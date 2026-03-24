// Shared domain types — consumed by both the Bun CLI backend and the Electron GUI renderer.
// The GUI imports these via the @shared alias configured in electron.vite.config.ts.

export type BuildSystem = 'maven' | 'node' | 'wildfly';
export type PackageManager = 'npm' | 'pnpm' | 'bun';
export type ExecutionMode = 'internal' | 'external';
export type NodeCommandType = 'script' | 'install';
export type MavenStepMode = 'build' | 'deploy';
export type MavenProfileState = 'default' | 'enabled' | 'disabled';
export type MavenOptionKey =
  | 'skipTests'
  | 'skipTestCompile'
  | 'updateSnapshots'
  | 'offline'
  | 'quiet'
  | 'debug'
  | 'errors'
  | 'failAtEnd'
  | 'failNever';
export type BuildCompletionStatus = 'success' | 'failed' | 'launched';
export type MavenSubmoduleBuildStrategy = 'root-pl' | 'submodule-dir';
export type BuildRunStatus = 'running' | BuildCompletionStatus;
export type WorkflowKind = 'pipeline' | 'deployment' | 'quick';
export type DeployablePackaging = 'ear' | 'war' | 'rar' | 'jar';
export type DeployableSelectionConfidence = 'high' | 'medium' | 'manual';
export type WildFlyDeployMode = 'filesystem-scanner' | 'management-cli';
export type JrebelAgentKind = 'agentpath' | 'javaagent';
export type WildFlyCleanupTarget = 'tmp' | 'log' | 'data' | 'data/content';
export type WildFlyStepKind = 'wildfly-cleanup' | 'wildfly-deploy' | 'wildfly-startup';

export interface DeployableArtifactCandidate {
  modulePath: string;
  artifactId: string;
  packaging: DeployablePackaging;
  declaredFinalName?: string;
  declaredBuildDirectory?: string;
  expectedDefaultFileName?: string | null;
  selectionConfidence: DeployableSelectionConfidence;
}

export interface MavenModuleMetadata {
  id: string;
  name: string;
  relativePath: string;
  fullPath: string;
  packaging?: string;
  javaVersion?: string;
}

export interface MavenProfileMetadata {
  id: string;
  activeByDefault: boolean;
  sourcePomPath: string;
  sourceModulePath: string;
}

export interface MavenMetadata {
  pomPath: string;
  artifactId: string;
  version?: string;
  packaging: string;
  isAggregator: boolean;
  javaVersion?: string;
  buildDirectory?: string;
  finalName?: string;
  modules: MavenModuleMetadata[];
  profiles: MavenProfileMetadata[];
  deployableCandidates: DeployableArtifactCandidate[];
  hasMvnConfig: boolean;
  mvnConfigContent?: string;
}

export interface NodeMetadata {
  packageJsonPath: string;
  name: string;
  version?: string;
  scripts: Record<string, string>;
  packageManager: PackageManager;
  isAngular: boolean;
  angularVersion?: string;
}

export interface Project {
  name: string;
  path: string;
  depth: number;
  rootName: string;
  buildSystem: BuildSystem;
  maven?: MavenMetadata;
  node?: NodeMetadata;
}

export interface MavenBuildStep {
  path: string;
  buildSystem: 'maven';
  mode?: MavenStepMode;
  deploymentWorkflowName?: string;
  modulePath?: string;
  submoduleBuildStrategy?: MavenSubmoduleBuildStrategy;
  goals: string[];
  optionKeys: MavenOptionKey[];
  profileStates: Record<string, MavenProfileState>;
  extraOptions: string[];
  executionMode: ExecutionMode;
  label: string;
  mavenExecutable: string;
  javaVersion?: string;
  javaHome?: string;
}

export interface WildFlyCleanupPreset {
  removePreviousDeployment: boolean;
  removeMarkerFiles: boolean;
  clearBaseSubdirs: WildFlyCleanupTarget[];
  extraRelativePaths: string[];
}

