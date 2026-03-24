import path from 'node:path';
import type {
  BuildEvent,
  DeployableArtifactCandidate,
  DeploymentWorkflowDefinition,
  WildFlyCleanupPreset,
  WildFlyDeployMode,
  WildFlyEnvironmentConfig,
  WildFlyOperationStep,
  StandaloneProfileConfig,
  WildFlyStartupPreset,
} from '@gfos-build/domain';
import type { DeploymentPlanPreview } from '@gfos-build/contracts';
import type { FileSystem } from './file-system.js';
import type { ProcessRunner } from './process-runner.js';
import { inspectMavenProject } from './maven-project.js';

export interface DeploymentWorkflowContext {
  workflowName: string;
  workflow: DeploymentWorkflowDefinition;
  environment: WildFlyEnvironmentConfig;
}

export class DeploymentWorkflowService {
  constructor(
    private readonly fs: FileSystem,
    private readonly processRunner: ProcessRunner,
  ) {}

  async inspectProject(projectPath: string): Promise<{ deployableCandidates: DeployableArtifactCandidate[] }> {
    const project = await inspectMavenProject(this.fs, projectPath);
    return {
      deployableCandidates: project?.deployableCandidates ?? [],
    };
  }

  async preview(context: DeploymentWorkflowContext): Promise<DeploymentPlanPreview> {
    const candidate = await this.resolveSelectedCandidate(context.workflow.projectPath, context.workflow.artifactSelector);
    const environment = normalizeEnvironment(context.environment);
    const artifactPattern = buildExpectedArtifactPattern(context.workflow.projectPath, candidate);
    const cleanupPaths = resolveCleanupPaths(environment, context.environment.cleanupPresets[context.workflow.cleanupPresetName ?? '']);
    const startupCommand = context.workflow.startServer
      ? buildStartupCommand(
          environment,
          context.environment.standaloneProfiles[context.workflow.standaloneProfileName],
          context.environment.startupPresets[context.workflow.startupPresetName ?? ''],
        )
      : null;

    return {
      recommendedDeployMode: context.workflow.deployMode ?? recommendDeployMode(context.workflow),
      resolvedArtifactPattern: artifactPattern,
      resolvedStartupCommand: startupCommand,
      cleanupPaths,
      warnings: candidate.packaging === 'jar' ? ['Selected artifact uses JAR packaging and may not be deployable in all WildFly setups.'] : [],
    };
  }

  async *run(context: DeploymentWorkflowContext, signal?: AbortSignal): AsyncGenerator<BuildEvent> {
    const total = context.workflow.startServer ? 3 : 2;
    yield { type: 'run:start', startedAt: Date.now() };

    const candidate = await this.resolveSelectedCandidate(context.workflow.projectPath, context.workflow.artifactSelector);
    const artifactPath = await this.resolveBuiltArtifactPath(context.workflow.projectPath, candidate);
    const environment = normalizeEnvironment(context.environment);
    const deployMode = context.workflow.deployMode ?? recommendDeployMode(context.workflow);

    const cleanupStep = this.makeWildFlyStep('wildfly-cleanup', 'Clean WildFly', context, `cleanup ${environment.baseDir}`);
    yield { type: 'step:start', step: cleanupStep, index: 0, total, pipelineName: context.workflowName };
    const cleanupWarnings = await this.executeCleanup(environment, context.environment.cleanupPresets[context.workflow.cleanupPresetName ?? ''], artifactPath);
    for (const line of cleanupWarnings) {
      yield { type: 'step:output', stream: 'stdout', line };
    }
    yield { type: 'step:done', step: cleanupStep, index: 0, total, exitCode: 0, durationMs: 0, status: 'success', success: true };

    const deployStep = this.makeWildFlyStep('wildfly-deploy', 'Deploy artifact', context, this.describeDeployCommand(deployMode, artifactPath, environment));
    yield { type: 'step:start', step: deployStep, index: 1, total, pipelineName: context.workflowName };
    for await (const event of this.executeDeploy(deployMode, artifactPath, candidate, environment, signal)) {
      if (event.type === 'stdout' || event.type === 'stderr') {
        yield { type: 'step:output', stream: event.type, line: event.line! };
      } else {
        yield { type: 'step:done', step: deployStep, index: 1, total, exitCode: event.exitCode!, durationMs: event.durationMs!, status: event.exitCode === 0 ? 'success' : 'failed', success: event.exitCode === 0 };
        if (event.exitCode !== 0) {
          yield { type: 'run:done', result: { results: [], status: 'failed', success: false, durationMs: event.durationMs!, stoppedAt: 1 } };
          return;
        }
      }
    }

    if (context.workflow.startServer) {
      const startupPreset = context.environment.startupPresets[context.workflow.startupPresetName ?? ''];
      const standaloneProfile = context.environment.standaloneProfiles[context.workflow.standaloneProfileName];
      const startupCommand = buildStartupCommand(environment, standaloneProfile, startupPreset);
      const startupStep = this.makeWildFlyStep('wildfly-startup', 'Start WildFly', context, startupCommand);
      yield { type: 'step:start', step: startupStep, index: 2, total, pipelineName: context.workflowName };
      for await (const event of this.executeStartup(environment, standaloneProfile, startupPreset, signal)) {
        if (event.type === 'stdout' || event.type === 'stderr') {
          yield { type: 'step:output', stream: event.type, line: event.line! };
        } else {
          const status = event.exitCode === 0 ? 'launched' : 'failed';
          yield { type: 'step:done', step: startupStep, index: 2, total, exitCode: event.exitCode!, durationMs: event.durationMs!, status, success: status !== 'failed' };
          yield { type: 'run:done', result: { results: [], status, success: status !== 'failed', durationMs: event.durationMs! } };
          return;
        }
      }
    }

    yield { type: 'run:done', result: { results: [], status: 'success', success: true, durationMs: 0 } };
  }

