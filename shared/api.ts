// REST API response types — must stay in sync with src/cli/commands/serve.ts
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

/** GET /api/config */
export interface ConfigResponse {
  config: {
    roots: Record<string, string>;
    pipelines: Record<string, unknown>;
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
  error?: string;
}

/** A single step as returned by GET /api/pipelines */
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

/** A single pipeline entry as returned by GET /api/pipelines */
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

/** A single build_runs row as returned by GET /api/builds */
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

/** GET /api/builds/:runId/logs */
export interface BuildLogEntry {
  seq: number;
  stream: string;
  line: string;
}

/** GET /api/builds/stats */
export interface BuildStatsApi {
  totalBuilds: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number | null;
  byPipeline: Array<{ name: string; runs: number; successes: number; avgMs: number | null }>;
  byProject: Array<{ path: string; name: string; runs: number; successes: number; avgMs: number | null }>;
  slowestSteps: Array<{ label: string; path: string; avgMs: number; runs: number }>;
}

/** Returned by POST /api/pipeline/:name/run and POST /api/build */
export interface StartJobResponse {
  jobId: string;
}

/** GET /api/scan */
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

/** WebSocket message envelope sent from server → client */
export interface WsEnvelope {
  type: 'event' | 'done' | 'error';
  jobId: string;
  event?: BuildEvent | ScanEvent;
  message?: string;
}
