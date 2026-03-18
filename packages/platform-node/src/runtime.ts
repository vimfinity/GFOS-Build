import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type {
  BuildLogPage,
  BuildRunRowApi,
  BuildStatsApi,
  ConfigResponse,
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
  Pipeline,
  RunResult,
  ScanEvent,
} from '@gfos-build/domain';
import { buildCommandString } from '@gfos-build/domain';
import {
  BuildExecutor,
  BuildRunner,
  CachedScanner,
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
  pipelineConfigSchema,
  type AppConfig,
  type BuildStepConfig,
  type PipelineConfig,
} from './schema.js';

const DEFAULT_SCAN_CACHE_TTL_MS = 5 * 60 * 1000;
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
      const resolved = resolvePipeline(saved.name, saved.definition, config);
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
    return this.db.getPipelineDefinition(name)?.definition ?? null;
  }

  getResolvedPipeline(name: string): Pipeline {
    const config = this.getSettings();
    const saved = this.db.getPipelineDefinition(name);
    if (!saved) {
      throw new Error(`Pipeline "${name}" not found.`);
    }
    return resolvePipeline(saved.name, saved.definition, config);
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

    const pipeline = resolvePipeline(saved.name, saved.definition, config);
    const fromIndex = input.from ? resolveFromArg(pipeline, input.from) : 0;
    const jobId = randomUUID();
    const runId = this.db.createRun({
      jobId,
      kind: 'pipeline',
      pipelineName: pipeline.name,
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
    let result: ScanResponse = { projects: [], durationMs: 0, fromCache: false };
    for await (const event of this.scanner.scan(toScanOptions(config), DEFAULT_SCAN_CACHE_TTL_MS, noCache)) {
      if (event.type === 'scan:done') {
        result = {
          projects: event.projects,
          durationMs: event.durationMs,
          fromCache: event.fromCache,
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

  close(): void {
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
      for await (const event of this.pipelineRunner.run(pipeline, fromIndex, job.jobId, job.controller?.signal, runId)) {
        this.emit(job, { type: 'event', jobId: job.jobId, event });
      }
      this.finishJob(job);
    } catch (error) {
      this.failJob(job, error);
    }
  }

  private async runQuickJob(job: RuntimeJob, step: BuildStep, runId: number): Promise<void> {
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
            projectPath: event.step.path,
            projectName: event.step.label,
            buildSystem: event.step.buildSystem,
            packageManager: event.step.buildSystem === 'node' ? event.step.packageManager : undefined,
            executionMode: event.step.executionMode,
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
        modulePath: input['modulePath'],
        submoduleBuildStrategy: input['submoduleBuildStrategy'],
        goals: input['goals'],
        optionKeys: input['optionKeys'],
        profileStates: input['profileStates'],
        extraOptions: input['extraOptions'],
        javaVersion: input['javaVersion'] ?? input['java'],
        executionMode: input['executionMode'] ?? 'internal',
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

  return {
    label: step.label,
    path: step.path,
    buildSystem: step.buildSystem,
    executionMode: step.executionMode,
    modulePath: step.modulePath,
    goals: step.goals,
    optionKeys: step.optionKeys,
    profileStates: step.profileStates,
    extraOptions: step.extraOptions,
    mavenExecutable: step.mavenExecutable,
    javaVersion: step.javaVersion,
    javaHome: step.javaHome,
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