  private makeWildFlyStep(kind: WildFlyOperationStep['kind'], label: string, context: DeploymentWorkflowContext, command: string): WildFlyOperationStep {
    return {
      path: context.workflow.projectPath,
      buildSystem: 'wildfly',
      label,
      kind,
      environmentName: context.workflow.environmentName,
      deployMode: context.workflow.deployMode ?? recommendDeployMode(context.workflow),
      command,
    };
  }

  private async resolveSelectedCandidate(projectPath: string, selector: DeploymentWorkflowDefinition['artifactSelector']): Promise<DeployableArtifactCandidate> {
    const inspection = await this.inspectProject(projectPath);
    const candidates = inspection.deployableCandidates;
    if (candidates.length === 0) {
      throw new Error(`No deployable Maven artifacts were detected in "${projectPath}".`);
    }

    if (selector.kind === 'module') {
      const match = candidates.find((candidate) => candidate.modulePath === (selector.modulePath ?? '') && candidate.packaging === selector.packaging);
      if (!match) {
        throw new Error(`Configured deployable artifact "${selector.modulePath ?? '.'}" (${selector.packaging ?? 'unknown'}) is no longer available.`);
      }
      return match;
    }

    if (selector.kind === 'explicit-file') {
      const match = candidates.find((candidate) => candidate.modulePath === (selector.modulePath ?? '') && candidate.packaging === selector.packaging);
      if (!match) {
        throw new Error(`Configured explicit artifact "${selector.fileName ?? ''}" cannot be mapped to a Maven module anymore.`);
      }
      return match;
    }

    if (candidates.length === 1) {
      return candidates[0]!;
    }

    const preferred = candidates.find((candidate) => candidate.packaging === 'ear') ?? candidates.find((candidate) => candidate.packaging === 'war');
    if (!preferred) {
      throw new Error('Multiple deployable candidates found. Select a specific module or artifact file.');
    }
    return preferred;
  }

  private async resolveBuiltArtifactPath(projectPath: string, candidate: DeployableArtifactCandidate): Promise<string> {
    const modulePath = candidate.modulePath ? path.join(projectPath, candidate.modulePath) : projectPath;
    const buildDir = candidate.declaredBuildDirectory
      ? path.resolve(modulePath, candidate.declaredBuildDirectory)
      : path.join(modulePath, 'target');
    if (!(await this.fs.exists(buildDir))) {
      throw new Error(`Expected build output directory "${buildDir}" does not exist. The artifact may not have been built yet.`);
    }

    const entries = await this.fs.readDir(buildDir);
    const matchingFiles = entries
      .filter((entry) => !entry.isDirectory() && entry.name.toLowerCase().endsWith(`.${candidate.packaging}`))
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('original-') && !name.includes('-sources.') && !name.includes('-javadoc.'));

