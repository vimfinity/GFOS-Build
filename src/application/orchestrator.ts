import { z } from 'zod';
import { loadConfig } from '../config/config.js';
import { BuildService } from '../core/build-service.js';
import { RepositoryScanner } from '../core/repository-scanner.js';
import {
  BuildPlan,
  BuildResult,
  BuildScope,
  MavenProfile,
  MavenRepository,
  ModuleGraph,
  PipelineDefinition,
  PipelineReport,
  PipelineStageDefinition,
  PipelineStageReport,
  RunEvent,
  RunReport,
} from '../core/types.js';
import { DiscoveryCache } from '../infrastructure/discovery-cache.js';

const pipelineSchema = z.object({
  schemaVersion: z.literal('1.0'),
  name: z.string().min(1).optional(),
  mavenExecutable: z.string().min(1).optional(),
  stages: z
    .array(
      z.object({
        name: z.string().min(1),
        scope: z.enum(['root-only', 'explicit-modules', 'auto']).optional(),
        modules: z.array(z.string().min(1)).optional(),
        goals: z.array(z.string().min(1)).min(1),
        failFast: z.boolean().optional(),
        maxParallel: z.number().int().min(1).max(32).optional(),
      })
    )
    .min(1),
});

export interface RunCommandInput {
  command: 'scan' | 'build' | 'pipeline';
  pipelineAction?: 'plan' | 'run';
  pipelinePath?: string;
  roots?: string[];
  maxDepth?: number;
  includeHidden?: boolean;
  goals?: string[];
  mavenExecutable?: string;
  failFast?: boolean;
  maxParallel?: number;
  useScanCache?: boolean;
  scanCacheTtlSec?: number;
  discoverProfiles?: boolean;
  profileFilter?: string;
  planOnly?: boolean;
  buildScope?: BuildScope;
  modules?: string[];
  includeModules?: string[];
  excludeModules?: string[];
  configPath?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emit(
  events: RunEvent[],
  type: RunEvent['type'],
  payload?: Record<string, string | number | boolean>
): void {
  events.push({ type, timestamp: nowIso(), payload });
}

function containsToken(target: string, token: string): boolean {
  return target.toLowerCase().includes(token.trim().toLowerCase());
}

function selectModules(
  modules: MavenRepository[],
  scope: BuildScope,
  explicitModules: string[]
): MavenRepository[] {
  if (scope === 'root-only' || scope === 'auto') {
    return modules.filter(module => !module.parentPath);
  }

  const normalizedSelectors = explicitModules.map(value => value.trim()).filter(Boolean);
  if (normalizedSelectors.length === 0) {
    return [];
  }

  return modules.filter(module =>
    normalizedSelectors.some(selector =>
      containsToken(module.path, selector) || containsToken(module.name, selector)
    )
  );
}

function applyModuleFilters(
  modules: MavenRepository[],
  includeModules: string[],
  excludeModules: string[]
): MavenRepository[] {
  const includes = includeModules.map(token => token.trim()).filter(Boolean);
  const excludes = excludeModules.map(token => token.trim()).filter(Boolean);

  return modules.filter(module => {
    const includeMatch =
      includes.length === 0 ||
      includes.some(token => containsToken(module.path, token) || containsToken(module.name, token));

    if (!includeMatch) {
      return false;
    }

    const excluded = excludes.some(
      token => containsToken(module.path, token) || containsToken(module.name, token)
    );

    return !excluded;
  });
}

function createBuildPlan(
  repositories: MavenRepository[],
  options: {
    goals: string[];
    mavenExecutable: string;
    failFast: boolean;
    scope: BuildScope;
    maxParallel: number;
  }
): BuildPlan {
  const normalizedParallel = Math.max(1, options.maxParallel);

  return {
    strategy: normalizedParallel > 1 ? 'parallel' : 'sequential',
    failFast: options.failFast,
    goals: options.goals,
    mavenExecutable: options.mavenExecutable,
    scope: options.scope,
    maxParallel: normalizedParallel,
    repositories: repositories.map(repository => ({
      name: repository.name,
      path: repository.path,
    })),
  };
}

async function loadPipelineDefinition(pipelinePath: string): Promise<PipelineDefinition> {
  const { promises: fs } = await import('node:fs');
  const nodePath = await import('node:path');
  const resolved = nodePath.resolve(pipelinePath);

  let content = '';
  try {
    content = await fs.readFile(resolved, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Pipeline-Datei nicht gefunden: ${resolved}. Lege eine pipeline.json an oder nutze --pipeline <path>.`
      );
    }
    throw error;
  }

  const parsed = JSON.parse(content) as unknown;
  return pipelineSchema.parse(parsed);
}

function createReport(input: {
  command: 'scan' | 'build' | 'pipeline';
  mode: RunReport['mode'];
  startedAtMs: number;
  discovered: MavenRepository[];
  moduleGraph: ModuleGraph;
  profileScan: { enabled: boolean; filter?: string; profiles: MavenProfile[] };
  buildPlan?: BuildPlan;
  buildResults: BuildResult[];
  pipeline?: PipelineReport;
  events: RunEvent[];
  maxParallelUsed: number;
}): RunReport {
  const finishedAtMs = Date.now();
  const succeededCount = input.buildResults.filter(result => result.exitCode === 0).length;
  const failedCount = input.buildResults.filter(result => result.exitCode !== 0).length;

  return {
    schemaVersion: '1.0',
    command: input.command,
    mode: input.mode,
    startedAt: new Date(input.startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - input.startedAtMs,
    discovered: input.discovered,
    moduleGraph: input.moduleGraph,
    profileScan: input.profileScan,
    buildPlan: input.buildPlan,
    buildResults: input.buildResults,
    pipeline: input.pipeline,
    events: input.events,
    stats: {
      discoveredCount: input.discovered.length,
      plannedCount:
        input.pipeline?.stages.reduce((sum, stage) => sum + stage.plan.repositories.length, 0) ??
        input.buildPlan?.repositories.length ??
        0,
      builtCount: input.buildResults.length,
      succeededCount,
      failedCount,
      maxParallelUsed: Math.max(1, input.maxParallelUsed),
      profileCount: input.profileScan.profiles.length,
    },
  };
}

interface ExecutionOutcome {
  results: BuildResult[];
  wallDurationMs: number;
}

async function executePlan(
  plan: BuildPlan,
  selectedModules: MavenRepository[],
  buildService: BuildService,
  events: RunEvent[]
): Promise<ExecutionOutcome> {
  const startedAtMs = Date.now();
  if (selectedModules.length === 0) {
    return { results: [], wallDurationMs: 0 };
  }

  if (plan.maxParallel <= 1 || selectedModules.length === 1) {
    const results: BuildResult[] = [];
    for (const repository of selectedModules) {
      emit(events, 'module_started', { repository: repository.path });
      const result = await buildService.buildRepository(repository, {
        goals: plan.goals,
        mavenExecutable: plan.mavenExecutable,
        failFast: plan.failFast,
      });
      results.push(result);
      emit(events, 'module_finished', {
        repository: repository.path,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
      });

      if (plan.failFast && result.exitCode !== 0) {
        break;
      }
    }

    return {
      results,
      wallDurationMs: Date.now() - startedAtMs,
    };
  }

  const maxWorkers = Math.min(plan.maxParallel, selectedModules.length);
  let nextIndex = 0;
  let stopScheduling = false;
  const indexedResults: Array<{ index: number; result: BuildResult }> = [];

  const worker = async (): Promise<void> => {
    while (true) {
      if (stopScheduling && plan.failFast) {
        return;
      }

      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= selectedModules.length) {
        return;
      }

      const repository = selectedModules[currentIndex];
      if (!repository) {
        return;
      }

      emit(events, 'module_started', { repository: repository.path });
      const result = await buildService.buildRepository(repository, {
        goals: plan.goals,
        mavenExecutable: plan.mavenExecutable,
        failFast: plan.failFast,
      });

      indexedResults.push({ index: currentIndex, result });
      emit(events, 'module_finished', {
        repository: repository.path,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
      });

      if (result.exitCode !== 0 && plan.failFast) {
        stopScheduling = true;
      }
    }
  };

  await Promise.all(Array.from({ length: maxWorkers }, () => worker()));

  const ordered = indexedResults.sort((a, b) => a.index - b.index).map(entry => entry.result);
  return {
    results: ordered,
    wallDurationMs: Date.now() - startedAtMs,
  };
}

function stageToPlan(
  stage: PipelineStageDefinition,
  modules: MavenRepository[],
  defaults: { mavenExecutable: string; failFast: boolean; maxParallel: number },
  includeModules: string[],
  excludeModules: string[]
): { selected: MavenRepository[]; plan: BuildPlan } {
  const scope = stage.scope ?? 'root-only';
  const scoped = selectModules(modules, scope, stage.modules ?? []);
  const selected = applyModuleFilters(scoped, includeModules, excludeModules);
  const plan = createBuildPlan(selected, {
    goals: stage.goals,
    mavenExecutable: defaults.mavenExecutable,
    failFast: stage.failFast ?? defaults.failFast,
    scope,
    maxParallel: stage.maxParallel ?? defaults.maxParallel,
  });

  return { selected, plan };
}

async function discoverWithOptionalCache(input: {
  scanner: RepositoryScanner;
  cache: DiscoveryCache;
  useScanCache: boolean;
  cacheTtlSec: number;
  roots: string[];
  maxDepth: number;
  includeHidden: boolean;
  events: RunEvent[];
}): Promise<ModuleGraph> {
  if (!input.useScanCache) {
    return input.scanner.scanGraph({
      rootPaths: input.roots,
      maxDepth: input.maxDepth,
      includeHidden: input.includeHidden,
    });
  }

  const cacheKey = input.cache.createKey({
    roots: input.roots,
    maxDepth: input.maxDepth,
    includeHidden: input.includeHidden,
  });

  const cached = await input.cache.read(cacheKey, input.cacheTtlSec * 1000);
  if (cached) {
    emit(input.events, 'discovery_cache_hit', { key: cacheKey });
    return cached;
  }

  emit(input.events, 'discovery_cache_miss', { key: cacheKey });
  const graph = await input.scanner.scanGraph({
    rootPaths: input.roots,
    maxDepth: input.maxDepth,
    includeHidden: input.includeHidden,
  });

  await input.cache.write(cacheKey, graph);
  return graph;
}

export async function runCommand(
  input: RunCommandInput,
  scanner: RepositoryScanner,
  buildService: BuildService,
  cache: DiscoveryCache
): Promise<RunReport> {
  const startedAtMs = Date.now();
  const events: RunEvent[] = [];
  let maxParallelUsed = 1;

  emit(events, 'run_started', { command: input.command });

  const config = await loadConfig(input.configPath);
  const roots = input.roots && input.roots.length > 0 ? input.roots : config.roots;
  const maxDepth = input.maxDepth ?? config.scan.maxDepth;
  const includeHidden = input.includeHidden ?? config.scan.includeHidden;
  const useScanCache = input.useScanCache ?? config.scan.cacheEnabled;
  const cacheTtlSec = input.scanCacheTtlSec ?? config.scan.cacheTtlSec;
  const includeModules = input.includeModules ?? [];
  const excludeModules = input.excludeModules ?? [];

  const moduleGraph = await discoverWithOptionalCache({
    scanner,
    cache,
    useScanCache,
    cacheTtlSec,
    roots,
    maxDepth,
    includeHidden,
    events,
  });

  emit(events, 'discovery_completed', {
    modules: moduleGraph.modules.length,
    roots: moduleGraph.rootModules.length,
  });

  const discoverProfiles = input.discoverProfiles ?? false;
  const profileFilter = input.profileFilter?.trim() || undefined;
  const profiles = discoverProfiles
    ? await scanner.scanProfiles(moduleGraph.modules, profileFilter)
    : [];

  if (discoverProfiles) {
    emit(events, 'profile_discovery_completed', {
      profiles: profiles.length,
      filter: profileFilter ?? '',
    });
  }

  const profileScan = {
    enabled: discoverProfiles,
    filter: profileFilter,
    profiles,
  };

  if (input.command === 'scan' || moduleGraph.modules.length === 0) {
    emit(events, 'run_finished', { mode: 'scan' });
    return createReport({
      command: input.command,
      mode: 'scan',
      startedAtMs,
      discovered: moduleGraph.modules,
      moduleGraph,
      profileScan,
      buildResults: [],
      events,
      maxParallelUsed,
    });
  }

  if (input.command === 'pipeline') {
    if (!input.pipelinePath) {
      throw new Error('Für pipeline ist --pipeline <path> erforderlich.');
    }

    const definition = await loadPipelineDefinition(input.pipelinePath);
    const action = input.pipelineAction ?? 'plan';
    const defaultMavenExecutable = definition.mavenExecutable ?? config.build.mavenExecutable;
    const defaultFailFast = config.build.failFast;
    const defaultMaxParallel = input.maxParallel ?? config.build.maxParallel;

    const pipeline: PipelineReport = {
      action,
      stages: [],
    };

    const allResults: BuildResult[] = [];

    for (const stage of definition.stages) {
      emit(events, 'stage_started', { stage: stage.name });
      const { selected, plan } = stageToPlan(
        stage,
        moduleGraph.modules,
        {
          mavenExecutable: defaultMavenExecutable,
          failFast: defaultFailFast,
          maxParallel: defaultMaxParallel,
        },
        includeModules,
        excludeModules
      );

      maxParallelUsed = Math.max(maxParallelUsed, plan.maxParallel);

      emit(events, 'plan_created', {
        stage: stage.name,
        planned: plan.repositories.length,
        scope: plan.scope,
        strategy: plan.strategy,
        maxParallel: plan.maxParallel,
      });

      if (action === 'plan') {
        const stageReport: PipelineStageReport = {
          stageName: stage.name,
          plan,
          buildResults: [],
          stageDurationMs: 0,
          estimatedSequentialDurationMs: 0,
        };
        pipeline.stages.push(stageReport);
        emit(events, 'stage_finished', { stage: stage.name, built: 0 });
        continue;
      }

      const stageOutcome = await executePlan(plan, selected, buildService, events);
      const estimatedSequentialDurationMs = stageOutcome.results.reduce(
        (sum, result) => sum + result.durationMs,
        0
      );
      const speedupFactor =
        stageOutcome.wallDurationMs > 0 && estimatedSequentialDurationMs > 0
          ? Number((estimatedSequentialDurationMs / stageOutcome.wallDurationMs).toFixed(2))
          : undefined;

      const stageReport: PipelineStageReport = {
        stageName: stage.name,
        plan,
        buildResults: stageOutcome.results,
        stageDurationMs: stageOutcome.wallDurationMs,
        estimatedSequentialDurationMs,
        speedupFactor,
      };

      pipeline.stages.push(stageReport);
      allResults.push(...stageOutcome.results);
      emit(events, 'stage_finished', {
        stage: stage.name,
        built: stageOutcome.results.length,
        durationMs: stageOutcome.wallDurationMs,
      });

      const stageFailed = stageOutcome.results.some(result => result.exitCode !== 0);
      if (stageFailed && plan.failFast) {
        break;
      }
    }

    emit(events, 'run_finished', { mode: action === 'plan' ? 'pipeline-plan' : 'pipeline-run' });
    return createReport({
      command: 'pipeline',
      mode: action === 'plan' ? 'pipeline-plan' : 'pipeline-run',
      startedAtMs,
      discovered: moduleGraph.modules,
      moduleGraph,
      profileScan,
      buildResults: allResults,
      pipeline,
      events,
      maxParallelUsed,
    });
  }

  const goals = input.goals && input.goals.length > 0 ? input.goals : config.build.goals;
  const mavenExecutable = input.mavenExecutable ?? config.build.mavenExecutable;
  const failFast = input.failFast ?? config.build.failFast;
  const maxParallel = input.maxParallel ?? config.build.maxParallel;
  const scope = input.buildScope ?? 'root-only';
  const selectedModules = applyModuleFilters(
    selectModules(moduleGraph.modules, scope, input.modules ?? []),
    includeModules,
    excludeModules
  );

  const buildPlan = createBuildPlan(selectedModules, {
    goals,
    mavenExecutable,
    failFast,
    scope,
    maxParallel,
  });
  maxParallelUsed = Math.max(maxParallelUsed, buildPlan.maxParallel);

  emit(events, 'plan_created', {
    scope,
    planned: buildPlan.repositories.length,
    strategy: buildPlan.strategy,
    maxParallel: buildPlan.maxParallel,
  });

  if (input.planOnly) {
    emit(events, 'run_finished', { mode: 'build-plan' });
    return createReport({
      command: input.command,
      mode: 'build-plan',
      startedAtMs,
      discovered: moduleGraph.modules,
      moduleGraph,
      profileScan,
      buildPlan,
      buildResults: [],
      events,
      maxParallelUsed,
    });
  }

  const buildOutcome = await executePlan(buildPlan, selectedModules, buildService, events);

  emit(events, 'run_finished', {
    mode: 'build-run',
    durationMs: buildOutcome.wallDurationMs,
    estimatedSequentialDurationMs: buildOutcome.results.reduce((sum, result) => sum + result.durationMs, 0),
  });

  return createReport({
    command: input.command,
    mode: 'build-run',
    startedAtMs,
    discovered: moduleGraph.modules,
    moduleGraph,
    profileScan,
    buildPlan,
    buildResults: buildOutcome.results,
    events,
    maxParallelUsed,
  });
}
