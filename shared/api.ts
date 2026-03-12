// REST API response types — must stay in sync with src/cli/commands/serve.ts
import type { Project, BuildEvent, ScanEvent } from './types.js';

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
    maven: { executable: string; defaultGoals: string[]; defaultFlags: string[] };
    npm: { executable: string; defaultBuildScript: string; defaultInstallArgs: string[] };
    jdkRegistry: Record<string, string>;
    scan: { maxDepth: number; includeHidden: boolean; exclude: string[] };
  };
  configPath: string;
}

/** A single step as returned by GET /api/pipelines */
export interface PipelineStep {
  label: string;
  path: string;
  goals: string[];
  flags: string[];
  mavenExecutable: string;
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
  project_path: string;
  project_name: string;
  build_system: string;
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

/** WebSocket message envelope sent from server → client */
export interface WsEnvelope {
  type: 'event' | 'done' | 'error';
  jobId: string;
  event?: BuildEvent | ScanEvent;
  message?: string;
}