    const exact = candidate.expectedDefaultFileName ? matchingFiles.find((name) => name === candidate.expectedDefaultFileName) : undefined;
    if (exact) {
      return path.join(buildDir, exact);
    }
    if (matchingFiles.length === 1) {
      return path.join(buildDir, matchingFiles[0]!);
    }
    if (matchingFiles.length === 0) {
      throw new Error(`No built ${candidate.packaging.toUpperCase()} artifact found in "${buildDir}". Expected pattern "${buildExpectedArtifactPattern(projectPath, candidate)}".`);
    }
    throw new Error(`Multiple built artifacts found in "${buildDir}": ${matchingFiles.join(', ')}. Configure an explicit file selection.`);
  }

  private async executeCleanup(environment: ResolvedWildFlyEnvironment, preset: WildFlyCleanupPreset | undefined, artifactPath: string): Promise<string[]> {
    const lines: string[] = [];
    if (!preset) {
      return ['No cleanup preset selected.'];
    }
    if (preset.removePreviousDeployment) {
      const deploymentTarget = path.join(environment.deploymentsDir, path.basename(artifactPath));
      await this.fs.rm?.(deploymentTarget, { force: true });
      lines.push(`Removed previous deployment: ${deploymentTarget}`);
      if (preset.removeMarkerFiles) {
        for (const suffix of ['.dodeploy', '.deployed', '.failed', '.isdeploying', '.isundeploying', '.pending']) {
          await this.fs.rm?.(`${deploymentTarget}${suffix}`, { force: true });
        }
        lines.push(`Removed deployment marker files for ${path.basename(artifactPath)}`);
      }
    }
    for (const target of preset.clearBaseSubdirs) {
      const resolved = path.join(environment.baseDir, ...target.split('/'));
      assertPathWithinBase(environment.baseDir, resolved);
      await this.fs.rm?.(resolved, { recursive: true, force: true });
      lines.push(`Cleared ${resolved}`);
    }
    for (const relative of preset.extraRelativePaths) {
      const resolved = path.join(environment.baseDir, relative);
      assertPathWithinBase(environment.baseDir, resolved);
      await this.fs.rm?.(resolved, { recursive: true, force: true });
      lines.push(`Cleared ${resolved}`);
    }
    await this.fs.mkdir(environment.deploymentsDir, { recursive: true });
    return lines;
  }

  private async *executeDeploy(
    deployMode: WildFlyDeployMode,
    artifactPath: string,
    _candidate: DeployableArtifactCandidate,
    environment: ResolvedWildFlyEnvironment,
    signal?: AbortSignal,
  ): AsyncGenerator<{ type: 'stdout' | 'stderr' | 'done'; line?: string; exitCode?: number; durationMs?: number }> {
    const destination = path.join(environment.deploymentsDir, path.basename(artifactPath));
    if (deployMode === 'filesystem-scanner') {
      await this.fs.copyFile?.(artifactPath, destination);
      await this.fs.writeFile(`${destination}.dodeploy`, '');
      yield { type: 'stdout', line: `Copied ${path.basename(artifactPath)} to ${environment.deploymentsDir}` };
      yield { type: 'done', exitCode: 0, durationMs: 0 };
      return;
    }

    const args = ['--connect', `command=deploy ${quoteCliArg(artifactPath)} --force`];
    for await (const event of this.processRunner.spawn(environment.cliScript, args, { cwd: path.dirname(environment.cliScript), signal })) {
      yield event;
    }
  }

  private async *executeStartup(
    environment: ResolvedWildFlyEnvironment,
    standaloneProfile: StandaloneProfileConfig | undefined,
    startupPreset: WildFlyStartupPreset | undefined,
    _signal?: AbortSignal,
  ): AsyncGenerator<{ type: 'stdout' | 'stderr' | 'done'; line?: string; exitCode?: number; durationMs?: number }> {
    if (standaloneProfile?.materializeToStandaloneXml) {
      const sourcePath = resolveServerConfigPath(environment, standaloneProfile);
      const targetPath = path.join(environment.configDir, 'standalone.xml');
      await this.fs.copyFile?.(sourcePath, targetPath);
    }
    const args = buildStartupArgs(environment, standaloneProfile, startupPreset);
    const javaOpts = buildJavaOpts(startupPreset);
    const env = {
      JBOSS_HOME: environment.homeDir,
      JAVA_HOME: startupPreset?.javaHome ?? environment.javaHome,
      JAVA_OPTS: javaOpts.join(' '),
    };
    for await (const event of this.processRunner.launchExternal(environment.startupScript, args, { cwd: path.dirname(environment.startupScript), env })) {
      yield event;
    }
  }

  private describeDeployCommand(deployMode: WildFlyDeployMode, artifactPath: string, environment: ResolvedWildFlyEnvironment): string {
    if (deployMode === 'filesystem-scanner') {
      return `copy ${artifactPath} ${environment.deploymentsDir}`;
    }
    return `${environment.cliScript} --connect command=deploy ${quoteCliArg(artifactPath)} --force`;
  }
}

interface ResolvedWildFlyEnvironment {
  homeDir: string;
  baseDir: string;
  configDir: string;
  deploymentsDir: string;
  cliScript: string;
  startupScript: string;
  javaHome?: string;
}

