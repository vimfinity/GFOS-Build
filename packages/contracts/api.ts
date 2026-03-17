// Shared desktop/CLI-facing query and command types.
import type {
  BuildEvent,
  ExecutionMode,
  MavenOptionKey,
  MavenProfileState,
  NodeCommandType,
  PackageManager,
  Project,
  ScanEvent,
} from './types.js';

export interface HealthResponse {
  version: string;
  uptime: number;
  platform: string;
}

/** Current local settings snapshot. */
export interface ConfigResponse {
  config: {
    roots: Record<string, string>;
    maven: {
      executable: string;
      defaultGoals: string[];
      defaultOptionKeys: MavenOptionKey[];
      defaultExtraOptions: string[];
    };
    node: { executables: Record<PackageManager, string> };
    jdkRegistry: Record<string, string>;
    scan: { includeHidden: boolean; exclude: string[] };
  };
  configPath: string;
}

/** One resolved pipeline step. */
export interface PipelineStep {
  label: string;
  path: string;
  buildSystem: 'maven' | 'node';
  packageManager?: PackageManager;
  executionMode?: ExecutionMode;
  commandType?: NodeCommandType;
  modulePath?: string;
  goals?: string[];
  optionKeys?: MavenOptionKey[];
  profileStates?: Record<string, MavenProfileState>;
  extraOptions?: string[];
  mavenExecutable?: string;
  script?: string;
  args?: string[];
  javaVersion?: string;
  javaHome?: string;
}

/** One saved pipeline entry. */
export interface PipelineListItem {
  name: string;
  description?: string;
  failFast: boolean;
  steps: PipelineStep[];
  lastRun: {
    status: string;
    startedAt: string;
    durationMs: number | null;
  } | null;
}

/** One persisted run row. */
export interface BuildRunRowApi {
  id: number;
  job_id: string | null;
  project_path: string;
  project_name: string;
  build_system: string;
  package_manager: PackageManager | null;
  execution_mode: ExecutionMode | null;
  command: string;
  java_home: string | null;
  pipeline_name: string | null;
  step_index: number | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  exit_code: number | null;
  status: string;
}

/** One persisted log line. */
export interface BuildLogEntry {
  seq: number;
  stream: string;
  line: string;
}

/** Paginated build log response, newest chunk first via beforeSeq cursor. */
export interface BuildLogPage {
  entries: BuildLogEntry[];
  nextBeforeSeq: number | null;
}

/** Aggregated run statistics. */
export interface BuildStatsApi {
  totalBuilds: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number | null;
  byPipeline: Array<{ name: string; runs: number; successes: number; avgMs: number | null }>;
  byProject: Array<{ path: string; name: string; runs: number; successes: number; avgMs: number | null }>;
  slowestSteps: Array<{ label: string; path: string; avgMs: number; runs: number }>;
}

/** Returned when starting a pipeline or quick run. */
export interface StartJobResponse {
  jobId: string;
  runId: number | null;
}

/** Project scan result. */
export interface ScanResponse {
  projects: Project[];
  durationMs: number;
  fromCache: boolean;
}

export interface ProjectInspectionResponse {
  project: Project | null;
}

export interface DetectedJdkApi {
  version: string;
  path: string;
}

export interface JdkDetectionResponse {
  baseDir: string;
  jdks: DetectedJdkApi[];
}

/** Live run event envelope delivered over the desktop bridge. */
export interface RunEventEnvelope {
  type: 'event' | 'done' | 'error';
  jobId: string;
  event?: BuildEvent | ScanEvent;
  message?: string;
}
