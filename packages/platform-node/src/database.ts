import { existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { BuildStatsApi, BuildRunRowApi } from '@gfos-build/contracts';
import type { BuildCompletionStatus, ExecutionMode, PackageManager } from '@gfos-build/domain';
import type { PipelineConfig } from './schema.js';
import { StateCompatibilityError } from './state-errors.js';

const require = createRequire(import.meta.url);

const SCHEMA_VERSION = 3;
const SCHEMA_SQL = `
CREATE TABLE schema_meta (
  version INTEGER NOT NULL
);

CREATE TABLE pipeline_definitions (
  name TEXT PRIMARY KEY,
  definition_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  run_kind TEXT NOT NULL,
  pipeline_name TEXT,
  title TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'running',
  stopped_at INTEGER
);

CREATE TABLE pipeline_step_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  job_id TEXT,
  project_path TEXT NOT NULL,
  project_name TEXT NOT NULL,
  build_system TEXT NOT NULL,
  package_manager TEXT,
  execution_mode TEXT,
  command TEXT NOT NULL,
  java_home TEXT,
  pipeline_name TEXT,
  step_index INTEGER,
  step_label TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  exit_code INTEGER,
  status TEXT NOT NULL DEFAULT 'running',
  branch TEXT,
  FOREIGN KEY (run_id) REFERENCES pipeline_runs(id) ON DELETE CASCADE
);

CREATE TABLE run_step_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  step_run_id INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  stream TEXT NOT NULL DEFAULT 'stdout',
  line TEXT NOT NULL,
  FOREIGN KEY (step_run_id) REFERENCES pipeline_step_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_pipeline_runs_started_at ON pipeline_runs(started_at DESC);
CREATE INDEX idx_pipeline_runs_name ON pipeline_runs(pipeline_name);
CREATE INDEX idx_pipeline_step_runs_run_id ON pipeline_step_runs(run_id);
CREATE INDEX idx_pipeline_step_runs_job_id ON pipeline_step_runs(job_id);
CREATE INDEX idx_pipeline_step_runs_started_at ON pipeline_step_runs(started_at DESC);
CREATE INDEX idx_run_step_logs_step_run_id ON run_step_logs(step_run_id, seq DESC);
`;

type NodeSqliteModule = typeof import('node:sqlite');
let cachedNodeSqlite: NodeSqliteModule | null = null;

export interface SavedPipelineDefinition {
  name: string;
  definition: PipelineConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunParams {
  jobId?: string;
  kind: 'pipeline' | 'quick';
  pipelineName?: string;
  title: string;
}

export interface FinishRunParams {
  id: number;
  status: BuildCompletionStatus;
  durationMs: number;
  stoppedAt?: number;
}

export interface StartStepRunParams {
  runId: number;
  jobId?: string;
  projectPath: string;
  projectName: string;
  buildSystem: string;
  packageManager?: PackageManager;
  executionMode?: ExecutionMode;
  command: string;
  javaHome?: string;
  pipelineName?: string;
  stepIndex?: number;
  stepLabel: string;
  branch?: string;
}

export interface FinishStepRunParams {
  id: number;
  exitCode: number;
  durationMs: number;
  status: BuildCompletionStatus;
}

export interface BuildLogPage {
  entries: Array<{ seq: number; stream: string; line: string }>;
  nextBeforeSeq: number | null;
}

export interface IDatabase {
  listPipelineDefinitions(): SavedPipelineDefinition[];
  getPipelineDefinition(name: string): SavedPipelineDefinition | null;
  savePipelineDefinition(name: string, definition: PipelineConfig): void;
  deletePipelineDefinition(name: string): void;
  createRun(params: CreateRunParams): number;
  finishRun(params: FinishRunParams): void;
  reconcileRunningRuns(activeJobIds: string[], staleAfterMs?: number): void;
  createStepRun(params: StartStepRunParams): number;
  finishStepRun(params: FinishStepRunParams): void;
  appendStepLog(stepRunId: number, seq: number, stream: string, line: string): void;
  getRecentRuns(opts: { limit: number; pipeline?: string; project?: string }): BuildRunRowApi[];
  getBuildStats(): BuildStatsApi;
  getLastRunsByPipeline(): Record<string, { status: string; startedAt: string; durationMs: number | null; stoppedAt: number | null }>;
  getLastFailedStepIndex(pipelineName: string): number | null;
  getBuildLogs(stepRunId: number, opts?: { limit?: number; beforeSeq?: number }): BuildLogPage;
  clearBuildLogs(): void;
  clearAllBuilds(): void;
  close(): void;
}

export class AppDatabase implements IDatabase {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    const { DatabaseSync: DatabaseCtor } = loadNodeSqlite();
    const existed = existsSync(dbPath);
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseCtor(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.initializeSchema(existed, dbPath);
  }

  listPipelineDefinitions(): SavedPipelineDefinition[] {
    return this.db
      .prepare(
        `SELECT name, definition_json, created_at, updated_at
         FROM pipeline_definitions
         ORDER BY name ASC`,
      )
      .all()
      .map((row) => ({
        name: String((row as { name: string }).name),
        definition: JSON.parse(String((row as { definition_json: string }).definition_json)) as PipelineConfig,
        createdAt: String((row as { created_at: string }).created_at),
        updatedAt: String((row as { updated_at: string }).updated_at),
      })) as SavedPipelineDefinition[];
  }

  getPipelineDefinition(name: string): SavedPipelineDefinition | null {
    const row = this.db
      .prepare(
        `SELECT name, definition_json, created_at, updated_at
         FROM pipeline_definitions
         WHERE name = ?`,
      )
      .get(name) as { name: string; definition_json: string; created_at: string; updated_at: string } | undefined;

    if (!row) return null;
    return {
      name: row.name,
      definition: JSON.parse(row.definition_json) as PipelineConfig,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  savePipelineDefinition(name: string, definition: PipelineConfig): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO pipeline_definitions (name, definition_json, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           definition_json = excluded.definition_json,
           updated_at = excluded.updated_at`,
      )
      .run(name, JSON.stringify(definition), now, now);
  }

  deletePipelineDefinition(name: string): void {
    this.db.prepare('DELETE FROM pipeline_definitions WHERE name = ?').run(name);
  }

  createRun(params: CreateRunParams): number {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO pipeline_runs
          (job_id, run_kind, pipeline_name, title, started_at, status)
         VALUES (?, ?, ?, ?, ?, 'running')`,
      )
      .run(params.jobId ?? null, params.kind, params.pipelineName ?? null, params.title, now) as {
      lastInsertRowid: number | bigint;
    };
    return Number(result.lastInsertRowid);
  }

  finishRun(params: FinishRunParams): void {
    this.db
      .prepare(
        `UPDATE pipeline_runs
         SET finished_at = ?, duration_ms = ?, status = ?, stopped_at = ?
         WHERE id = ?`,
      )
      .run(new Date().toISOString(), params.durationMs, params.status, params.stoppedAt ?? null, params.id);
  }

  reconcileRunningRuns(activeJobIds: string[], staleAfterMs = 30_000): void {
    const now = new Date();
    const finishedAt = now.toISOString();
    const staleBefore = new Date(now.getTime() - staleAfterMs).toISOString();
    const activeClause =
      activeJobIds.length > 0
        ? `job_id IS NULL OR job_id NOT IN (${activeJobIds.map(() => '?').join(', ')})`
        : '1 = 1';

    this.db
      .prepare(
        `UPDATE pipeline_step_runs
         SET finished_at = ?,
             duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER),
             exit_code = COALESCE(exit_code, 1),
             status = 'failed'
         WHERE status = 'running'
           AND started_at <= ?
           AND (${activeClause})`,
      )
      .run(finishedAt, finishedAt, staleBefore, ...activeJobIds);

    this.db
      .prepare(
        `UPDATE pipeline_runs
         SET finished_at = ?,
             duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER),
             status = 'failed'
         WHERE status = 'running'
           AND started_at <= ?
           AND (${activeClause})`,
      )
      .run(finishedAt, finishedAt, staleBefore, ...activeJobIds);
  }

  createStepRun(params: StartStepRunParams): number {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO pipeline_step_runs
          (run_id, job_id, project_path, project_name, build_system, package_manager, execution_mode, command, java_home, pipeline_name, step_index, step_label, started_at, status, branch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)`,
      )
      .run(
        params.runId,
        params.jobId ?? null,
        params.projectPath,
        params.projectName,
        params.buildSystem,
        params.packageManager ?? null,
        params.executionMode ?? null,
        params.command,
        params.javaHome ?? null,
        params.pipelineName ?? null,
        params.stepIndex ?? null,
        params.stepLabel,
        now,
        params.branch ?? null,
      ) as { lastInsertRowid: number | bigint };
    return Number(result.lastInsertRowid);
  }

  finishStepRun(params: FinishStepRunParams): void {
    this.db
      .prepare(
        `UPDATE pipeline_step_runs
         SET finished_at = ?, duration_ms = ?, exit_code = ?, status = ?
         WHERE id = ?`,
      )
      .run(new Date().toISOString(), params.durationMs, params.exitCode, params.status, params.id);
  }

  appendStepLog(stepRunId: number, seq: number, stream: string, line: string): void {
    this.db
      .prepare('INSERT INTO run_step_logs (step_run_id, seq, stream, line) VALUES (?, ?, ?, ?)')
      .run(stepRunId, seq, stream, line);
  }

  getRecentRuns(opts: { limit: number; pipeline?: string; project?: string }): BuildRunRowApi[] {
    const select = `
      SELECT
        s.id,
        s.job_id,
        s.project_path,
        s.project_name,
        s.build_system,
        s.package_manager,
        s.execution_mode,
        s.command,
        s.java_home,
        s.pipeline_name,
        s.step_index,
        s.started_at,
        s.finished_at,
        s.duration_ms,
        s.exit_code,
        s.status,
        s.branch
      FROM pipeline_step_runs s
    `;

    if (opts.pipeline) {
      return this.db
        .prepare(`${select} WHERE s.pipeline_name = ? ORDER BY s.started_at DESC LIMIT ?`)
        .all(opts.pipeline, opts.limit) as unknown as BuildRunRowApi[];
    }

    if (opts.project) {
      return this.db
        .prepare(`${select} WHERE s.project_path = ? ORDER BY s.started_at DESC LIMIT ?`)
        .all(opts.project, opts.limit) as unknown as BuildRunRowApi[];
    }

    return this.db.prepare(`${select} ORDER BY s.started_at DESC LIMIT ?`).all(opts.limit) as unknown as BuildRunRowApi[];
  }

  getBuildStats(): BuildStatsApi {
    const totals = (this.db
      .prepare(
        `SELECT
           COUNT(CASE WHEN status IN ('success', 'failed') THEN 1 END) AS total,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failure_count,
           AVG(CASE WHEN status IN ('success', 'failed') THEN duration_ms END) AS avg_duration_ms
         FROM pipeline_step_runs`,
      )
      .get() as { total: number; success_count: number; failure_count: number; avg_duration_ms: number | null } | undefined) ?? {
      total: 0,
      success_count: 0,
      failure_count: 0,
      avg_duration_ms: null,
    };

    const byPipeline = (this.db
      .prepare(
        `SELECT
           pipeline_name AS name,
           COUNT(CASE WHEN status IN ('success', 'failed', 'launched') THEN 1 END) AS runs,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
           AVG(CASE WHEN status IN ('success', 'failed', 'launched') THEN duration_ms END) AS avg_ms
         FROM pipeline_runs
         WHERE pipeline_name IS NOT NULL
         GROUP BY pipeline_name
         ORDER BY runs DESC`,
      )
      .all() as Array<{ name: string; runs: number; successes: number; avg_ms: number | null }>)
      .filter((row) => row.runs > 0)
      .map((row) => ({ name: row.name, runs: row.runs, successes: row.successes, avgMs: row.avg_ms }));

    const byProject = (this.db
      .prepare(
        `SELECT
           project_path AS path,
           project_name AS name,
           COUNT(CASE WHEN status IN ('success', 'failed', 'launched') THEN 1 END) AS runs,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
           AVG(CASE WHEN status IN ('success', 'failed', 'launched') THEN duration_ms END) AS avg_ms
         FROM pipeline_step_runs
         GROUP BY project_path
         HAVING runs > 0
         ORDER BY runs DESC
         LIMIT 20`,
      )
      .all() as Array<{ path: string; name: string; runs: number; successes: number; avg_ms: number | null }>)
      .map((row) => ({ path: row.path, name: row.name, runs: row.runs, successes: row.successes, avgMs: row.avg_ms }));

    const slowestSteps = (this.db
      .prepare(
        `SELECT
           step_label AS label,
           project_path AS path,
           AVG(duration_ms) AS avg_ms,
           COUNT(*) AS runs
         FROM pipeline_step_runs
         WHERE status = 'success' AND duration_ms IS NOT NULL
         GROUP BY project_path, step_label
         HAVING COUNT(*) >= 2
         ORDER BY avg_ms DESC
         LIMIT 10`,
      )
      .all() as Array<{ label: string; path: string; avg_ms: number; runs: number }>)
      .map((row) => ({ label: row.label, path: row.path, avgMs: row.avg_ms, runs: row.runs }));

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

  getLastRunsByPipeline(): Record<string, { status: string; startedAt: string; durationMs: number | null; stoppedAt: number | null }> {
    const rows = this.db
      .prepare(
        `SELECT pipeline_name, status, started_at, duration_ms, stopped_at
         FROM pipeline_runs
         WHERE pipeline_name IS NOT NULL
           AND id IN (
             SELECT MAX(id)
             FROM pipeline_runs
             WHERE pipeline_name IS NOT NULL
             GROUP BY pipeline_name
           )`,
      )
      .all() as Array<{ pipeline_name: string; status: string; started_at: string; duration_ms: number | null; stopped_at: number | null }>;

    const result: Record<string, { status: string; startedAt: string; durationMs: number | null; stoppedAt: number | null }> = {};
    for (const row of rows) {
      result[row.pipeline_name] = {
        status: row.status,
        startedAt: row.started_at,
        durationMs: row.duration_ms,
        stoppedAt: row.stopped_at,
      };
    }
    return result;
  }

  getLastFailedStepIndex(pipelineName: string): number | null {
    const row = this.db
      .prepare(
        `SELECT stopped_at
         FROM pipeline_runs
         WHERE pipeline_name = ?
           AND status = 'failed'
         ORDER BY started_at DESC
         LIMIT 1`,
      )
      .get(pipelineName) as { stopped_at: number | null } | undefined;

    return row?.stopped_at ?? null;
  }

  getBuildLogs(stepRunId: number, opts?: { limit?: number; beforeSeq?: number }): BuildLogPage {
    const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 5_000);
    const beforeSeq = opts?.beforeSeq;

    const entries = (beforeSeq === undefined || beforeSeq === null
      ? this.db
          .prepare(
            `SELECT seq, stream, line
             FROM run_step_logs
             WHERE step_run_id = ?
             ORDER BY seq DESC
             LIMIT ?`,
          )
          .all(stepRunId, limit)
      : this.db
          .prepare(
            `SELECT seq, stream, line
             FROM run_step_logs
             WHERE step_run_id = ?
               AND seq < ?
             ORDER BY seq DESC
             LIMIT ?`,
          )
          .all(stepRunId, beforeSeq, limit)) as Array<{ seq: number; stream: string; line: string }>;

    const orderedEntries = [...entries].reverse();
    const nextBeforeSeq = entries.length === limit ? entries[entries.length - 1]?.seq ?? null : null;

    return { entries: orderedEntries, nextBeforeSeq };
  }

  clearBuildLogs(): void {
    this.db.exec('DELETE FROM run_step_logs');
  }

  clearAllBuilds(): void {
    this.db.exec('DELETE FROM run_step_logs');
    this.db.exec('DELETE FROM pipeline_step_runs');
    this.db.exec('DELETE FROM pipeline_runs');
  }

  close(): void {
    this.db.close();
  }

  private initializeSchema(existed: boolean, dbPath: string): void {
    if (!existed || this.isNewDatabaseFile(dbPath)) {
      this.db.exec(SCHEMA_SQL);
      this.db.prepare('INSERT INTO schema_meta (version) VALUES (?)').run(SCHEMA_VERSION);
      return;
    }

    try {
      const metaExists = this.db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'`)
        .get() as { name: string } | undefined;

      if (!metaExists) {
        throw new StateCompatibilityError('State schema metadata is missing.');
      }

      const row = this.db.prepare('SELECT version FROM schema_meta LIMIT 1').get() as { version: number } | undefined;
      const currentVersion = row?.version ?? 0;

      if (currentVersion === SCHEMA_VERSION) {
        return;
      }

      // Migrate v2 → v3: add branch column to pipeline_step_runs
      if (currentVersion === 2 && SCHEMA_VERSION >= 3) {
        this.db.exec('ALTER TABLE pipeline_step_runs ADD COLUMN branch TEXT');
        this.db.prepare('UPDATE schema_meta SET version = ?').run(SCHEMA_VERSION);
        return;
      }

      if (currentVersion !== SCHEMA_VERSION) {
        throw new StateCompatibilityError(
          `State schema version ${currentVersion} is incompatible with version ${SCHEMA_VERSION}.`,
        );
      }
    } catch (error) {
      if (error instanceof StateCompatibilityError) {
        throw error;
      }
      throw new StateCompatibilityError(
        error instanceof Error ? error.message : 'State database could not be validated.',
      );
    }
  }

  private isNewDatabaseFile(dbPath: string): boolean {
    try {
      return statSync(dbPath).size === 0;
    } catch {
      return true;
    }
  }
}

function loadNodeSqlite(): NodeSqliteModule {
  if (cachedNodeSqlite) return cachedNodeSqlite;
  cachedNodeSqlite = require('node:sqlite') as NodeSqliteModule;
  return cachedNodeSqlite;
}
