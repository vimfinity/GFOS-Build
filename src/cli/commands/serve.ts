import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import type { AppConfig } from '../../config/schema.js';
import { configSchema, pipelineConfigSchema } from '../../config/schema.js';
import type { IDatabase } from '../../infrastructure/database.js';
import type { CachedScanner } from '../../application/scanner.js';
import type { BuildRunner } from '../../application/build-runner.js';
import type { PipelineRunner } from '../../application/pipeline-runner.js';
import type { FileSystem } from '../../infrastructure/file-system.js';
import { resolvePipeline, resolveStepPath } from '../../config/resolver.js';
import { resolveJavaHome } from '../../core/jdk-resolver.js';
import type { BuildStep } from '../../core/types.js';

const VERSION = '2.0.0';

interface ActiveJob {
  controller: AbortController;
  startedAt: number;
}

export interface ServeOptions {
  port: number;
  config: AppConfig;
  configPath: string;
  db: IDatabase;
  scanner: CachedScanner;
  buildRunner: BuildRunner;
  pipelineRunner: PipelineRunner;
  fs: FileSystem;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function notFound(): Response {
  return json({ error: 'Not found' }, 404);
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

export async function runServe(options: ServeOptions): Promise<{ port: number; close: () => void }> {
  const { db, scanner, buildRunner, pipelineRunner } = options;
  let currentConfig = options.config;
  const activeJobs = new Map<string, ActiveJob>();
  const startTime = Date.now();

  /** Write current config to disk and return the updated config object. */
  function persistConfig(patch: Partial<AppConfig>): AppConfig {
    const raw = JSON.parse(readFileSync(options.configPath, 'utf-8'));
    const merged = { ...raw, ...patch };
    writeFileSync(options.configPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    currentConfig = configSchema.parse(merged);
    return currentConfig;
  }

  // Manual pub/sub replacing Bun's built-in server.publish / ws.subscribe
  const subscriptions = new Map<string, Set<WebSocket>>();

  function broadcast(channel: string, msg: string): void {
    const subs = subscriptions.get(channel);
    if (!subs) return;
    for (const ws of subs) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }

  function startJob(runner: () => AsyncGenerator<unknown>): string {
    const jobId = randomUUID();
    const controller = new AbortController();
    const startedAt = Date.now();
    activeJobs.set(jobId, { controller, startedAt });

    void (async () => {
      try {
        broadcast(jobId, JSON.stringify({ type: 'event', jobId, event: { type: 'run:start', startedAt } }));
        for await (const event of runner()) {
          broadcast(jobId, JSON.stringify({ type: 'event', jobId, event }));
        }
        broadcast(jobId, JSON.stringify({ type: 'done', jobId }));
      } catch (err) {
        broadcast(jobId, JSON.stringify({ type: 'error', jobId, message: String(err) }));
      } finally {
        activeJobs.delete(jobId);
      }
    })();

    return jobId;
  }

  async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

    // GET /api/health
    if (req.method === 'GET' && pathname === '/api/health') {
      return json({ version: VERSION, uptime: Math.floor((Date.now() - startTime) / 1000), platform: process.platform });
    }

    // GET /api/config
    if (req.method === 'GET' && pathname === '/api/config') {
      return json({ config: currentConfig, configPath: options.configPath });
    }

    // GET /api/pipelines
    if (req.method === 'GET' && pathname === '/api/pipelines') {
      const lastRuns = db.getLastRunsByPipeline();
      // Use raw config for list view — avoids resolvePipeline() which throws when
      // a step path references an unknown root.  Path resolution only needs to
      // happen at run time, not for display.
      const pipelines = Object.entries(currentConfig.pipelines).map(([name, pc]) => ({
        name,
        description: pc.description,
        failFast: pc.failFast,
        steps: pc.steps.map((s) => ({
          label: s.label ?? path.basename(s.path.replace(/^[^:]+:/, '')),
          path: s.path,
          goals: s.goals ?? currentConfig.maven.defaultGoals,
          flags: s.flags ?? currentConfig.maven.defaultFlags,
          mavenExecutable: s.maven ?? currentConfig.maven.executable,
          javaVersion: s.javaVersion,
          javaHome: undefined,
        })),
        lastRun: lastRuns[name] ?? null,
      }));
      return json(pipelines);
    }

    // GET /api/scan
    if (req.method === 'GET' && pathname === '/api/scan') {
      const noCache = url.searchParams.get('noCache') === 'true';
      const scanOptions = {
        roots: currentConfig.roots,
        maxDepth: currentConfig.scan.maxDepth,
        includeHidden: currentConfig.scan.includeHidden,
        exclude: currentConfig.scan.exclude,
      };
      const projects: unknown[] = [];
      for await (const event of scanner.scan(scanOptions, undefined, noCache)) {
        if (event.type === 'scan:done') {
          return json({ projects: event.projects, durationMs: event.durationMs, fromCache: event.fromCache });
        }
      }
      return json({ projects, durationMs: 0, fromCache: false });
    }

    // POST /api/scan/refresh
    if (req.method === 'POST' && pathname === '/api/scan/refresh') {
      const scanOptions = {
        roots: currentConfig.roots,
        maxDepth: currentConfig.scan.maxDepth,
        includeHidden: currentConfig.scan.includeHidden,
        exclude: currentConfig.scan.exclude,
      };
      const jobId = startJob(async function* () {
        for await (const event of scanner.scan(scanOptions, undefined, true)) {
          yield event;
        }
      });
      return json({ jobId });
    }

    // GET /api/builds
    if (req.method === 'GET' && pathname === '/api/builds') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 500);
      const pipeline = url.searchParams.get('pipeline') ?? undefined;
      const project = url.searchParams.get('project') ?? undefined;
      const rows = db.getRecentBuilds({ limit, pipeline, project });
      return json(rows);
    }

    // GET /api/builds/stats
    if (req.method === 'GET' && pathname === '/api/builds/stats') {
      return json(db.getBuildStats());
    }

    // GET /api/builds/:runId/logs
    const logsMatch = pathname.match(/^\/api\/builds\/(\d+)\/logs$/);
    if (req.method === 'GET' && logsMatch) {
      const runId = parseInt(logsMatch[1]!, 10);
      const logs = db.getBuildLogs(runId);
      return json(logs);
    }

    // POST /api/pipeline/:name/run
    const pipelineRunMatch = pathname.match(/^\/api\/pipeline\/([^/]+)\/run$/);
    if (req.method === 'POST' && pipelineRunMatch) {
      const pipelineName = decodeURIComponent(pipelineRunMatch[1]!);
      const pipelineConfig = currentConfig.pipelines[pipelineName];
      if (!pipelineConfig) return json({ error: `Pipeline "${pipelineName}" not found` }, 404);

      let body: { from?: string; dryRun?: boolean } = {};
      try { body = (await req.json()) as typeof body; } catch { /* no body */ }

      const pipeline = resolvePipeline(pipelineName, pipelineConfig, currentConfig);
      let fromIndex = 0;
      if (body.from) {
        const n = parseInt(body.from, 10);
        fromIndex = isNaN(n) ? 0 : Math.max(0, n - 1);
      }

      const jobId = startJob(async function* () {
        for await (const event of pipelineRunner.run(pipeline, fromIndex)) {
          yield event;
        }
      });
      return json({ jobId });
    }

    // POST /api/build
    if (req.method === 'POST' && pathname === '/api/build') {
      let body: { path?: string; goals?: string[]; flags?: string[]; java?: string; maven?: string } = {};
      try { body = (await req.json()) as typeof body; } catch { /* no body */ }
      if (!body.path) return badRequest('path is required');

      const resolvedPath = resolveStepPath(body.path, currentConfig.roots);
      const goals = body.goals ?? currentConfig.maven.defaultGoals;
      const flags = body.flags ?? currentConfig.maven.defaultFlags;
      const mavenExecutable = body.maven ?? currentConfig.maven.executable;
      const javaHome = resolveJavaHome(currentConfig, body.java);

      const step: BuildStep = {
        path: resolvedPath,
        goals,
        flags,
        buildSystem: 'maven',
        label: path.basename(resolvedPath),
        mavenExecutable,
        javaVersion: body.java,
        javaHome,
      };

      const jobId = startJob(async function* () {
        let runId: number | undefined;
        try {
          const command = [mavenExecutable, ...goals, ...flags].join(' ');
          runId = db.startBuildRun({
            projectPath: resolvedPath,
            projectName: step.label,
            buildSystem: 'maven',
            command,
            javaHome: step.javaHome,
          });
        } catch { /* non-fatal DB error */ }

        let logSeq = 0;
        for await (const event of buildRunner.run(step, 0, 1)) {
          if (event.type === 'step:start' && runId !== undefined) {
            yield { ...event, runId };
          } else {
            yield event;
          }
          if (event.type === 'step:output' && runId !== undefined) {
            try { db.appendBuildLog(runId, logSeq++, event.stream, event.line); } catch { /* non-fatal */ }
          }
          if (event.type === 'step:done' && runId !== undefined) {
            try {
              db.finishBuildRun({ id: runId, exitCode: event.exitCode, durationMs: event.durationMs, status: event.success ? 'success' : 'failed' });
            } catch { /* non-fatal */ }
          }
        }
      });
      return json({ jobId });
    }

    // DELETE /api/builds/logs — clear stored log lines, keep build metadata for stats
    if (req.method === 'DELETE' && pathname === '/api/builds/logs') {
      db.clearBuildLogs();
      return json({ ok: true });
    }

    // DELETE /api/builds — clear all build history and logs
    if (req.method === 'DELETE' && pathname === '/api/builds') {
      db.clearAllBuilds();
      return json({ ok: true });
    }

    // DELETE /api/jobs/:id
    const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (req.method === 'DELETE' && jobMatch) {
      const jobId = jobMatch[1]!;
      const job = activeJobs.get(jobId);
      if (!job) return json({ error: 'Job not found' }, 404);
      job.controller.abort();
      activeJobs.delete(jobId);
      return json({ cancelled: true });
    }

    // GET /api/jobs (list active)
    if (req.method === 'GET' && pathname === '/api/jobs') {
      return json({ jobs: [...activeJobs.keys()] });
    }

    // ── Pipeline CRUD ──────────────────────────────────────────────

    // POST /api/pipelines — create a new pipeline
    if (req.method === 'POST' && pathname === '/api/pipelines') {
      const body = (await req.json()) as { name?: string; pipeline?: unknown };
      if (!body.name) return badRequest('name is required');
      if (currentConfig.pipelines[body.name]) return json({ error: 'Pipeline already exists' }, 409);
      const parsed = pipelineConfigSchema.safeParse(body.pipeline);
      if (!parsed.success) return badRequest(parsed.error.errors.map((e) => e.message).join(', '));
      const newPipelines = { ...currentConfig.pipelines, [body.name]: parsed.data };
      persistConfig({ pipelines: newPipelines });
      return json({ ok: true, name: body.name }, 201);
    }

    // PUT /api/pipelines/:name — update an existing pipeline
    const pipelineUpdateMatch = pathname.match(/^\/api\/pipelines\/([^/]+)$/);
    if (req.method === 'PUT' && pipelineUpdateMatch) {
      const name = decodeURIComponent(pipelineUpdateMatch[1]!);
      if (!currentConfig.pipelines[name]) return json({ error: `Pipeline "${name}" not found` }, 404);
      const body = (await req.json()) as { pipeline?: unknown };
      const parsed = pipelineConfigSchema.safeParse(body.pipeline);
      if (!parsed.success) return badRequest(parsed.error.errors.map((e) => e.message).join(', '));
      const newPipelines = { ...currentConfig.pipelines, [name]: parsed.data };
      persistConfig({ pipelines: newPipelines });
      return json({ ok: true, name });
    }

    // DELETE /api/pipelines/:name — delete a pipeline
    const pipelineDeleteMatch = pathname.match(/^\/api\/pipelines\/([^/]+)$/);
    if (req.method === 'DELETE' && pipelineDeleteMatch) {
      const name = decodeURIComponent(pipelineDeleteMatch[1]!);
      if (!currentConfig.pipelines[name]) return json({ error: `Pipeline "${name}" not found` }, 404);
      const newPipelines = { ...currentConfig.pipelines };
      delete newPipelines[name];
      persistConfig({ pipelines: newPipelines });
      return json({ ok: true });
    }

    // POST /api/config — save partial config (e.g. roots from onboarding)
    if (req.method === 'POST' && pathname === '/api/config') {
      const body = (await req.json()) as Partial<AppConfig>;
      persistConfig(body);
      return json({ ok: true });
    }

    return notFound();
  }

