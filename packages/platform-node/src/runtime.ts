import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type {
  BuildLogPage,
  BuildRunRowApi,
  BuildStatsApi,
  ConfigResponse,
  DeploymentPlanPreview,
  DeploymentProjectInspectionResponse,
  GitInfoResponse,
  HealthResponse,
  JdkDetectionResponse,
  PipelineListItem,
  PipelineStep,
  ProjectInspectionResponse,
  RunEventEnvelope,
  ScanResponse,
  StartJobResponse,
} from '@gfos-build/contracts';
import type {
  BuildCompletionStatus,
  BuildStep,
  BuildStepResult,
  DeploymentWorkflowDefinition,
  Pipeline,
  RunResult,
  ScanEvent,
} from '@gfos-build/domain';
import { buildCommandString } from '@gfos-build/domain';
import {
  BuildExecutor,
  BuildRunner,
  CachedScanner,
  DeploymentWorkflowService,
  detectJdks,
  NodeExecutor,
  PipelineRunner,
  RepositoryScanner,
  inspectMavenProject,
  inspectNodeProject,
} from '@gfos-build/application';
import {
  AppDatabase,
  type IDatabase,
} from './database.js';
import { NodeFileSystem } from './file-system.js';
import { loadSettings, saveConfigPatch } from './loader.js';
import {
  getConfigPath,
  getDbPath,
  getScanCacheDir,
} from './paths.js';
import { NodeGitInfoReader } from './git-info.js';
import { NodeProcessRunner } from './process-runner.js';
import { resolvePipeline, resolveStep } from './resolver.js';
import { FileScanCacheStore } from './scan-cache.js';
import {
  buildStepConfigSchema,
  deploymentWorkflowConfigSchema,
  pipelineConfigSchema,
  type AppConfig,
  type BuildStepConfig,
  type DeploymentWorkflowConfig,
  type PipelineConfig,
} from './schema.js';

const DEFAULT_SCAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SCAN_JOB_TTL_MS = 5 * 60 * 1000;
const MAX_JOB_HISTORY = 20_000;

interface RuntimeJob {
  jobId: string;
  controller: AbortController | null;
  history: RunEventEnvelope[];
  listeners: Set<(event: RunEventEnvelope) => void>;
  done: boolean;
}

export interface AppRuntimeOptions {
  version: string;
  stateRootDir?: string;
  settingsPath?: string;
}

export class AppRuntime {
  private readonly db: IDatabase;
  private readonly fs: NodeFileSystem;
  private readonly processRunner: NodeProcessRunner;
  private readonly gitInfoReader: NodeGitInfoReader;
  private readonly scanner: CachedScanner;
  private readonly buildRunner: BuildRunner;
  private readonly pipelineRunner: PipelineRunner;
  private readonly deploymentWorkflowService: DeploymentWorkflowService;
  private readonly startedAt = Date.now();
  private readonly jobs = new Map<string, RuntimeJob>();
  private readonly stateRootDir: string | undefined;

  constructor(private readonly options: AppRuntimeOptions) {
    this.stateRootDir = options.stateRootDir;
    this.fs = new NodeFileSystem();
    this.processRunner = new NodeProcessRunner();
    this.gitInfoReader = new NodeGitInfoReader();
    // Validate settings eagerly so startup can use the same recovery flow as schema failures.
    loadSettings(this.getSettingsPath());
    this.scanner = new CachedScanner(
      new RepositoryScanner(this.fs),
      new FileScanCacheStore(getScanCacheDir(this.stateRootDir)),
    );
    this.buildRunner = new BuildRunner(
      new BuildExecutor(this.processRunner),
      new NodeExecutor(this.processRunner),
      this.fs,
    );
    this.db = new AppDatabase(getDbPath(this.stateRootDir));
    this.pipelineRunner = new PipelineRunner(this.buildRunner, this.db, this.gitInfoReader);
    this.deploymentWorkflowService = new DeploymentWorkflowService(this.fs, this.processRunner);
  }

  getHealth(): HealthResponse {
    return {
      version: this.options.version,
      uptime: Date.now() - this.startedAt,
      platform: process.platform,
    };
  }

