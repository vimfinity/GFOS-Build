//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let node_path = require("node:path");
node_path = __toESM(node_path);
let node_fs = require("node:fs");
let node_module = require("node:module");
let node_fs_promises = require("node:fs/promises");
node_fs_promises = __toESM(node_fs_promises);
let node_child_process = require("node:child_process");
node_child_process = __toESM(node_child_process);
let node_crypto = require("node:crypto");
node_crypto = __toESM(node_crypto);
let node_util = require("node:util");
//#region ../../packages/contracts/dist/ipc.js
var IPC = {
	GET_HEALTH: "gfos:get-health",
	GET_CONFIG: "gfos:get-config",
	SAVE_CONFIG: "gfos:save-config",
	LIST_PIPELINES: "gfos:list-pipelines",
	CREATE_PIPELINE: "gfos:create-pipeline",
	UPDATE_PIPELINE: "gfos:update-pipeline",
	DELETE_PIPELINE: "gfos:delete-pipeline",
	RUN_PIPELINE: "gfos:run-pipeline",
	RUN_QUICK: "gfos:run-quick",
	CANCEL_JOB: "gfos:cancel-job",
	LIST_RUNS: "gfos:list-runs",
	GET_RUN_LOGS: "gfos:get-run-logs",
	GET_STATS: "gfos:get-stats",
	GET_SCAN: "gfos:get-scan",
	REFRESH_SCAN: "gfos:refresh-scan",
	INSPECT_PROJECT: "gfos:inspect-project",
	DETECT_JDKS: "gfos:detect-jdks",
	CLEAR_RUN_LOGS: "gfos:clear-run-logs",
	CLEAR_RUNS: "gfos:clear-runs",
	OPEN_DIRECTORY: "gfos:open-directory",
	GET_GIT_INFO: "gfos:get-git-info",
	GET_GIT_INFO_BATCH: "gfos:get-git-info-batch",
	RUN_SUBSCRIBE: "gfos:run-subscribe",
	RUN_UNSUBSCRIBE: "gfos:run-unsubscribe",
	RUN_EVENT: "gfos:run-event",
	GIT_HEAD_CHANGED: "gfos:git-head-changed"
};
//#endregion
//#region ../../packages/platform-node/dist/state-errors.js
var StateCompatibilityError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "StateCompatibilityError";
	}
};
//#endregion
//#region ../../packages/platform-node/dist/database.js
var require$1 = (0, node_module.createRequire)(require("url").pathToFileURL(__filename).href);
var SCHEMA_VERSION = 3;
var SCHEMA_SQL = `
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
var cachedNodeSqlite = null;
var AppDatabase = class {
	db;
	constructor(dbPath) {
		const { DatabaseSync: DatabaseCtor } = loadNodeSqlite();
		const existed = (0, node_fs.existsSync)(dbPath);
		(0, node_fs.mkdirSync)(node_path.default.dirname(dbPath), { recursive: true });
		this.db = new DatabaseCtor(dbPath);
		this.db.exec("PRAGMA journal_mode = WAL");
		this.db.exec("PRAGMA foreign_keys = ON");
		this.initializeSchema(existed, dbPath);
	}
	listPipelineDefinitions() {
		return this.db.prepare(`SELECT name, definition_json, created_at, updated_at
         FROM pipeline_definitions
         ORDER BY name ASC`).all().map((row) => ({
			name: String(row.name),
			definition: JSON.parse(String(row.definition_json)),
			createdAt: String(row.created_at),
			updatedAt: String(row.updated_at)
		}));
	}
	getPipelineDefinition(name) {
		const row = this.db.prepare(`SELECT name, definition_json, created_at, updated_at
         FROM pipeline_definitions
         WHERE name = ?`).get(name);
		if (!row) return null;
		return {
			name: row.name,
			definition: JSON.parse(row.definition_json),
			createdAt: row.created_at,
			updatedAt: row.updated_at
		};
	}
	savePipelineDefinition(name, definition) {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		this.db.prepare(`INSERT INTO pipeline_definitions (name, definition_json, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           definition_json = excluded.definition_json,
           updated_at = excluded.updated_at`).run(name, JSON.stringify(definition), now, now);
	}
	deletePipelineDefinition(name) {
		this.db.prepare("DELETE FROM pipeline_definitions WHERE name = ?").run(name);
	}
	createRun(params) {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = this.db.prepare(`INSERT INTO pipeline_runs
          (job_id, run_kind, pipeline_name, title, started_at, status)
         VALUES (?, ?, ?, ?, ?, 'running')`).run(params.jobId ?? null, params.kind, params.pipelineName ?? null, params.title, now);
		return Number(result.lastInsertRowid);
	}
	finishRun(params) {
		this.db.prepare(`UPDATE pipeline_runs
         SET finished_at = ?, duration_ms = ?, status = ?, stopped_at = ?
         WHERE id = ?`).run((/* @__PURE__ */ new Date()).toISOString(), params.durationMs, params.status, params.stoppedAt ?? null, params.id);
	}
	reconcileRunningRuns(activeJobIds, staleAfterMs = 3e4) {
		const now = /* @__PURE__ */ new Date();
		const finishedAt = now.toISOString();
		const staleBefore = new Date(now.getTime() - staleAfterMs).toISOString();
		const activeClause = activeJobIds.length > 0 ? `job_id IS NULL OR job_id NOT IN (${activeJobIds.map(() => "?").join(", ")})` : "1 = 1";
		this.db.prepare(`UPDATE pipeline_step_runs
         SET finished_at = ?,
             duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER),
             exit_code = COALESCE(exit_code, 1),
             status = 'failed'
         WHERE status = 'running'
           AND started_at <= ?
           AND (${activeClause})`).run(finishedAt, finishedAt, staleBefore, ...activeJobIds);
		this.db.prepare(`UPDATE pipeline_runs
         SET finished_at = ?,
             duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER),
             status = 'failed'
         WHERE status = 'running'
           AND started_at <= ?
           AND (${activeClause})`).run(finishedAt, finishedAt, staleBefore, ...activeJobIds);
	}
	createStepRun(params) {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = this.db.prepare(`INSERT INTO pipeline_step_runs
          (run_id, job_id, project_path, project_name, build_system, package_manager, execution_mode, command, java_home, pipeline_name, step_index, step_label, started_at, status, branch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)`).run(params.runId, params.jobId ?? null, params.projectPath, params.projectName, params.buildSystem, params.packageManager ?? null, params.executionMode ?? null, params.command, params.javaHome ?? null, params.pipelineName ?? null, params.stepIndex ?? null, params.stepLabel, now, params.branch ?? null);
		return Number(result.lastInsertRowid);
	}
	finishStepRun(params) {
		this.db.prepare(`UPDATE pipeline_step_runs
         SET finished_at = ?, duration_ms = ?, exit_code = ?, status = ?
         WHERE id = ?`).run((/* @__PURE__ */ new Date()).toISOString(), params.durationMs, params.exitCode, params.status, params.id);
	}
	appendStepLog(stepRunId, seq, stream, line) {
		this.db.prepare("INSERT INTO run_step_logs (step_run_id, seq, stream, line) VALUES (?, ?, ?, ?)").run(stepRunId, seq, stream, line);
	}
	getRecentRuns(opts) {
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
        s.step_label,
        s.started_at,
        s.finished_at,
        s.duration_ms,
        s.exit_code,
        s.status,
        s.branch
      FROM pipeline_step_runs s
    `;
		if (opts.pipeline) return this.db.prepare(`${select} WHERE s.pipeline_name = ? ORDER BY s.started_at DESC LIMIT ?`).all(opts.pipeline, opts.limit);
		if (opts.project) return this.db.prepare(`${select} WHERE s.project_path = ? ORDER BY s.started_at DESC LIMIT ?`).all(opts.project, opts.limit);
		return this.db.prepare(`${select} ORDER BY s.started_at DESC LIMIT ?`).all(opts.limit);
	}
	getBuildStats() {
		const totals = this.db.prepare(`SELECT
           COUNT(CASE WHEN status IN ('success', 'failed') THEN 1 END) AS total,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failure_count,
           AVG(CASE WHEN status IN ('success', 'failed') THEN duration_ms END) AS avg_duration_ms
         FROM pipeline_step_runs`).get() ?? {
			total: 0,
			success_count: 0,
			failure_count: 0,
			avg_duration_ms: null
		};
		const byPipeline = this.db.prepare(`SELECT
           pipeline_name AS name,
           COUNT(CASE WHEN status IN ('success', 'failed', 'launched') THEN 1 END) AS runs,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
           AVG(CASE WHEN status IN ('success', 'failed', 'launched') THEN duration_ms END) AS avg_ms
         FROM pipeline_runs
         WHERE pipeline_name IS NOT NULL
         GROUP BY pipeline_name
         ORDER BY runs DESC`).all().filter((row) => row.runs > 0).map((row) => ({
			name: row.name,
			runs: row.runs,
			successes: row.successes,
			avgMs: row.avg_ms
		}));
		const byProject = this.db.prepare(`SELECT
           project_path AS path,
           project_name AS name,
           COUNT(CASE WHEN status IN ('success', 'failed', 'launched') THEN 1 END) AS runs,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
           AVG(CASE WHEN status IN ('success', 'failed', 'launched') THEN duration_ms END) AS avg_ms
         FROM pipeline_step_runs
         GROUP BY project_path
         HAVING runs > 0
         ORDER BY runs DESC
         LIMIT 20`).all().map((row) => ({
			path: row.path,
			name: row.name,
			runs: row.runs,
			successes: row.successes,
			avgMs: row.avg_ms
		}));
		const slowestSteps = this.db.prepare(`SELECT
           step_label AS label,
           project_path AS path,
           AVG(duration_ms) AS avg_ms,
           COUNT(*) AS runs
         FROM pipeline_step_runs
         WHERE status = 'success' AND duration_ms IS NOT NULL
         GROUP BY project_path, step_label
         HAVING COUNT(*) >= 2
         ORDER BY avg_ms DESC
         LIMIT 10`).all().map((row) => ({
			label: row.label,
			path: row.path,
			avgMs: row.avg_ms,
			runs: row.runs
		}));
		return {
			totalBuilds: totals.total,
			successCount: totals.success_count,
			failureCount: totals.failure_count,
			avgDurationMs: totals.avg_duration_ms,
			byPipeline,
			byProject,
			slowestSteps
		};
	}
	getLastRunsByPipeline() {
		const rows = this.db.prepare(`SELECT pipeline_name, status, started_at, duration_ms, stopped_at
         FROM pipeline_runs
         WHERE pipeline_name IS NOT NULL
           AND id IN (
             SELECT MAX(id)
             FROM pipeline_runs
             WHERE pipeline_name IS NOT NULL
             GROUP BY pipeline_name
           )`).all();
		const result = {};
		for (const row of rows) result[row.pipeline_name] = {
			status: row.status,
			startedAt: row.started_at,
			durationMs: row.duration_ms,
			stoppedAt: row.stopped_at
		};
		return result;
	}
	getLastFailedStepIndex(pipelineName) {
		return this.db.prepare(`SELECT stopped_at
         FROM pipeline_runs
         WHERE pipeline_name = ?
           AND status = 'failed'
         ORDER BY started_at DESC
         LIMIT 1`).get(pipelineName)?.stopped_at ?? null;
	}
	getBuildLogs(stepRunId, opts) {
		const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 5e3);
		const beforeSeq = opts?.beforeSeq;
		const entries = beforeSeq === void 0 || beforeSeq === null ? this.db.prepare(`SELECT seq, stream, line
             FROM run_step_logs
             WHERE step_run_id = ?
             ORDER BY seq DESC
             LIMIT ?`).all(stepRunId, limit) : this.db.prepare(`SELECT seq, stream, line
             FROM run_step_logs
             WHERE step_run_id = ?
               AND seq < ?
             ORDER BY seq DESC
             LIMIT ?`).all(stepRunId, beforeSeq, limit);
		return {
			entries: [...entries].reverse(),
			nextBeforeSeq: entries.length === limit ? entries[entries.length - 1]?.seq ?? null : null
		};
	}
	clearBuildLogs() {
		this.db.exec("DELETE FROM run_step_logs");
	}
	clearAllBuilds() {
		this.db.exec("DELETE FROM run_step_logs");
		this.db.exec("DELETE FROM pipeline_step_runs");
		this.db.exec("DELETE FROM pipeline_runs");
	}
	close() {
		this.db.close();
	}
	initializeSchema(existed, dbPath) {
		if (!existed || this.isNewDatabaseFile(dbPath)) {
			this.db.exec(SCHEMA_SQL);
			this.db.prepare("INSERT INTO schema_meta (version) VALUES (?)").run(SCHEMA_VERSION);
			return;
		}
		try {
			if (!this.db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'`).get()) throw new StateCompatibilityError("State schema metadata is missing.");
			const currentVersion = this.db.prepare("SELECT version FROM schema_meta LIMIT 1").get()?.version ?? 0;
			if (currentVersion === SCHEMA_VERSION) return;
			if (currentVersion === 2 && SCHEMA_VERSION >= 3) {
				this.db.exec("ALTER TABLE pipeline_step_runs ADD COLUMN branch TEXT");
				this.db.prepare("UPDATE schema_meta SET version = ?").run(SCHEMA_VERSION);
				return;
			}
			if (currentVersion !== SCHEMA_VERSION) throw new StateCompatibilityError(`State schema version ${currentVersion} is incompatible with version ${SCHEMA_VERSION}.`);
		} catch (error) {
			if (error instanceof StateCompatibilityError) throw error;
			throw new StateCompatibilityError(error instanceof Error ? error.message : "State database could not be validated.");
		}
	}
	isNewDatabaseFile(dbPath) {
		try {
			return (0, node_fs.statSync)(dbPath).size === 0;
		} catch {
			return true;
		}
	}
};
function loadNodeSqlite() {
	if (cachedNodeSqlite) return cachedNodeSqlite;
	cachedNodeSqlite = require$1("node:sqlite");
	return cachedNodeSqlite;
}
//#endregion
//#region ../../packages/platform-node/dist/file-system.js
var NodeFileSystem = class {
	async exists(p) {
		try {
			await node_fs_promises.default.access(p);
			return true;
		} catch {
			return false;
		}
	}
	async readDir(p) {
		return node_fs_promises.default.readdir(p, { withFileTypes: true });
	}
	async readFile(p) {
		return node_fs_promises.default.readFile(p, "utf-8");
	}
	async writeFile(p, content) {
		await node_fs_promises.default.mkdir(node_path.default.dirname(p), { recursive: true });
		await node_fs_promises.default.writeFile(p, content, "utf-8");
	}
	async mkdir(p, options) {
		await node_fs_promises.default.mkdir(p, options);
	}
};
//#endregion
//#region ../../node_modules/.bun/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util) {
	util.assertEqual = (_) => {};
	function assertIs(_arg) {}
	util.assertIs = assertIs;
	function assertNever(_x) {
		throw new Error();
	}
	util.assertNever = assertNever;
	util.arrayToEnum = (items) => {
		const obj = {};
		for (const item of items) obj[item] = item;
		return obj;
	};
	util.getValidEnumValues = (obj) => {
		const validKeys = util.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
		const filtered = {};
		for (const k of validKeys) filtered[k] = obj[k];
		return util.objectValues(filtered);
	};
	util.objectValues = (obj) => {
		return util.objectKeys(obj).map(function(e) {
			return obj[e];
		});
	};
	util.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
		const keys = [];
		for (const key in object) if (Object.prototype.hasOwnProperty.call(object, key)) keys.push(key);
		return keys;
	};
	util.find = (arr, checker) => {
		for (const item of arr) if (checker(item)) return item;
	};
	util.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
	function joinValues(array, separator = " | ") {
		return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
	}
	util.joinValues = joinValues;
	util.jsonStringifyReplacer = (_, value) => {
		if (typeof value === "bigint") return value.toString();
		return value;
	};
})(util || (util = {}));
var objectUtil;
(function(objectUtil) {
	objectUtil.mergeShapes = (first, second) => {
		return {
			...first,
			...second
		};
	};
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
	"string",
	"nan",
	"number",
	"integer",
	"float",
	"boolean",
	"date",
	"bigint",
	"symbol",
	"function",
	"undefined",
	"null",
	"array",
	"object",
	"unknown",
	"promise",
	"void",
	"never",
	"map",
	"set"
]);
var getParsedType = (data) => {
	switch (typeof data) {
		case "undefined": return ZodParsedType.undefined;
		case "string": return ZodParsedType.string;
		case "number": return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
		case "boolean": return ZodParsedType.boolean;
		case "function": return ZodParsedType.function;
		case "bigint": return ZodParsedType.bigint;
		case "symbol": return ZodParsedType.symbol;
		case "object":
			if (Array.isArray(data)) return ZodParsedType.array;
			if (data === null) return ZodParsedType.null;
			if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") return ZodParsedType.promise;
			if (typeof Map !== "undefined" && data instanceof Map) return ZodParsedType.map;
			if (typeof Set !== "undefined" && data instanceof Set) return ZodParsedType.set;
			if (typeof Date !== "undefined" && data instanceof Date) return ZodParsedType.date;
			return ZodParsedType.object;
		default: return ZodParsedType.unknown;
	}
};
//#endregion
//#region ../../node_modules/.bun/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
	"invalid_type",
	"invalid_literal",
	"custom",
	"invalid_union",
	"invalid_union_discriminator",
	"invalid_enum_value",
	"unrecognized_keys",
	"invalid_arguments",
	"invalid_return_type",
	"invalid_date",
	"invalid_string",
	"too_small",
	"too_big",
	"invalid_intersection_types",
	"not_multiple_of",
	"not_finite"
]);
var ZodError = class ZodError extends Error {
	get errors() {
		return this.issues;
	}
	constructor(issues) {
		super();
		this.issues = [];
		this.addIssue = (sub) => {
			this.issues = [...this.issues, sub];
		};
		this.addIssues = (subs = []) => {
			this.issues = [...this.issues, ...subs];
		};
		const actualProto = new.target.prototype;
		if (Object.setPrototypeOf) Object.setPrototypeOf(this, actualProto);
		else this.__proto__ = actualProto;
		this.name = "ZodError";
		this.issues = issues;
	}
	format(_mapper) {
		const mapper = _mapper || function(issue) {
			return issue.message;
		};
		const fieldErrors = { _errors: [] };
		const processError = (error) => {
			for (const issue of error.issues) if (issue.code === "invalid_union") issue.unionErrors.map(processError);
			else if (issue.code === "invalid_return_type") processError(issue.returnTypeError);
			else if (issue.code === "invalid_arguments") processError(issue.argumentsError);
			else if (issue.path.length === 0) fieldErrors._errors.push(mapper(issue));
			else {
				let curr = fieldErrors;
				let i = 0;
				while (i < issue.path.length) {
					const el = issue.path[i];
					if (!(i === issue.path.length - 1)) curr[el] = curr[el] || { _errors: [] };
					else {
						curr[el] = curr[el] || { _errors: [] };
						curr[el]._errors.push(mapper(issue));
					}
					curr = curr[el];
					i++;
				}
			}
		};
		processError(this);
		return fieldErrors;
	}
	static assert(value) {
		if (!(value instanceof ZodError)) throw new Error(`Not a ZodError: ${value}`);
	}
	toString() {
		return this.message;
	}
	get message() {
		return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
	}
	get isEmpty() {
		return this.issues.length === 0;
	}
	flatten(mapper = (issue) => issue.message) {
		const fieldErrors = {};
		const formErrors = [];
		for (const sub of this.issues) if (sub.path.length > 0) {
			const firstEl = sub.path[0];
			fieldErrors[firstEl] = fieldErrors[firstEl] || [];
			fieldErrors[firstEl].push(mapper(sub));
		} else formErrors.push(mapper(sub));
		return {
			formErrors,
			fieldErrors
		};
	}
	get formErrors() {
		return this.flatten();
	}
};
ZodError.create = (issues) => {
	return new ZodError(issues);
};
//#endregion
//#region ../../node_modules/.bun/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
	let message;
	switch (issue.code) {
		case ZodIssueCode.invalid_type:
			if (issue.received === ZodParsedType.undefined) message = "Required";
			else message = `Expected ${issue.expected}, received ${issue.received}`;
			break;
		case ZodIssueCode.invalid_literal:
			message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
			break;
		case ZodIssueCode.unrecognized_keys:
			message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
			break;
		case ZodIssueCode.invalid_union:
			message = `Invalid input`;
			break;
		case ZodIssueCode.invalid_union_discriminator:
			message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
			break;
		case ZodIssueCode.invalid_enum_value:
			message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
			break;
		case ZodIssueCode.invalid_arguments:
			message = `Invalid function arguments`;
			break;
		case ZodIssueCode.invalid_return_type:
			message = `Invalid function return type`;
			break;
		case ZodIssueCode.invalid_date:
			message = `Invalid date`;
			break;
		case ZodIssueCode.invalid_string:
			if (typeof issue.validation === "object") if ("includes" in issue.validation) {
				message = `Invalid input: must include "${issue.validation.includes}"`;
				if (typeof issue.validation.position === "number") message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
			} else if ("startsWith" in issue.validation) message = `Invalid input: must start with "${issue.validation.startsWith}"`;
			else if ("endsWith" in issue.validation) message = `Invalid input: must end with "${issue.validation.endsWith}"`;
			else util.assertNever(issue.validation);
			else if (issue.validation !== "regex") message = `Invalid ${issue.validation}`;
			else message = "Invalid";
			break;
		case ZodIssueCode.too_small:
			if (issue.type === "array") message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
			else if (issue.type === "string") message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
			else if (issue.type === "number") message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
			else if (issue.type === "bigint") message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
			else if (issue.type === "date") message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
			else message = "Invalid input";
			break;
		case ZodIssueCode.too_big:
			if (issue.type === "array") message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
			else if (issue.type === "string") message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
			else if (issue.type === "number") message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
			else if (issue.type === "bigint") message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
			else if (issue.type === "date") message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
			else message = "Invalid input";
			break;
		case ZodIssueCode.custom:
			message = `Invalid input`;
			break;
		case ZodIssueCode.invalid_intersection_types:
			message = `Intersection results could not be merged`;
			break;
		case ZodIssueCode.not_multiple_of:
			message = `Number must be a multiple of ${issue.multipleOf}`;
			break;
		case ZodIssueCode.not_finite:
			message = "Number must be finite";
			break;
		default:
			message = _ctx.defaultError;
			util.assertNever(issue);
	}
	return { message };
};
//#endregion
//#region ../../node_modules/.bun/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = errorMap;
function getErrorMap() {
	return overrideErrorMap;
}
//#endregion
//#region ../../node_modules/.bun/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
	const { data, path, errorMaps, issueData } = params;
	const fullPath = [...path, ...issueData.path || []];
	const fullIssue = {
		...issueData,
		path: fullPath
	};
	if (issueData.message !== void 0) return {
		...issueData,
		path: fullPath,
		message: issueData.message
	};
	let errorMessage = "";
	const maps = errorMaps.filter((m) => !!m).slice().reverse();
	for (const map of maps) errorMessage = map(fullIssue, {
		data,
		defaultError: errorMessage
	}).message;
	return {
		...issueData,
		path: fullPath,
		message: errorMessage
	};
};
function addIssueToContext(ctx, issueData) {
	const overrideMap = getErrorMap();
	const issue = makeIssue({
		issueData,
		data: ctx.data,
		path: ctx.path,
		errorMaps: [
			ctx.common.contextualErrorMap,
			ctx.schemaErrorMap,
			overrideMap,
			overrideMap === errorMap ? void 0 : errorMap
		].filter((x) => !!x)
	});
	ctx.common.issues.push(issue);
}
var ParseStatus = class ParseStatus {
	constructor() {
		this.value = "valid";
	}
	dirty() {
		if (this.value === "valid") this.value = "dirty";
	}
	abort() {
		if (this.value !== "aborted") this.value = "aborted";
	}
	static mergeArray(status, results) {
		const arrayValue = [];
		for (const s of results) {
			if (s.status === "aborted") return INVALID;
			if (s.status === "dirty") status.dirty();
			arrayValue.push(s.value);
		}
		return {
			status: status.value,
			value: arrayValue
		};
	}
	static async mergeObjectAsync(status, pairs) {
		const syncPairs = [];
		for (const pair of pairs) {
			const key = await pair.key;
			const value = await pair.value;
			syncPairs.push({
				key,
				value
			});
		}
		return ParseStatus.mergeObjectSync(status, syncPairs);
	}
	static mergeObjectSync(status, pairs) {
		const finalObject = {};
		for (const pair of pairs) {
			const { key, value } = pair;
			if (key.status === "aborted") return INVALID;
			if (value.status === "aborted") return INVALID;
			if (key.status === "dirty") status.dirty();
			if (value.status === "dirty") status.dirty();
			if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) finalObject[key.value] = value.value;
		}
		return {
			status: status.value,
			value: finalObject
		};
	}
};
var INVALID = Object.freeze({ status: "aborted" });
var DIRTY = (value) => ({
	status: "dirty",
	value
});
var OK = (value) => ({
	status: "valid",
	value
});
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
//#endregion
//#region ../../node_modules/.bun/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil) {
	errorUtil.errToObj = (message) => typeof message === "string" ? { message } : message || {};
	errorUtil.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));