  // Node.js HTTP server bridging web-standard Request/Response
  const httpServer = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[key] = value;
    }

    const webReq = new Request(`http://127.0.0.1${req.url ?? '/'}`, {
      method: req.method,
      headers,
      body: body.length > 0 ? body : undefined,
    });

    let webRes: Response;
    try {
      webRes = await handleRequest(webReq);
    } catch (err) {
      webRes = json({ error: String(err) }, 500);
    }

    res.writeHead(webRes.status, Object.fromEntries(webRes.headers));
    const arrayBuf = await webRes.arrayBuffer();
    res.end(Buffer.from(arrayBuf));
  });

  // WebSocket server (upgrade handled separately)
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url!, 'http://127.0.0.1');
    if (url.pathname === '/api/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    const joined = new Set<string>();

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type: string; jobId?: string };
        if (msg.type === 'subscribe' && msg.jobId) {
          if (!subscriptions.has(msg.jobId)) subscriptions.set(msg.jobId, new Set());
          subscriptions.get(msg.jobId)!.add(ws);
          joined.add(msg.jobId);
          // Replay run:start so late-joining clients get the correct server timestamp
          const activeJob = activeJobs.get(msg.jobId);
          if (activeJob && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'event', jobId: msg.jobId, event: { type: 'run:start', startedAt: activeJob.startedAt } }));
          }
        } else if (msg.type === 'unsubscribe' && msg.jobId) {
          subscriptions.get(msg.jobId)?.delete(ws);
          joined.delete(msg.jobId);
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      for (const ch of joined) {
        const set = subscriptions.get(ch);
        if (set) {
          set.delete(ws);
          if (set.size === 0) subscriptions.delete(ch);
        }
      }
    });
  });

  // Start listening
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(options.port, '127.0.0.1', () => resolve());
    httpServer.on('error', reject);
  });

  const addr = httpServer.address() as AddressInfo;
  return {
    port: addr.port,
    close: () => { httpServer.close(); wss.close(); },
  };
}