  getConfig(): ConfigResponse {
    const { config, configPath } = loadSettings(this.getSettingsPath());
    return { config, configPath };
  }

  getSettingsSnapshot(): { config: AppConfig; configPath: string } {
    const { config, configPath } = loadSettings(this.getSettingsPath());
    return { config, configPath };
  }

  saveConfig(patch: Record<string, unknown>): { ok: boolean } {
    saveConfigPatch(patch, this.getSettingsPath());
    return { ok: true };
  }

  listPipelines(): PipelineListItem[] {
    const config = this.getSettings();
    const lastRuns = this.db.getLastRunsByPipeline();
    return this.db.listPipelineDefinitions().map((saved) => {
      const resolved = resolvePipeline(saved.name, this.normalizePipelineDefinition(saved.definition), config);
      const lastRun = lastRuns[saved.name] ?? null;
      return {
        name: saved.name,
        description: saved.definition.description,
        failFast: saved.definition.failFast,
        steps: resolved.steps.map((step) => toPipelineStep(step)),
        lastRun,
      };
    });
  }

  createPipeline(input: { name: string; pipeline: unknown }): { ok: boolean; name: string } {
    const definition = pipelineConfigSchema.parse(input.pipeline);
    this.db.savePipelineDefinition(input.name, definition);
    return { ok: true, name: input.name };
  }

  updatePipeline(input: { name: string; pipeline: unknown }): { ok: boolean; name: string } {
    const definition = pipelineConfigSchema.parse(input.pipeline);
    this.db.savePipelineDefinition(input.name, definition);
    return { ok: true, name: input.name };
  }

  deletePipeline(name: string): void {
    this.db.deletePipelineDefinition(name);
  }

  getPipelineDefinition(name: string): PipelineConfig | null {
    const definition = this.db.getPipelineDefinition(name)?.definition;
    return definition ? this.normalizePipelineDefinition(definition) : null;
  }

  getResolvedPipeline(name: string): Pipeline {
    const config = this.getSettings();
    const saved = this.db.getPipelineDefinition(name);
    if (!saved) {
      throw new Error(`Pipeline "${name}" not found.`);
    }
    return resolvePipeline(saved.name, this.normalizePipelineDefinition(saved.definition), config);
  }

  getResumeIndex(name: string): number {
    return this.pipelineRunner.getResumeIndex(name);
  }

  runPipeline(input: { name: string; from?: string }): StartJobResponse {
    const config = this.getSettings();
    const saved = this.db.getPipelineDefinition(input.name);
    if (!saved) {
      throw new Error(`Pipeline "${input.name}" not found.`);
    }

    const pipeline = resolvePipeline(saved.name, this.normalizePipelineDefinition(saved.definition), config);
    const fromIndex = input.from ? resolveFromArg(pipeline, input.from) : 0;
    const jobId = randomUUID();
    const runId = this.db.createRun({
      jobId,
      kind: 'pipeline',
      workflowName: pipeline.name,
      title: pipeline.name,
    });
    const job = this.createJob(jobId, new AbortController());

    void this.runPipelineJob(job, pipeline, fromIndex, runId);
    return { jobId, runId };
  }

  runQuick(input: Record<string, unknown>): StartJobResponse {
    const config = this.getSettings();
    const quickStep = this.resolveQuickRunStep(input, config);
    const jobId = randomUUID();
    const runId = this.db.createRun({
      jobId,
      kind: 'quick',
      title: quickStep.label,
    });
    const job = this.createJob(jobId, new AbortController());

    void this.runQuickJob(job, quickStep, runId);
    return { jobId, runId };
  }

  async inspectDeploymentProject(projectPath: string): Promise<DeploymentProjectInspectionResponse> {
    const projectResult = await this.inspectProject(projectPath);
    const inspection = await this.deploymentWorkflowService.inspectProject(projectPath);
    return {
      project: projectResult.project,
      deployableCandidates: inspection.deployableCandidates,
    };
  }

