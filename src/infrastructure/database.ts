import { Database } from 'bun:sqlite';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Project } from '../core/types.js';

const SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS build_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path  TEXT    NOT NULL,
  project_name  TEXT    NOT NULL,
  build_system  TEXT    NOT NULL DEFAULT 'maven',
  command       TEXT    NOT NULL,
  java_home     TEXT,
  pipeline_name TEXT,
  step_index    INTEGER,
  started_at    TEXT    NOT NULL,
  finished_at   TEXT,
  duration_ms   INTEGER,
  exit_code     INTEGER,
  status        TEXT    NOT NULL DEFAULT 'running'
);
CREATE TABLE IF NOT EXISTS pipeline_state (
  pipeline_name      TEXT PRIMARY KEY,
  last_failed_step   INTEGER,
  updated_at         TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scan_cache (
  cache_key     TEXT PRIMARY KEY,
  scanned_at    TEXT NOT NULL,
  projects_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS build_logs (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id  INTEGER NOT NULL,
  seq     INTEGER NOT NULL,
  stream  TEXT    NOT NULL DEFAULT 'stdout',
  line    TEXT    NOT NULL,
  FOREIGN KEY (run_id) REFERENCES build_runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_build_logs_run_id ON build_logs(run_id);
`;

export interface StartBuildRunParams {
  projectPath: string;
  projectName: string;
  buildSystem: string;
  command: string;
  javaHome?: string;
  pipelineName?: string;
  stepIndex?: number;
}

export interface FinishBuildRunParams {
  id: number;
  exitCode: number;
  durationMs: number;
  status: 'success' | 'failed';
}

export interface BuildRunRow {
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

export interface BuildStats {
  totalBuilds: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number | null;
  byPipeline: Array<{ name: string; runs: number; successes: number; avgMs: number | null }>;
  byProject: Array<{ path: string; name: string; runs: number; successes: number; avgMs: number | null }>;
  slowestSteps: Array<{ label: string; path: string; avgMs: number; runs: number }>;
}

/** Shared interface — implemented by AppDatabase (bun:sqlite) and NodeDatabase (better-sqlite3). */
export interface IDatabase {
  startBuildRun(params: StartBuildRunParams): number;
  finishBuildRun(params: FinishBuildRunParams): void;
  getPipelineState(pipelineName: string): { last_failed_step: number | null } | null;
  upsertPipelineState(pipelineName: string, lastFailedStep: number | null): void;
  getScanCache(cacheKey: string, ttlMs: number): Project[] | null;
  setScanCache(cacheKey: string, projects: Project[]): void;
  getRecentBuilds(opts: { limit: number; pipeline?: string; project?: string }): BuildRunRow[];
  getBuildStats(): BuildStats;
  getLastRunsByPipeline(): Record<string, { status: string; startedAt: string; durationMs: number | null }>;
  appendBuildLog(runId: number, seq: number, stream: string, line: string): void;
  getBuildLogs(runId: number): Array<{ seq: number; stream: string; line: string }>;
  clearBuildLogs(): void;
  clearAllBuilds(): void;
  close(): void;
}

/** CLI implementation — uses bun:sqlite (built into the Bun runtime, no native compilation). */
export class AppDatabase implements IDatabase {
  private readonly db: Database;

  constructor(dbPath: string) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(SCHEMA_SQL);
    const row = this.db
      .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
      .get() as { version: number } | undefined;
    if (!row) {
      this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    }
  }

  startBuildRun(params: StartBuildRunParams): number {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO build_runs
          (project_path, project_name, build_system, command, java_home, pipeline_name, step_index, started_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running')`,
      )
      .run(
        params.projectPath,
        params.projectName,
        params.buildSystem,
        params.command,
        params.javaHome ?? null,
        params.pipelineName ?? null,
        params.stepIndex ?? null,
        now,
      );
    return (this.db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
  }

  finishBuildRun(params: FinishBuildRunParams): void {
    this.db
      .prepare('UPDATE build_runs SET finished_at = ?, duration_ms = ?, exit_code = ?, status = ? WHERE id = ?')
      .run(new Date().toISOString(), params.durationMs, params.exitCode, params.status, params.id);
  }

  getPipelineState(pipelineName: string): { last_failed_step: number | null } | null {
    return (
      (this.db
        .prepare('SELECT last_failed_step FROM pipeline_state WHERE pipeline_name = ?')
        .get(pipelineName) as { last_failed_step: number | null } | undefined) ?? null
    );
  }

  upsertPipelineState(pipelineName: string, lastFailedStep: number | null): void {
    this.db
      .prepare(
        `INSERT INTO pipeline_state (pipeline_name, last_failed_step, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(pipeline_name) DO UPDATE SET
           last_failed_step = excluded.last_failed_step,
           updated_at = excluded.updated_at`,
      )
      .run(pipelineName, lastFailedStep, new Date().toISOString());
  }

  getScanCache(cacheKey: string, ttlMs: number): Project[] | null {
    const row = this.db
      .prepare('SELECT scanned_at, projects_json FROM scan_cache WHERE cache_key = ?')
      .get(cacheKey) as { scanned_at: string; projects_json: string } | undefined;
    if (!row) return null;
    const age = Date.now() - new Date(row.scanned_at).getTime();
    if (age > ttlMs) return null;
    try {
      return JSON.parse(row.projects_json) as Project[];
    } catch {
      return null;
    }
  }

  setScanCache(cacheKey: string, projects: Project[]): void {
    this.db
      .prepare(
        `INSERT INTO scan_cache (cache_key, scanned_at, projects_json)
         VALUES (?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET
           scanned_at = excluded.scanned_at,
           projects_json = excluded.projects_json`,
      )
      .run(cacheKey, new Date().toISOString(), JSON.stringify(projects));
  }

  getRecentBuilds(opts: { limit: number; pipeline?: string; project?: string }): BuildRunRow[] {
    const SELECT = `SELECT id, project_path, project_name, build_system, command, java_home,
                pipeline_name, step_index, started_at, finished_at, duration_ms, exit_code, status
         FROM build_runs`;
    if (opts.pipeline) {
      return this.db
        .prepare(`${SELECT} WHERE pipeline_name = ? ORDER BY started_at DESC LIMIT ?`)
        .all(opts.pipeline, opts.limit) as BuildRunRow[];
    }
    if (opts.project) {
      return this.db
        .prepare(`${SELECT} WHERE project_path = ? ORDER BY started_at DESC LIMIT ?`)
        .all(opts.project, opts.limit) as BuildRunRow[];
    }
    return this.db
      .prepare(`${SELECT} ORDER BY started_at DESC LIMIT ?`)
      .all(opts.limit) as BuildRunRow[];
  }

  getBuildStats(): BuildStats {
    const totals = (this.db
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) as failure_count,
                AVG(CASE WHEN status != 'running' THEN duration_ms END) as avg_duration_ms
         FROM build_runs`,
      )
      .get() as { total: number; success_count: number; failure_count: number; avg_duration_ms: number | null } | undefined) ?? { total: 0, success_count: 0, failure_count: 0, avg_duration_ms: null };

    const byPipeline = (this.db
      .prepare(
        `SELECT pipeline_name as name, COUNT(*) as runs,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
                AVG(CASE WHEN status != 'running' THEN duration_ms END) as avg_ms
         FROM build_runs WHERE pipeline_name IS NOT NULL
         GROUP BY pipeline_name ORDER BY runs DESC`,
      )
      .all() as Array<{ name: string; runs: number; successes: number; avg_ms: number | null }>)
      .map((r) => ({ name: r.name, runs: r.runs, successes: r.successes, avgMs: r.avg_ms }));

    const byProject = (this.db
      .prepare(
        `SELECT project_path as path, project_name as name, COUNT(*) as runs,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
                AVG(CASE WHEN status != 'running' THEN duration_ms END) as avg_ms
         FROM build_runs GROUP BY project_path ORDER BY runs DESC LIMIT 20`,
      )
      .all() as Array<{ path: string; name: string; runs: number; successes: number; avg_ms: number | null }>)
      .map((r) => ({ path: r.path, name: r.name, runs: r.runs, successes: r.successes, avgMs: r.avg_ms }));

    const slowestSteps = (this.db
      .prepare(
        `SELECT project_name as label, project_path as path,
                AVG(duration_ms) as avg_ms, COUNT(*) as runs
         FROM build_runs WHERE status = 'success' AND duration_ms IS NOT NULL
         GROUP BY project_path HAVING COUNT(*) >= 2 ORDER BY avg_ms DESC LIMIT 10`,
      )
      .all() as Array<{ label: string; path: string; avg_ms: number; runs: number }>)
      .map((r) => ({ label: r.label, path: r.path, avgMs: r.avg_ms, runs: r.runs }));

    return {
      totalBuilds: totals.total,
      successCount: totals.success_count,
      failureCount: totals.failure_count,
      avgDurationMs: totals.avg_duration_ms,
      byPipeline,
      byProject,
      slowestSteps,
    };
  }

  getLastRunsByPipeline(): Record<string, { status: string; startedAt: string; durationMs: number | null }> {
    const rows = this.db
      .prepare(
        `SELECT pipeline_name, status, started_at, duration_ms
         FROM build_runs
         WHERE pipeline_name IS NOT NULL
           AND id IN (
             SELECT MAX(id) FROM build_runs WHERE pipeline_name IS NOT NULL GROUP BY pipeline_name
           )`,
      )
      .all() as Array<{ pipeline_name: string; status: string; started_at: string; duration_ms: number | null }>;
    const result: Record<string, { status: string; startedAt: string; durationMs: number | null }> = {};
    for (const row of rows) {
      result[row.pipeline_name] = { status: row.status, startedAt: row.started_at, durationMs: row.duration_ms };
    }
    return result;
  }

  appendBuildLog(runId: number, seq: number, stream: string, line: string): void {
    this.db
      .prepare('INSERT INTO build_logs (run_id, seq, stream, line) VALUES (?, ?, ?, ?)')
      .run(runId, seq, stream, line);
  }

  getBuildLogs(runId: number): Array<{ seq: number; stream: string; line: string }> {
    return this.db
      .prepare('SELECT seq, stream, line FROM build_logs WHERE run_id = ? ORDER BY seq ASC')
      .all(runId) as Array<{ seq: number; stream: string; line: string }>;
  }


  clearBuildLogs(): void {
    this.db.exec('DELETE FROM build_logs');
  }

  clearAllBuilds(): void {
    this.db.exec('DELETE FROM build_runs');
  }
  close(): void {
    this.db.close();
  }
}
