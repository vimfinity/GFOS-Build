// Shared domain types — consumed by both the Bun CLI backend and the Electron GUI renderer.
// The GUI imports these via the @shared alias configured in electron.vite.config.ts.

export type BuildSystem = 'maven' | 'node';
export type PackageManager = 'npm' | 'pnpm' | 'bun';
export type ExecutionMode = 'internal' | 'external';
export type NodeCommandType = 'script' | 'install';
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
export type BuildRunStatus = 'running' | BuildCompletionStatus;

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
  packaging: string;
  isAggregator: boolean;
  javaVersion?: string;
  modules: MavenModuleMetadata[];
  profiles: MavenProfileMetadata[];
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
  modulePath?: string;
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

export type BuildStep = MavenBuildStep | NodeBuildStep;

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
  | { type: 'scan:done'; projects: Project[]; durationMs: number; fromCache: boolean };

export interface ScanOptions {
  roots: Record<string, string>;
  includeHidden: boolean;
  exclude: string[];
}

export type BuildEvent =
  | { type: 'run:start'; startedAt: number }
  | { type: 'step:start'; step: BuildStep; index: number; total: number; pipelineName?: string; runId?: number }
  | { type: 'step:output'; line: string; stream: 'stdout' | 'stderr' }
  | { type: 'step:done'; step: BuildStep; index: number; total: number; exitCode: number; durationMs: number; status: BuildCompletionStatus; success: boolean }
  | { type: 'run:done'; result: RunResult };