  async previewDeploymentPlan(input: Record<string, unknown>): Promise<DeploymentPlanPreview> {
    const config = this.getSettings();
    const workflow = deploymentWorkflowConfigSchema.parse(input) as DeploymentWorkflowConfig;
    const environment = config.wildfly.environments[workflow.environmentName];
    if (!environment) {
      throw new Error(`WildFly environment "${workflow.environmentName}" not found.`);
    }
    return this.deploymentWorkflowService.preview({
      workflowName: 'preview',
      workflow: toDeploymentDefinition(workflow),
      environment,
    });
  }

  cancelJob(jobId: string): void {
    this.jobs.get(jobId)?.controller?.abort();
  }

  listRuns(opts?: { pipeline?: string; limit?: number }): BuildRunRowApi[] {
    return this.db.getRecentRuns({
      limit: opts?.limit ?? 100,
      pipeline: opts?.pipeline,
    });
  }

  getRunLogs(runId: number, opts?: { limit?: number; beforeSeq?: number }): BuildLogPage {
    return this.db.getBuildLogs(runId, opts);
  }

  getStats(): BuildStatsApi {
    return this.db.getBuildStats();
  }

  async getScan(noCache = false): Promise<ScanResponse> {
    const config = this.getSettings();
    let result: ScanResponse = { projects: [], durationMs: 0, fromCache: false, scannedAt: new Date(0).toISOString() };
    for await (const event of this.scanner.scan(toScanOptions(config), DEFAULT_SCAN_CACHE_TTL_MS, noCache)) {
      if (event.type === 'scan:done') {
        result = {
          projects: event.projects,
          durationMs: event.durationMs,
          fromCache: event.fromCache,
          scannedAt: event.scannedAt,
        };
      }
    }
    return result;
  }

  refreshScan(): StartJobResponse {
    const jobId = randomUUID();
    const job = this.createJob(jobId, null);
    void this.runScanJob(job);
    return { jobId, runId: null };
  }

  async inspectProject(projectPath: string): Promise<ProjectInspectionResponse> {
    const maven = await inspectMavenProject(this.fs, projectPath);
    if (maven) {
      return {
        project: {
          name: path.basename(projectPath),
          path: projectPath,
          depth: 0,
          rootName: 'local',
          buildSystem: 'maven',
          maven,
        },
      };
    }

    const node = await inspectNodeProject(this.fs, projectPath, false);
    return {
      project: node
        ? {
            name: path.basename(projectPath),
            path: projectPath,
            depth: 0,
            rootName: 'local',
            buildSystem: 'node',
            node,
          }
        : null,
    };
  }

  async detectJdks(baseDir: string): Promise<JdkDetectionResponse> {
    const jdks = await detectJdks(baseDir, this.fs);
    return { baseDir, jdks };
  }

  clearRunLogs(): void {
    this.db.clearBuildLogs();
  }

  clearRuns(): void {
    this.db.clearAllBuilds();
  }

  getGitInfo(projectPath: string): GitInfoResponse {
    return this.gitInfoReader.getInfo(projectPath);
  }

  getGitInfoBatch(paths: string[]): Promise<Record<string, GitInfoResponse>> {
    return this.gitInfoReader.getBatch(paths);
  }

  async *scanProjects(
    options?: { roots?: Record<string, string>; includeHidden?: boolean; exclude?: string[]; noCache?: boolean },
  ): AsyncGenerator<ScanEvent> {
    const config = this.getSettings();
    const scanOptions = {
      roots: options?.roots ?? config.roots,
      includeHidden: options?.includeHidden ?? config.scan.includeHidden,
      exclude: options?.exclude ?? config.scan.exclude,
    };
    for await (const event of this.scanner.scan(scanOptions, DEFAULT_SCAN_CACHE_TTL_MS, options?.noCache ?? false)) {
      yield event;
    }
  }

  subscribeRun(jobId: string, listener: (event: RunEventEnvelope) => void): () => void {
    const job = this.jobs.get(jobId);
    if (!job) {
      return () => undefined;
    }

    for (const event of job.history) {
      listener(event);
    }

    job.listeners.add(listener);
    return () => {
      job.listeners.delete(listener);
    };
  }

  watchGitHeads(onChange: () => void): () => void {
    return this.gitInfoReader.watchHeads(onChange);
  }