//#endregion
//#region ../../node_modules/.bun/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
	constructor(parent, value, path, key) {
		this._cachedPath = [];
		this.parent = parent;
		this.data = value;
		this._path = path;
		this._key = key;
	}
	get path() {
		if (!this._cachedPath.length) if (Array.isArray(this._key)) this._cachedPath.push(...this._path, ...this._key);
		else this._cachedPath.push(...this._path, this._key);
		return this._cachedPath;
	}
};
var handleResult = (ctx, result) => {
	if (isValid(result)) return {
		success: true,
		data: result.value
	};
	else {
		if (!ctx.common.issues.length) throw new Error("Validation failed but no issues detected.");
		return {
			success: false,
			get error() {
				if (this._error) return this._error;
				this._error = new ZodError(ctx.common.issues);
				return this._error;
			}
		};
	}
};
function processCreateParams(params) {
	if (!params) return {};
	const { errorMap, invalid_type_error, required_error, description } = params;
	if (errorMap && (invalid_type_error || required_error)) throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
	if (errorMap) return {
		errorMap,
		description
	};
	const customMap = (iss, ctx) => {
		const { message } = params;
		if (iss.code === "invalid_enum_value") return { message: message ?? ctx.defaultError };
		if (typeof ctx.data === "undefined") return { message: message ?? required_error ?? ctx.defaultError };
		if (iss.code !== "invalid_type") return { message: ctx.defaultError };
		return { message: message ?? invalid_type_error ?? ctx.defaultError };
	};
	return {
		errorMap: customMap,
		description
	};
}
var ZodType = class {
	get description() {
		return this._def.description;
	}
	_getType(input) {
		return getParsedType(input.data);
	}
	_getOrReturnCtx(input, ctx) {
		return ctx || {
			common: input.parent.common,
			data: input.data,
			parsedType: getParsedType(input.data),
			schemaErrorMap: this._def.errorMap,
			path: input.path,
			parent: input.parent
		};
	}
	_processInputParams(input) {
		return {
			status: new ParseStatus(),
			ctx: {
				common: input.parent.common,
				data: input.data,
				parsedType: getParsedType(input.data),
				schemaErrorMap: this._def.errorMap,
				path: input.path,
				parent: input.parent
			}
		};
	}
	_parseSync(input) {
		const result = this._parse(input);
		if (isAsync(result)) throw new Error("Synchronous parse encountered promise.");
		return result;
	}
	_parseAsync(input) {
		const result = this._parse(input);
		return Promise.resolve(result);
	}
	parse(data, params) {
		const result = this.safeParse(data, params);
		if (result.success) return result.data;
		throw result.error;
	}
	safeParse(data, params) {
		const ctx = {
			common: {
				issues: [],
				async: params?.async ?? false,
				contextualErrorMap: params?.errorMap
			},
			path: params?.path || [],
			schemaErrorMap: this._def.errorMap,
			parent: null,
			data,
			parsedType: getParsedType(data)
		};
		return handleResult(ctx, this._parseSync({
			data,
			path: ctx.path,
			parent: ctx
		}));
	}
	"~validate"(data) {
		const ctx = {
			common: {
				issues: [],
				async: !!this["~standard"].async
			},
			path: [],
			schemaErrorMap: this._def.errorMap,
			parent: null,
			data,
			parsedType: getParsedType(data)
		};
		if (!this["~standard"].async) try {
			const result = this._parseSync({
				data,
				path: [],
				parent: ctx
			});
			return isValid(result) ? { value: result.value } : { issues: ctx.common.issues };
		} catch (err) {
			if (err?.message?.toLowerCase()?.includes("encountered")) this["~standard"].async = true;
			ctx.common = {
				issues: [],
				async: true
			};
		}
		return this._parseAsync({
			data,
			path: [],
			parent: ctx
		}).then((result) => isValid(result) ? { value: result.value } : { issues: ctx.common.issues });
	}
	async parseAsync(data, params) {
		const result = await this.safeParseAsync(data, params);
		if (result.success) return result.data;
		throw result.error;
	}
	async safeParseAsync(data, params) {
		const ctx = {
			common: {
				issues: [],
				contextualErrorMap: params?.errorMap,
				async: true
			},
			path: params?.path || [],
			schemaErrorMap: this._def.errorMap,
			parent: null,
			data,
			parsedType: getParsedType(data)
		};
		const maybeAsyncResult = this._parse({
			data,
			path: ctx.path,
			parent: ctx
		});
		return handleResult(ctx, await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult)));
	}
	refine(check, message) {
		const getIssueProperties = (val) => {
			if (typeof message === "string" || typeof message === "undefined") return { message };
			else if (typeof message === "function") return message(val);
			else return message;
		};
		return this._refinement((val, ctx) => {
			const result = check(val);
			const setError = () => ctx.addIssue({
				code: ZodIssueCode.custom,
				...getIssueProperties(val)
			});
			if (typeof Promise !== "undefined" && result instanceof Promise) return result.then((data) => {
				if (!data) {
					setError();
					return false;
				} else return true;
			});
			if (!result) {
				setError();
				return false;
			} else return true;
		});
	}
	refinement(check, refinementData) {
		return this._refinement((val, ctx) => {
			if (!check(val)) {
				ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
				return false;
			} else return true;
		});
	}
	_refinement(refinement) {
		return new ZodEffects({
			schema: this,
			typeName: ZodFirstPartyTypeKind.ZodEffects,
			effect: {
				type: "refinement",
				refinement
			}
		});
	}
	superRefine(refinement) {
		return this._refinement(refinement);
	}
	constructor(def) {
		/** Alias of safeParseAsync */
		this.spa = this.safeParseAsync;
		this._def = def;
		this.parse = this.parse.bind(this);
		this.safeParse = this.safeParse.bind(this);
		this.parseAsync = this.parseAsync.bind(this);
		this.safeParseAsync = this.safeParseAsync.bind(this);
		this.spa = this.spa.bind(this);
		this.refine = this.refine.bind(this);
		this.refinement = this.refinement.bind(this);
		this.superRefine = this.superRefine.bind(this);
		this.optional = this.optional.bind(this);
		this.nullable = this.nullable.bind(this);
		this.nullish = this.nullish.bind(this);
		this.array = this.array.bind(this);
		this.promise = this.promise.bind(this);
		this.or = this.or.bind(this);
		this.and = this.and.bind(this);
		this.transform = this.transform.bind(this);
		this.brand = this.brand.bind(this);
		this.default = this.default.bind(this);
		this.catch = this.catch.bind(this);
		this.describe = this.describe.bind(this);
		this.pipe = this.pipe.bind(this);
		this.readonly = this.readonly.bind(this);
		this.isNullable = this.isNullable.bind(this);
		this.isOptional = this.isOptional.bind(this);
		this["~standard"] = {
			version: 1,
			vendor: "zod",
			validate: (data) => this["~validate"](data)
		};
	}
	optional() {
		return ZodOptional.create(this, this._def);
	}
	nullable() {
		return ZodNullable.create(this, this._def);
	}
	nullish() {
		return this.nullable().optional();
	}
	array() {
		return ZodArray.create(this);
	}
	promise() {
		return ZodPromise.create(this, this._def);
	}
	or(option) {
		return ZodUnion.create([this, option], this._def);
	}
	and(incoming) {
		return ZodIntersection.create(this, incoming, this._def);
	}
	transform(transform) {
		return new ZodEffects({
			...processCreateParams(this._def),
			schema: this,
			typeName: ZodFirstPartyTypeKind.ZodEffects,
			effect: {
				type: "transform",
				transform
			}
		});
	}
	default(def) {
		const defaultValueFunc = typeof def === "function" ? def : () => def;
		return new ZodDefault({
			...processCreateParams(this._def),
			innerType: this,
			defaultValue: defaultValueFunc,
			typeName: ZodFirstPartyTypeKind.ZodDefault
		});
	}
	brand() {
		return new ZodBranded({
			typeName: ZodFirstPartyTypeKind.ZodBranded,
			type: this,
			...processCreateParams(this._def)
		});
	}
	catch(def) {
		const catchValueFunc = typeof def === "function" ? def : () => def;
		return new ZodCatch({
			...processCreateParams(this._def),
			innerType: this,
			catchValue: catchValueFunc,
			typeName: ZodFirstPartyTypeKind.ZodCatch
		});
	}
	describe(description) {
		const This = this.constructor;
		return new This({
			...this._def,
			description
		});
	}
	pipe(target) {
		return ZodPipeline.create(this, target);
	}
	readonly() {
		return ZodReadonly.create(this);
	}
	isOptional() {
		return this.safeParse(void 0).success;
	}
	isNullable() {
		return this.safeParse(null).success;
	}
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
	let secondsRegexSource = `[0-5]\\d`;
	if (args.precision) secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
	else if (args.precision == null) secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
	const secondsQuantifier = args.precision ? "+" : "?";
	return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
	return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
	let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
	const opts = [];
	opts.push(args.local ? `Z?` : `Z`);
	if (args.offset) opts.push(`([+-]\\d{2}:?\\d{2})`);
	regex = `${regex}(${opts.join("|")})`;
	return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
	if ((version === "v4" || !version) && ipv4Regex.test(ip)) return true;
	if ((version === "v6" || !version) && ipv6Regex.test(ip)) return true;
	return false;
}
function isValidJWT(jwt, alg) {
	if (!jwtRegex.test(jwt)) return false;
	try {
		const [header] = jwt.split(".");
		if (!header) return false;
		const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
		const decoded = JSON.parse(atob(base64));
		if (typeof decoded !== "object" || decoded === null) return false;
		if ("typ" in decoded && decoded?.typ !== "JWT") return false;
		if (!decoded.alg) return false;
		if (alg && decoded.alg !== alg) return false;
		return true;
	} catch {
		return false;
	}
}
function isValidCidr(ip, version) {
	if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) return true;
	if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) return true;
	return false;
}
var ZodString = class ZodString extends ZodType {
	_parse(input) {
		if (this._def.coerce) input.data = String(input.data);
		if (this._getType(input) !== ZodParsedType.string) {
			const ctx = this._getOrReturnCtx(input);
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.string,
				received: ctx.parsedType
			});
			return INVALID;
		}
		const status = new ParseStatus();
		let ctx = void 0;
		for (const check of this._def.checks) if (check.kind === "min") {
			if (input.data.length < check.value) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_small,
					minimum: check.value,
					type: "string",
					inclusive: true,
					exact: false,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "max") {
			if (input.data.length > check.value) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_big,
					maximum: check.value,
					type: "string",
					inclusive: true,
					exact: false,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "length") {
			const tooBig = input.data.length > check.value;
			const tooSmall = input.data.length < check.value;
			if (tooBig || tooSmall) {
				ctx = this._getOrReturnCtx(input, ctx);
				if (tooBig) addIssueToContext(ctx, {
					code: ZodIssueCode.too_big,
					maximum: check.value,
					type: "string",
					inclusive: true,
					exact: true,
					message: check.message
				});
				else if (tooSmall) addIssueToContext(ctx, {
					code: ZodIssueCode.too_small,
					minimum: check.value,
					type: "string",
					inclusive: true,
					exact: true,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "email") {
			if (!emailRegex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "email",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "emoji") {
			if (!emojiRegex) emojiRegex = new RegExp(_emojiRegex, "u");
			if (!emojiRegex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "emoji",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "uuid") {
			if (!uuidRegex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "uuid",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "nanoid") {
			if (!nanoidRegex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "nanoid",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "cuid") {
			if (!cuidRegex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "cuid",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "cuid2") {
			if (!cuid2Regex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "cuid2",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "ulid") {
			if (!ulidRegex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "ulid",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "url") try {
			new URL(input.data);
		} catch {
			ctx = this._getOrReturnCtx(input, ctx);
			addIssueToContext(ctx, {
				validation: "url",
				code: ZodIssueCode.invalid_string,
				message: check.message
			});
			status.dirty();
		}
		else if (check.kind === "regex") {
			check.regex.lastIndex = 0;
			if (!check.regex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "regex",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "trim") input.data = input.data.trim();
		else if (check.kind === "includes") {
			if (!input.data.includes(check.value, check.position)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.invalid_string,
					validation: {
						includes: check.value,
						position: check.position
					},
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "toLowerCase") input.data = input.data.toLowerCase();
		else if (check.kind === "toUpperCase") input.data = input.data.toUpperCase();
		else if (check.kind === "startsWith") {
			if (!input.data.startsWith(check.value)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.invalid_string,
					validation: { startsWith: check.value },
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "endsWith") {
			if (!input.data.endsWith(check.value)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.invalid_string,
					validation: { endsWith: check.value },
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "datetime") {
			if (!datetimeRegex(check).test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.invalid_string,
					validation: "datetime",
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "date") {
			if (!dateRegex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.invalid_string,
					validation: "date",
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "time") {
			if (!timeRegex(check).test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.invalid_string,
					validation: "time",
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "duration") {
			if (!durationRegex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "duration",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "ip") {
			if (!isValidIP(input.data, check.version)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "ip",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "jwt") {
			if (!isValidJWT(input.data, check.alg)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "jwt",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "cidr") {
			if (!isValidCidr(input.data, check.version)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "cidr",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "base64") {
			if (!base64Regex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "base64",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "base64url") {
			if (!base64urlRegex.test(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					validation: "base64url",
					code: ZodIssueCode.invalid_string,
					message: check.message
				});
				status.dirty();
			}
		} else util.assertNever(check);
		return {
			status: status.value,
			value: input.data
		};
	}
	_regex(regex, validation, message) {
		return this.refinement((data) => regex.test(data), {
			validation,
			code: ZodIssueCode.invalid_string,
			...errorUtil.errToObj(message)
		});
	}
	_addCheck(check) {
		return new ZodString({
			...this._def,
			checks: [...this._def.checks, check]
		});
	}
	email(message) {
		return this._addCheck({
			kind: "email",
			...errorUtil.errToObj(message)
		});
	}
	url(message) {
		return this._addCheck({
			kind: "url",
			...errorUtil.errToObj(message)
		});
	}
	emoji(message) {
		return this._addCheck({
			kind: "emoji",
			...errorUtil.errToObj(message)
		});
	}
	uuid(message) {
		return this._addCheck({
			kind: "uuid",
			...errorUtil.errToObj(message)
		});
	}
	nanoid(message) {
		return this._addCheck({
			kind: "nanoid",
			...errorUtil.errToObj(message)
		});
	}
	cuid(message) {
		return this._addCheck({
			kind: "cuid",
			...errorUtil.errToObj(message)
		});
	}
	cuid2(message) {
		return this._addCheck({
			kind: "cuid2",
			...errorUtil.errToObj(message)
		});
	}
	ulid(message) {
		return this._addCheck({
			kind: "ulid",
			...errorUtil.errToObj(message)
		});
	}
	base64(message) {
		return this._addCheck({
			kind: "base64",
			...errorUtil.errToObj(message)
		});
	}
	base64url(message) {
		return this._addCheck({
			kind: "base64url",
			...errorUtil.errToObj(message)
		});
	}
	jwt(options) {
		return this._addCheck({
			kind: "jwt",
			...errorUtil.errToObj(options)
		});
	}
	ip(options) {
		return this._addCheck({
			kind: "ip",
			...errorUtil.errToObj(options)
		});
	}
	cidr(options) {
		return this._addCheck({
			kind: "cidr",
			...errorUtil.errToObj(options)
		});
	}
	datetime(options) {
		if (typeof options === "string") return this._addCheck({
			kind: "datetime",
			precision: null,
			offset: false,
			local: false,
			message: options
		});
		return this._addCheck({
			kind: "datetime",
			precision: typeof options?.precision === "undefined" ? null : options?.precision,
			offset: options?.offset ?? false,
			local: options?.local ?? false,
			...errorUtil.errToObj(options?.message)
		});
	}
	date(message) {
		return this._addCheck({
			kind: "date",
			message
		});
	}
	time(options) {
		if (typeof options === "string") return this._addCheck({
			kind: "time",
			precision: null,
			message: options
		});
		return this._addCheck({
			kind: "time",
			precision: typeof options?.precision === "undefined" ? null : options?.precision,
			...errorUtil.errToObj(options?.message)
		});
	}
	duration(message) {
		return this._addCheck({
			kind: "duration",
			...errorUtil.errToObj(message)
		});
	}
	regex(regex, message) {
		return this._addCheck({
			kind: "regex",
			regex,
			...errorUtil.errToObj(message)
		});
	}
	includes(value, options) {
		return this._addCheck({
			kind: "includes",
			value,
			position: options?.position,
			...errorUtil.errToObj(options?.message)
		});
	}
	startsWith(value, message) {
		return this._addCheck({
			kind: "startsWith",
			value,
			...errorUtil.errToObj(message)
		});
	}
	endsWith(value, message) {
		return this._addCheck({
			kind: "endsWith",
			value,
			...errorUtil.errToObj(message)
		});
	}
	min(minLength, message) {
		return this._addCheck({
			kind: "min",
			value: minLength,
			...errorUtil.errToObj(message)
		});
	}
	max(maxLength, message) {
		return this._addCheck({
			kind: "max",
			value: maxLength,
			...errorUtil.errToObj(message)
		});
	}
	length(len, message) {
		return this._addCheck({
			kind: "length",
			value: len,
			...errorUtil.errToObj(message)
		});
	}
	/**
	* Equivalent to `.min(1)`
	*/
	nonempty(message) {
		return this.min(1, errorUtil.errToObj(message));
	}
	trim() {
		return new ZodString({
			...this._def,
			checks: [...this._def.checks, { kind: "trim" }]
		});
	}
	toLowerCase() {
		return new ZodString({
			...this._def,
			checks: [...this._def.checks, { kind: "toLowerCase" }]
		});
	}
	toUpperCase() {
		return new ZodString({
			...this._def,
			checks: [...this._def.checks, { kind: "toUpperCase" }]
		});
	}
	get isDatetime() {
		return !!this._def.checks.find((ch) => ch.kind === "datetime");
	}
	get isDate() {
		return !!this._def.checks.find((ch) => ch.kind === "date");
	}
	get isTime() {
		return !!this._def.checks.find((ch) => ch.kind === "time");
	}
	get isDuration() {
		return !!this._def.checks.find((ch) => ch.kind === "duration");
	}
	get isEmail() {
		return !!this._def.checks.find((ch) => ch.kind === "email");
	}
	get isURL() {
		return !!this._def.checks.find((ch) => ch.kind === "url");
	}
	get isEmoji() {
		return !!this._def.checks.find((ch) => ch.kind === "emoji");
	}
	get isUUID() {
		return !!this._def.checks.find((ch) => ch.kind === "uuid");
	}
	get isNANOID() {
		return !!this._def.checks.find((ch) => ch.kind === "nanoid");
	}
	get isCUID() {
		return !!this._def.checks.find((ch) => ch.kind === "cuid");
	}
	get isCUID2() {
		return !!this._def.checks.find((ch) => ch.kind === "cuid2");
	}
	get isULID() {
		return !!this._def.checks.find((ch) => ch.kind === "ulid");
	}
	get isIP() {
		return !!this._def.checks.find((ch) => ch.kind === "ip");
	}
	get isCIDR() {
		return !!this._def.checks.find((ch) => ch.kind === "cidr");
	}
	get isBase64() {
		return !!this._def.checks.find((ch) => ch.kind === "base64");
	}
	get isBase64url() {
		return !!this._def.checks.find((ch) => ch.kind === "base64url");
	}
	get minLength() {
		let min = null;
		for (const ch of this._def.checks) if (ch.kind === "min") {
			if (min === null || ch.value > min) min = ch.value;
		}
		return min;
	}
	get maxLength() {
		let max = null;
		for (const ch of this._def.checks) if (ch.kind === "max") {
			if (max === null || ch.value < max) max = ch.value;
		}
		return max;
	}
};
ZodString.create = (params) => {
	return new ZodString({
		checks: [],
		typeName: ZodFirstPartyTypeKind.ZodString,
		coerce: params?.coerce ?? false,
		...processCreateParams(params)
	});
};
function floatSafeRemainder(val, step) {
	const valDecCount = (val.toString().split(".")[1] || "").length;
	const stepDecCount = (step.toString().split(".")[1] || "").length;
	const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
	return Number.parseInt(val.toFixed(decCount).replace(".", "")) % Number.parseInt(step.toFixed(decCount).replace(".", "")) / 10 ** decCount;
}
var ZodNumber = class ZodNumber extends ZodType {
	constructor() {
		super(...arguments);
		this.min = this.gte;
		this.max = this.lte;
		this.step = this.multipleOf;
	}
	_parse(input) {
		if (this._def.coerce) input.data = Number(input.data);
		if (this._getType(input) !== ZodParsedType.number) {
			const ctx = this._getOrReturnCtx(input);
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.number,
				received: ctx.parsedType
			});
			return INVALID;
		}
		let ctx = void 0;
		const status = new ParseStatus();
		for (const check of this._def.checks) if (check.kind === "int") {
			if (!util.isInteger(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.invalid_type,
					expected: "integer",
					received: "float",
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "min") {
			if (check.inclusive ? input.data < check.value : input.data <= check.value) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_small,
					minimum: check.value,
					type: "number",
					inclusive: check.inclusive,
					exact: false,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "max") {
			if (check.inclusive ? input.data > check.value : input.data >= check.value) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_big,
					maximum: check.value,
					type: "number",
					inclusive: check.inclusive,
					exact: false,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "multipleOf") {
			if (floatSafeRemainder(input.data, check.value) !== 0) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.not_multiple_of,
					multipleOf: check.value,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "finite") {
			if (!Number.isFinite(input.data)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.not_finite,
					message: check.message
				});
				status.dirty();
			}
		} else util.assertNever(check);
		return {
			status: status.value,
			value: input.data
		};
	}
	gte(value, message) {
		return this.setLimit("min", value, true, errorUtil.toString(message));
	}
	gt(value, message) {
		return this.setLimit("min", value, false, errorUtil.toString(message));
	}
	lte(value, message) {
		return this.setLimit("max", value, true, errorUtil.toString(message));
	}
	lt(value, message) {
		return this.setLimit("max", value, false, errorUtil.toString(message));
	}
	setLimit(kind, value, inclusive, message) {
		return new ZodNumber({
			...this._def,
			checks: [...this._def.checks, {
				kind,
				value,
				inclusive,
				message: errorUtil.toString(message)
			}]
		});
	}
	_addCheck(check) {
		return new ZodNumber({
			...this._def,
			checks: [...this._def.checks, check]
		});
	}
	int(message) {
		return this._addCheck({
			kind: "int",
			message: errorUtil.toString(message)
		});
	}
	positive(message) {
		return this._addCheck({
			kind: "min",
			value: 0,
			inclusive: false,
			message: errorUtil.toString(message)
		});
	}
	negative(message) {
		return this._addCheck({
			kind: "max",
			value: 0,
			inclusive: false,
			message: errorUtil.toString(message)
		});
	}
	nonpositive(message) {
		return this._addCheck({
			kind: "max",
			value: 0,
			inclusive: true,
			message: errorUtil.toString(message)
		});
	}
	nonnegative(message) {
		return this._addCheck({
			kind: "min",
			value: 0,
			inclusive: true,
			message: errorUtil.toString(message)
		});
	}
	multipleOf(value, message) {
		return this._addCheck({
			kind: "multipleOf",
			value,
			message: errorUtil.toString(message)
		});
	}
	finite(message) {
		return this._addCheck({
			kind: "finite",
			message: errorUtil.toString(message)
		});
	}
	safe(message) {
		return this._addCheck({
			kind: "min",
			inclusive: true,
			value: Number.MIN_SAFE_INTEGER,
			message: errorUtil.toString(message)
		})._addCheck({
			kind: "max",
			inclusive: true,
			value: Number.MAX_SAFE_INTEGER,
			message: errorUtil.toString(message)
		});
	}
	get minValue() {
		let min = null;
		for (const ch of this._def.checks) if (ch.kind === "min") {
			if (min === null || ch.value > min) min = ch.value;
		}
		return min;
	}
	get maxValue() {
		let max = null;
		for (const ch of this._def.checks) if (ch.kind === "max") {
			if (max === null || ch.value < max) max = ch.value;
		}
		return max;
	}
	get isInt() {
		return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
	}
	get isFinite() {
		let max = null;
		let min = null;
		for (const ch of this._def.checks) if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") return true;
		else if (ch.kind === "min") {
			if (min === null || ch.value > min) min = ch.value;
		} else if (ch.kind === "max") {
			if (max === null || ch.value < max) max = ch.value;
		}
		return Number.isFinite(min) && Number.isFinite(max);
	}
};
ZodNumber.create = (params) => {
	return new ZodNumber({
		checks: [],
		typeName: ZodFirstPartyTypeKind.ZodNumber,
		coerce: params?.coerce || false,
		...processCreateParams(params)
	});
};
var ZodBigInt = class ZodBigInt extends ZodType {
	constructor() {
		super(...arguments);
		this.min = this.gte;
		this.max = this.lte;
	}
	_parse(input) {
		if (this._def.coerce) try {
			input.data = BigInt(input.data);
		} catch {
			return this._getInvalidInput(input);
		}
		if (this._getType(input) !== ZodParsedType.bigint) return this._getInvalidInput(input);
		let ctx = void 0;
		const status = new ParseStatus();
		for (const check of this._def.checks) if (check.kind === "min") {
			if (check.inclusive ? input.data < check.value : input.data <= check.value) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_small,
					type: "bigint",
					minimum: check.value,
					inclusive: check.inclusive,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "max") {
			if (check.inclusive ? input.data > check.value : input.data >= check.value) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_big,
					type: "bigint",
					maximum: check.value,
					inclusive: check.inclusive,
					message: check.message
				});
				status.dirty();
			}
		} else if (check.kind === "multipleOf") {
			if (input.data % check.value !== BigInt(0)) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.not_multiple_of,
					multipleOf: check.value,
					message: check.message
				});
				status.dirty();
			}
		} else util.assertNever(check);
		return {
			status: status.value,
			value: input.data
		};
	}
	_getInvalidInput(input) {
		const ctx = this._getOrReturnCtx(input);
		addIssueToContext(ctx, {
			code: ZodIssueCode.invalid_type,
			expected: ZodParsedType.bigint,
			received: ctx.parsedType
		});
		return INVALID;
	}
	gte(value, message) {
		return this.setLimit("min", value, true, errorUtil.toString(message));
	}
	gt(value, message) {
		return this.setLimit("min", value, false, errorUtil.toString(message));
	}
	lte(value, message) {
		return this.setLimit("max", value, true, errorUtil.toString(message));
	}
	lt(value, message) {
		return this.setLimit("max", value, false, errorUtil.toString(message));
	}
	setLimit(kind, value, inclusive, message) {
		return new ZodBigInt({
			...this._def,
			checks: [...this._def.checks, {
				kind,
				value,
				inclusive,
				message: errorUtil.toString(message)
			}]
		});
	}
	_addCheck(check) {
		return new ZodBigInt({
			...this._def,
			checks: [...this._def.checks, check]
		});
	}
	positive(message) {
		return this._addCheck({
			kind: "min",
			value: BigInt(0),
			inclusive: false,
			message: errorUtil.toString(message)
		});
	}
	negative(message) {
		return this._addCheck({
			kind: "max",
			value: BigInt(0),
			inclusive: false,
			message: errorUtil.toString(message)
		});
	}
	nonpositive(message) {
		return this._addCheck({
			kind: "max",
			value: BigInt(0),
			inclusive: true,
			message: errorUtil.toString(message)
		});
	}
	nonnegative(message) {
		return this._addCheck({
			kind: "min",
			value: BigInt(0),
			inclusive: true,
			message: errorUtil.toString(message)
		});
	}
	multipleOf(value, message) {
		return this._addCheck({
			kind: "multipleOf",
			value,
			message: errorUtil.toString(message)
		});
	}
	get minValue() {
		let min = null;
		for (const ch of this._def.checks) if (ch.kind === "min") {
			if (min === null || ch.value > min) min = ch.value;
		}
		return min;
	}
	get maxValue() {
		let max = null;
		for (const ch of this._def.checks) if (ch.kind === "max") {
			if (max === null || ch.value < max) max = ch.value;
		}
		return max;
	}
};
ZodBigInt.create = (params) => {
	return new ZodBigInt({
		checks: [],
		typeName: ZodFirstPartyTypeKind.ZodBigInt,
		coerce: params?.coerce ?? false,
		...processCreateParams(params)
	});
};
var ZodBoolean = class extends ZodType {
	_parse(input) {
		if (this._def.coerce) input.data = Boolean(input.data);
		if (this._getType(input) !== ZodParsedType.boolean) {
			const ctx = this._getOrReturnCtx(input);
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.boolean,
				received: ctx.parsedType
			});
			return INVALID;
		}
		return OK(input.data);
	}
};
ZodBoolean.create = (params) => {
	return new ZodBoolean({
		typeName: ZodFirstPartyTypeKind.ZodBoolean,
		coerce: params?.coerce || false,
		...processCreateParams(params)
	});
};
var ZodDate = class ZodDate extends ZodType {
	_parse(input) {
		if (this._def.coerce) input.data = new Date(input.data);
		if (this._getType(input) !== ZodParsedType.date) {
			const ctx = this._getOrReturnCtx(input);
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.date,
				received: ctx.parsedType
			});
			return INVALID;
		}
		if (Number.isNaN(input.data.getTime())) {
			addIssueToContext(this._getOrReturnCtx(input), { code: ZodIssueCode.invalid_date });
			return INVALID;
		}
		const status = new ParseStatus();
		let ctx = void 0;
		for (const check of this._def.checks) if (check.kind === "min") {
			if (input.data.getTime() < check.value) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_small,
					message: check.message,
					inclusive: true,
					exact: false,
					minimum: check.value,
					type: "date"
				});
				status.dirty();
			}
		} else if (check.kind === "max") {
			if (input.data.getTime() > check.value) {
				ctx = this._getOrReturnCtx(input, ctx);
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_big,
					message: check.message,
					inclusive: true,
					exact: false,
					maximum: check.value,
					type: "date"
				});
				status.dirty();
			}
		} else util.assertNever(check);
		return {
			status: status.value,
			value: new Date(input.data.getTime())
		};
	}
	_addCheck(check) {
		return new ZodDate({
			...this._def,
			checks: [...this._def.checks, check]
		});
	}
	min(minDate, message) {
		return this._addCheck({
			kind: "min",
			value: minDate.getTime(),
			message: errorUtil.toString(message)
		});
	}
	max(maxDate, message) {
		return this._addCheck({
			kind: "max",
			value: maxDate.getTime(),
			message: errorUtil.toString(message)
		});
	}
	get minDate() {
		let min = null;
		for (const ch of this._def.checks) if (ch.kind === "min") {
			if (min === null || ch.value > min) min = ch.value;
		}
		return min != null ? new Date(min) : null;
	}
	get maxDate() {
		let max = null;
		for (const ch of this._def.checks) if (ch.kind === "max") {
			if (max === null || ch.value < max) max = ch.value;
		}
		return max != null ? new Date(max) : null;
	}
};
ZodDate.create = (params) => {
	return new ZodDate({
		checks: [],
		coerce: params?.coerce || false,
		typeName: ZodFirstPartyTypeKind.ZodDate,
		...processCreateParams(params)
	});
};
var ZodSymbol = class extends ZodType {
	_parse(input) {
		if (this._getType(input) !== ZodParsedType.symbol) {
			const ctx = this._getOrReturnCtx(input);
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.symbol,
				received: ctx.parsedType
			});
			return INVALID;
		}
		return OK(input.data);
	}
};
ZodSymbol.create = (params) => {
	return new ZodSymbol({
		typeName: ZodFirstPartyTypeKind.ZodSymbol,
		...processCreateParams(params)
	});
};
var ZodUndefined = class extends ZodType {
	_parse(input) {
		if (this._getType(input) !== ZodParsedType.undefined) {
			const ctx = this._getOrReturnCtx(input);
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.undefined,
				received: ctx.parsedType
			});
			return INVALID;
		}
		return OK(input.data);
	}
};
ZodUndefined.create = (params) => {
	return new ZodUndefined({
		typeName: ZodFirstPartyTypeKind.ZodUndefined,
		...processCreateParams(params)
	});
};
var ZodNull = class extends ZodType {
	_parse(input) {
		if (this._getType(input) !== ZodParsedType.null) {
			const ctx = this._getOrReturnCtx(input);
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.null,
				received: ctx.parsedType
			});
			return INVALID;
		}
		return OK(input.data);
	}
};
ZodNull.create = (params) => {
	return new ZodNull({
		typeName: ZodFirstPartyTypeKind.ZodNull,
		...processCreateParams(params)
	});
};
var ZodAny = class extends ZodType {
	constructor() {
		super(...arguments);
		this._any = true;
	}
	_parse(input) {
		return OK(input.data);
	}
};
ZodAny.create = (params) => {
	return new ZodAny({
		typeName: ZodFirstPartyTypeKind.ZodAny,
		...processCreateParams(params)
	});
};
var ZodUnknown = class extends ZodType {
	constructor() {
		super(...arguments);
		this._unknown = true;
	}
	_parse(input) {
		return OK(input.data);
	}
};
ZodUnknown.create = (params) => {
	return new ZodUnknown({
		typeName: ZodFirstPartyTypeKind.ZodUnknown,
		...processCreateParams(params)
	});
};
var ZodNever = class extends ZodType {
	_parse(input) {
		const ctx = this._getOrReturnCtx(input);
		addIssueToContext(ctx, {
			code: ZodIssueCode.invalid_type,
			expected: ZodParsedType.never,
			received: ctx.parsedType
		});
		return INVALID;
	}
};
ZodNever.create = (params) => {
	return new ZodNever({
		typeName: ZodFirstPartyTypeKind.ZodNever,
		...processCreateParams(params)
	});
};
var ZodVoid = class extends ZodType {
	_parse(input) {
		if (this._getType(input) !== ZodParsedType.undefined) {
			const ctx = this._getOrReturnCtx(input);
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.void,
				received: ctx.parsedType
			});
			return INVALID;
		}
		return OK(input.data);
	}
};
ZodVoid.create = (params) => {
	return new ZodVoid({
		typeName: ZodFirstPartyTypeKind.ZodVoid,
		...processCreateParams(params)
	});
};
var ZodArray = class ZodArray extends ZodType {
	_parse(input) {
		const { ctx, status } = this._processInputParams(input);
		const def = this._def;
		if (ctx.parsedType !== ZodParsedType.array) {
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.array,
				received: ctx.parsedType
			});
			return INVALID;
		}
		if (def.exactLength !== null) {
			const tooBig = ctx.data.length > def.exactLength.value;
			const tooSmall = ctx.data.length < def.exactLength.value;
			if (tooBig || tooSmall) {
				addIssueToContext(ctx, {
					code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
					minimum: tooSmall ? def.exactLength.value : void 0,
					maximum: tooBig ? def.exactLength.value : void 0,
					type: "array",
					inclusive: true,
					exact: true,
					message: def.exactLength.message
				});
				status.dirty();
			}
		}
		if (def.minLength !== null) {
			if (ctx.data.length < def.minLength.value) {
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_small,
					minimum: def.minLength.value,
					type: "array",
					inclusive: true,
					exact: false,
					message: def.minLength.message
				});
				status.dirty();
			}
		}
		if (def.maxLength !== null) {
			if (ctx.data.length > def.maxLength.value) {
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_big,
					maximum: def.maxLength.value,
					type: "array",
					inclusive: true,
					exact: false,
					message: def.maxLength.message
				});
				status.dirty();
			}
		}
		if (ctx.common.async) return Promise.all([...ctx.data].map((item, i) => {
			return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
		})).then((result) => {
			return ParseStatus.mergeArray(status, result);
		});
		const result = [...ctx.data].map((item, i) => {
			return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
		});
		return ParseStatus.mergeArray(status, result);
	}
	get element() {
		return this._def.type;
	}
	min(minLength, message) {
		return new ZodArray({
			...this._def,
			minLength: {
				value: minLength,
				message: errorUtil.toString(message)
			}
		});
	}
	max(maxLength, message) {
		return new ZodArray({
			...this._def,
			maxLength: {
				value: maxLength,
				message: errorUtil.toString(message)
			}
		});
	}
	length(len, message) {
		return new ZodArray({
			...this._def,
			exactLength: {
				value: len,
				message: errorUtil.toString(message)
			}
		});
	}
	nonempty(message) {
		return this.min(1, message);
	}
};
ZodArray.create = (schema, params) => {
	return new ZodArray({
		type: schema,
		minLength: null,
		maxLength: null,
		exactLength: null,
		typeName: ZodFirstPartyTypeKind.ZodArray,
		...processCreateParams(params)
	});
};
function deepPartialify(schema) {
	if (schema instanceof ZodObject) {
		const newShape = {};
		for (const key in schema.shape) {
			const fieldSchema = schema.shape[key];
			newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
		}
		return new ZodObject({
			...schema._def,
			shape: () => newShape
		});
	} else if (schema instanceof ZodArray) return new ZodArray({
		...schema._def,
		type: deepPartialify(schema.element)
	});
	else if (schema instanceof ZodOptional) return ZodOptional.create(deepPartialify(schema.unwrap()));
	else if (schema instanceof ZodNullable) return ZodNullable.create(deepPartialify(schema.unwrap()));
	else if (schema instanceof ZodTuple) return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
	else return schema;
}
var ZodObject = class ZodObject extends ZodType {
	constructor() {
		super(...arguments);
		this._cached = null;
		/**
		* @deprecated In most cases, this is no longer needed - unknown properties are now silently stripped.
		* If you want to pass through unknown properties, use `.passthrough()` instead.
		*/
		this.nonstrict = this.passthrough;
		/**
		* @deprecated Use `.extend` instead
		*  */
		this.augment = this.extend;
	}
	_getCached() {
		if (this._cached !== null) return this._cached;
		const shape = this._def.shape();
		this._cached = {
			shape,
			keys: util.objectKeys(shape)
		};
		return this._cached;
	}
	_parse(input) {
		if (this._getType(input) !== ZodParsedType.object) {
			const ctx = this._getOrReturnCtx(input);
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.object,
				received: ctx.parsedType
			});
			return INVALID;
		}
		const { status, ctx } = this._processInputParams(input);
		const { shape, keys: shapeKeys } = this._getCached();
		const extraKeys = [];
		if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
			for (const key in ctx.data) if (!shapeKeys.includes(key)) extraKeys.push(key);
		}
		const pairs = [];
		for (const key of shapeKeys) {
			const keyValidator = shape[key];
			const value = ctx.data[key];
			pairs.push({
				key: {
					status: "valid",
					value: key
				},
				value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
				alwaysSet: key in ctx.data
			});
		}
		if (this._def.catchall instanceof ZodNever) {
			const unknownKeys = this._def.unknownKeys;
			if (unknownKeys === "passthrough") for (const key of extraKeys) pairs.push({
				key: {
					status: "valid",
					value: key
				},
				value: {
					status: "valid",
					value: ctx.data[key]
				}
			});
			else if (unknownKeys === "strict") {
				if (extraKeys.length > 0) {
					addIssueToContext(ctx, {
						code: ZodIssueCode.unrecognized_keys,
						keys: extraKeys
					});
					status.dirty();
				}
			} else if (unknownKeys === "strip") {} else throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
		} else {
			const catchall = this._def.catchall;
			for (const key of extraKeys) {
				const value = ctx.data[key];
				pairs.push({
					key: {
						status: "valid",
						value: key
					},
					value: catchall._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
					alwaysSet: key in ctx.data
				});
			}
		}
		if (ctx.common.async) return Promise.resolve().then(async () => {
			const syncPairs = [];
			for (const pair of pairs) {
				const key = await pair.key;
				const value = await pair.value;
				syncPairs.push({
					key,
					value,
					alwaysSet: pair.alwaysSet
				});
			}
			return syncPairs;
		}).then((syncPairs) => {
			return ParseStatus.mergeObjectSync(status, syncPairs);
		});
		else return ParseStatus.mergeObjectSync(status, pairs);
	}
	get shape() {
		return this._def.shape();
	}
	strict(message) {
		errorUtil.errToObj;
		return new ZodObject({
			...this._def,
			unknownKeys: "strict",
			...message !== void 0 ? { errorMap: (issue, ctx) => {
				const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
				if (issue.code === "unrecognized_keys") return { message: errorUtil.errToObj(message).message ?? defaultError };
				return { message: defaultError };
			} } : {}
		});
	}
	strip() {
		return new ZodObject({
			...this._def,
			unknownKeys: "strip"
		});
	}
	passthrough() {
		return new ZodObject({
			...this._def,
			unknownKeys: "passthrough"
		});
	}
	extend(augmentation) {
		return new ZodObject({
			...this._def,
			shape: () => ({
				...this._def.shape(),
				...augmentation
			})
		});
	}
	/**
	* Prior to zod@1.0.12 there was a bug in the
	* inferred type of merged objects. Please
	* upgrade if you are experiencing issues.
	*/
	merge(merging) {
		return new ZodObject({
			unknownKeys: merging._def.unknownKeys,
			catchall: merging._def.catchall,
			shape: () => ({
				...this._def.shape(),
				...merging._def.shape()
			}),
			typeName: ZodFirstPartyTypeKind.ZodObject
		});
	}
	setKey(key, schema) {
		return this.augment({ [key]: schema });
	}
	catchall(index) {
		return new ZodObject({
			...this._def,
			catchall: index
		});
	}
	pick(mask) {
		const shape = {};
		for (const key of util.objectKeys(mask)) if (mask[key] && this.shape[key]) shape[key] = this.shape[key];
		return new ZodObject({
			...this._def,
			shape: () => shape
		});
	}
	omit(mask) {
		const shape = {};
		for (const key of util.objectKeys(this.shape)) if (!mask[key]) shape[key] = this.shape[key];
		return new ZodObject({
			...this._def,
			shape: () => shape
		});
	}
	/**
	* @deprecated
	*/
	deepPartial() {
		return deepPartialify(this);
	}
	partial(mask) {
		const newShape = {};
		for (const key of util.objectKeys(this.shape)) {
			const fieldSchema = this.shape[key];
			if (mask && !mask[key]) newShape[key] = fieldSchema;
			else newShape[key] = fieldSchema.optional();
		}
		return new ZodObject({
			...this._def,
			shape: () => newShape
		});
	}
	required(mask) {
		const newShape = {};
		for (const key of util.objectKeys(this.shape)) if (mask && !mask[key]) newShape[key] = this.shape[key];
		else {
			let newField = this.shape[key];
			while (newField instanceof ZodOptional) newField = newField._def.innerType;
			newShape[key] = newField;
		}
		return new ZodObject({
			...this._def,
			shape: () => newShape
		});
	}
	keyof() {
		return createZodEnum(util.objectKeys(this.shape));
	}
};
ZodObject.create = (shape, params) => {
	return new ZodObject({
		shape: () => shape,
		unknownKeys: "strip",
		catchall: ZodNever.create(),
		typeName: ZodFirstPartyTypeKind.ZodObject,
		...processCreateParams(params)
	});
};
ZodObject.strictCreate = (shape, params) => {
	return new ZodObject({
		shape: () => shape,
		unknownKeys: "strict",
		catchall: ZodNever.create(),
		typeName: ZodFirstPartyTypeKind.ZodObject,
		...processCreateParams(params)
	});
};
ZodObject.lazycreate = (shape, params) => {
	return new ZodObject({
		shape,
		unknownKeys: "strip",
		catchall: ZodNever.create(),
		typeName: ZodFirstPartyTypeKind.ZodObject,
		...processCreateParams(params)
	});
};
var ZodUnion = class extends ZodType {
	_parse(input) {
		const { ctx } = this._processInputParams(input);
		const options = this._def.options;
		function handleResults(results) {
			for (const result of results) if (result.result.status === "valid") return result.result;
			for (const result of results) if (result.result.status === "dirty") {
				ctx.common.issues.push(...result.ctx.common.issues);
				return result.result;
			}
			const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_union,
				unionErrors
			});
			return INVALID;
		}
		if (ctx.common.async) return Promise.all(options.map(async (option) => {
			const childCtx = {
				...ctx,
				common: {
					...ctx.common,
					issues: []
				},
				parent: null
			};
			return {
				result: await option._parseAsync({
					data: ctx.data,
					path: ctx.path,
					parent: childCtx
				}),
				ctx: childCtx
			};
		})).then(handleResults);
		else {
			let dirty = void 0;
			const issues = [];
			for (const option of options) {
				const childCtx = {
					...ctx,
					common: {
						...ctx.common,
						issues: []
					},
					parent: null
				};
				const result = option._parseSync({
					data: ctx.data,
					path: ctx.path,
					parent: childCtx
				});
				if (result.status === "valid") return result;
				else if (result.status === "dirty" && !dirty) dirty = {
					result,
					ctx: childCtx
				};
				if (childCtx.common.issues.length) issues.push(childCtx.common.issues);
			}
			if (dirty) {
				ctx.common.issues.push(...dirty.ctx.common.issues);
				return dirty.result;
			}
			const unionErrors = issues.map((issues) => new ZodError(issues));
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_union,
				unionErrors
			});
			return INVALID;
		}
	}
	get options() {
		return this._def.options;
	}
};
ZodUnion.create = (types, params) => {
	return new ZodUnion({
		options: types,
		typeName: ZodFirstPartyTypeKind.ZodUnion,
		...processCreateParams(params)
	});
};
var getDiscriminator = (type) => {
	if (type instanceof ZodLazy) return getDiscriminator(type.schema);
	else if (type instanceof ZodEffects) return getDiscriminator(type.innerType());
	else if (type instanceof ZodLiteral) return [type.value];
	else if (type instanceof ZodEnum) return type.options;
	else if (type instanceof ZodNativeEnum) return util.objectValues(type.enum);
	else if (type instanceof ZodDefault) return getDiscriminator(type._def.innerType);
	else if (type instanceof ZodUndefined) return [void 0];
	else if (type instanceof ZodNull) return [null];
	else if (type instanceof ZodOptional) return [void 0, ...getDiscriminator(type.unwrap())];
	else if (type instanceof ZodNullable) return [null, ...getDiscriminator(type.unwrap())];
	else if (type instanceof ZodBranded) return getDiscriminator(type.unwrap());
	else if (type instanceof ZodReadonly) return getDiscriminator(type.unwrap());
	else if (type instanceof ZodCatch) return getDiscriminator(type._def.innerType);
	else return [];
};
var ZodDiscriminatedUnion = class ZodDiscriminatedUnion extends ZodType {
	_parse(input) {
		const { ctx } = this._processInputParams(input);
		if (ctx.parsedType !== ZodParsedType.object) {
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.object,
				received: ctx.parsedType
			});
			return INVALID;
		}
		const discriminator = this.discriminator;
		const discriminatorValue = ctx.data[discriminator];
		const option = this.optionsMap.get(discriminatorValue);
		if (!option) {
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_union_discriminator,
				options: Array.from(this.optionsMap.keys()),
				path: [discriminator]
			});
			return INVALID;
		}
		if (ctx.common.async) return option._parseAsync({
			data: ctx.data,
			path: ctx.path,
			parent: ctx
		});
		else return option._parseSync({
			data: ctx.data,
			path: ctx.path,
			parent: ctx
		});
	}
	get discriminator() {
		return this._def.discriminator;
	}
	get options() {
		return this._def.options;
	}
	get optionsMap() {
		return this._def.optionsMap;
	}
	/**
	* The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
	* However, it only allows a union of objects, all of which need to share a discriminator property. This property must
	* have a different value for each object in the union.
	* @param discriminator the name of the discriminator property
	* @param types an array of object schemas
	* @param params
	*/
	static create(discriminator, options, params) {
		const optionsMap = /* @__PURE__ */ new Map();
		for (const type of options) {
			const discriminatorValues = getDiscriminator(type.shape[discriminator]);
			if (!discriminatorValues.length) throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
			for (const value of discriminatorValues) {
				if (optionsMap.has(value)) throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
				optionsMap.set(value, type);
			}
		}
		return new ZodDiscriminatedUnion({
			typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
			discriminator,
			options,
			optionsMap,
			...processCreateParams(params)
		});
	}
};
function mergeValues(a, b) {
	const aType = getParsedType(a);
	const bType = getParsedType(b);
	if (a === b) return {
		valid: true,
		data: a
	};
	else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
		const bKeys = util.objectKeys(b);
		const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
		const newObj = {
			...a,
			...b
		};
		for (const key of sharedKeys) {
			const sharedValue = mergeValues(a[key], b[key]);
			if (!sharedValue.valid) return { valid: false };
			newObj[key] = sharedValue.data;
		}
		return {
			valid: true,
			data: newObj
		};
	} else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
		if (a.length !== b.length) return { valid: false };
		const newArray = [];
		for (let index = 0; index < a.length; index++) {
			const itemA = a[index];
			const itemB = b[index];
			const sharedValue = mergeValues(itemA, itemB);
			if (!sharedValue.valid) return { valid: false };
			newArray.push(sharedValue.data);
		}
		return {
			valid: true,
			data: newArray
		};
	} else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) return {
		valid: true,
		data: a
	};
	else return { valid: false };
}
var ZodIntersection = class extends ZodType {
	_parse(input) {
		const { status, ctx } = this._processInputParams(input);
		const handleParsed = (parsedLeft, parsedRight) => {
			if (isAborted(parsedLeft) || isAborted(parsedRight)) return INVALID;
			const merged = mergeValues(parsedLeft.value, parsedRight.value);
			if (!merged.valid) {
				addIssueToContext(ctx, { code: ZodIssueCode.invalid_intersection_types });
				return INVALID;
			}
			if (isDirty(parsedLeft) || isDirty(parsedRight)) status.dirty();
			return {
				status: status.value,
				value: merged.data
			};
		};
		if (ctx.common.async) return Promise.all([this._def.left._parseAsync({
			data: ctx.data,
			path: ctx.path,
			parent: ctx
		}), this._def.right._parseAsync({
			data: ctx.data,
			path: ctx.path,
			parent: ctx
		})]).then(([left, right]) => handleParsed(left, right));
		else return handleParsed(this._def.left._parseSync({
			data: ctx.data,
			path: ctx.path,
			parent: ctx
		}), this._def.right._parseSync({
			data: ctx.data,
			path: ctx.path,
			parent: ctx
		}));
	}
};
ZodIntersection.create = (left, right, params) => {
	return new ZodIntersection({
		left,
		right,
		typeName: ZodFirstPartyTypeKind.ZodIntersection,
		...processCreateParams(params)
	});
};
var ZodTuple = class ZodTuple extends ZodType {
	_parse(input) {
		const { status, ctx } = this._processInputParams(input);
		if (ctx.parsedType !== ZodParsedType.array) {
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.array,
				received: ctx.parsedType
			});
			return INVALID;
		}
		if (ctx.data.length < this._def.items.length) {
			addIssueToContext(ctx, {
				code: ZodIssueCode.too_small,
				minimum: this._def.items.length,
				inclusive: true,
				exact: false,
				type: "array"
			});
			return INVALID;
		}
		if (!this._def.rest && ctx.data.length > this._def.items.length) {
			addIssueToContext(ctx, {
				code: ZodIssueCode.too_big,
				maximum: this._def.items.length,
				inclusive: true,
				exact: false,
				type: "array"
			});
			status.dirty();
		}
		const items = [...ctx.data].map((item, itemIndex) => {
			const schema = this._def.items[itemIndex] || this._def.rest;
			if (!schema) return null;
			return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
		}).filter((x) => !!x);
		if (ctx.common.async) return Promise.all(items).then((results) => {
			return ParseStatus.mergeArray(status, results);
		});
		else return ParseStatus.mergeArray(status, items);
	}
	get items() {
		return this._def.items;
	}
	rest(rest) {
		return new ZodTuple({
			...this._def,
			rest
		});
	}
};
ZodTuple.create = (schemas, params) => {
	if (!Array.isArray(schemas)) throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
	return new ZodTuple({
		items: schemas,
		typeName: ZodFirstPartyTypeKind.ZodTuple,
		rest: null,
		...processCreateParams(params)
	});
};
var ZodRecord = class ZodRecord extends ZodType {
	get keySchema() {
		return this._def.keyType;
	}
	get valueSchema() {
		return this._def.valueType;
	}
	_parse(input) {
		const { status, ctx } = this._processInputParams(input);
		if (ctx.parsedType !== ZodParsedType.object) {
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.object,
				received: ctx.parsedType
			});
			return INVALID;
		}
		const pairs = [];
		const keyType = this._def.keyType;
		const valueType = this._def.valueType;
		for (const key in ctx.data) pairs.push({
			key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
			value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
			alwaysSet: key in ctx.data
		});
		if (ctx.common.async) return ParseStatus.mergeObjectAsync(status, pairs);
		else return ParseStatus.mergeObjectSync(status, pairs);
	}
	get element() {
		return this._def.valueType;
	}
	static create(first, second, third) {
		if (second instanceof ZodType) return new ZodRecord({
			keyType: first,
			valueType: second,
			typeName: ZodFirstPartyTypeKind.ZodRecord,
			...processCreateParams(third)
		});
		return new ZodRecord({
			keyType: ZodString.create(),
			valueType: first,
			typeName: ZodFirstPartyTypeKind.ZodRecord,
			...processCreateParams(second)
		});
	}
};
var ZodMap = class extends ZodType {
	get keySchema() {
		return this._def.keyType;
	}
	get valueSchema() {
		return this._def.valueType;
	}
	_parse(input) {
		const { status, ctx } = this._processInputParams(input);
		if (ctx.parsedType !== ZodParsedType.map) {
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.map,
				received: ctx.parsedType
			});
			return INVALID;
		}
		const keyType = this._def.keyType;
		const valueType = this._def.valueType;
		const pairs = [...ctx.data.entries()].map(([key, value], index) => {
			return {
				key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
				value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
			};
		});
		if (ctx.common.async) {
			const finalMap = /* @__PURE__ */ new Map();
			return Promise.resolve().then(async () => {
				for (const pair of pairs) {
					const key = await pair.key;
					const value = await pair.value;
					if (key.status === "aborted" || value.status === "aborted") return INVALID;
					if (key.status === "dirty" || value.status === "dirty") status.dirty();
					finalMap.set(key.value, value.value);
				}
				return {
					status: status.value,
					value: finalMap
				};
			});
		} else {
			const finalMap = /* @__PURE__ */ new Map();
			for (const pair of pairs) {
				const key = pair.key;
				const value = pair.value;
				if (key.status === "aborted" || value.status === "aborted") return INVALID;
				if (key.status === "dirty" || value.status === "dirty") status.dirty();
				finalMap.set(key.value, value.value);
			}
			return {
				status: status.value,
				value: finalMap
			};
		}
	}
};
ZodMap.create = (keyType, valueType, params) => {
	return new ZodMap({
		valueType,
		keyType,
		typeName: ZodFirstPartyTypeKind.ZodMap,
		...processCreateParams(params)
	});
};
var ZodSet = class ZodSet extends ZodType {
	_parse(input) {
		const { status, ctx } = this._processInputParams(input);
		if (ctx.parsedType !== ZodParsedType.set) {
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.set,
				received: ctx.parsedType
			});
			return INVALID;
		}
		const def = this._def;
		if (def.minSize !== null) {
			if (ctx.data.size < def.minSize.value) {
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_small,
					minimum: def.minSize.value,
					type: "set",
					inclusive: true,
					exact: false,
					message: def.minSize.message
				});
				status.dirty();
			}
		}
		if (def.maxSize !== null) {
			if (ctx.data.size > def.maxSize.value) {
				addIssueToContext(ctx, {
					code: ZodIssueCode.too_big,
					maximum: def.maxSize.value,
					type: "set",
					inclusive: true,
					exact: false,
					message: def.maxSize.message
				});
				status.dirty();
			}
		}
		const valueType = this._def.valueType;
		function finalizeSet(elements) {
			const parsedSet = /* @__PURE__ */ new Set();
			for (const element of elements) {
				if (element.status === "aborted") return INVALID;
				if (element.status === "dirty") status.dirty();
				parsedSet.add(element.value);
			}
			return {
				status: status.value,
				value: parsedSet
			};
		}
		const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
		if (ctx.common.async) return Promise.all(elements).then((elements) => finalizeSet(elements));
		else return finalizeSet(elements);
	}
	min(minSize, message) {
		return new ZodSet({
			...this._def,
			minSize: {
				value: minSize,
				message: errorUtil.toString(message)
			}
		});
	}
	max(maxSize, message) {
		return new ZodSet({
			...this._def,
			maxSize: {
				value: maxSize,
				message: errorUtil.toString(message)
			}
		});
	}
	size(size, message) {
		return this.min(size, message).max(size, message);
	}
	nonempty(message) {
		return this.min(1, message);
	}
};
ZodSet.create = (valueType, params) => {
	return new ZodSet({
		valueType,
		minSize: null,
		maxSize: null,
		typeName: ZodFirstPartyTypeKind.ZodSet,
		...processCreateParams(params)
	});
};
var ZodFunction = class ZodFunction extends ZodType {
	constructor() {
		super(...arguments);
		this.validate = this.implement;
	}
	_parse(input) {
		const { ctx } = this._processInputParams(input);
		if (ctx.parsedType !== ZodParsedType.function) {
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.function,
				received: ctx.parsedType
			});
			return INVALID;
		}
		function makeArgsIssue(args, error) {
			return makeIssue({
				data: args,
				path: ctx.path,
				errorMaps: [
					ctx.common.contextualErrorMap,
					ctx.schemaErrorMap,
					getErrorMap(),
					errorMap
				].filter((x) => !!x),
				issueData: {
					code: ZodIssueCode.invalid_arguments,
					argumentsError: error
				}
			});
		}
		function makeReturnsIssue(returns, error) {
			return makeIssue({
				data: returns,
				path: ctx.path,
				errorMaps: [
					ctx.common.contextualErrorMap,
					ctx.schemaErrorMap,
					getErrorMap(),
					errorMap
				].filter((x) => !!x),
				issueData: {
					code: ZodIssueCode.invalid_return_type,
					returnTypeError: error
				}
			});
		}
		const params = { errorMap: ctx.common.contextualErrorMap };
		const fn = ctx.data;
		if (this._def.returns instanceof ZodPromise) {
			const me = this;
			return OK(async function(...args) {
				const error = new ZodError([]);
				const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
					error.addIssue(makeArgsIssue(args, e));
					throw error;
				});
				const result = await Reflect.apply(fn, this, parsedArgs);
				return await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
					error.addIssue(makeReturnsIssue(result, e));
					throw error;
				});
			});
		} else {
			const me = this;
			return OK(function(...args) {
				const parsedArgs = me._def.args.safeParse(args, params);
				if (!parsedArgs.success) throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
				const result = Reflect.apply(fn, this, parsedArgs.data);
				const parsedReturns = me._def.returns.safeParse(result, params);
				if (!parsedReturns.success) throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
				return parsedReturns.data;
			});
		}
	}
	parameters() {
		return this._def.args;
	}
	returnType() {
		return this._def.returns;
	}
	args(...items) {
		return new ZodFunction({
			...this._def,
			args: ZodTuple.create(items).rest(ZodUnknown.create())
		});
	}
	returns(returnType) {
		return new ZodFunction({
			...this._def,
			returns: returnType
		});
	}
	implement(func) {
		return this.parse(func);
	}
	strictImplement(func) {
		return this.parse(func);
	}
	static create(args, returns, params) {
		return new ZodFunction({
			args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
			returns: returns || ZodUnknown.create(),
			typeName: ZodFirstPartyTypeKind.ZodFunction,
			...processCreateParams(params)
		});
	}
};
var ZodLazy = class extends ZodType {
	get schema() {
		return this._def.getter();
	}
	_parse(input) {
		const { ctx } = this._processInputParams(input);
		return this._def.getter()._parse({
			data: ctx.data,
			path: ctx.path,
			parent: ctx
		});
	}
};
ZodLazy.create = (getter, params) => {
	return new ZodLazy({
		getter,
		typeName: ZodFirstPartyTypeKind.ZodLazy,
		...processCreateParams(params)
	});
};
var ZodLiteral = class extends ZodType {
	_parse(input) {
		if (input.data !== this._def.value) {
			const ctx = this._getOrReturnCtx(input);
			addIssueToContext(ctx, {
				received: ctx.data,
				code: ZodIssueCode.invalid_literal,
				expected: this._def.value
			});
			return INVALID;
		}
		return {
			status: "valid",
			value: input.data
		};
	}
	get value() {
		return this._def.value;
	}
};
ZodLiteral.create = (value, params) => {
	return new ZodLiteral({
		value,
		typeName: ZodFirstPartyTypeKind.ZodLiteral,
		...processCreateParams(params)
	});
};
function createZodEnum(values, params) {
	return new ZodEnum({
		values,
		typeName: ZodFirstPartyTypeKind.ZodEnum,
		...processCreateParams(params)
	});
}
var ZodEnum = class ZodEnum extends ZodType {
	_parse(input) {
		if (typeof input.data !== "string") {
			const ctx = this._getOrReturnCtx(input);
			const expectedValues = this._def.values;
			addIssueToContext(ctx, {
				expected: util.joinValues(expectedValues),
				received: ctx.parsedType,
				code: ZodIssueCode.invalid_type
			});
			return INVALID;
		}
		if (!this._cache) this._cache = new Set(this._def.values);
		if (!this._cache.has(input.data)) {
			const ctx = this._getOrReturnCtx(input);
			const expectedValues = this._def.values;
			addIssueToContext(ctx, {
				received: ctx.data,
				code: ZodIssueCode.invalid_enum_value,
				options: expectedValues
			});
			return INVALID;
		}
		return OK(input.data);
	}
	get options() {
		return this._def.values;
	}
	get enum() {
		const enumValues = {};
		for (const val of this._def.values) enumValues[val] = val;
		return enumValues;
	}
	get Values() {
		const enumValues = {};
		for (const val of this._def.values) enumValues[val] = val;
		return enumValues;
	}
	get Enum() {
		const enumValues = {};
		for (const val of this._def.values) enumValues[val] = val;
		return enumValues;
	}
	extract(values, newDef = this._def) {
		return ZodEnum.create(values, {
			...this._def,
			...newDef
		});
	}
	exclude(values, newDef = this._def) {
		return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
			...this._def,
			...newDef
		});
	}
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
	_parse(input) {
		const nativeEnumValues = util.getValidEnumValues(this._def.values);
		const ctx = this._getOrReturnCtx(input);
		if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
			const expectedValues = util.objectValues(nativeEnumValues);
			addIssueToContext(ctx, {
				expected: util.joinValues(expectedValues),
				received: ctx.parsedType,
				code: ZodIssueCode.invalid_type
			});
			return INVALID;
		}
		if (!this._cache) this._cache = new Set(util.getValidEnumValues(this._def.values));
		if (!this._cache.has(input.data)) {
			const expectedValues = util.objectValues(nativeEnumValues);
			addIssueToContext(ctx, {
				received: ctx.data,
				code: ZodIssueCode.invalid_enum_value,
				options: expectedValues
			});
			return INVALID;
		}
		return OK(input.data);
	}
	get enum() {
		return this._def.values;
	}
};
ZodNativeEnum.create = (values, params) => {
	return new ZodNativeEnum({
		values,
		typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
		...processCreateParams(params)
	});
};
var ZodPromise = class extends ZodType {
	unwrap() {
		return this._def.type;
	}
	_parse(input) {
		const { ctx } = this._processInputParams(input);
		if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.promise,
				received: ctx.parsedType
			});
			return INVALID;
		}
		return OK((ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data)).then((data) => {
			return this._def.type.parseAsync(data, {
				path: ctx.path,
				errorMap: ctx.common.contextualErrorMap
			});
		}));
	}
};
ZodPromise.create = (schema, params) => {
	return new ZodPromise({
		type: schema,
		typeName: ZodFirstPartyTypeKind.ZodPromise,
		...processCreateParams(params)
	});
};
var ZodEffects = class extends ZodType {
	innerType() {
		return this._def.schema;
	}
	sourceType() {
		return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
	}
	_parse(input) {
		const { status, ctx } = this._processInputParams(input);
		const effect = this._def.effect || null;
		const checkCtx = {
			addIssue: (arg) => {
				addIssueToContext(ctx, arg);
				if (arg.fatal) status.abort();
				else status.dirty();
			},
			get path() {
				return ctx.path;
			}
		};
		checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
		if (effect.type === "preprocess") {
			const processed = effect.transform(ctx.data, checkCtx);
			if (ctx.common.async) return Promise.resolve(processed).then(async (processed) => {
				if (status.value === "aborted") return INVALID;
				const result = await this._def.schema._parseAsync({
					data: processed,
					path: ctx.path,
					parent: ctx
				});
				if (result.status === "aborted") return INVALID;
				if (result.status === "dirty") return DIRTY(result.value);
				if (status.value === "dirty") return DIRTY(result.value);
				return result;
			});
			else {
				if (status.value === "aborted") return INVALID;
				const result = this._def.schema._parseSync({
					data: processed,
					path: ctx.path,
					parent: ctx
				});
				if (result.status === "aborted") return INVALID;
				if (result.status === "dirty") return DIRTY(result.value);
				if (status.value === "dirty") return DIRTY(result.value);
				return result;
			}
		}
		if (effect.type === "refinement") {
			const executeRefinement = (acc) => {
				const result = effect.refinement(acc, checkCtx);
				if (ctx.common.async) return Promise.resolve(result);
				if (result instanceof Promise) throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
				return acc;
			};
			if (ctx.common.async === false) {
				const inner = this._def.schema._parseSync({
					data: ctx.data,
					path: ctx.path,
					parent: ctx
				});
				if (inner.status === "aborted") return INVALID;
				if (inner.status === "dirty") status.dirty();
				executeRefinement(inner.value);
				return {
					status: status.value,
					value: inner.value
				};
			} else return this._def.schema._parseAsync({
				data: ctx.data,
				path: ctx.path,
				parent: ctx
			}).then((inner) => {
				if (inner.status === "aborted") return INVALID;
				if (inner.status === "dirty") status.dirty();
				return executeRefinement(inner.value).then(() => {
					return {
						status: status.value,
						value: inner.value
					};
				});
			});
		}
		if (effect.type === "transform") if (ctx.common.async === false) {
			const base = this._def.schema._parseSync({
				data: ctx.data,
				path: ctx.path,
				parent: ctx
			});
			if (!isValid(base)) return INVALID;
			const result = effect.transform(base.value, checkCtx);
			if (result instanceof Promise) throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
			return {
				status: status.value,
				value: result
			};
		} else return this._def.schema._parseAsync({
			data: ctx.data,
			path: ctx.path,
			parent: ctx
		}).then((base) => {
			if (!isValid(base)) return INVALID;
			return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
				status: status.value,
				value: result
			}));
		});
		util.assertNever(effect);
	}
};
ZodEffects.create = (schema, effect, params) => {
	return new ZodEffects({
		schema,
		typeName: ZodFirstPartyTypeKind.ZodEffects,
		effect,
		...processCreateParams(params)
	});
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
	return new ZodEffects({
		schema,
		effect: {
			type: "preprocess",
			transform: preprocess
		},
		typeName: ZodFirstPartyTypeKind.ZodEffects,
		...processCreateParams(params)
	});
};
var ZodOptional = class extends ZodType {
	_parse(input) {
		if (this._getType(input) === ZodParsedType.undefined) return OK(void 0);
		return this._def.innerType._parse(input);
	}
	unwrap() {
		return this._def.innerType;
	}
};
ZodOptional.create = (type, params) => {
	return new ZodOptional({
		innerType: type,
		typeName: ZodFirstPartyTypeKind.ZodOptional,
		...processCreateParams(params)
	});
};
var ZodNullable = class extends ZodType {
	_parse(input) {
		if (this._getType(input) === ZodParsedType.null) return OK(null);
		return this._def.innerType._parse(input);
	}
	unwrap() {
		return this._def.innerType;
	}
};
ZodNullable.create = (type, params) => {
	return new ZodNullable({
		innerType: type,
		typeName: ZodFirstPartyTypeKind.ZodNullable,
		...processCreateParams(params)
	});
};
var ZodDefault = class extends ZodType {
	_parse(input) {
		const { ctx } = this._processInputParams(input);
		let data = ctx.data;
		if (ctx.parsedType === ZodParsedType.undefined) data = this._def.defaultValue();
		return this._def.innerType._parse({
			data,
			path: ctx.path,
			parent: ctx
		});
	}
	removeDefault() {
		return this._def.innerType;
	}
};
ZodDefault.create = (type, params) => {
	return new ZodDefault({
		innerType: type,
		typeName: ZodFirstPartyTypeKind.ZodDefault,
		defaultValue: typeof params.default === "function" ? params.default : () => params.default,
		...processCreateParams(params)
	});
};
var ZodCatch = class extends ZodType {
	_parse(input) {
		const { ctx } = this._processInputParams(input);
		const newCtx = {
			...ctx,
			common: {
				...ctx.common,
				issues: []
			}
		};
		const result = this._def.innerType._parse({
			data: newCtx.data,
			path: newCtx.path,
			parent: { ...newCtx }
		});
		if (isAsync(result)) return result.then((result) => {
			return {
				status: "valid",
				value: result.status === "valid" ? result.value : this._def.catchValue({
					get error() {
						return new ZodError(newCtx.common.issues);
					},
					input: newCtx.data
				})
			};
		});
		else return {
			status: "valid",
			value: result.status === "valid" ? result.value : this._def.catchValue({
				get error() {
					return new ZodError(newCtx.common.issues);
				},
				input: newCtx.data
			})
		};
	}
	removeCatch() {
		return this._def.innerType;
	}
};
ZodCatch.create = (type, params) => {
	return new ZodCatch({
		innerType: type,
		typeName: ZodFirstPartyTypeKind.ZodCatch,
		catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
		...processCreateParams(params)
	});
};
var ZodNaN = class extends ZodType {
	_parse(input) {
		if (this._getType(input) !== ZodParsedType.nan) {
			const ctx = this._getOrReturnCtx(input);
			addIssueToContext(ctx, {
				code: ZodIssueCode.invalid_type,
				expected: ZodParsedType.nan,
				received: ctx.parsedType
			});
			return INVALID;
		}
		return {
			status: "valid",
			value: input.data
		};
	}
};
ZodNaN.create = (params) => {
	return new ZodNaN({
		typeName: ZodFirstPartyTypeKind.ZodNaN,
		...processCreateParams(params)
	});
};
var ZodBranded = class extends ZodType {
	_parse(input) {
		const { ctx } = this._processInputParams(input);
		const data = ctx.data;
		return this._def.type._parse({
			data,
			path: ctx.path,
			parent: ctx
		});
	}
	unwrap() {
		return this._def.type;
	}
};
var ZodPipeline = class ZodPipeline extends ZodType {
	_parse(input) {
		const { status, ctx } = this._processInputParams(input);
		if (ctx.common.async) {
			const handleAsync = async () => {
				const inResult = await this._def.in._parseAsync({
					data: ctx.data,
					path: ctx.path,
					parent: ctx
				});
				if (inResult.status === "aborted") return INVALID;
				if (inResult.status === "dirty") {
					status.dirty();
					return DIRTY(inResult.value);
				} else return this._def.out._parseAsync({
					data: inResult.value,
					path: ctx.path,
					parent: ctx
				});
			};
			return handleAsync();
		} else {
			const inResult = this._def.in._parseSync({
				data: ctx.data,
				path: ctx.path,
				parent: ctx
			});
			if (inResult.status === "aborted") return INVALID;
			if (inResult.status === "dirty") {
				status.dirty();
				return {
					status: "dirty",
					value: inResult.value
				};
			} else return this._def.out._parseSync({
				data: inResult.value,
				path: ctx.path,
				parent: ctx
			});
		}
	}
	static create(a, b) {
		return new ZodPipeline({
			in: a,
			out: b,
			typeName: ZodFirstPartyTypeKind.ZodPipeline
		});
	}
};
var ZodReadonly = class extends ZodType {
	_parse(input) {
		const result = this._def.innerType._parse(input);
		const freeze = (data) => {
			if (isValid(data)) data.value = Object.freeze(data.value);
			return data;
		};
		return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
	}
	unwrap() {
		return this._def.innerType;
	}
};
ZodReadonly.create = (type, params) => {
	return new ZodReadonly({
		innerType: type,
		typeName: ZodFirstPartyTypeKind.ZodReadonly,
		...processCreateParams(params)
	});
};
ZodObject.lazycreate;
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind) {
	ZodFirstPartyTypeKind["ZodString"] = "ZodString";
	ZodFirstPartyTypeKind["ZodNumber"] = "ZodNumber";
	ZodFirstPartyTypeKind["ZodNaN"] = "ZodNaN";
	ZodFirstPartyTypeKind["ZodBigInt"] = "ZodBigInt";
	ZodFirstPartyTypeKind["ZodBoolean"] = "ZodBoolean";
	ZodFirstPartyTypeKind["ZodDate"] = "ZodDate";
	ZodFirstPartyTypeKind["ZodSymbol"] = "ZodSymbol";
	ZodFirstPartyTypeKind["ZodUndefined"] = "ZodUndefined";
	ZodFirstPartyTypeKind["ZodNull"] = "ZodNull";
	ZodFirstPartyTypeKind["ZodAny"] = "ZodAny";
	ZodFirstPartyTypeKind["ZodUnknown"] = "ZodUnknown";
	ZodFirstPartyTypeKind["ZodNever"] = "ZodNever";
	ZodFirstPartyTypeKind["ZodVoid"] = "ZodVoid";
	ZodFirstPartyTypeKind["ZodArray"] = "ZodArray";
	ZodFirstPartyTypeKind["ZodObject"] = "ZodObject";
	ZodFirstPartyTypeKind["ZodUnion"] = "ZodUnion";
	ZodFirstPartyTypeKind["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
	ZodFirstPartyTypeKind["ZodIntersection"] = "ZodIntersection";
	ZodFirstPartyTypeKind["ZodTuple"] = "ZodTuple";
	ZodFirstPartyTypeKind["ZodRecord"] = "ZodRecord";
	ZodFirstPartyTypeKind["ZodMap"] = "ZodMap";
	ZodFirstPartyTypeKind["ZodSet"] = "ZodSet";
	ZodFirstPartyTypeKind["ZodFunction"] = "ZodFunction";
	ZodFirstPartyTypeKind["ZodLazy"] = "ZodLazy";
	ZodFirstPartyTypeKind["ZodLiteral"] = "ZodLiteral";
	ZodFirstPartyTypeKind["ZodEnum"] = "ZodEnum";
	ZodFirstPartyTypeKind["ZodEffects"] = "ZodEffects";
	ZodFirstPartyTypeKind["ZodNativeEnum"] = "ZodNativeEnum";
	ZodFirstPartyTypeKind["ZodOptional"] = "ZodOptional";
	ZodFirstPartyTypeKind["ZodNullable"] = "ZodNullable";
	ZodFirstPartyTypeKind["ZodDefault"] = "ZodDefault";
	ZodFirstPartyTypeKind["ZodCatch"] = "ZodCatch";
	ZodFirstPartyTypeKind["ZodPromise"] = "ZodPromise";
	ZodFirstPartyTypeKind["ZodBranded"] = "ZodBranded";
	ZodFirstPartyTypeKind["ZodPipeline"] = "ZodPipeline";
	ZodFirstPartyTypeKind["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var stringType = ZodString.create;
ZodNumber.create;
ZodNaN.create;
ZodBigInt.create;
var booleanType = ZodBoolean.create;
ZodDate.create;
ZodSymbol.create;
ZodUndefined.create;
ZodNull.create;
ZodAny.create;
ZodUnknown.create;
ZodNever.create;
ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
ZodObject.strictCreate;
var unionType = ZodUnion.create;
ZodDiscriminatedUnion.create;
ZodIntersection.create;
ZodTuple.create;
var recordType = ZodRecord.create;
ZodMap.create;
ZodSet.create;
ZodFunction.create;
ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
ZodNativeEnum.create;
ZodPromise.create;
ZodEffects.create;
ZodOptional.create;
ZodNullable.create;
ZodEffects.createWithPreprocess;
ZodPipeline.create;
var buildStepConfigSchema = unionType([objectType({
	path: stringType().min(1),
	buildSystem: literalType("maven").default("maven"),
	modulePath: stringType().min(1).optional(),
	submoduleBuildStrategy: enumType(["root-pl", "submodule-dir"]).optional(),
	goals: arrayType(stringType().min(1)).optional(),
	optionKeys: arrayType(enumType([
		"skipTests",
		"skipTestCompile",
		"updateSnapshots",
		"offline",
		"quiet",
		"debug",
		"errors",
		"failAtEnd",
		"failNever"
	])).default([]),
	profileStates: recordType(enumType([
		"default",
		"enabled",
		"disabled"
	])).default({}),
	extraOptions: arrayType(stringType()).default([]),
	label: stringType().optional(),
	maven: stringType().optional(),
	javaVersion: stringType().optional(),
	executionMode: enumType(["internal", "external"]).default("internal")
}).strict(), objectType({
	path: stringType().min(1),
	buildSystem: literalType("node"),
	label: stringType().optional(),
	commandType: enumType(["script", "install"]).default("script"),
	script: stringType().min(1).optional(),
	args: arrayType(stringType()).default([]),
	executionMode: enumType(["internal", "external"]).default("internal")
}).strict().superRefine((step, ctx) => {
	if (step.commandType === "script" && !step.script) ctx.addIssue({
		code: ZodIssueCode.custom,
		message: "script is required when commandType is \"script\"",
		path: ["script"]
	});
})]);
var pipelineConfigSchema = objectType({
	description: stringType().optional(),
	failFast: booleanType().default(true),
	steps: arrayType(buildStepConfigSchema).min(1)
});
var configSchema = objectType({
	roots: recordType(stringType().min(2, "Root names must be at least 2 characters (single characters are drive letters)"), stringType().min(1)).default({}),
	maven: objectType({
		executable: stringType().min(1).default("mvn"),
		defaultGoals: arrayType(stringType().min(1)).default(["clean", "install"]),
		defaultOptionKeys: arrayType(enumType([
			"skipTests",
			"skipTestCompile",
			"updateSnapshots",
			"offline",
			"quiet",
			"debug",
			"errors",
			"failAtEnd",
			"failNever"
		])).default([]),
		defaultExtraOptions: arrayType(stringType()).default([])
	}).strict().default({}),
	node: objectType({ executables: objectType({
		npm: stringType().min(1).default("npm"),
		pnpm: stringType().min(1).default("pnpm"),
		bun: stringType().min(1).default("bun")
	}).strict().default({}) }).strict().default({}),
	jdkRegistry: recordType(stringType().min(1), stringType().min(1)).default({}),
	scan: objectType({
		includeHidden: booleanType().default(false),
		exclude: arrayType(stringType()).default([])
	}).strict().default({})
}).strict();
//#endregion
//#region ../../packages/platform-node/dist/settings-store.js
var SettingsStore = class {
	settingsPath;
	constructor(settingsPath) {
		this.settingsPath = settingsPath;
	}
	load() {
		try {
			const raw = (0, node_fs.readFileSync)(this.settingsPath, "utf8");
			const parsed = JSON.parse(raw);
			const result = configSchema.safeParse(parsed);
			if (!result.success) throw new StateCompatibilityError(formatValidationError(this.settingsPath, result.error.issues));
			return {
				found: true,
				config: result.data,
				configPath: this.settingsPath
			};
		} catch (error) {
			if (isEnoent(error)) return {
				found: false,
				config: configSchema.parse({}),
				configPath: this.settingsPath
			};
			if (error instanceof SyntaxError) throw new StateCompatibilityError(`Invalid JSON in local settings file "${this.settingsPath}".`);
			if (error instanceof StateCompatibilityError) throw error;
			throw new StateCompatibilityError(error instanceof Error ? error.message : "Local settings could not be read.");
		}
	}
	save(config) {
		const validated = configSchema.parse(config);
		(0, node_fs.mkdirSync)(node_path.default.dirname(this.settingsPath), { recursive: true });
		const tempPath = `${this.settingsPath}.tmp`;
		(0, node_fs.writeFileSync)(tempPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
		(0, node_fs.renameSync)(tempPath, this.settingsPath);
	}
	savePatch(patch) {
		const current = this.load().config;
		const merged = mergePlainObjects(current, patch);
		const validated = configSchema.parse(merged);
		this.save(validated);
		return validated;
	}
	reset() {
		(0, node_fs.rmSync)(this.settingsPath, { force: true });
	}
};
function mergePlainObjects(base, patch) {
	const next = { ...base };
	for (const [key, value] of Object.entries(patch)) {
		if (isPlainObject(value) && isPlainObject(next[key])) {
			next[key] = mergePlainObjects(next[key], value);
			continue;
		}
		next[key] = value;
	}
	return next;
}
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function formatValidationError(settingsPath, issues) {
	return `Local settings file "${settingsPath}" is invalid. ${issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ")}`;
}
function isEnoent(error) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
//#endregion
//#region ../../packages/platform-node/dist/paths.js
function getDefaultStateRootDir() {
	const base = process.env["APPDATA"] ?? process.env["HOME"] ?? ".";
	return node_path.default.join(base, "gfos-build");
}
function getStateRootDir(rootDir = getDefaultStateRootDir()) {
	return rootDir;
}
function getConfigDir(rootDir = getDefaultStateRootDir()) {
	return node_path.default.join(getStateRootDir(rootDir), "config");
}
function getConfigPath(rootDir = getDefaultStateRootDir()) {
	return node_path.default.join(getConfigDir(rootDir), "settings.json");
}
function getDataDir(rootDir = getDefaultStateRootDir()) {
	return node_path.default.join(getStateRootDir(rootDir), "data");
}
function getDbPath(rootDir = getDefaultStateRootDir()) {
	return node_path.default.join(getDataDir(rootDir), "state.sqlite");
}
function getCacheDir(rootDir = getDefaultStateRootDir()) {
	return node_path.default.join(getStateRootDir(rootDir), "cache");
}
function getScanCacheDir(rootDir = getDefaultStateRootDir()) {
	return node_path.default.join(getCacheDir(rootDir), "scan");
}
function getSessionDataDir(rootDir = getDefaultStateRootDir()) {
	return node_path.default.join(getCacheDir(rootDir), "chromium");
}
//#endregion
//#region ../../packages/platform-node/dist/loader.js
function loadSettings(overridePath) {
	return new SettingsStore(overridePath ?? getConfigPath()).load();
}
function saveConfigPatch(patch, overridePath) {
	return new SettingsStore(overridePath ?? getConfigPath()).savePatch(patch);
}
function resetLocalState(rootDir) {
	(0, node_fs.rmSync)(getConfigPath(rootDir), { force: true });
	(0, node_fs.rmSync)(getDataDir(rootDir), {
		recursive: true,
		force: true
	});
	(0, node_fs.rmSync)(getCacheDir(rootDir), {
		recursive: true,
		force: true
	});
	(0, node_fs.rmSync)(node_path.default.dirname(getConfigPath(rootDir)), {
		recursive: true,
		force: true
	});
}
//#endregion
//#region ../../packages/platform-node/dist/process-env.js
function buildChildProcessEnv$1(overrides) {
	const env = { ...process.env };
	delete env.NODE_ENV;
	if (!overrides) return env;
	return {
		...env,
		...overrides
	};
}
//#endregion
//#region ../../packages/platform-node/dist/process-runner.js
var AsyncQueue = class {
	buffer = [];
	resolvers = [];
	closed = false;
	push(item) {
		if (this.resolvers.length > 0) this.resolvers.shift()({
			value: item,
			done: false
		});
		else this.buffer.push(item);
	}
	close() {
		this.closed = true;
		while (this.resolvers.length > 0) this.resolvers.shift()({
			value: void 0,
			done: true
		});
	}
	[Symbol.asyncIterator]() {
		return { next: () => {
			if (this.buffer.length > 0) return Promise.resolve({
				value: this.buffer.shift(),
				done: false
			});
			if (this.closed) return Promise.resolve({
				value: void 0,
				done: true
			});
			return new Promise((resolve) => {
				this.resolvers.push(resolve);
			});
		} };
	}
};
var NodeProcessRunner = class {
	spawn(executable, args, options) {
		const queue = new AsyncQueue();
		const startMs = Date.now();
		let exitCode = 0;
		let stdoutClosed = false;
		let stderrClosed = false;
		let processClosed = false;
		let stdoutBuffer = "";
		let stderrBuffer = "";
		let aborted = false;
		function emitBufferedLines(chunk, stream) {
			const parts = ((stream === "stdout" ? stdoutBuffer : stderrBuffer) + chunk).split(/\r\n|[\r\n]/);
			const remainder = parts.pop() ?? "";
			for (const line of parts) queue.push({
				type: stream,
				line
			});
			return remainder;
		}
		function flushBuffer(stream) {
			const buffer = stream === "stdout" ? stdoutBuffer : stderrBuffer;
			if (buffer.length > 0) {
				queue.push({
					type: stream,
					line: buffer
				});
				if (stream === "stdout") stdoutBuffer = "";
				else stderrBuffer = "";
			}
		}
		function tryFinalize() {
			if (stdoutClosed && stderrClosed && processClosed) {
				queue.push({
					type: "done",
					exitCode,
					durationMs: Date.now() - startMs
				});
				queue.close();
			}
		}
		const resolvedExecutable = resolveInternalExecutable(executable);
		const sanitizedArgs = args.filter((arg) => arg !== "");
		const isWindows = process.platform === "win32";
		const spawnCmd = isWindows ? "cmd.exe" : resolvedExecutable;
		const spawnArgs = isWindows ? [
			"/d",
			"/s",
			"/c",
			resolvedExecutable,
			...sanitizedArgs
		] : sanitizedArgs;
		const proc = node_child_process.spawn(spawnCmd, spawnArgs, {
			cwd: options.cwd,
			env: buildChildProcessEnv$1(options.env),
			shell: false,
			windowsHide: true,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		const handleAbort = () => {
			if (processClosed || aborted) return;
			aborted = true;
			queue.push({
				type: "stderr",
				line: "Build cancelled."
			});
			if (process.platform === "win32" && proc.pid) node_child_process.spawn("taskkill", [
				"/pid",
				String(proc.pid),
				"/T",
				"/F"
			], {
				stdio: "ignore",
				windowsHide: true
			}).on("error", () => {});
			else proc.kill("SIGTERM");
		};
		if (options.signal) if (options.signal.aborted) handleAbort();
		else options.signal.addEventListener("abort", handleAbort, { once: true });
		proc.stdout?.setEncoding("utf8");
		proc.stderr?.setEncoding("utf8");
		proc.stdout?.on("data", (chunk) => {
			stdoutBuffer = emitBufferedLines(chunk, "stdout");
		});
		proc.stdout?.on("close", () => {
			flushBuffer("stdout");
			stdoutClosed = true;
			tryFinalize();
		});
		proc.stderr?.on("data", (chunk) => {
			stderrBuffer = emitBufferedLines(chunk, "stderr");
		});
		proc.stderr?.on("close", () => {
			flushBuffer("stderr");
			stderrClosed = true;
			tryFinalize();
		});
		proc.on("close", (code) => {
			exitCode = code ?? 1;
			processClosed = true;
			if (options.signal) options.signal.removeEventListener("abort", handleAbort);
			tryFinalize();
		});
		proc.on("error", (err) => {
			const details = [
				`Process error: ${err.message}`,
				`  executable: ${resolvedExecutable}`,
				`  args: ${JSON.stringify(sanitizedArgs)}`,
				`  cwd: ${options.cwd}`
			].join("\n");
			queue.push({
				type: "stderr",
				line: details
			});
			exitCode = 1;
			stdoutClosed = true;
			stderrClosed = true;
			processClosed = true;
			if (options.signal) options.signal.removeEventListener("abort", handleAbort);
			tryFinalize();
		});
		return queue;
	}
	launchExternal(executable, args, options) {
		const queue = new AsyncQueue();
		const startMs = Date.now();
		if (process.platform !== "win32") {
			queue.push({
				type: "stderr",
				line: "External terminal launch is currently supported only on Windows."
			});
			queue.push({
				type: "done",
				exitCode: 1,
				durationMs: Date.now() - startMs
			});
			queue.close();
			return queue;
		}
		const launchCommand = buildWindowsExternalLaunchCommand(executable, args, options.cwd);
		const launcher = node_child_process.spawn("powershell.exe", [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			launchCommand
		], {
			cwd: options.cwd,
			env: buildChildProcessEnv$1(options.env),
			windowsHide: true,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		let stderr = "";
		launcher.stderr?.setEncoding("utf8");
		launcher.stderr?.on("data", (chunk) => {
			stderr += chunk;
		});
		launcher.on("error", (error) => {
			queue.push({
				type: "stderr",
				line: `Failed to launch external terminal: ${error.message}`
			});
			queue.push({
				type: "done",
				exitCode: 1,
				durationMs: Date.now() - startMs
			});
			queue.close();
		});
		launcher.on("close", (code) => {
			if ((code ?? 1) === 0) {
				queue.push({
					type: "stdout",
					line: "Launched in an external terminal window."
				});
				queue.push({
					type: "done",
					exitCode: 0,
					durationMs: Date.now() - startMs
				});
			} else {
				const message = stderr.trim() || "Failed to launch external terminal window.";
				queue.push({
					type: "stderr",
					line: message
				});
				queue.push({
					type: "done",
					exitCode: code ?? 1,
					durationMs: Date.now() - startMs
				});
			}
			queue.close();
		});
		return queue;
	}
};
function buildWindowsExternalLaunchCommand(executable, args, cwd) {
	return ["$shell = if (Get-Command pwsh.exe -ErrorAction SilentlyContinue) { 'pwsh.exe' } else { 'powershell.exe' }", `Start-Process -FilePath $shell -ArgumentList @('-NoExit', '-NoProfile', '-Command', '${escapeForPowerShell([`Set-Location -LiteralPath '${escapeForPowerShell(cwd)}'`, `& '${escapeForPowerShell(executable)}'${args.length > 0 ? ` ${args.map(quoteForPowerShellLiteral).join(" ")}` : ""}`].join("; "))}') -WorkingDirectory '${escapeForPowerShell(cwd)}'`].join("; ");
}
function resolveInternalExecutable(executable) {
	if (process.platform !== "win32") return executable;
	const ext = executable.slice(Math.max(0, executable.lastIndexOf(".")));
	if (ext === ".exe" || ext === ".cmd" || ext === ".bat" || ext === ".ps1") return executable;
	const normalized = executable.replace(/\\/g, "/");
	const basename = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
	if (basename === "npm" || basename === "pnpm" || basename === "npx" || basename === "mvn" || basename === "mvnw") return `${executable}.cmd`;
	return executable;
}
function quoteForPowerShellLiteral(value) {
	return `'${escapeForPowerShell(value)}'`;
}
function escapeForPowerShell(value) {
	return value.replace(/'/g, "''");
}
//#endregion
//#region ../../packages/domain/dist/build-command.js
var MAVEN_OPTION_FLAG_BY_KEY = {
	skipTests: "-DskipTests",
	skipTestCompile: "-Dmaven.test.skip=true",
	updateSnapshots: "-U",
	offline: "-o",
	quiet: "-q",
	debug: "-X",
	errors: "-e",
	failAtEnd: "-fae",
	failNever: "-fn"
};
function buildCommandString(step) {
	if (step.buildSystem === "maven") return [step.mavenExecutable, ...buildMavenArgs(step)].join(" ");
	return buildNodeCommandString(step.packageManager ?? "npm", step.commandType, step.args, step.script);
}
function buildMavenArgs(step) {
	const args = [...step.goals];
	for (const optionKey of step.optionKeys ?? []) args.push(MAVEN_OPTION_FLAG_BY_KEY[optionKey]);
	const profileArgValue = buildMavenProfileArgValue(step.profileStates ?? {});
	if (profileArgValue) args.push("-P", profileArgValue);
	if (step.modulePath && step.submoduleBuildStrategy !== "submodule-dir") args.push("-pl", step.modulePath);
	args.push(...step.extraOptions ?? []);
	return args;
}
function buildMavenProfileArgValue(profileStates) {
	const explicitProfiles = Object.entries(profileStates).filter(([, state]) => state !== "default").sort(([a], [b]) => a.localeCompare(b)).map(([profileId, state]) => state === "disabled" ? `!${profileId}` : profileId);
	if (explicitProfiles.length === 0) return;
	return explicitProfiles.join(",");
}
function buildNodeCommandString(packageManager, commandType, args = [], script) {
	if (commandType === "install") return [
		packageManager,
		"install",
		...args
	].join(" ");
	return [
		packageManager,
		"run",
		script ?? "<script>",
		...args.length > 0 ? ["--", ...args] : []
	].join(" ");
}
//#endregion
//#region ../../packages/domain/dist/package-parser.js
function parsePackageJson(content) {
	let pkg;
	try {
		pkg = JSON.parse(content);
	} catch {
		return {
			name: "unknown",
			scripts: {},
			isAngular: false
		};
	}
	const name = typeof pkg["name"] === "string" ? pkg["name"] : "unknown";
	const version = typeof pkg["version"] === "string" ? pkg["version"] : void 0;
	const scripts = {};
	if (pkg["scripts"] && typeof pkg["scripts"] === "object") {
		for (const [k, v] of Object.entries(pkg["scripts"])) if (typeof v === "string") scripts[k] = v;
	}
	const deps = {
		...pkg["dependencies"],
		...pkg["devDependencies"]
	};
	return {
		name,
		version,
		scripts,
		isAngular: "@angular/core" in deps || "@angular/cli" in deps,
		angularVersion: (deps["@angular/core"] ?? deps["@angular/cli"])?.replace(/[^0-9.]/g, "")
	};
}
//#endregion
//#region ../../packages/domain/dist/pom-parser.js
function parsePom(content) {
	const normalized = stripXmlComments(content);
	return {
		artifactId: extractArtifactId(normalized) ?? "unknown",
		packaging: extractTagValue(normalized, "packaging") ?? "jar",
		isAggregator: extractTagBlocks(normalized, "modules").length > 0,
		javaVersion: extractJavaVersion(normalized),
		modules: extractModules(normalized),
		profiles: extractProfiles(normalized)
	};
}
function extractTagValue(content, tag) {
	return extractTagBlocks(content, tag)[0]?.trim() || void 0;
}
function extractArtifactId(content) {
	const parentEnd = content.indexOf("</parent>");
	return extractTagValue(parentEnd !== -1 ? content.slice(parentEnd) : content, "artifactId");
}
function extractJavaVersion(content) {
	return extractTagValue(content, "maven.compiler.source") ?? extractTagValue(content, "maven.compiler.release");
}
function extractModules(content) {
	const modulesBlock = extractTagBlocks(content, "modules")[0];
	if (!modulesBlock) return [];
	return extractTagBlocks(modulesBlock, "module").map((modulePath) => modulePath.trim()).filter(Boolean);
}
function extractProfiles(content) {
	return extractTagBlocks(content, "profile").map((profileBlock) => {
		const id = extractTagValue(profileBlock, "id");
		if (!id) return null;
		return {
			id,
			activeByDefault: extractTagValue(profileBlock, "activeByDefault") === "true"
		};
	}).filter((profile) => profile !== null);
}
function extractTagBlocks(content, tag) {
	return [...content.matchAll(new RegExp(`<(?:(?:[\\w-]+):)?${escapeRegExp(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:(?:[\\w-]+):)?${escapeRegExp(tag)}>`, "g"))].map((match) => match[1] ?? "");
}
function stripXmlComments(content) {
	return content.replace(/<!--[\s\S]*?-->/g, "");
}
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//#endregion
//#region ../../packages/application/dist/jdk-resolver.js
/**
* Look up a JDK path from the registry by version string.
*/
function resolveJavaHome(config, javaVersion) {
	if (!javaVersion) return void 0;
	return config.jdkRegistry[javaVersion];
}
function requireRegisteredJavaHome(config, javaVersion) {
	if (!javaVersion) return void 0;
	const javaHome = resolveJavaHome(config, javaVersion);
	if (!javaHome) throw new Error(`Java version "${javaVersion}" is not registered in the JDK registry. Add it in Settings before selecting it as a JAVA_HOME override.`);
	return javaHome;
}
/**
* Build a JAVA_HOME-augmented env object, or undefined if no override needed.
*/
function buildEnvWithJavaHome(javaHome) {
	if (!javaHome) return void 0;
	return buildChildProcessEnv({ JAVA_HOME: javaHome });
}
/**
* Scan a base directory for JDK installations.
* Looks for directories containing bin/javac (or bin/javac.exe on Windows),
* then reads the `release` file to extract the major version.
*/
async function detectJdks(baseDir, fs) {
	const results = /* @__PURE__ */ new Map();
	if (!await fs.exists(baseDir)) return [];
	const selfDetected = await inspectJdkHome(baseDir, node_path.default.basename(baseDir), fs);
	if (selfDetected) results.set(selfDetected.version, selfDetected);
	let entries;
	try {
		entries = await fs.readDir(baseDir);
	} catch {
		return Array.from(results.values()).sort((a, b) => Number(a.version) - Number(b.version));
	}
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const detected = await inspectJdkHome(node_path.default.join(baseDir, entry.name), entry.name, fs);
		if (!detected || results.has(detected.version)) continue;
		results.set(detected.version, detected);
	}
	return Array.from(results.values()).sort((a, b) => Number(a.version) - Number(b.version));
}
/**
* Parse the JAVA_VERSION from a JDK `release` file.
* Handles both modern (21.0.1) and legacy (1.8.0_382) formats.
*/
function parseJavaVersion(releaseContent) {
	const match = releaseContent.match(/JAVA_VERSION="([^"]+)"/);
	if (!match?.[1]) return void 0;
	const raw = match[1];
	if (raw.startsWith("1.")) return raw.split(".")[1];
	return raw.split(".")[0];
}
function inferVersionFromName(name) {
	return name.match(/(?:jdk|java)[_-]?(\d+)/i)?.[1];
}
async function inspectJdkHome(jdkDir, fallbackName, fs) {
	const javacPath = node_path.default.join(jdkDir, "bin", process.platform === "win32" ? "javac.exe" : "javac");
	if (!await fs.exists(javacPath)) return void 0;
	const releasePath = node_path.default.join(jdkDir, "release");
	let version;
	if (await fs.exists(releasePath)) try {
		version = parseJavaVersion(await fs.readFile(releasePath));
	} catch {}
	if (!version) version = inferVersionFromName(fallbackName);
	return version ? {
		version,
		path: jdkDir
	} : void 0;
}
function buildChildProcessEnv(overrides) {
	const env = { ...process.env };
	delete env.NODE_ENV;
	return overrides ? {
		...env,
		...overrides
	} : env;
}
//#endregion
//#region ../../packages/application/dist/build-executor.js
var BuildExecutor = class {
	runner;
	constructor(runner) {
		this.runner = runner;
	}
	execute(step, signal) {
		const args = buildMavenArgs(step);
		const env = buildEnvWithJavaHome(step.javaHome);
		const cwd = step.submoduleBuildStrategy === "submodule-dir" && step.modulePath ? node_path.default.join(step.path, step.modulePath) : step.path;
		if (step.executionMode === "external") return this.runner.launchExternal(step.mavenExecutable, args, {
			cwd,
			env
		});
		return this.runner.spawn(step.mavenExecutable, args, {
			cwd,
			env,
			signal
		});
	}
};
//#endregion
//#region ../../packages/application/dist/git-info.js
/** No-op implementation used when git info is not available (e.g. in tests). */
var noopGitInfoReader = {
	getInfo: () => ({
		branch: null,
		isDirty: false
	}),
	getBatch: async (paths) => Object.fromEntries(paths.map((p) => [p, {
		branch: null,
		isDirty: false
	}]))
};
//#endregion
//#region ../../packages/application/dist/node-project.js
var PACKAGE_MANAGER_LOCKFILES = [
	{
		packageManager: "bun",
		filenames: ["bun.lock", "bun.lockb"]
	},
	{
		packageManager: "pnpm",
		filenames: ["pnpm-lock.yaml"]
	},
	{
		packageManager: "npm",
		filenames: ["package-lock.json", "npm-shrinkwrap.json"]
	}
];
async function inspectNodeProject(fs, dir, forceAngular = false) {
	const packageJsonPath = node_path.default.join(dir, "package.json");
	if (!await fs.exists(packageJsonPath)) return null;
	let parsed = {
		name: node_path.default.basename(dir),
		scripts: {},
		isAngular: forceAngular
	};
	try {
		parsed = parsePackageJson(await fs.readFile(packageJsonPath));
	} catch {}
	return {
		packageJsonPath,
		name: parsed.name,
		version: parsed.version,
		scripts: parsed.scripts,
		packageManager: await detectPackageManager(fs, dir),
		isAngular: forceAngular || parsed.isAngular,
		angularVersion: parsed.angularVersion
	};
}
async function detectPackageManager(fs, dir) {
	for (const candidate of PACKAGE_MANAGER_LOCKFILES) for (const filename of candidate.filenames) if (await fs.exists(node_path.default.join(dir, filename))) return candidate.packageManager;
	return "npm";
}
//#endregion
//#region ../../packages/application/dist/build-runner.js
var BuildRunner = class {
	executor;
	nodeExecutor;
	fs;
	constructor(executor, nodeExecutor, fs) {
		this.executor = executor;
		this.nodeExecutor = nodeExecutor;
		this.fs = fs;
	}
	async *run(step, index, total, pipelineName, signal) {
		const manifestFile = step.buildSystem === "node" ? "package.json" : "pom.xml";
		const manifestPath = node_path.default.join(step.path, manifestFile);
		if (!await this.fs.exists(manifestPath)) {
			yield {
				type: "step:output",
				line: `No ${manifestFile} found at "${step.path}".` + (pipelineName ? ` Check step "${step.label}" in pipeline "${pipelineName}".` : ""),
				stream: "stderr"
			};
			yield {
				type: "step:done",
				step,
				index,
				total,
				exitCode: 1,
				durationMs: 0,
				status: "failed",
				success: false
			};
			return;
		}
		const effectiveStep = step.buildSystem === "node" ? await this.resolveNodeStep(step) : step;
		yield {
			type: "step:start",
			step: effectiveStep,
			index,
			total,
			pipelineName
		};
		let exitCode = 0;
		let durationMs = 0;
		try {
			const events = effectiveStep.buildSystem === "node" ? this.nodeExecutor.execute(effectiveStep, signal) : this.executor.execute(effectiveStep, signal);
			for await (const event of events) if (event.type === "stdout" || event.type === "stderr") yield {
				type: "step:output",
				line: event.line,
				stream: event.type
			};
			else {
				exitCode = event.exitCode;
				durationMs = event.durationMs;
			}
		} catch (error) {
			yield {
				type: "step:output",
				line: error instanceof Error ? error.message : String(error),
				stream: "stderr"
			};
			exitCode = 1;
			durationMs = 0;
		}
		const status = this.getCompletionStatus(effectiveStep, exitCode);
		yield {
			type: "step:done",
			step: effectiveStep,
			index,
			total,
			exitCode,
			durationMs,
			status,
			success: status !== "failed"
		};
	}
	async resolveNodeStep(step) {
		const metadata = await inspectNodeProject(this.fs, step.path);
		if (!metadata) throw new Error(`No package.json found at "${step.path}".`);
		if (step.commandType === "script" && (!step.script || !(step.script in metadata.scripts))) throw new Error(`Script "${step.script}" is not defined in "${metadata.packageJsonPath}".`);
		return {
			...step,
			packageManager: metadata.packageManager
		};
	}
	getCompletionStatus(step, exitCode) {
		if (exitCode !== 0) return "failed";
		if (step.executionMode === "external") return "launched";
		return "success";
	}
};
//#endregion
//#region ../../packages/application/dist/maven-project.js
async function inspectMavenProject(fs, projectPath) {
	const pomPath = node_path.default.join(projectPath, "pom.xml");
	if (!await fs.exists(pomPath)) return null;
	const visited = /* @__PURE__ */ new Set();
	const modules = [];
	const profiles = [];
	let rootArtifactId = "unknown";
	let rootPackaging = "jar";
	let rootJavaVersion;
	let isAggregator = false;
	async function visitModule(modulePath) {
		const normalizedModulePath = node_path.default.normalize(modulePath);
		if (visited.has(normalizedModulePath)) return;
		visited.add(normalizedModulePath);
		const currentPomPath = node_path.default.join(modulePath, "pom.xml");
		if (!await fs.exists(currentPomPath)) return;
		let parsed;
		try {
			parsed = parsePom(await fs.readFile(currentPomPath));
		} catch {
			return;
		}
		const relativePath = toPortablePath(node_path.default.relative(projectPath, modulePath));
		if (relativePath === "") {
			rootArtifactId = parsed.artifactId;
			rootPackaging = parsed.packaging;
			rootJavaVersion = parsed.javaVersion;
			isAggregator = parsed.isAggregator;
		} else modules.push({
			id: parsed.artifactId,
			name: node_path.default.basename(modulePath),
			relativePath,
			fullPath: modulePath,
			packaging: parsed.packaging,
			javaVersion: parsed.javaVersion
		});
		for (const profile of parsed.profiles) profiles.push({
			id: profile.id,
			activeByDefault: profile.activeByDefault,
			sourcePomPath: currentPomPath,
			sourceModulePath: relativePath
		});
		for (const childModule of parsed.modules) await visitModule(node_path.default.resolve(modulePath, childModule));
	}
	await visitModule(projectPath);
	const mvnConfigPath = node_path.default.join(projectPath, ".mvn", "maven.config");
	const hasMvnConfig = await fs.exists(mvnConfigPath);
	let mvnConfigContent;
	if (hasMvnConfig) try {
		mvnConfigContent = (await fs.readFile(mvnConfigPath)).trim();
	} catch {}
	const dedupedModules = dedupeModules(modules);
	return {
		pomPath,
		artifactId: rootArtifactId,
		packaging: rootPackaging,
		isAggregator,
		javaVersion: highestJavaVersion([rootJavaVersion, ...dedupedModules.map((m) => m.javaVersion)]),
		modules: dedupedModules,
		profiles: dedupeProfiles(profiles),
		hasMvnConfig,
		mvnConfigContent
	};
}
function dedupeModules(modules) {
	const byPath = /* @__PURE__ */ new Map();
	for (const moduleEntry of modules) byPath.set(moduleEntry.relativePath, moduleEntry);
	return [...byPath.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
function dedupeProfiles(profiles) {
	const byKey = /* @__PURE__ */ new Map();
	for (const profile of profiles) byKey.set(`${profile.id}:${profile.sourceModulePath}`, profile);
	return [...byKey.values()].sort((a, b) => a.id.localeCompare(b.id) || a.sourceModulePath.localeCompare(b.sourceModulePath));
}
function highestJavaVersion(versions) {
	const parsed = versions.filter((v) => v !== void 0).map((v) => ({
		raw: v,
		numeric: parseInt(v, 10)
	})).filter((v) => !isNaN(v.numeric));
	if (parsed.length === 0) return void 0;
	return parsed.reduce((a, b) => b.numeric > a.numeric ? b : a).raw;
}
function toPortablePath(value) {
	return value.replace(/\\/g, "/");
}
//#endregion
//#region ../../packages/application/dist/node-executor.js
var NodeExecutor = class {
	runner;
	constructor(runner) {
		this.runner = runner;
	}
	execute(step, signal) {
		const executable = step.nodeExecutables[step.packageManager ?? "npm"];
		const args = step.commandType === "install" ? ["install", ...step.args] : [
			"run",
			step.script ?? "",
			...step.args.length > 0 ? ["--", ...step.args] : []
		];
		if (step.executionMode === "external") return this.runner.launchExternal(executable, args, { cwd: step.path });
		return this.runner.spawn(executable, args, {
			cwd: step.path,
			signal
		});
	}
};
//#endregion
//#region ../../packages/application/dist/pipeline-runner.js
var PipelineRunner = class {
	buildRunner;
	db;
	gitInfoReader;
	constructor(buildRunner, db, gitInfoReader) {
		this.buildRunner = buildRunner;
		this.db = db;
		this.gitInfoReader = gitInfoReader ?? noopGitInfoReader;
	}
	async *run(pipeline, fromIndex = 0, jobId, signal, existingRunId) {
		const startTime = Date.now();
		const runId = existingRunId ?? this.db.createRun({
			jobId,
			kind: "pipeline",
			pipelineName: pipeline.name,
			title: pipeline.name
		});
		const results = [];
		const stepsToRun = pipeline.steps.slice(fromIndex);
		const total = pipeline.steps.length;
		let failedAt;
		yield {
			type: "run:start",
			startedAt: startTime,
			runId
		};
		for (let i = 0; i < stepsToRun.length; i++) {
			const step = stepsToRun[i];
			const displayIndex = fromIndex + i;
			let logSeq = 0;
			let stepRunId;
			for await (const event of this.buildRunner.run(step, displayIndex, total, pipeline.name, signal)) {
				if (event.type === "step:start") {
					if (stepRunId === void 0) try {
						const gitInfo = this.gitInfoReader.getInfo(event.step.path);
						stepRunId = this.db.createStepRun({
							runId,
							jobId,
							projectPath: event.step.path,
							projectName: event.step.label,
							buildSystem: event.step.buildSystem,
							packageManager: event.step.buildSystem === "node" ? event.step.packageManager : void 0,
							executionMode: event.step.buildSystem === "node" ? event.step.executionMode : void 0,
							command: buildCommandString(event.step),
							javaHome: event.step.buildSystem === "maven" ? event.step.javaHome : void 0,
							pipelineName: pipeline.name,
							stepIndex: displayIndex,
							stepLabel: event.step.label,
							branch: gitInfo.branch ?? void 0
						});
					} catch {}
					yield stepRunId !== void 0 ? {
						...event,
						runId: stepRunId
					} : event;
				} else yield event;
				if (event.type === "step:output" && stepRunId !== void 0) try {
					this.db.appendStepLog(stepRunId, logSeq++, event.stream, event.line);
				} catch {}
				if (event.type === "step:done") {
					results.push({
						step: event.step,
						exitCode: event.exitCode,
						durationMs: event.durationMs,
						status: event.status,
						success: event.success
					});
					if (stepRunId !== void 0) try {
						this.db.finishStepRun({
							id: stepRunId,
							exitCode: event.exitCode,
							durationMs: event.durationMs,
							status: event.status
						});
					} catch {}
					if (event.status === "failed" && pipeline.failFast) failedAt = displayIndex;
				}
			}
			if (failedAt !== void 0) break;
		}
		const status = deriveRunStatus$1(results, failedAt);
		const runResult = {
			results,
			status,
			success: status !== "failed",
			durationMs: Date.now() - startTime,
			stoppedAt: failedAt
		};
		try {
			this.db.finishRun({
				id: runId,
				status,
				durationMs: runResult.durationMs,
				stoppedAt: failedAt
			});
		} catch {}
		yield {
			type: "run:done",
			result: runResult
		};
	}
	getResumeIndex(pipelineName) {
		try {
			const index = this.db.getLastFailedStepIndex(pipelineName);
			if (index !== null && index !== void 0) return index;
		} catch {}
		return 0;
	}
};
function deriveRunStatus$1(results, failedAt) {
	if (failedAt !== void 0 || results.some((result) => result.status === "failed")) return "failed";
	if (results.some((result) => result.status === "launched")) return "launched";
	return "success";
}
//#endregion
//#region ../../packages/application/dist/repository-scanner.js
var HARD_SKIPPED_DIRECTORIES = new Set([
	"node_modules",
	".git",
	"target",
	"dist",
	"build",
	".next",
	"out",
	"coverage",
	".turbo"
]);
var RepositoryScanner = class {
	fs;
	constructor(fs) {
		this.fs = fs;
	}
	async *scan(options) {
		const startTime = Date.now();
		const discovered = [];
		const seen = /* @__PURE__ */ new Set();
		const claimedMavenModuleDirs = /* @__PURE__ */ new Set();
		for (const [rootName, rootPath] of Object.entries(options.roots)) {
			if (!await this.fs.exists(rootPath)) continue;
			const queue = [{
				dir: rootPath,
				depth: 0
			}];
			while (queue.length > 0) {
				const { dir, depth } = queue.shift();
				if (seen.has(dir)) continue;
				if (claimedMavenModuleDirs.has(node_path.default.normalize(dir))) {
					seen.add(dir);
					continue;
				}
				const pomPath = node_path.default.join(dir, "pom.xml");
				if (await this.fs.exists(pomPath)) {
					seen.add(dir);
					const maven = await inspectMavenProject(this.fs, dir);
					if (!maven) continue;
					for (const moduleEntry of maven.modules) claimedMavenModuleDirs.add(node_path.default.normalize(moduleEntry.fullPath));
					const project = {
						name: node_path.default.basename(dir),
						path: dir,
						depth,
						rootName,
						buildSystem: "maven",
						maven
					};
					discovered.push(project);
					yield {
						type: "repo:found",
						project
					};
					continue;
				}
				const angularJsonPath = node_path.default.join(dir, "angular.json");
				if (await this.fs.exists(angularJsonPath)) {
					seen.add(dir);
					const node = await inspectNodeProject(this.fs, dir, true);
					const project = {
						name: node_path.default.basename(dir),
						path: dir,
						depth,
						rootName,
						buildSystem: "node",
						node: node ?? void 0
					};
					discovered.push(project);
					yield {
						type: "repo:found",
						project
					};
					continue;
				}
				const packageJsonPath = node_path.default.join(dir, "package.json");
				if (await this.fs.exists(packageJsonPath)) {
					seen.add(dir);
					const node = await inspectNodeProject(this.fs, dir, false);
					const project = {
						name: node_path.default.basename(dir),
						path: dir,
						depth,
						rootName,
						buildSystem: "node",
						node: node ?? void 0
					};
					discovered.push(project);
					yield {
						type: "repo:found",
						project
					};
					continue;
				}
				let entries;
				try {
					entries = await this.fs.readDir(dir);
				} catch {
					continue;
				}
				for (const entry of entries) {
					if (!entry.isDirectory()) continue;
					if (HARD_SKIPPED_DIRECTORIES.has(entry.name)) continue;
					if (!options.includeHidden && entry.name.startsWith(".")) continue;
					if (options.exclude.includes(entry.name)) continue;
					queue.push({
						dir: node_path.default.join(dir, entry.name),
						depth: depth + 1
					});
				}
			}
		}
		yield {
			type: "scan:done",
			projects: [...discovered].sort((a, b) => a.path.localeCompare(b.path)),
			durationMs: Date.now() - startTime,
			fromCache: false
		};
	}
};
//#endregion
//#region ../../packages/application/dist/scanner.js
var DEFAULT_CACHE_TTL_MS = 300 * 1e3;
var CachedScanner = class {
	scanner;
	cache;
	constructor(scanner, cache) {
		this.scanner = scanner;
		this.cache = cache;
	}
	async *scan(options, ttlMs = DEFAULT_CACHE_TTL_MS, noCache = false) {
		const cacheKey = buildCacheKey(options);
		if (!noCache) {
			const cached = this.cache.get(cacheKey, ttlMs);
			if (cached) {
				for (const project of cached) yield {
					type: "repo:found",
					project
				};
				yield {
					type: "scan:done",
					projects: cached,
					durationMs: 0,
					fromCache: true
				};
				return;
			}
		}
		for await (const event of this.scanner.scan(options)) {
			yield event;
			if (event.type === "scan:done") this.cache.set(cacheKey, event.projects);
		}
	}
};
function buildCacheKey(options) {
	const data = JSON.stringify({
		roots: Object.entries(options.roots).sort(),
		includeHidden: options.includeHidden,
		exclude: [...options.exclude].sort()
	});
	return node_crypto.createHash("sha1").update(data).digest("hex").slice(0, 16);
}
//#endregion
//#region ../../packages/platform-node/dist/resolver.js
function resolveStepPath(rawPath, roots) {
	const colonIndex = rawPath.indexOf(":");
	if (colonIndex === 1) return node_path.default.normalize(rawPath);
	if (colonIndex > 1) {
		const rootName = rawPath.slice(0, colonIndex);
		const relPath = rawPath.slice(colonIndex + 1);
		const rootValue = roots[rootName];
		if (rootValue === void 0) {
			const configured = Object.keys(roots);
			const hint = configured.length > 0 ? `Configured roots: ${configured.join(", ")}` : "No roots configured. Run \"gfos-build config init\" to set up.";
			throw new Error(`Unknown root "${rootName}" in path "${rawPath}". ${hint}`);
		}
		return node_path.default.join(node_path.default.normalize(rootValue), node_path.default.normalize(relPath));
	}
	return node_path.default.resolve(rawPath);
}
function resolveStep(stepConfig, config) {
	const resolvedPath = resolveStepPath(stepConfig.path, config.roots);
	const label = stepConfig.label ?? node_path.default.basename(resolvedPath);
	if (stepConfig.buildSystem === "node") return {
		path: resolvedPath,
		buildSystem: "node",
		label,
		commandType: stepConfig.commandType,
		script: stepConfig.script,
		args: stepConfig.args,
		executionMode: stepConfig.executionMode,
		nodeExecutables: config.node.executables
	};
	const goals = stepConfig.goals ?? config.maven.defaultGoals;
	const mavenExecutable = stepConfig.maven ?? config.maven.executable;
	const javaVersion = stepConfig.javaVersion;
	const javaHome = requireRegisteredJavaHome(config, javaVersion);
	return {
		path: resolvedPath,
		buildSystem: "maven",
		modulePath: stepConfig.modulePath,
		submoduleBuildStrategy: stepConfig.submoduleBuildStrategy,
		goals,
		optionKeys: stepConfig.optionKeys ?? config.maven.defaultOptionKeys,
		profileStates: stepConfig.profileStates ?? {},
		extraOptions: stepConfig.extraOptions ?? config.maven.defaultExtraOptions,
		executionMode: stepConfig.executionMode ?? "internal",
		label,
		mavenExecutable,
		javaVersion,
		javaHome
	};
}
function resolvePipeline(name, pipelineConfig, config) {
	return {
		name,
		description: pipelineConfig.description,
		failFast: pipelineConfig.failFast,
		steps: pipelineConfig.steps.map((s) => resolveStep(s, config))
	};
}
//#endregion
//#region ../../packages/platform-node/dist/git-info.js
var execAsync = (0, node_util.promisify)(node_child_process.exec);
var GIT_OPTS = {
	timeout: 3e3,
	encoding: "utf8"
};
var NULL_INFO = {
	branch: null,
	isDirty: false
};
var MAX_CONCURRENCY = 4;
async function gitExec(cmd, cwd) {
	const { stdout } = await execAsync(cmd, {
		...GIT_OPTS,
		cwd
	});
	return stdout.trim();
}
async function resolveGitInfo(cwd) {
	let branch = null;
	try {
		branch = await gitExec("git rev-parse --abbrev-ref HEAD", cwd) || null;
	} catch {
		return NULL_INFO;
	}
	let isDirty = false;
	try {
		isDirty = (await gitExec("git status --porcelain", cwd)).length > 0;
	} catch {}
	return {
		branch,
		isDirty
	};
}
async function mapConcurrent(items, concurrency, fn) {
	const results = new Array(items.length);
	let next = 0;
	async function worker() {
		while (next < items.length) {
			const i = next++;
			results[i] = await fn(items[i]);
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
	return results;
}
var NodeGitInfoReader = class {
	gitRootCache = /* @__PURE__ */ new Map();
	headChangeCallback = null;
	watchedRoots = /* @__PURE__ */ new Set();
	headWatchers = [];
	async resolveGitRoot(p) {
		if (this.gitRootCache.has(p)) return this.gitRootCache.get(p) ?? null;
		try {
			const root = await gitExec("git rev-parse --show-toplevel", p);
			this.gitRootCache.set(p, root);
			this.tryWatchRoot(root);
			return root;
		} catch {
			this.gitRootCache.set(p, null);
			return null;
		}
	}
	tryWatchRoot(root) {
		if (!this.headChangeCallback || this.watchedRoots.has(root)) return;
		this.watchedRoots.add(root);
		try {
			const w = (0, node_fs.watch)(node_path.default.join(root, ".git", "HEAD"), { persistent: false }, () => this.headChangeCallback?.());
			this.headWatchers.push(w);
		} catch {}
	}
	/**
	* Start watching .git/HEAD for every known (and future) git root.
	* Events are debounced (250 ms) so multiple rapid fs.watch firings from a
	* single `git checkout` coalesce into one callback — preventing redundant
	* IPC sends and git process spawns.
	* Returns a cleanup that cancels the pending debounce and stops all watchers.
	*/
	watchHeads(onChange) {
		let timer = null;
		const debounced = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				timer = null;
				onChange();
			}, 250);
		};
		this.headChangeCallback = debounced;
		for (const root of this.gitRootCache.values()) if (root) this.tryWatchRoot(root);
		return () => {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			this.close();
		};
	}
	close() {
		this.headChangeCallback = null;
		for (const w of this.headWatchers) try {
			w.close();
		} catch {}
		this.headWatchers.length = 0;
		this.watchedRoots.clear();
	}
	getInfo(p) {
		let branch = null;
		try {
			branch = (0, node_child_process.execSync)("git rev-parse --abbrev-ref HEAD", {
				cwd: p,
				encoding: "utf8",
				timeout: 3e3,
				stdio: [
					"ignore",
					"pipe",
					"ignore"
				]
			}).trim() || null;
		} catch {
			return NULL_INFO;
		}
		let isDirty = false;
		try {
			isDirty = (0, node_child_process.execSync)("git status --porcelain", {
				cwd: p,
				encoding: "utf8",
				timeout: 3e3,
				stdio: [
					"ignore",
					"pipe",
					"ignore"
				]
			}).trim().length > 0;
		} catch {}
		return {
			branch,
			isDirty
		};
	}
	async getBatch(paths) {
		const rootEntries = await mapConcurrent(paths, MAX_CONCURRENCY, async (p) => ({
			path: p,
			root: await this.resolveGitRoot(p)
		}));
		const byRoot = /* @__PURE__ */ new Map();
		const results = {};
		for (const { path: p, root } of rootEntries) {
			if (!root) {
				results[p] = NULL_INFO;
				continue;
			}
			if (!byRoot.has(root)) byRoot.set(root, []);
			byRoot.get(root).push(p);
		}
		await mapConcurrent([...byRoot.entries()], MAX_CONCURRENCY, async ([, rootPaths]) => {
			const info = await resolveGitInfo(rootPaths[0]);
			for (const p of rootPaths) results[p] = info;
		});
		return results;
	}
};
//#endregion
//#region ../../packages/platform-node/dist/scan-cache.js
var SCAN_CACHE_VERSION = 1;
var FileScanCacheStore = class {
	cacheDir;
	constructor(cacheDir) {
		this.cacheDir = cacheDir;
	}
	get(key, ttlMs) {
		const filePath = this.getEntryPath(key);
		try {
			const stats = (0, node_fs.statSync)(filePath);
			if (Date.now() - stats.mtimeMs > ttlMs) {
				(0, node_fs.rmSync)(filePath, { force: true });
				return null;
			}
			const raw = (0, node_fs.readFileSync)(filePath, "utf8");
			const parsed = JSON.parse(raw);
			if (parsed.version !== SCAN_CACHE_VERSION || !Array.isArray(parsed.projects)) {
				(0, node_fs.rmSync)(filePath, { force: true });
				return null;
			}
			return parsed.projects;
		} catch {
			return null;
		}
	}
	set(key, projects) {
		(0, node_fs.mkdirSync)(this.cacheDir, { recursive: true });
		const record = {
			version: SCAN_CACHE_VERSION,
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			projects
		};
		(0, node_fs.writeFileSync)(this.getEntryPath(key), `${JSON.stringify(record)}\n`, "utf8");
	}
	clear() {
		(0, node_fs.rmSync)(this.cacheDir, {
			recursive: true,
			force: true
		});
	}
	prune(maxAgeMs) {
		try {
			const entries = (0, node_fs.readdirSync)(this.cacheDir, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isFile()) continue;
				const filePath = node_path.default.join(this.cacheDir, entry.name);
				try {
					const stats = (0, node_fs.statSync)(filePath);
					if (Date.now() - stats.mtimeMs > maxAgeMs) (0, node_fs.rmSync)(filePath, { force: true });
				} catch {}
			}
		} catch {}
	}
	getEntryPath(key) {
		return node_path.default.join(this.cacheDir, `${key}.json`);
	}
};
//#endregion
//#region ../../packages/platform-node/dist/runtime.js
var DEFAULT_SCAN_CACHE_TTL_MS = 300 * 1e3;
var DEFAULT_SCAN_JOB_TTL_MS = 300 * 1e3;
var MAX_JOB_HISTORY = 2e4;
var AppRuntime = class {
	options;
	db;
	fs;
	processRunner;
	gitInfoReader;
	scanner;
	buildRunner;
	pipelineRunner;
	startedAt = Date.now();
	jobs = /* @__PURE__ */ new Map();
	stateRootDir;
	constructor(options) {
		this.options = options;
		this.stateRootDir = options.stateRootDir;
		this.fs = new NodeFileSystem();
		this.processRunner = new NodeProcessRunner();
		this.gitInfoReader = new NodeGitInfoReader();
		loadSettings(this.getSettingsPath());
		this.scanner = new CachedScanner(new RepositoryScanner(this.fs), new FileScanCacheStore(getScanCacheDir(this.stateRootDir)));
		this.buildRunner = new BuildRunner(new BuildExecutor(this.processRunner), new NodeExecutor(this.processRunner), this.fs);
		this.db = new AppDatabase(getDbPath(this.stateRootDir));
		this.pipelineRunner = new PipelineRunner(this.buildRunner, this.db, this.gitInfoReader);
	}
	getHealth() {
		return {
			version: this.options.version,
			uptime: Date.now() - this.startedAt,
			platform: process.platform
		};
	}
	getConfig() {
		const { config, configPath } = loadSettings(this.getSettingsPath());
		return {
			config,
			configPath
		};
	}
	getSettingsSnapshot() {
		const { config, configPath } = loadSettings(this.getSettingsPath());
		return {
			config,
			configPath
		};
	}
	saveConfig(patch) {
		saveConfigPatch(patch, this.getSettingsPath());
		return { ok: true };
	}
	listPipelines() {
		const config = this.getSettings();
		const lastRuns = this.db.getLastRunsByPipeline();
		return this.db.listPipelineDefinitions().map((saved) => {
			const resolved = resolvePipeline(saved.name, saved.definition, config);
			const lastRun = lastRuns[saved.name] ?? null;
			return {
				name: saved.name,
				description: saved.definition.description,
				failFast: saved.definition.failFast,
				steps: resolved.steps.map((step) => toPipelineStep(step)),
				lastRun
			};
		});
	}
	createPipeline(input) {
		const definition = pipelineConfigSchema.parse(input.pipeline);
		this.db.savePipelineDefinition(input.name, definition);
		return {
			ok: true,
			name: input.name
		};
	}
	updatePipeline(input) {
		const definition = pipelineConfigSchema.parse(input.pipeline);
		this.db.savePipelineDefinition(input.name, definition);
		return {
			ok: true,
			name: input.name
		};
	}
	deletePipeline(name) {
		this.db.deletePipelineDefinition(name);
	}
	getPipelineDefinition(name) {
		return this.db.getPipelineDefinition(name)?.definition ?? null;
	}
	getResolvedPipeline(name) {
		const config = this.getSettings();
		const saved = this.db.getPipelineDefinition(name);
		if (!saved) throw new Error(`Pipeline "${name}" not found.`);
		return resolvePipeline(saved.name, saved.definition, config);
	}
	getResumeIndex(name) {
		return this.pipelineRunner.getResumeIndex(name);
	}
	runPipeline(input) {
		const config = this.getSettings();
		const saved = this.db.getPipelineDefinition(input.name);
		if (!saved) throw new Error(`Pipeline "${input.name}" not found.`);
		const pipeline = resolvePipeline(saved.name, saved.definition, config);
		const fromIndex = input.from ? resolveFromArg(pipeline, input.from) : 0;
		const jobId = (0, node_crypto.randomUUID)();
		const runId = this.db.createRun({
			jobId,
			kind: "pipeline",
			pipelineName: pipeline.name,
			title: pipeline.name
		});
		const job = this.createJob(jobId, new AbortController());
		this.runPipelineJob(job, pipeline, fromIndex, runId);
		return {
			jobId,
			runId
		};
	}
	runQuick(input) {
		const config = this.getSettings();
		const quickStep = this.resolveQuickRunStep(input, config);
		const jobId = (0, node_crypto.randomUUID)();
		const runId = this.db.createRun({
			jobId,
			kind: "quick",
			title: quickStep.label
		});
		const job = this.createJob(jobId, new AbortController());
		this.runQuickJob(job, quickStep, runId);
		return {
			jobId,
			runId
		};
	}
	cancelJob(jobId) {
		this.jobs.get(jobId)?.controller?.abort();
	}
	listRuns(opts) {
		return this.db.getRecentRuns({
			limit: opts?.limit ?? 100,
			pipeline: opts?.pipeline
		});
	}
	getRunLogs(runId, opts) {
		return this.db.getBuildLogs(runId, opts);
	}
	getStats() {
		return this.db.getBuildStats();
	}
	async getScan(noCache = false) {
		const config = this.getSettings();
		let result = {
			projects: [],
			durationMs: 0,
			fromCache: false
		};
		for await (const event of this.scanner.scan(toScanOptions(config), DEFAULT_SCAN_CACHE_TTL_MS, noCache)) if (event.type === "scan:done") result = {
			projects: event.projects,
			durationMs: event.durationMs,
			fromCache: event.fromCache
		};
		return result;
	}
	refreshScan() {
		const jobId = (0, node_crypto.randomUUID)();
		const job = this.createJob(jobId, null);
		this.runScanJob(job);
		return {
			jobId,
			runId: null
		};
	}
	async inspectProject(projectPath) {
		const maven = await inspectMavenProject(this.fs, projectPath);
		if (maven) return { project: {
			name: node_path.default.basename(projectPath),
			path: projectPath,
			depth: 0,
			rootName: "local",
			buildSystem: "maven",
			maven
		} };
		const node = await inspectNodeProject(this.fs, projectPath, false);
		return { project: node ? {
			name: node_path.default.basename(projectPath),
			path: projectPath,
			depth: 0,
			rootName: "local",
			buildSystem: "node",
			node
		} : null };
	}
	async detectJdks(baseDir) {
		return {
			baseDir,
			jdks: await detectJdks(baseDir, this.fs)
		};
	}
	clearRunLogs() {
		this.db.clearBuildLogs();
	}
	clearRuns() {
		this.db.clearAllBuilds();
	}
	getGitInfo(projectPath) {
		return this.gitInfoReader.getInfo(projectPath);
	}
	getGitInfoBatch(paths) {
		return this.gitInfoReader.getBatch(paths);
	}
	async *scanProjects(options) {
		const config = this.getSettings();
		const scanOptions = {
			roots: options?.roots ?? config.roots,
			includeHidden: options?.includeHidden ?? config.scan.includeHidden,
			exclude: options?.exclude ?? config.scan.exclude
		};
		for await (const event of this.scanner.scan(scanOptions, DEFAULT_SCAN_CACHE_TTL_MS, options?.noCache ?? false)) yield event;
	}
	subscribeRun(jobId, listener) {
		const job = this.jobs.get(jobId);
		if (!job) return () => void 0;
		for (const event of job.history) listener(event);
		job.listeners.add(listener);
		return () => {
			job.listeners.delete(listener);
		};
	}
	watchGitHeads(onChange) {
		return this.gitInfoReader.watchHeads(onChange);
	}
	close() {
		this.gitInfoReader.close();
		this.db.close();
		this.jobs.clear();
	}
	createJob(jobId, controller) {
		const job = {
			jobId,
			controller,
			history: [],
			listeners: /* @__PURE__ */ new Set(),
			done: false
		};
		this.jobs.set(jobId, job);
		return job;
	}
	async runPipelineJob(job, pipeline, fromIndex, runId) {
		try {
			for await (const event of this.pipelineRunner.run(pipeline, fromIndex, job.jobId, job.controller?.signal, runId)) this.emit(job, {
				type: "event",
				jobId: job.jobId,
				event
			});
			this.finishJob(job);
		} catch (error) {
			this.failJob(job, error);
		}
	}
	async runQuickJob(job, step, runId) {
		const startedAt = Date.now();
		const results = [];
		let persistedStepRunId;
		let logSeq = 0;
		this.emit(job, {
			type: "event",
			jobId: job.jobId,
			event: {
				type: "run:start",
				startedAt,
				runId
			}
		});
		try {
			for await (const event of this.buildRunner.run(step, 0, 1, void 0, job.controller?.signal)) {
				if (event.type === "step:start") {
					const gitInfo = this.gitInfoReader.getInfo(event.step.path);
					persistedStepRunId = this.db.createStepRun({
						runId,
						jobId: job.jobId,
						projectPath: event.step.path,
						projectName: event.step.label,
						buildSystem: event.step.buildSystem,
						packageManager: event.step.buildSystem === "node" ? event.step.packageManager : void 0,
						executionMode: event.step.executionMode,
						command: toCommandString(event.step),
						javaHome: event.step.buildSystem === "maven" ? event.step.javaHome : void 0,
						stepIndex: 0,
						stepLabel: event.step.label,
						branch: gitInfo.branch ?? void 0
					});
					this.emit(job, {
						type: "event",
						jobId: job.jobId,
						event: {
							...event,
							runId: persistedStepRunId
						}
					});
					continue;
				}
				if (event.type === "step:output" && persistedStepRunId !== void 0) this.db.appendStepLog(persistedStepRunId, logSeq++, event.stream, event.line);
				if (event.type === "step:done") {
					results.push({
						step: event.step,
						exitCode: event.exitCode,
						durationMs: event.durationMs,
						status: event.status,
						success: event.success
					});
					if (persistedStepRunId !== void 0) this.db.finishStepRun({
						id: persistedStepRunId,
						exitCode: event.exitCode,
						durationMs: event.durationMs,
						status: event.status
					});
				}
				this.emit(job, {
					type: "event",
					jobId: job.jobId,
					event
				});
			}
			const status = deriveRunStatus(results);
			const result = {
				results,
				status,
				success: status !== "failed",
				durationMs: Date.now() - startedAt
			};
			this.db.finishRun({
				id: runId,
				status,
				durationMs: result.durationMs
			});
			this.emit(job, {
				type: "event",
				jobId: job.jobId,
				event: {
					type: "run:done",
					result
				}
			});
			this.finishJob(job);
		} catch (error) {
			const durationMs = Date.now() - startedAt;
			this.db.finishRun({
				id: runId,
				status: "failed",
				durationMs
			});
			if (persistedStepRunId !== void 0) this.db.finishStepRun({
				id: persistedStepRunId,
				exitCode: 1,
				durationMs,
				status: "failed"
			});
			this.failJob(job, error);
		}
	}
	async runScanJob(job) {
		try {
			const config = this.getSettings();
			for await (const event of this.scanner.scan(toScanOptions(config), DEFAULT_SCAN_JOB_TTL_MS, true)) this.emit(job, {
				type: "event",
				jobId: job.jobId,
				event
			});
			this.finishJob(job);
		} catch (error) {
			this.failJob(job, error);
		}
	}
	emit(job, envelope) {
		if (job.history.length >= MAX_JOB_HISTORY) job.history.shift();
		job.history.push(envelope);
		for (const listener of job.listeners) listener(envelope);
	}
	finishJob(job) {
		if (job.done) return;
		job.done = true;
		this.emit(job, {
			type: "done",
			jobId: job.jobId
		});
	}
	failJob(job, error) {
		if (job.done) return;
		job.done = true;
		this.emit(job, {
			type: "error",
			jobId: job.jobId,
			message: error instanceof Error ? error.message : String(error)
		});
	}
	getSettings() {
		return loadSettings(this.getSettingsPath()).config;
	}
	getSettingsPath() {
		return this.options.settingsPath ?? getConfigPath(this.stateRootDir);
	}
	resolveQuickRunStep(input, config) {
		if (input["buildSystem"] === "node") return resolveStep(buildStepConfigSchema.parse({
			path: input["path"],
			label: input["label"],
			buildSystem: "node",
			commandType: input["commandType"] ?? "script",
			script: input["script"],
			args: input["args"] ?? [],
			executionMode: input["executionMode"] ?? "internal"
		}), config);
		return resolveStep(buildStepConfigSchema.parse({
			path: input["path"],
			label: input["label"],
			buildSystem: "maven",
			modulePath: input["modulePath"],
			submoduleBuildStrategy: input["submoduleBuildStrategy"],
			goals: input["goals"],
			optionKeys: input["optionKeys"],
			profileStates: input["profileStates"],
			extraOptions: input["extraOptions"],
			javaVersion: input["javaVersion"] ?? input["java"],
			executionMode: input["executionMode"] ?? "internal"
		}), config);
	}
};
function resolveFromArg(pipeline, fromArg) {
	const numeric = Number.parseInt(fromArg, 10);
	if (!Number.isNaN(numeric)) {
		if (numeric < 1 || numeric > pipeline.steps.length) throw new Error(`Step ${numeric} is out of range for pipeline "${pipeline.name}".`);
		return numeric - 1;
	}
	const index = pipeline.steps.findIndex((step) => step.label.toLowerCase() === fromArg.toLowerCase());
	if (index === -1) throw new Error(`Step "${fromArg}" was not found in pipeline "${pipeline.name}".`);
	return index;
}
function toPipelineStep(step) {
	if (step.buildSystem === "node") return {
		label: step.label,
		path: step.path,
		buildSystem: step.buildSystem,
		packageManager: step.packageManager,
		executionMode: step.executionMode,
		commandType: step.commandType,
		script: step.script,
		args: step.args
	};
	return {
		label: step.label,
		path: step.path,
		buildSystem: step.buildSystem,
		executionMode: step.executionMode,
		modulePath: step.modulePath,
		submoduleBuildStrategy: step.submoduleBuildStrategy,
		goals: step.goals,
		optionKeys: step.optionKeys,
		profileStates: step.profileStates,
		extraOptions: step.extraOptions,
		mavenExecutable: step.mavenExecutable,
		javaVersion: step.javaVersion,
		javaHome: step.javaHome
	};
}
function toCommandString(step) {
	return buildCommandString(step);
}
function deriveRunStatus(results) {
	if (results.some((result) => result.status === "failed")) return "failed";
	if (results.some((result) => result.status === "launched")) return "launched";
	return "success";
}
function toScanOptions(config) {
	return {
		roots: config.roots,
		includeHidden: config.scan.includeHidden,
		exclude: config.scan.exclude
	};
}
//#endregion
//#region src/main/index.ts
var APP_NAME = "GFOS Build";
var APP_USER_MODEL_ID = "com.gfos.gfos-build";
var SMOKE_TEST_EXIT_DELAY_MS = 250;
var isSmokeTest = process.argv.includes("--smoke-test") || process.env["GFOS_BUILD_SMOKE_TEST"] === "1";
var stateRootDir = getDefaultStateRootDir();
var mainWindow = null;
var runtime = null;
var fatalExitStarted = false;
var runSubscriptions = /* @__PURE__ */ new Map();
electron.app.setName(APP_NAME);
electron.app.setPath("userData", stateRootDir);
electron.app.setPath("sessionData", getSessionDataDir(stateRootDir));
if (isSmokeTest) electron.app.disableHardwareAcceleration();
if (process.platform === "win32") electron.app.setAppUserModelId(APP_USER_MODEL_ID);
function formatFatalError(error) {
	if (error instanceof Error) return error.stack ?? error.message;
	return String(error);
}
function fatalExit(title, error) {
	const message = formatFatalError(error);
	console.error(`${title}:`, error);
	if (fatalExitStarted) process.exit(1);
	fatalExitStarted = true;
	try {
		runtime?.close();
		runtime = null;
	} catch (closeError) {
		console.error("Failed to close runtime during fatal exit:", closeError);
	}
	if (electron.app.isReady()) {
		if (!isSmokeTest) electron.dialog.showErrorBox(title, message);
		electron.app.exit(1);
	}
	process.exit(1);
}
async function handleInvalidLocalState(error) {
	const message = "Local app state is invalid or incompatible with this version.";
	if (isSmokeTest) throw error;
	const choice = electron.dialog.showMessageBoxSync({
		type: "error",
		title: APP_NAME,
		message,
		detail: error.message,
		buttons: ["Reset local data", "Exit"],
		defaultId: 0,
		cancelId: 1,
		noLink: true
	});
	if (choice === 0) {
		resetLocalState(stateRootDir);
		electron.app.relaunch();
	}
	electron.app.exit(choice === 0 ? 0 : 1);
}
async function runSmokeTest(win) {
	await new Promise((resolve) => setTimeout(resolve, SMOKE_TEST_EXIT_DELAY_MS));
	const result = await win.webContents.executeJavaScript(`(() => ({
      title: document.title,
      hash: window.location.hash,
      rootChildren: document.getElementById('root')?.childElementCount ?? 0,
      bodyText: document.body.innerText.slice(0, 200)
    }))()`, true);
	if (result.title !== APP_NAME) throw new Error(`Smoke test failed: expected title "${APP_NAME}" but received "${result.title}".`);
	if (result.hash !== "#/") throw new Error(`Smoke test failed: expected hash "#/" but received "${result.hash}".`);
	if (result.rootChildren === 0) throw new Error("Smoke test failed: renderer root is empty.");
	if (/not found/i.test(result.bodyText)) throw new Error(`Smoke test failed: renderer body contains "Not Found": ${result.bodyText}`);
	electron.app.exit(0);
}
function createWindow() {
	const win = new electron.BrowserWindow({
		title: APP_NAME,
		width: 1280,
		height: 820,
		minWidth: 900,
		minHeight: 600,
		show: false,
		backgroundColor: "#1d2f32",
		icon: electron.app.isPackaged ? node_path.default.join(process.resourcesPath, "assets", "icon.ico") : node_path.default.resolve(__dirname, "../../../../assets/icon.ico"),
		webPreferences: {
			preload: node_path.default.join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true
		}
	});
	const senderId = win.webContents.id;
	mainWindow = win;
	win.once("ready-to-show", () => {
		if (!isSmokeTest && !win.isDestroyed()) win.show();
	});
	win.on("closed", () => {
		if (mainWindow === win) mainWindow = null;
		clearSubscriptionsForSender(senderId);
	});
	win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
		if (isMainFrame) fatalExit("Failed to load desktop UI", /* @__PURE__ */ new Error(`${errorDescription} (${errorCode}) while loading ${validatedURL}`));
	});
	win.webContents.once("did-finish-load", () => {
		if (isSmokeTest) runSmokeTest(win).catch((error) => {
			fatalExit("Desktop smoke test failed", error);
		});
	});
	if (process.env["ELECTRON_RENDERER_URL"]) {
		const rendererUrl = new URL("/#/", process.env["ELECTRON_RENDERER_URL"]).toString();
		win.loadURL(rendererUrl);
	} else win.loadFile(node_path.default.join(__dirname, "../renderer/index.html"), { hash: "/" });
	return win;
}
function getRuntime() {
	if (!runtime) throw new Error("Application runtime is not available.");
	return runtime;
}
function registerIpcHandlers() {
	electron.ipcMain.handle(IPC.GET_HEALTH, () => getRuntime().getHealth());
	electron.ipcMain.handle(IPC.GET_CONFIG, () => getRuntime().getConfig());
	electron.ipcMain.handle(IPC.SAVE_CONFIG, (_event, patch) => getRuntime().saveConfig(patch));
	electron.ipcMain.handle(IPC.LIST_PIPELINES, () => getRuntime().listPipelines());
	electron.ipcMain.handle(IPC.CREATE_PIPELINE, (_event, input) => getRuntime().createPipeline(input));
	electron.ipcMain.handle(IPC.UPDATE_PIPELINE, (_event, input) => getRuntime().updatePipeline(input));
	electron.ipcMain.handle(IPC.DELETE_PIPELINE, (_event, name) => getRuntime().deletePipeline(name));
	electron.ipcMain.handle(IPC.RUN_PIPELINE, (_event, input) => getRuntime().runPipeline(input));
	electron.ipcMain.handle(IPC.RUN_QUICK, (_event, input) => getRuntime().runQuick(input));
	electron.ipcMain.handle(IPC.CANCEL_JOB, (_event, jobId) => getRuntime().cancelJob(jobId));
	electron.ipcMain.handle(IPC.LIST_RUNS, (_event, opts) => getRuntime().listRuns(opts));
	electron.ipcMain.handle(IPC.GET_RUN_LOGS, (_event, runId, opts) => getRuntime().getRunLogs(runId, opts));
	electron.ipcMain.handle(IPC.GET_STATS, () => getRuntime().getStats());
	electron.ipcMain.handle(IPC.GET_SCAN, () => getRuntime().getScan());
	electron.ipcMain.handle(IPC.REFRESH_SCAN, () => getRuntime().refreshScan());
	electron.ipcMain.handle(IPC.INSPECT_PROJECT, (_event, projectPath) => getRuntime().inspectProject(projectPath));
	electron.ipcMain.handle(IPC.DETECT_JDKS, (_event, baseDir) => getRuntime().detectJdks(baseDir));
	electron.ipcMain.handle(IPC.CLEAR_RUN_LOGS, () => getRuntime().clearRunLogs());
	electron.ipcMain.handle(IPC.CLEAR_RUNS, () => getRuntime().clearRuns());
	electron.ipcMain.handle(IPC.GET_GIT_INFO, (_event, projectPath) => getRuntime().getGitInfo(projectPath));
	electron.ipcMain.handle(IPC.GET_GIT_INFO_BATCH, (_event, paths) => getRuntime().getGitInfoBatch(paths));
	electron.ipcMain.handle(IPC.OPEN_DIRECTORY, async () => {
		const ownerWindow = electron.BrowserWindow.getFocusedWindow() ?? mainWindow ?? void 0;
		const options = {
			properties: ["openDirectory"],
			title: "Select workspace root"
		};
		const result = ownerWindow ? await electron.dialog.showOpenDialog(ownerWindow, options) : await electron.dialog.showOpenDialog(options);
		return result.canceled ? null : result.filePaths[0] ?? null;
	});
	electron.ipcMain.on(IPC.RUN_SUBSCRIBE, (event, jobId) => {
		clearSubscription(event.sender.id, jobId);
		const unsubscribe = getRuntime().subscribeRun(jobId, (payload) => {
			if (!event.sender.isDestroyed()) event.sender.send(IPC.RUN_EVENT, payload);
		});
		runSubscriptions.set(makeSubscriptionKey(event.sender.id, jobId), unsubscribe);
	});
	electron.ipcMain.on(IPC.RUN_UNSUBSCRIBE, (event, jobId) => {
		clearSubscription(event.sender.id, jobId);
	});
}
function makeSubscriptionKey(senderId, jobId) {
	return `${senderId}:${jobId}`;
}
function clearSubscription(senderId, jobId) {
	const key = makeSubscriptionKey(senderId, jobId);
	const unsubscribe = runSubscriptions.get(key);
	if (unsubscribe) {
		unsubscribe();
		runSubscriptions.delete(key);
	}
}
function clearSubscriptionsForSender(senderId) {
	for (const key of [...runSubscriptions.keys()]) if (key.startsWith(`${senderId}:`)) {
		runSubscriptions.get(key)?.();
		runSubscriptions.delete(key);
	}
}
process.on("uncaughtException", (error) => {
	fatalExit("A JavaScript error occurred in the main process", error);
});
process.on("unhandledRejection", (reason) => {
	fatalExit("An unhandled promise rejection occurred in the main process", reason);
});
electron.app.whenReady().then(async () => {
	try {
		runtime = new AppRuntime({
			version: electron.app.getVersion(),
			stateRootDir
		});
	} catch (error) {
		if (error instanceof StateCompatibilityError) {
			await handleInvalidLocalState(error);
			return;
		}
		fatalExit("Failed to start desktop app", error);
	}
	registerIpcHandlers();
	createWindow();
	getRuntime().watchGitHeads(() => {
		if (mainWindow && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send(IPC.GIT_HEAD_CHANGED);
	});
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
	});
}).catch((error) => {
	fatalExit("Failed to start desktop app", error);
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("quit", () => {
	runtime?.close();
	runtime = null;
});
//#endregion
