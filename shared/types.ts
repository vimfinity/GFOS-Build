// Shared domain types — consumed by both the Bun CLI backend and the Electron GUI renderer.
// The GUI imports these via the @shared alias configured in electron.vite.config.ts.

export type BuildSystem = 'maven' | 'npm';

export interface MavenMetadata {
  pomPath: string;
  artifactId: string;
  packaging: string;
  isAggregator: boolean;
  javaVersion?: string;
  hasMvnConfig: boolean;
  mvnConfigContent?: string;
}

export interface NpmMetadata {
  packageJsonPath: string;
  name: string;
  version?: string;
  scripts: Record<string, string>;
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
  npm?: NpmMetadata;
}

export interface BuildStep {
  path: string;
  buildSystem: BuildSystem;
  goals: string[];
  flags: string[];
  label: string;
  mavenExecutable: string;
  npmExecutable?: string;
  npmScript?: string;
  javaVersion?: string;
  javaHome?: string;
}

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
  success: boolean;
}

export interface RunResult {
  results: BuildStepResult[];
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
  maxDepth: number;
  includeHidden: boolean;
  exclude: string[];
}

export type BuildEvent =
  | { type: 'step:start'; step: BuildStep; index: number; total: number; pipelineName?: string }
  | { type: 'step:output'; line: string; stream: 'stdout' | 'stderr' }
  | { type: 'step:done'; step: BuildStep; index: number; total: number; exitCode: number; durationMs: number; success: boolean }
  | { type: 'run:done'; result: RunResult };