  close(): void {
    this.gitInfoReader.close();
    this.db.close();
    this.jobs.clear();
  }

  private createJob(jobId: string, controller: AbortController | null): RuntimeJob {
    const job: RuntimeJob = {
      jobId,
      controller,
      history: [],
      listeners: new Set(),
      done: false,
    };
    this.jobs.set(jobId, job);
    return job;
  }

  private async runPipelineJob(job: RuntimeJob, pipeline: Pipeline, fromIndex: number, runId: number): Promise<void> {
    try {
      const startedAt = Date.now();
      const results: BuildStepResult[] = [];
      let failedAt: number | undefined;

      this.emit(job, {
        type: 'event',
        jobId: job.jobId,
        event: { type: 'run:start', startedAt, runId },
      });

      for (let index = fromIndex; index < pipeline.steps.length; index++) {
        const step = pipeline.steps[index]!;
        const stepResults = await this.executePipelineStep(job, pipeline, step, index, runId);
        results.push(...stepResults);
        if (stepResults.some((result) => result.status === 'failed')) {
          failedAt = index;
          if (pipeline.failFast) {
            break;
          }
        }
      }

      const result: RunResult = {
        results,
        status: deriveRunStatus(results),
        success: !results.some((entry) => entry.status === 'failed'),
        durationMs: Date.now() - startedAt,
        stoppedAt: failedAt,
      };
      this.db.finishRun({
        id: runId,
        status: result.status,
        durationMs: result.durationMs,
        stoppedAt: failedAt,
      });
      this.emit(job, {
        type: 'event',
        jobId: job.jobId,
        event: { type: 'run:done', result },
      });
      this.finishJob(job);
    } catch (error) {
      const durationMs = 0;
      this.db.finishRun({ id: runId, status: 'failed', durationMs });
      this.failJob(job, error);
    }
  }

  private async executePipelineStep(
    job: RuntimeJob,
    pipeline: Pipeline,
    step: BuildStep,
    index: number,
    runId: number,
  ): Promise<BuildStepResult[]> {
    if (
      step.buildSystem === 'maven' &&
      step.mode === 'deploy' &&
      step.deploy
    ) {
      return this.executePipelineDeploymentStep(job, pipeline, step, index, runId);
    }

    return this.executeStandardPipelineStep(job, pipeline, step, index, runId);
  }

  private async executeStandardPipelineStep(
    job: RuntimeJob,
    pipeline: Pipeline,
    step: BuildStep,
    index: number,
    runId: number,
  ): Promise<BuildStepResult[]> {
    const results: BuildStepResult[] = [];
    let persistedStepRunId: number | undefined;
    let logSeq = 0;

    for await (const event of this.buildRunner.run(step, index, pipeline.steps.length, pipeline.name, job.controller?.signal)) {
      if (event.type === 'step:start') {
        const gitInfo = this.gitInfoReader.getInfo(event.step.path);
        persistedStepRunId = this.db.createStepRun({
          runId,
          jobId: job.jobId,
          workflowKind: 'pipeline',
          workflowName: pipeline.name,
          projectPath: event.step.path,
          projectName: event.step.label,
          buildSystem: event.step.buildSystem,
          packageManager: event.step.buildSystem === 'node' ? event.step.packageManager : undefined,
          executionMode: event.step.buildSystem !== 'wildfly' ? event.step.executionMode : undefined,
          command: toCommandString(event.step),
          javaHome: event.step.buildSystem === 'maven' ? event.step.javaHome : undefined,
          stepIndex: index,
          stepLabel: event.step.label,
          branch: gitInfo.branch ?? undefined,
        });
        this.emit(job, {
          type: 'event',
          jobId: job.jobId,
          event: { ...event, runId: persistedStepRunId },
        });
        continue;
      }

      if (event.type === 'step:output' && persistedStepRunId !== undefined) {
        this.db.appendStepLog(persistedStepRunId, logSeq++, event.stream, event.line);
      }

      if (event.type === 'step:done') {
        results.push({
          step: event.step,
          exitCode: event.exitCode,
          durationMs: event.durationMs,
          status: event.status,
          success: event.success,
        });
        if (persistedStepRunId !== undefined) {
          this.db.finishStepRun({
            id: persistedStepRunId,
            exitCode: event.exitCode,
            durationMs: event.durationMs,
            status: event.status,
          });
          persistedStepRunId = undefined;
          logSeq = 0;
        }
      }

      if (event.type !== 'run:start' && event.type !== 'run:done') {
        this.emit(job, { type: 'event', jobId: job.jobId, event });
      }
    }

    return results;
  }

