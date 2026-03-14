import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
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
import { detectJdks, requireRegisteredJavaHome, resolveJavaHome } from '../../core/jdk-resolver.js';
import type { BuildStep } from '../../core/types.js';
import { inspectMavenProject } from '../../core/maven-project.js';
import { inspectNodeProject } from '../../core/node-project.js';
import { buildCommandString } from '../../core/build-command.js';

const VERSION = '2.0.0';

interface ActiveJob {
  controller: AbortController;
  startedAt: number;
}

interface JobHistory {
  frames: string[];
  terminalFrame: string | null;
}

export interface ServeOptions {
  port: number;
  config: AppConfig;
  configPath: string;
  configError?: string;
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
  let currentConfigError = options.configError;
  const activeJobs = new Map<string, ActiveJob>();
  const jobHistory = new Map<string, JobHistory>();
  const startTime = Date.now();
  const MAX_JOB_HISTORY = 30;

  db.reconcileRunningBuilds([]);

  /** Write current config to disk and return the updated config object. */
  function persistConfig(patch: Partial<AppConfig>): AppConfig {
    const merged = { ...currentConfig, ...patch };
    writeFileSync(options.configPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    currentConfig = configSchema.parse(merged);
    currentConfigError = undefined;
    return currentConfig;
  }

  function requireValidConfig(pathname: string): Response | null {
    if (!currentConfigError) return null;
    if (
      pathname === '/api/health' ||
      pathname === '/api/config' ||
      pathname === '/api/jdks/detect' ||
      pathname === '/api/pipelines' ||
      pathname === '/api/scan' ||
      pathname === '/api/scan/refresh' ||
      pathname === '/api/builds' ||
      pathname === '/api/builds/stats' ||
      /^\/api\/builds\/\d+\/logs$/.test(pathname)
    ) {
      return null;
    }
    return json({ error: currentConfigError }, 409);
  }

  async function inspectProject(rawPath: string) {
    const resolvedPath = resolveStepPath(rawPath, currentConfig.roots);
    const maven = await inspectMavenProject(options.fs, resolvedPath);
    if (maven) {
      return {
        project: {
          name: path.basename(resolvedPath),
          path: resolvedPath,
          depth: 0,
          rootName: '',
          buildSystem: 'maven' as const,
          maven,
        },
      };
    }

    const node = await inspectNodeProject(options.fs, resolvedPath);
    if (!node) {
      return { project: null };
    }

    return {
      project: {
        name: path.basename(resolvedPath),
        path: resolvedPath,
        depth: 0,
        rootName: '',
        buildSystem: 'node' as const,
        node,
      },
    };
  }

  // Manual pub/sub replacing Bun's built-in server.publish / ws.subscribe
  const subscriptions = new Map<string, Set<WebSocket>>();

  function broadcast(channel: string, msg: string): void {
    const history = jobHistory.get(channel);
    if (history) {
      const parsed = JSON.parse(msg) as { type: string };
      if (parsed.type === 'done' || parsed.type === 'error') history.terminalFrame = msg;
      else history.frames.push(msg);
    }
    const subs = subscriptions.get(channel);
    if (!subs) return;
    for (const ws of subs) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }

  function startJob(runner: (jobId: string) => AsyncGenerator<unknown>): string {
    const jobId = randomUUID();
    const controller = new AbortController();
    const startedAt = Date.now();
    activeJobs.set(jobId, { controller, startedAt });
    jobHistory.set(jobId, {
      frames: [JSON.stringify({ type: 'event', jobId, event: { type: 'run:start', startedAt } })],
      terminalFrame: null,
    });
    if (jobHistory.size > MAX_JOB_HISTORY) {
      const oldest = jobHistory.keys().next().value;
      if (oldest) jobHistory.delete(oldest);
    }

    void (async () => {
      try {
        broadcast(jobId, JSON.stringify({ type: 'event', jobId, event: { type: 'run:start', startedAt } }));
        for await (const event of runner(jobId)) {
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
    const configBlock = requireValidConfig(pathname);
    if (configBlock) return configBlock;

    // GET /api/health
    if (req.method === 'GET' && pathname === '/api/health') {
      return json({ version: VERSION, uptime: Math.floor((Date.now() - startTime) / 1000), platform: process.platform });
    }

    // GET /api/config
    if (req.method === 'GET' && pathname === '/api/config') {
      return json({ config: currentConfig, configPath: options.configPath, error: currentConfigError });
    }

    // GET /api/pipelines
    if (req.method === 'GET' && pathname === '/api/pipelines') {
      const lastRuns = db.getLastRunsByPipeline();
      // Use raw config for list view — avoids resolvePipeline() which throws when
      // a step path references an unknown root.  Path resolution only needs to
      // happen at run time, not for display.
      const pipelines = await Promise.all(
        Object.entries(currentConfig.pipelines).map(async ([name, pc]) => ({
          name,
          description: pc.description,
          failFast: pc.failFast,
          steps: await Promise.all(
            pc.steps.map(async (s) => {
              if (s.buildSystem === 'node') {
                let inspection: Awaited<ReturnType<typeof inspectProject>> = { project: null };
                try {
                  inspection = await inspectProject(s.path);
                } catch {
                  // Keep pipeline list available even when a stored path no longer resolves.
                }
                return {
                  label: s.label ?? path.basename(s.path.replace(/^[^:]+:/, '')),
                  path: s.path,
                  buildSystem: 'node' as const,
                  packageManager: inspection.project?.buildSystem === 'node' ? inspection.project.node?.packageManager : undefined,
                  executionMode: s.executionMode,
                  commandType: s.commandType,
                  script: s.script,
                  args: s.args,
                };
              }

              return {
                label: s.label ?? path.basename(s.path.replace(/^[^:]+:/, '')),
                path: s.path,
                buildSystem: 'maven' as const,
                goals: s.goals ?? currentConfig.maven.defaultGoals,
                modulePath: s.modulePath,
                optionKeys: s.optionKeys ?? currentConfig.maven.defaultOptionKeys,
                profileStates: s.profileStates ?? {},
                extraOptions: s.extraOptions ?? currentConfig.maven.defaultExtraOptions,
                executionMode: s.executionMode ?? 'internal',
                mavenExecutable: s.maven ?? currentConfig.maven.executable,
                javaVersion: s.javaVersion,
                javaHome: undefined,
              };
            }),
          ),
          lastRun: lastRuns[name] ?? null,
        })),
      );
      return json(pipelines);
    }

    // POST /api/project/inspect
    if (req.method === 'POST' && pathname === '/api/project/inspect') {
      const body = (await req.json()) as { path?: string };
      if (!body.path) return badRequest('path is required');
      try {
        return json(await inspectProject(body.path));
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    // POST /api/jdks/detect
    if (req.method === 'POST' && pathname === '/api/jdks/detect') {
      const body = (await req.json()) as { path?: string };
      if (!body.path) return badRequest('path is required');
      try {
        return json({ baseDir: body.path, jdks: await detectJdks(body.path, options.fs) });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    // GET /api/scan
    if (req.method === 'GET' && pathname === '/api/scan') {
      const noCache = url.searchParams.get('noCache') === 'true';
      const scanOptions = {
        roots: currentConfig.roots,
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
      db.reconcileRunningBuilds([...activeJobs.keys()]);
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

      let pipeline;
      try {
        pipeline = resolvePipeline(pipelineName, pipelineConfig, currentConfig);
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
      let fromIndex = 0;
      if (body.from) {
        const n = parseInt(body.from, 10);
        fromIndex = isNaN(n) ? 0 : Math.max(0, n - 1);
      }

      const jobId = startJob(async function* (jobId) {
        const activeJob = activeJobs.get(jobId);
        for await (const event of pipelineRunner.run(pipeline, fromIndex, jobId, activeJob?.controller.signal)) {
          yield event;
        }
      });
      return json({ jobId });
    }

    // POST /api/build
    if (req.method === 'POST' && pathname === '/api/build') {
      let body: {
        path?: string;
        buildSystem?: 'maven' | 'node';
        modulePath?: string;
        goals?: string[];
        optionKeys?: Array<'skipTests' | 'skipTestCompile' | 'updateSnapshots' | 'offline' | 'quiet' | 'debug' | 'errors' | 'failAtEnd' | 'failNever'>;
        profileStates?: Record<string, 'default' | 'enabled' | 'disabled'>;
        extraOptions?: string[];
        java?: string;
        maven?: string;
        commandType?: 'script' | 'install';
        script?: string;
        args?: string[];
        executionMode?: 'internal' | 'external';
      } = {};
      try { body = (await req.json()) as typeof body; } catch { /* no body */ }
      if (!body.path) return badRequest('path is required');

      const resolvedPath = resolveStepPath(body.path, currentConfig.roots);
      const buildSystem = body.buildSystem ?? 'maven';
      const inspection = await inspectProject(body.path);
      if (!inspection.project) return badRequest(`No build manifest found at "${resolvedPath}".`);
      if (inspection.project.buildSystem !== buildSystem) {
        return badRequest(`Project at "${resolvedPath}" is ${inspection.project.buildSystem}, not ${buildSystem}.`);
      }
      if (buildSystem === 'node') {
        const commandType = body.commandType ?? 'script';
        const script = body.script;
        if (commandType === 'script') {
          if (!script) return badRequest('script is required for node script builds');
          if (!(script in (inspection.project.node?.scripts ?? {}))) {
            return badRequest(`Script "${script}" was not found in package.json.`);
          }
        }
      } else {
        const availableModulePaths = new Set(
          inspection.project.maven?.modules.map((moduleEntry) => moduleEntry.relativePath) ?? [],
        );
        if (body.modulePath && !availableModulePaths.has(body.modulePath)) {
          return badRequest(`Module "${body.modulePath}" was not found in the selected Maven project.`);
        }

        const availableProfileIds = new Set(
          inspection.project.maven?.profiles.map((profile) => profile.id) ?? [],
        );
        for (const profileId of Object.keys(body.profileStates ?? {})) {
          if (!availableProfileIds.has(profileId)) {
            return badRequest(`Profile "${profileId}" was not found in the selected Maven project.`);
          }
        }

        const goals = body.goals ?? currentConfig.maven.defaultGoals;
        if (goals.length === 0) {
          return badRequest('At least one Maven goal is required.');
        }

        if (body.java) {
          try {
            requireRegisteredJavaHome(currentConfig, body.java);
          } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
          }
        }
      }

      const step: BuildStep =
        buildSystem === 'node'
          ? {
              path: resolvedPath,
              buildSystem: 'node',
              label: inspection.project.name,
              commandType: body.commandType ?? 'script',
              script: body.script,
              args: body.args ?? [],
              executionMode: body.executionMode ?? 'internal',
              packageManager: inspection.project.node?.packageManager,
              nodeExecutables: currentConfig.node.executables,
            }
          : {
              path: resolvedPath,
              modulePath: body.modulePath,
              goals: body.goals ?? currentConfig.maven.defaultGoals,
              optionKeys: body.optionKeys ?? currentConfig.maven.defaultOptionKeys,
              profileStates: body.profileStates ?? {},
              extraOptions: body.extraOptions ?? currentConfig.maven.defaultExtraOptions,
              executionMode: body.executionMode ?? 'internal',
              buildSystem: 'maven',
              label: inspection.project.name,
              mavenExecutable: body.maven ?? currentConfig.maven.executable,
              javaVersion: body.java,
              javaHome: resolveJavaHome(currentConfig, body.java),
            };

      const jobId = startJob(async function* (jobId) {
        let runId: number | undefined;
        const activeJob = activeJobs.get(jobId);
        let logSeq = 0;
        for await (const event of buildRunner.run(step, 0, 1, undefined, activeJob?.controller.signal)) {
          if (event.type === 'step:start') {
            if (runId === undefined) {
              try {
                runId = db.startBuildRun({
                  jobId,
                  projectPath: event.step.path,
                  projectName: event.step.label,
                  buildSystem: event.step.buildSystem,
                  packageManager: event.step.buildSystem === 'node' ? event.step.packageManager : undefined,
                  executionMode: event.step.executionMode,
                  command: buildCommandString(event.step),
                  javaHome: event.step.buildSystem === 'maven' ? event.step.javaHome : undefined,
                });
              } catch {
                // non-fatal DB error
              }
            }
            yield runId !== undefined ? { ...event, runId } : event;
          } else {
            yield event;
          }
          if (event.type === 'step:output' && runId !== undefined) {
            try { db.appendBuildLog(runId, logSeq++, event.stream, event.line); } catch { /* non-fatal */ }
          }
          if (event.type === 'step:done' && runId !== undefined) {
            try {
              db.finishBuildRun({ id: runId, exitCode: event.exitCode, durationMs: event.durationMs, status: event.status });
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
      try {
        persistConfig(body);
        return json({ ok: true });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
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
          const history = jobHistory.get(msg.jobId);
          if (history && ws.readyState === WebSocket.OPEN) {
            for (const frame of history.frames) ws.send(frame);
            if (history.terminalFrame) ws.send(history.terminalFrame);
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