export interface StandaloneProfileConfig {
  serverConfigPath: string;
  materializeToStandaloneXml?: boolean;
}

export interface WildFlyStartupPreset {
  javaHome?: string;
  javaOpts: string[];
  programArgs: string[];
  debugEnabled: boolean;
  debugHost: string;
  debugPort: number;
  debugSuspend: boolean;
  jrebelEnabled: boolean;
  jrebelAgentKind: JrebelAgentKind;
  jrebelAgentPath?: string;
  jrebelArgs: string[];
}

export interface WildFlyEnvironmentConfig {
  homeDir: string;
  baseDir: string;
  configDir?: string;
  deploymentsDir?: string;
  cliScript?: string;
  startupScript?: string;
  javaHome?: string;
  standaloneProfiles: Record<string, StandaloneProfileConfig>;
  cleanupPresets: Record<string, WildFlyCleanupPreset>;
  startupPresets: Record<string, WildFlyStartupPreset>;
}

export interface DeploymentArtifactSelector {
  kind: 'auto' | 'module' | 'explicit-file';
  modulePath?: string;
  packaging?: DeployablePackaging;
  fileName?: string;
}

export interface DeploymentWorkflowDefinition {
  description?: string;
  projectPath: string;
  artifactSelector: DeploymentArtifactSelector;
  environmentName: string;
  standaloneProfileName: string;
  cleanupPresetName?: string;
  startupPresetName?: string;
  deployMode?: WildFlyDeployMode;
  startServer: boolean;
}

export interface WildFlyOperationStep {
  path: string;
  buildSystem: 'wildfly';
  label: string;
  kind: WildFlyStepKind;
  environmentName: string;
  deployMode?: WildFlyDeployMode;
  command: string;
}

export interface NodeBuildStep {
  path: string;
  buildSystem: 'node';
  label: string;
  commandType: NodeCommandType;
  script?: string;
  args: string[];
  executionMode: ExecutionMode;
  packageManager?: PackageManager;
  nodeExecutables: Record<PackageManager, string>;
}

export interface DeploymentWorkflowRefStep {
  path: string;
  buildSystem: 'wildfly';
  label: string;
  kind: 'wildfly-deploy';
  environmentName: string;
  deployMode: WildFlyDeployMode;
  command: string;
}

export type BuildStep = MavenBuildStep | NodeBuildStep | WildFlyOperationStep;

export interface Pipeline {
  name: string;
  description?: string;
  failFast: boolean;
  steps: BuildStep[];
}

export interface BuildStepResult {
  step: BuildStep;
  exitCode: number;
  durationMs: number;
  status: BuildCompletionStatus;
  success: boolean;
}

export interface RunResult {
  results: BuildStepResult[];
  status: BuildCompletionStatus;
  success: boolean;
  durationMs: number;
  stoppedAt?: number;
}

export type ProcessEvent =
  | { type: 'stdout'; line: string }
  | { type: 'stderr'; line: string }
  | { type: 'done'; exitCode: number; durationMs: number };

export type ScanEvent =
  | { type: 'repo:found'; project: Project }
  | { type: 'scan:done'; projects: Project[]; durationMs: number; fromCache: boolean; scannedAt: string };

export interface ScanOptions {
  roots: Record<string, string>;
  includeHidden: boolean;
  exclude: string[];
}

export type BuildEvent =
  | { type: 'run:start'; startedAt: number; runId?: number }
  | { type: 'step:start'; step: BuildStep; index: number; total: number; pipelineName?: string; runId?: number }
  | { type: 'step:output'; line: string; stream: 'stdout' | 'stderr' }
  | { type: 'step:done'; step: BuildStep; index: number; total: number; exitCode: number; durationMs: number; status: BuildCompletionStatus; success: boolean }
  | { type: 'run:done'; result: RunResult };