  private async executePipelineDeploymentStep(
    job: RuntimeJob,
    pipeline: Pipeline,
    step: Extract<BuildStep, { buildSystem: 'maven' }>,
    index: number,
    runId: number,
  ): Promise<BuildStepResult[]> {
    const config = this.getSettings();
    if (!step.deploy) {
      throw new Error(`Pipeline step "${step.label}" is missing deployment settings.`);
    }
    const environment = config.wildfly.environments[step.deploy.environmentName];
    if (!environment) {
      throw new Error(`WildFly environment "${step.deploy.environmentName}" not found.`);
    }

    const workflow = toDeploymentDefinition({
      projectPath: step.path,
      artifactSelector: step.deploy.artifactSelector,
      environmentName: step.deploy.environmentName,
      standaloneProfileName: step.deploy.standaloneProfileName,
      cleanupPresetName: step.deploy.cleanupPresetName,
      startupPresetName: step.deploy.startupPresetName,
      deployMode: step.deploy.deployMode,
      startServer: step.deploy.startServer,
    });
    const results: BuildStepResult[] = [];
    let persistedStepRunId: number | undefined;
    let logSeq = 0;

    for await (const event of this.deploymentWorkflowService.run(
      {
        workflowName: `${pipeline.name}:${step.label}`,
        workflow,
        environment,
      },
      job.controller?.signal,
    )) {
      if (event.type === 'step:start') {
        const pipelineStep = {
          ...event.step,
          label: `${step.label}: ${event.step.label}`,
          path: step.path,
        };
        const gitInfo = this.gitInfoReader.getInfo(step.path);
        persistedStepRunId = this.db.createStepRun({
          runId,
          jobId: job.jobId,
          workflowKind: 'pipeline',
          workflowName: pipeline.name,
          projectPath: pipelineStep.path,
          projectName: pipelineStep.label,
          buildSystem: pipelineStep.buildSystem,
          executionMode: pipelineStep.buildSystem !== 'wildfly' ? pipelineStep.executionMode : undefined,
          command: toCommandString(pipelineStep),
          javaHome: pipelineStep.buildSystem === 'maven' ? pipelineStep.javaHome : undefined,
          stepIndex: index,
          stepLabel: pipelineStep.label,
          branch: gitInfo.branch ?? undefined,
        });
        this.emit(job, {
          type: 'event',
          jobId: job.jobId,
          event: {
            ...event,
            step: pipelineStep,
            index,
            total: pipeline.steps.length,
            runId: persistedStepRunId,
          },
        });
        continue;
      }

      if (event.type === 'step:output' && persistedStepRunId !== undefined) {
        this.db.appendStepLog(persistedStepRunId, logSeq++, event.stream, event.line);
      }

      if (event.type === 'step:done') {
        const pipelineStep = {
          ...event.step,
          label: `${step.label}: ${event.step.label}`,
          path: step.path,
        };
        results.push({
          step: pipelineStep,
          exitCode: event.exitCode,
          durationMs: event.durationMs,
          status: event.status,
          success: event.success,
        });
        if (persistedStepRunId !== undefined) {
          this.db.finishStepRun({
            id: persistedStepRunId,
            exitCode: event.exitCode,
            durationMs: event.durationMs,
            status: event.status,
          });
          persistedStepRunId = undefined;
          logSeq = 0;
        }
        this.emit(job, {
          type: 'event',
          jobId: job.jobId,
          event: { ...event, step: pipelineStep, index, total: pipeline.steps.length },
        });
        continue;
      }

      if (event.type === 'step:output') {
        this.emit(job, { type: 'event', jobId: job.jobId, event });
      }
    }

    return results;
  }