function normalizeEnvironment(environment: WildFlyEnvironmentConfig): ResolvedWildFlyEnvironment {
  return {
    homeDir: environment.homeDir,
    baseDir: environment.baseDir,
    configDir: environment.configDir ?? path.join(environment.baseDir, 'configuration'),
    deploymentsDir: environment.deploymentsDir ?? path.join(environment.baseDir, 'deployments'),
    cliScript: environment.cliScript ?? path.join(environment.homeDir, 'bin', process.platform === 'win32' ? 'jboss-cli.bat' : 'jboss-cli.sh'),
    startupScript: environment.startupScript ?? path.join(environment.homeDir, 'bin', process.platform === 'win32' ? 'standalone.bat' : 'standalone.sh'),
    javaHome: environment.javaHome,
  };
}

function buildExpectedArtifactPattern(projectPath: string, candidate: DeployableArtifactCandidate): string {
  const moduleDir = candidate.modulePath ? path.join(projectPath, candidate.modulePath) : projectPath;
  const buildDir = candidate.declaredBuildDirectory
    ? path.resolve(moduleDir, candidate.declaredBuildDirectory)
    : path.join(moduleDir, 'target');
  return path.join(buildDir, candidate.expectedDefaultFileName ?? `*.${candidate.packaging}`);
}

function resolveCleanupPaths(environment: ResolvedWildFlyEnvironment, preset: WildFlyCleanupPreset | undefined): string[] {
  if (!preset) {
    return [];
  }
  return [
    ...preset.clearBaseSubdirs.map((target) => path.join(environment.baseDir, ...target.split('/'))),
    ...preset.extraRelativePaths.map((target) => path.join(environment.baseDir, target)),
  ];
}

function buildStartupCommand(
  environment: ResolvedWildFlyEnvironment,
  standaloneProfile: StandaloneProfileConfig | undefined,
  startupPreset: WildFlyStartupPreset | undefined,
): string {
  const args = buildStartupArgs(environment, standaloneProfile, startupPreset);
  const javaOpts = buildJavaOpts(startupPreset);
  const prefix = javaOpts.length > 0 ? `JAVA_OPTS="${javaOpts.join(' ')}" ` : '';
  return `${prefix}${environment.startupScript} ${args.join(' ')}`.trim();
}

function buildStartupArgs(
  environment: ResolvedWildFlyEnvironment,
  standaloneProfile: StandaloneProfileConfig | undefined,
  startupPreset: WildFlyStartupPreset | undefined,
): string[] {
  const args = [`-Djboss.server.base.dir=${environment.baseDir}`];
  if (standaloneProfile && !standaloneProfile.materializeToStandaloneXml) {
    args.push(`--server-config=${resolveServerConfigPath(environment, standaloneProfile)}`);
  }
  args.push(...(startupPreset?.programArgs ?? []));
  return args;
}

function buildJavaOpts(startupPreset: WildFlyStartupPreset | undefined): string[] {
  const javaOpts = [...(startupPreset?.javaOpts ?? [])];
  if (startupPreset?.debugEnabled) {
    javaOpts.push(`-agentlib:jdwp=transport=dt_socket,server=y,suspend=${startupPreset.debugSuspend ? 'y' : 'n'},address=${startupPreset.debugHost}:${startupPreset.debugPort}`);
  }
  if (startupPreset?.jrebelEnabled && startupPreset.jrebelAgentPath) {
    const switchName = startupPreset.jrebelAgentKind === 'agentpath' ? '-agentpath' : '-javaagent';
    javaOpts.push(`${switchName}:${startupPreset.jrebelAgentPath}`);
    javaOpts.push(...startupPreset.jrebelArgs);
  }
  return javaOpts;
}

function recommendDeployMode(workflow: DeploymentWorkflowDefinition): WildFlyDeployMode {
  return workflow.startServer ? 'filesystem-scanner' : 'management-cli';
}

function resolveServerConfigPath(environment: ResolvedWildFlyEnvironment, standaloneProfile: StandaloneProfileConfig): string {
  return path.isAbsolute(standaloneProfile.serverConfigPath)
    ? standaloneProfile.serverConfigPath
    : path.join(environment.configDir, standaloneProfile.serverConfigPath);
}

function assertPathWithinBase(baseDir: string, candidatePath: string): void {
  const relative = path.relative(path.resolve(baseDir), path.resolve(candidatePath));
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(`Cleanup path "${candidatePath}" escapes the WildFly base directory "${baseDir}".`);
}

function quoteCliArg(value: string): string {
  return value.includes(' ') ? `"${value}"` : value;
}
