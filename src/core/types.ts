export interface ScanOptions {
  rootPaths: string[];
  maxDepth: number;
  includeHidden: boolean;
}

export interface MavenRepository {
  name: string;
  path: string;
  pomPath: string;
  depth: number;
  parentPath?: string;
}

export interface MavenProfile {
  id: string;
  modulePath: string;
  pomPath: string;
}

export interface ModuleGraph {
  modules: MavenRepository[];
  rootModules: MavenRepository[];
}

export type BuildScope = 'root-only' | 'explicit-modules' | 'auto';
export type QueueStrategy = 'fifo';

export interface BuildOptions {
  goals: string[];
  mavenExecutable: string;
  failFast: boolean;
  verbose: boolean;
  javaHome?: string;
}

export interface BuildResult {
  repository: MavenRepository;
  exitCode: number;
  durationMs: number;
  mavenExecutable: string;
  javaHome?: string;
}

export type RunCommand = 'scan' | 'build' | 'pipeline';
export type RunMode =
  | 'scan'
  | 'build-plan'
  | 'build-run'
  | 'pipeline-lint'
  | 'pipeline-plan'
  | 'pipeline-run';

export interface PlannedBuildRepository {
  name: string;
  path: string;
}

export interface BuildPlan {
  strategy: 'sequential' | 'parallel';
  queueStrategy: QueueStrategy;
  failFast: boolean;
  goals: string[];
  mavenExecutable: string;
  javaHome?: string;
  scope: BuildScope;
  maxParallel: number;
  repositories: PlannedBuildRepository[];
}

export interface PipelineStageDefinition {
  name: string;
  scope?: BuildScope;
  modules?: string[];
  goals: string[];
  failFast?: boolean;
  maxParallel?: number;
  javaHome?: string;
}

export interface PipelineDefinition {
  schemaVersion: '1.0';
  name?: string;
  mavenExecutable?: string;
  javaHome?: string;
  stages: PipelineStageDefinition[];
}

export interface PipelineStageReport {
  stageName: string;
  plan: BuildPlan;
  buildResults: BuildResult[];
  stageDurationMs: number;
  estimatedSequentialDurationMs: number;
  speedupFactor?: number;
}

export interface PipelineLintIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface PipelineReport {
  action: 'lint' | 'plan' | 'run';
  stages: PipelineStageReport[];
  lintIssues?: PipelineLintIssue[];
}

export interface ProfileScanReport {
  enabled: boolean;
  filter?: string;
  profiles: MavenProfile[];
}

export interface RunEvent {
  type:
    | 'run_started'
    | 'discovery_completed'
    | 'discovery_cache_hit'
    | 'discovery_cache_miss'
    | 'profile_discovery_completed'
    | 'plan_created'
    | 'stage_started'
    | 'module_started'
    | 'module_finished'
    | 'stage_finished'
    | 'selection_explained'
    | 'pipeline_lint_issue'
    | 'run_finished';
  timestamp: string;
  payload?: Record<string, string | number | boolean>;
}

export interface DiscoveryRootMetric {
  rootPath: string;
  durationMs: number;
  directoriesVisited: number;
  modulesFound: number;
  cacheHit: boolean;
}

export interface RunStats {
  discoveredCount: number;
  plannedCount: number;
  builtCount: number;
  succeededCount: number;
  failedCount: number;
  totalBuildDurationMs: number;
  failedBuildDurationMs: number;
  maxParallelUsed: number;
  profileCount: number;
  discoveryDurationMs: number;
  discoveryCacheHitRate: number;
  discoveryCacheHits: number;
  discoveryCacheMisses: number;
  discoveryRoots: DiscoveryRootMetric[];
}

export interface SelectionExplanation {
  repositoryPath: string;
  selected: boolean;
  reason: string;
}

export interface RunComparison {
  previousRunId: string;
  previousDurationMs: number;
  durationDeltaMs: number;
}

export interface RunReport {
  schemaVersion: '1.1';
  runId: string;
  command: RunCommand;
  mode: RunMode;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  discovered: MavenRepository[];
  moduleGraph: ModuleGraph;
  profileScan: ProfileScanReport;
  buildPlan?: BuildPlan;
  buildResults: BuildResult[];
  pipeline?: PipelineReport;
  events: RunEvent[];
  stats: RunStats;
  comparison?: RunComparison;
  selectionExplanation?: SelectionExplanation[];
}