  private async runQuickJob(job: RuntimeJob, step: BuildStep, runId: number): Promise<void> {
    if (step.buildSystem === 'maven' && step.mode === 'deploy' && step.deploy) {
      await this.runQuickDeploymentJob(job, step, runId);
      return;
    }

    const startedAt = Date.now();
    const results: BuildStepResult[] = [];
    let persistedStepRunId: number | undefined;
    let logSeq = 0;

    this.emit(job, { type: 'event', jobId: job.jobId, event: { type: 'run:start', startedAt, runId } });

    try {
      for await (const event of this.buildRunner.run(step, 0, 1, undefined, job.controller?.signal)) {
        if (event.type === 'step:start') {
          const gitInfo = this.gitInfoReader.getInfo(event.step.path);
          persistedStepRunId = this.db.createStepRun({
            runId,
            jobId: job.jobId,
            workflowKind: 'quick',
            projectPath: event.step.path,
            projectName: event.step.label,
            buildSystem: event.step.buildSystem,
            packageManager: event.step.buildSystem === 'node' ? event.step.packageManager : undefined,
            executionMode: event.step.buildSystem !== 'wildfly' ? event.step.executionMode : undefined,
            command: toCommandString(event.step),
            javaHome: event.step.buildSystem === 'maven' ? event.step.javaHome : undefined,
            stepIndex: 0,
            stepLabel: event.step.label,
            branch: gitInfo.branch ?? undefined,
          });
          this.emit(job, {
            type: 'event',
            jobId: job.jobId,
            event: { ...event, runId: persistedStepRunId },
          });
          continue;
        }

        if (event.type === 'step:output' && persistedStepRunId !== undefined) {
          this.db.appendStepLog(persistedStepRunId, logSeq++, event.stream, event.line);
        }

        if (event.type === 'step:done') {
          results.push({
            step: event.step,
            exitCode: event.exitCode,
            durationMs: event.durationMs,
            status: event.status,
            success: event.success,
          });
          if (persistedStepRunId !== undefined) {
            this.db.finishStepRun({
              id: persistedStepRunId,
              exitCode: event.exitCode,
              durationMs: event.durationMs,
              status: event.status,
            });
          }
        }

        this.emit(job, { type: 'event', jobId: job.jobId, event });
      }

      const status = deriveRunStatus(results);
      const result: RunResult = {
        results,
        status,
        success: status !== 'failed',
        durationMs: Date.now() - startedAt,
      };
      this.db.finishRun({
        id: runId,
        status,
        durationMs: result.durationMs,
      });
      this.emit(job, { type: 'event', jobId: job.jobId, event: { type: 'run:done', result } });
      this.finishJob(job);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      this.db.finishRun({ id: runId, status: 'failed', durationMs });
      if (persistedStepRunId !== undefined) {
        this.db.finishStepRun({ id: persistedStepRunId, exitCode: 1, durationMs, status: 'failed' });
      }
      this.failJob(job, error);
    }
  }

  private async runQuickDeploymentJob(
    job: RuntimeJob,
    step: Extract<BuildStep, { buildSystem: 'maven' }>,
    runId: number,
  ): Promise<void> {
    const config = this.getSettings();
    const deploy = step.deploy;
    if (!deploy) {
      throw new Error(`Quick run "${step.label}" is missing deployment settings.`);
    }
    const environment = config.wildfly.environments[deploy.environmentName];
    if (!environment) {
      throw new Error(`WildFly environment "${deploy.environmentName}" not found.`);
    }

    let persistedStepRunId: number | undefined;
    let logSeq = 0;

    try {
      for await (const event of this.deploymentWorkflowService.run(
        {
          workflowName: step.label,
          workflow: {
            projectPath: step.path,
            artifactSelector: deploy.artifactSelector,
            environmentName: deploy.environmentName,
            standaloneProfileName: deploy.standaloneProfileName,
            cleanupPresetName: deploy.cleanupPresetName,
            startupPresetName: deploy.startupPresetName,
            deployMode: deploy.deployMode,
            startServer: deploy.startServer,
          },
          environment,
        },
        job.controller?.signal,
      )) {
        if (event.type === 'step:start') {
          const gitInfo = this.gitInfoReader.getInfo(event.step.path);
          persistedStepRunId = this.db.createStepRun({
            runId,
            jobId: job.jobId,
            workflowKind: 'quick',
            projectPath: event.step.path,
            projectName: event.step.label,
            buildSystem: event.step.buildSystem,
            command: toCommandString(event.step),
            stepIndex: event.index,
            stepLabel: event.step.label,
            branch: gitInfo.branch ?? undefined,
          });
          this.emit(job, { type: 'event', jobId: job.jobId, event: { ...event, runId: persistedStepRunId } });
          continue;
        }

        if (event.type === 'step:output' && persistedStepRunId !== undefined) {
          this.db.appendStepLog(persistedStepRunId, logSeq++, event.stream, event.line);
        }

        if (event.type === 'step:done' && persistedStepRunId !== undefined) {
          this.db.finishStepRun({
            id: persistedStepRunId,
            exitCode: event.exitCode,
            durationMs: event.durationMs,
            status: event.status,
          });
          persistedStepRunId = undefined;
          logSeq = 0;
        }

        if (event.type === 'run:done') {
          this.db.finishRun({
            id: runId,
            status: event.result.status,
            durationMs: event.result.durationMs,
          });
        }

        this.emit(job, { type: 'event', jobId: job.jobId, event });
      }

      this.finishJob(job);
    } catch (error) {
      this.db.finishRun({ id: runId, status: 'failed', durationMs: 0 });
      this.failJob(job, error);
    }
  }

  private async runScanJob(job: RuntimeJob): Promise<void> {
    try {
      const config = this.getSettings();
      for await (const event of this.scanner.scan(toScanOptions(config), DEFAULT_SCAN_JOB_TTL_MS, true)) {
        this.emit(job, { type: 'event', jobId: job.jobId, event });
      }
      this.finishJob(job);
    } catch (error) {
      this.failJob(job, error);
    }
  }

  private emit(job: RuntimeJob, envelope: RunEventEnvelope): void {
    if (job.history.length >= MAX_JOB_HISTORY) {
      job.history.shift();
    }
    job.history.push(envelope);
    for (const listener of job.listeners) {
      listener(envelope);
    }
  }

  private finishJob(job: RuntimeJob): void {
    if (job.done) return;
    job.done = true;
    this.emit(job, { type: 'done', jobId: job.jobId });
  }

  private failJob(job: RuntimeJob, error: unknown): void {
    if (job.done) return;
    job.done = true;
    this.emit(job, {
      type: 'error',
      jobId: job.jobId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  private getSettings(): AppConfig {
    return loadSettings(this.getSettingsPath()).config;
  }

  private getSettingsPath(): string {
    return this.options.settingsPath ?? getConfigPath(this.stateRootDir);
  }

  private normalizePipelineDefinition(definition: PipelineConfig): PipelineConfig {
    return {
      ...definition,
      steps: definition.steps.map((step) => {
        if (
          step.buildSystem !== 'maven' ||
          step.mode !== 'deploy' ||
          step.deploy ||
          !step.deploymentWorkflowName
        ) {
          return step;
        }

        const legacyWorkflow = this.db.getDeploymentWorkflowDefinition(step.deploymentWorkflowName);
        if (!legacyWorkflow) {
          return {
            ...step,
            deploy: {
              artifactSelector: { kind: 'auto' },
              environmentName: '',
              standaloneProfileName: '',
              startServer: true,
            },
          };
        }

        return {
          ...step,
          deploy: {
            artifactSelector: legacyWorkflow.definition.artifactSelector,
            environmentName: legacyWorkflow.definition.environmentName,
            standaloneProfileName: legacyWorkflow.definition.standaloneProfileName,
            cleanupPresetName: legacyWorkflow.definition.cleanupPresetName,
            startupPresetName: legacyWorkflow.definition.startupPresetName,
            deployMode: legacyWorkflow.definition.deployMode,
            startServer: legacyWorkflow.definition.startServer,
          },
        };
      }),
    };
  }

  private resolveQuickRunStep(input: Record<string, unknown>, config: AppConfig): BuildStep {
    const buildSystem = input['buildSystem'];
    if (buildSystem === 'node') {
      return resolveStep(
        buildStepConfigSchema.parse({
          path: input['path'],
          label: input['label'],
          buildSystem: 'node',
          commandType: input['commandType'] ?? 'script',
          script: input['script'],
          args: input['args'] ?? [],
          executionMode: input['executionMode'] ?? 'internal',
        }) as BuildStepConfig,
        config,
      );
    }

    return resolveStep(
      buildStepConfigSchema.parse({
        path: input['path'],
        label: input['label'],
        buildSystem: 'maven',
        mode: input['mode'] ?? 'build',
        modulePath: input['modulePath'],
        submoduleBuildStrategy: input['submoduleBuildStrategy'],
        goals: input['goals'],
        optionKeys: input['optionKeys'],
        profileStates: input['profileStates'],
        extraOptions: input['extraOptions'],
        javaVersion: input['javaVersion'] ?? input['java'],
        executionMode: input['executionMode'] ?? 'internal',
        deploy: input['deploy'],
      }) as BuildStepConfig,
      config,
    );
  }

}

function resolveFromArg(pipeline: Pipeline, fromArg: string): number {
  const numeric = Number.parseInt(fromArg, 10);
  if (!Number.isNaN(numeric)) {
    if (numeric < 1 || numeric > pipeline.steps.length) {
      throw new Error(`Step ${numeric} is out of range for pipeline "${pipeline.name}".`);
    }
    return numeric - 1;
  }

  const index = pipeline.steps.findIndex((step) => step.label.toLowerCase() === fromArg.toLowerCase());
  if (index === -1) {
    throw new Error(`Step "${fromArg}" was not found in pipeline "${pipeline.name}".`);
  }
  return index;
}

function toPipelineStep(step: BuildStep): PipelineStep {
  if (step.buildSystem === 'node') {
    return {
      label: step.label,
      path: step.path,
      buildSystem: step.buildSystem,
      packageManager: step.packageManager,
      executionMode: step.executionMode,
      commandType: step.commandType,
      script: step.script,
      args: step.args,
    };
  }

  if (step.buildSystem === 'wildfly') {
    return {
      label: step.label,
      path: step.path,
      buildSystem: step.buildSystem,
      environmentName: step.environmentName,
      deployMode: step.deployMode,
      command: step.command,
    };
  }

  return {
    label: step.label,
    path: step.path,
    buildSystem: step.buildSystem,
    executionMode: step.executionMode,
    modulePath: step.modulePath,
    submoduleBuildStrategy: step.submoduleBuildStrategy,
    goals: step.goals,
    optionKeys: step.optionKeys,
    profileStates: step.profileStates,
    extraOptions: step.extraOptions,
    mavenExecutable: step.mavenExecutable,
    javaVersion: step.javaVersion,
    javaHome: step.javaHome,
    mode: step.mode,
    deploy: step.deploy,
  };
}

function toCommandString(step: BuildStep): string {
  return buildCommandString(step);
}

function deriveRunStatus(results: BuildStepResult[]): BuildCompletionStatus {
  if (results.some((result) => result.status === 'failed')) {
    return 'failed';
  }
  if (results.some((result) => result.status === 'launched')) {
    return 'launched';
  }
  return 'success';
}

function toScanOptions(config: AppConfig): { roots: Record<string, string>; includeHidden: boolean; exclude: string[] } {
  return {
    roots: config.roots,
    includeHidden: config.scan.includeHidden,
    exclude: config.scan.exclude,
  };
}

function toDeploymentDefinition(config: DeploymentWorkflowConfig): DeploymentWorkflowDefinition {
  return {
    description: config.description,
    projectPath: config.projectPath,
    artifactSelector: config.artifactSelector,
    environmentName: config.environmentName,
    standaloneProfileName: config.standaloneProfileName,
    cleanupPresetName: config.cleanupPresetName,
    startupPresetName: config.startupPresetName,
    deployMode: config.deployMode,
    startServer: config.startServer,
  };
}
