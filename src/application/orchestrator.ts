import os from 'node:os';
import { z } from 'zod';
import { loadConfig } from '../config/config.js';
import { BuildService } from '../core/build-service.js';
import { AppError } from '../core/errors.js';
import { RepositoryScanner } from '../core/repository-scanner.js';
import {
  BuildPlan,
  BuildResult,
  BuildScope,
  MavenProfile,
  MavenRepository,
  ModuleGraph,
  PipelineDefinition,
  PipelineLintIssue,
  PipelineReport,
  PipelineStageDefinition,
  RunEvent,
  RunReport,
  SelectionExplanation,
} from '../core/types.js';
import { DiscoveryCache } from '../infrastructure/discovery-cache.js';
import { RunHistory } from '../infrastructure/run-history.js';

const pipelineSchema = z.object({
  schemaVersion: z.literal('1.0'),
  name: z.string().min(1).optional(),
  mavenExecutable: z.string().min(1).optional(),
  javaHome: z.string().min(1).optional(),
  stages: z
    .array(
      z.object({
        name: z.string().min(1),
        scope: z.enum(['root-only', 'explicit-modules', 'auto']).optional(),
        modules: z.array(z.string().min(1)).optional(),
        goals: z.array(z.string().min(1)).min(1),
        failFast: z.boolean().optional(),
        maxParallel: z.number().int().min(1).max(32).optional(),
        javaHome: z.string().min(1).optional(),
      })
    )
    .min(1),
});

export interface RunCommandInput {
  command: 'scan' | 'build' | 'pipeline';
  pipelineAction?: 'lint' | 'plan' | 'run';
  pipelinePath?: string;
  roots?: string[];
  maxDepth?: number;
  includeHidden?: boolean;
  goals?: string[];
  mavenExecutable?: string;
  javaHome?: string;
  failFast?: boolean;
  maxParallel?: number;
  verbose?: boolean;
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
  explainSelection?: boolean;
}

interface ToolchainRule {
  selector: string;
  javaHome?: string;
  mavenExecutable?: string;
}

interface BuildRuntimeDefaults {
  mavenExecutable: string;
  javaHome?: string;
  failFast: boolean;
  verbose: boolean;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesSelector(repository: MavenRepository, selector: string): boolean {
  const value = selector.trim();
  if (value.length === 0) {
    return false;
  }

  const [prefix, rawPattern] = value.includes(':')
    ? [value.split(':', 1)[0] ?? '', value.slice(value.indexOf(':') + 1)]
    : ['', value];

  const targetPath = repository.path.toLowerCase();
  const targetName = repository.name.toLowerCase();
  const pattern = rawPattern.trim().toLowerCase();

  if (prefix === 'exact') {
    return targetPath === pattern || targetName === pattern;
  }

  if (prefix === 'path') {
    return targetPath.includes(pattern);
  }

  if (prefix === 'glob') {
    const escaped = escapeRegExp(pattern).replace(/\\\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(targetPath) || regex.test(targetName);
  }

  return containsToken(targetPath, pattern) || containsToken(targetName, pattern);
}

function resolveToolchainRule(repository: MavenRepository, rules: ToolchainRule[]): ToolchainRule | undefined {
  return rules.find(rule => matchesSelector(repository, rule.selector));
}

function createRuntimeOptions(
  repository: MavenRepository,
  goals: string[],
  defaults: BuildRuntimeDefaults,
  rules: ToolchainRule[],
  overrides: { mavenExecutable?: string; javaHome?: string }
) {
  const matchedRule = resolveToolchainRule(repository, rules);
  return {
    goals,
    mavenExecutable: overrides.mavenExecutable ?? matchedRule?.mavenExecutable ?? defaults.mavenExecutable,
    javaHome: overrides.javaHome ?? matchedRule?.javaHome ?? defaults.javaHome,
    failFast: defaults.failFast,
    verbose: defaults.verbose,
  };
}

function applyResourceLimits(
  requestedMaxParallel: number,
  limits: { maxParallelCap?: number; reserveCpuCores: number }
): number {
  const cpuCount = os.cpus().length;
  const usableCpu = Math.max(1, cpuCount - limits.reserveCpuCores);
  const capped = limits.maxParallelCap ? Math.min(requestedMaxParallel, limits.maxParallelCap) : requestedMaxParallel;
  return Math.max(1, Math.min(capped, usableCpu));
}

function selectModules(
  modules: MavenRepository[],
  scope: BuildScope,
  explicitModules: string[]
): MavenRepository[] {
  if (scope === 'root-only' || scope === 'auto') {
    return modules.filter(module => !module.parentPath);
  }

  const selectors = explicitModules.map(value => value.trim()).filter(Boolean);
  if (selectors.length === 0) {
    return [];
  }

  return modules.filter(module => selectors.some(selector => matchesSelector(module, selector)));
}

function explainSelection(
  modules: MavenRepository[],
  includeModules: string[],
  excludeModules: string[]
): SelectionExplanation[] {
  const includes = includeModules.map(token => token.trim()).filter(Boolean);
  const excludes = excludeModules.map(token => token.trim()).filter(Boolean);

  return modules.map(module => {
    const includeMatched = includes.length === 0 || includes.some(token => matchesSelector(module, token));
    if (!includeMatched) {
      return {
        repositoryPath: module.path,
        selected: false,
        reason: includes.length > 0 ? 'excluded_by_include_filter' : 'excluded',
      };
    }

    const excludeMatched = excludes.some(token => matchesSelector(module, token));
    if (excludeMatched) {
      return {
        repositoryPath: module.path,
        selected: false,
        reason: 'excluded_by_exclude_filter',
      };
    }

    return {
      repositoryPath: module.path,
      selected: true,
      reason: includes.length > 0 ? 'selected_by_include_filter' : 'selected',
    };
  });
}

function applyModuleFilters(
  modules: MavenRepository[],
  includeModules: string[],
  excludeModules: string[]
): MavenRepository[] {
  return explainSelection(modules, includeModules, excludeModules)
    .filter(decision => decision.selected)
    .map(decision => modules.find(module => module.path === decision.repositoryPath))
    .filter((module): module is MavenRepository => Boolean(module));
}

function createBuildPlan(
  repositories: MavenRepository[],
  options: {
    goals: string[];
    mavenExecutable: string;
    javaHome?: string;
    failFast: boolean;
    scope: BuildScope;
    maxParallel: number;
  }
): BuildPlan {
  const normalizedParallel = Math.max(1, options.maxParallel);

  return {
    strategy: normalizedParallel > 1 ? 'parallel' : 'sequential',
    queueStrategy: 'fifo',
    failFast: options.failFast,
    goals: options.goals,
    mavenExecutable: options.mavenExecutable,
    javaHome: options.javaHome,
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
      throw new AppError(
        'PIPELINE_FILE_NOT_FOUND',
        `Pipeline-Datei nicht gefunden: ${resolved}. Lege eine pipeline.json an oder nutze --pipeline <path>.`,
        { path: resolved }
      );
    }
    throw error;
  }

  try {
    return pipelineSchema.parse(JSON.parse(content) as unknown);
  } catch (error) {
    throw new AppError('PIPELINE_INVALID', `Ungültige Pipeline-Definition in ${resolved}: ${(error as Error).message}`);
  }
}

function createReport(input: {
  runId: string;
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
  discoveryDurationMs: number;
  discoveryCacheHits: number;
  discoveryCacheMisses: number;
  discoveryRoots: import('../core/types.js').DiscoveryRootMetric[];
  selectionExplanation?: SelectionExplanation[];
}): RunReport {
  const finishedAtMs = Date.now();
  const succeededCount = input.buildResults.filter(result => result.exitCode === 0).length;
  const failedCount = input.buildResults.filter(result => result.exitCode !== 0).length;
  const totalBuildDurationMs = input.buildResults.reduce((sum, result) => sum + result.durationMs, 0);
  const failedBuildDurationMs = input.buildResults
    .filter(result => result.exitCode !== 0)
    .reduce((sum, result) => sum + result.durationMs, 0);

  return {
    schemaVersion: '1.1',
    runId: input.runId,
    command: input.command,
    mode: input.mode,
    startedAt: new Date(input.startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - input.startedAtMs,
    discovered: input.discovered,
    moduleGraph: input.moduleGraph,
    profileScan: input.profileScan,
    ...(input.buildPlan ? { buildPlan: input.buildPlan } : {}),
    buildResults: input.buildResults,
    ...(input.pipeline ? { pipeline: input.pipeline } : {}),
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
      totalBuildDurationMs,
      failedBuildDurationMs,
      maxParallelUsed: Math.max(1, input.maxParallelUsed),
      profileCount: input.profileScan.profiles.length,
      discoveryDurationMs: input.discoveryDurationMs,
      discoveryCacheHitRate:
        input.discoveryCacheHits + input.discoveryCacheMisses > 0
          ? Number((input.discoveryCacheHits / (input.discoveryCacheHits + input.discoveryCacheMisses)).toFixed(2))
          : 0,
      discoveryCacheHits: input.discoveryCacheHits,
      discoveryCacheMisses: input.discoveryCacheMisses,
      discoveryRoots: input.discoveryRoots,
    },
    selectionExplanation: input.selectionExplanation,
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
  events: RunEvent[],
  runtime: {
    defaults: BuildRuntimeDefaults;
    rules: ToolchainRule[];
    overrides: { mavenExecutable?: string; javaHome?: string };
  }
): Promise<ExecutionOutcome> {
  const startedAtMs = Date.now();
  if (selectedModules.length === 0) {
    return { results: [], wallDurationMs: 0 };
  }

  if (plan.maxParallel <= 1 || selectedModules.length === 1) {
    const results: BuildResult[] = [];
    for (const repository of selectedModules) {
      const moduleRuntime = createRuntimeOptions(
        repository,
        plan.goals,
        {
          ...runtime.defaults,
          mavenExecutable: plan.mavenExecutable,
          javaHome: plan.javaHome ?? runtime.defaults.javaHome,
        },
        runtime.rules,
        runtime.overrides
      );
      emit(events, 'module_started', {
        repository: repository.path,
        mavenExecutable: moduleRuntime.mavenExecutable,
        javaHome: moduleRuntime.javaHome ?? '',
      });

      const result = await buildService.buildRepository(repository, moduleRuntime);
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

      const moduleRuntime = createRuntimeOptions(
        repository,
        plan.goals,
        {
          ...runtime.defaults,
          mavenExecutable: plan.mavenExecutable,
          javaHome: plan.javaHome ?? runtime.defaults.javaHome,
        },
        runtime.rules,
        runtime.overrides
      );
      emit(events, 'module_started', {
        repository: repository.path,
        mavenExecutable: moduleRuntime.mavenExecutable,
        javaHome: moduleRuntime.javaHome ?? '',
      });

      const result = await buildService.buildRepository(repository, moduleRuntime);
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

  return {
    results: indexedResults.sort((a, b) => a.index - b.index).map(entry => entry.result),
    wallDurationMs: Date.now() - startedAtMs,
  };
}

function stageToPlan(
  stage: PipelineStageDefinition,
  modules: MavenRepository[],
  defaults: { mavenExecutable: string; javaHome?: string; failFast: boolean; maxParallel: number },
  includeModules: string[],
  excludeModules: string[]
): { selected: MavenRepository[]; plan: BuildPlan } {
  const scope = stage.scope ?? 'root-only';
  const scoped = selectModules(modules, scope, stage.modules ?? []);
  const selected = applyModuleFilters(scoped, includeModules, excludeModules);
  const plan = createBuildPlan(selected, {
    goals: stage.goals,
    mavenExecutable: defaults.mavenExecutable,
    javaHome: stage.javaHome ?? defaults.javaHome,
    failFast: stage.failFast ?? defaults.failFast,
    scope,
    maxParallel: stage.maxParallel ?? defaults.maxParallel,
  });

  return { selected, plan };
}


function lintPipelineDefinition(definition: PipelineDefinition, modules: MavenRepository[]): PipelineLintIssue[] {
  const issues: PipelineLintIssue[] = [];
  const seenNames = new Set<string>();

  definition.stages.forEach((stage, index) => {
    const basePath = `stages[${index}]`;

    if (seenNames.has(stage.name)) {
      issues.push({
        path: `${basePath}.name`,
        severity: 'error',
        message: `Doppelter Stage-Name '${stage.name}'. Verwende pro Stage einen eindeutigen Namen (z. B. '${stage.name}-${index + 1}').`,
      });
    }
    seenNames.add(stage.name);

    if ((stage.scope ?? 'root-only') === 'explicit-modules' && (!stage.modules || stage.modules.length === 0)) {
      issues.push({
        path: `${basePath}.modules`,
        severity: 'error',
        message: `Scope explicit-modules benötigt mindestens einen Selector in ${basePath}.modules (z. B. ["shared"] oder ["glob:*web*"]).`,
      });
    }

    const selected = selectModules(modules, stage.scope ?? 'root-only', stage.modules ?? []);
    if (selected.length === 0) {
      issues.push({
        path: `${basePath}.scope`,
        severity: 'warning',
        message: `Stage '${stage.name}' selektiert aktuell keine Module. Prüfe scope/modules/include/exclude Filter.`,
      });
    }
  });

  return issues;
}


async function scanGraphWithMetrics(scanner: RepositoryScanner, options: {
  roots: string[];
  maxDepth: number;
  includeHidden: boolean;
}): Promise<{ graph: ModuleGraph; rootMetrics: import('../core/types.js').DiscoveryRootMetric[] }> {
  const scannerWithMetrics = scanner as RepositoryScanner & {
    scanGraphWithMetrics?: (input: { rootPaths: string[]; maxDepth: number; includeHidden: boolean }) => Promise<{
      graph: ModuleGraph;
      rootMetrics: import('../core/types.js').DiscoveryRootMetric[];
    }>;
  };

  if (scannerWithMetrics.scanGraphWithMetrics) {
    return scannerWithMetrics.scanGraphWithMetrics({
      rootPaths: options.roots,
      maxDepth: options.maxDepth,
      includeHidden: options.includeHidden,
    });
  }

  const graph = await scanner.scanGraph({
    rootPaths: options.roots,
    maxDepth: options.maxDepth,
    includeHidden: options.includeHidden,
  });

  return {
    graph,
    rootMetrics: options.roots.map(rootPath => ({
      rootPath,
      durationMs: 0,
      directoriesVisited: 0,
      modulesFound: graph.modules.filter(module => module.path.startsWith(rootPath)).length,
      cacheHit: false,
    })),
  };
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
}): Promise<{ graph: ModuleGraph; rootMetrics: import('../core/types.js').DiscoveryRootMetric[]; cacheHit: boolean }> {
  if (!input.useScanCache) {
    const scanned = await scanGraphWithMetrics(input.scanner, {
      roots: input.roots,
      maxDepth: input.maxDepth,
      includeHidden: input.includeHidden,
    });
    return { graph: scanned.graph, rootMetrics: scanned.rootMetrics, cacheHit: false };
  }

  const cacheKey = input.cache.createKey({
    roots: input.roots,
    maxDepth: input.maxDepth,
    includeHidden: input.includeHidden,
  });

  const cached = await input.cache.read(cacheKey, input.cacheTtlSec * 1000, { roots: input.roots });
  if (cached) {
    emit(input.events, 'discovery_cache_hit', { key: cacheKey });
    return {
      graph: cached,
      cacheHit: true,
      rootMetrics: input.roots.map(rootPath => ({
        rootPath,
        durationMs: 0,
        directoriesVisited: 0,
        modulesFound: cached.modules.filter(module => module.path.startsWith(rootPath)).length,
        cacheHit: true,
      })),
    };
  }

  emit(input.events, 'discovery_cache_miss', { key: cacheKey });
  const scanned = await scanGraphWithMetrics(input.scanner, {
    roots: input.roots,
    maxDepth: input.maxDepth,
    includeHidden: input.includeHidden,
  });

  await input.cache.write(cacheKey, scanned.graph, { roots: input.roots });
  return { graph: scanned.graph, rootMetrics: scanned.rootMetrics, cacheHit: false };
}


const inMemoryFallbackHistory: RunHistory = {
  assignRunId: () => `run-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  write: async () => {},
  findLatest: async () => null,
};

export async function runCommand(
  input: RunCommandInput,
  scanner: RepositoryScanner,
  buildService: BuildService,
  cache: DiscoveryCache,
  history: RunHistory = inMemoryFallbackHistory
): Promise<RunReport> {
  const startedAtMs = Date.now();
  const events: RunEvent[] = [];
  let maxParallelUsed = 1;
  const runId = history.assignRunId();

  emit(events, 'run_started', { command: input.command });

  const config = await loadConfig(input.configPath);
  const roots = input.roots && input.roots.length > 0 ? input.roots : config.roots;
  const maxDepth = input.maxDepth ?? config.scan.maxDepth;
  const includeHidden = input.includeHidden ?? config.scan.includeHidden;
  const useScanCache = input.useScanCache ?? config.scan.cacheEnabled;
  const cacheTtlSec = input.scanCacheTtlSec ?? config.scan.cacheTtlSec;
  const includeModules = input.includeModules ?? [];
  const excludeModules = input.excludeModules ?? [];
  const explainSelectionEnabled = input.explainSelection ?? false;
  const verbose = input.verbose ?? false;
  const javaHome = input.javaHome ?? config.build.javaHome;
  const toolchainRules: ToolchainRule[] = config.build.toolchains;
  const resourceLimits = config.build.resourceLimits;

  const discoveryStartedAtMs = Date.now();
  const discoveryResult = await discoverWithOptionalCache({
    scanner,
    cache,
    useScanCache,
    cacheTtlSec,
    roots,
    maxDepth,
    includeHidden,
    events,
  });
  const discoveryDurationMs = Date.now() - discoveryStartedAtMs;
  const moduleGraph = discoveryResult.graph;
  const discoveryRoots = discoveryResult.rootMetrics;
  const discoveryCacheHits = discoveryResult.cacheHit ? 1 : 0;
  const discoveryCacheMisses = discoveryResult.cacheHit ? 0 : 1;

  emit(events, 'discovery_completed', {
    modules: moduleGraph.modules.length,
    roots: moduleGraph.rootModules.length,
  });

  const discoverProfiles = input.discoverProfiles ?? false;
  const profileFilter = input.profileFilter?.trim() || undefined;
  const profiles = discoverProfiles ? await scanner.scanProfiles(moduleGraph.modules, profileFilter) : [];

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

  const finalize = async (report: RunReport): Promise<RunReport> => {
    const previous = await history.findLatest(report.command, report.mode, report.runId);
    if (previous) {
      report.comparison = {
        previousRunId: previous.runId,
        previousDurationMs: previous.durationMs,
        durationDeltaMs: report.durationMs - previous.durationMs,
      };
    }

    await history.write(report);
    return report;
  };

  if (input.command === 'scan') {
    emit(events, 'run_finished', { mode: 'scan' });
    return finalize(
      createReport({
        runId,
        command: 'scan',
        mode: 'scan',
        startedAtMs,
        discovered: moduleGraph.modules,
        moduleGraph,
        profileScan,
        buildResults: [],
        events,
        maxParallelUsed,
        discoveryDurationMs,
        discoveryCacheHits,
        discoveryCacheMisses,
        discoveryRoots,
      })
    );
  }

  if (input.command === 'pipeline') {
    if (!input.pipelinePath) {
      throw new AppError('USAGE_INVALID_PIPELINE_ACTION', 'Für pipeline ist --pipeline <path> erforderlich.');
    }

    const definition = await loadPipelineDefinition(input.pipelinePath);
    const action = input.pipelineAction ?? 'plan';
    const defaultMavenExecutable = input.mavenExecutable ?? definition.mavenExecutable ?? config.build.mavenExecutable;
    const defaultJavaHome = input.javaHome ?? definition.javaHome ?? config.build.javaHome;
    const defaultFailFast = config.build.failFast;
    const requestedDefaultMaxParallel = input.maxParallel ?? config.build.maxParallel;
    const defaultMaxParallel = applyResourceLimits(requestedDefaultMaxParallel, resourceLimits);

    const pipeline: PipelineReport = {
      action,
      stages: [],
    };

    if (action === 'lint') {
      const lintIssues = lintPipelineDefinition(definition, moduleGraph.modules);
      pipeline.lintIssues = lintIssues;

      for (const issue of lintIssues) {
        emit(events, 'pipeline_lint_issue', {
          path: issue.path,
          severity: issue.severity,
          message: issue.message,
        });
      }

      const hasErrors = lintIssues.some(issue => issue.severity === 'error');
      if (hasErrors) {
        throw new AppError('PIPELINE_INVALID', 'Pipeline lint hat Fehler gefunden.', { issues: lintIssues.length });
      }

      emit(events, 'run_finished', { mode: 'pipeline-lint' });
      return finalize(
        createReport({
          runId,
          command: 'pipeline',
          mode: 'pipeline-lint',
          startedAtMs,
          discovered: moduleGraph.modules,
          moduleGraph,
          profileScan,
          buildResults: [],
          pipeline,
          events,
          maxParallelUsed,
          discoveryDurationMs,
          discoveryCacheHits,
          discoveryCacheMisses,
          discoveryRoots,
        })
      );
    }

    const allResults: BuildResult[] = [];

    for (const stage of definition.stages) {
      emit(events, 'stage_started', { stage: stage.name });
      const { selected, plan } = stageToPlan(
        stage,
        moduleGraph.modules,
        {
          mavenExecutable: defaultMavenExecutable,
          javaHome: defaultJavaHome,
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
        pipeline.stages.push({
          stageName: stage.name,
          plan,
          buildResults: [],
          stageDurationMs: 0,
          estimatedSequentialDurationMs: 0,
        });
        emit(events, 'stage_finished', { stage: stage.name, built: 0 });
        continue;
      }

      const stageOutcome = await executePlan(plan, selected, buildService, events, {
        defaults: {
          mavenExecutable: defaultMavenExecutable,
          javaHome: defaultJavaHome,
          failFast: plan.failFast,
          verbose,
        },
        rules: toolchainRules,
        overrides: {
          mavenExecutable: input.mavenExecutable,
          javaHome: input.javaHome,
        },
      });

      const estimatedSequentialDurationMs = stageOutcome.results.reduce((sum, result) => sum + result.durationMs, 0);
      const speedupFactor =
        stageOutcome.wallDurationMs > 0 && estimatedSequentialDurationMs > 0
          ? Number((estimatedSequentialDurationMs / stageOutcome.wallDurationMs).toFixed(2))
          : undefined;

      pipeline.stages.push({
        stageName: stage.name,
        plan,
        buildResults: stageOutcome.results,
        stageDurationMs: stageOutcome.wallDurationMs,
        estimatedSequentialDurationMs,
        speedupFactor,
      });

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

    const mode = action === 'plan' ? 'pipeline-plan' : 'pipeline-run';
    emit(events, 'run_finished', { mode });

    return finalize(
      createReport({
        runId,
        command: 'pipeline',
        mode,
        startedAtMs,
        discovered: moduleGraph.modules,
        moduleGraph,
        profileScan,
        buildResults: allResults,
        pipeline,
        events,
        maxParallelUsed,
        discoveryDurationMs,
        discoveryCacheHits,
        discoveryCacheMisses,
        discoveryRoots,
      })
    );
  }

  const goals = input.goals && input.goals.length > 0 ? input.goals : config.build.goals;
  const mavenExecutable = input.mavenExecutable ?? config.build.mavenExecutable;
  const failFast = input.failFast ?? config.build.failFast;
  const requestedMaxParallel = input.maxParallel ?? config.build.maxParallel;
  const maxParallel = applyResourceLimits(requestedMaxParallel, resourceLimits);
  const scope = input.buildScope ?? 'root-only';

  const scopedModules = selectModules(moduleGraph.modules, scope, input.modules ?? []);
  const selectionDecisions = explainSelection(scopedModules, includeModules, excludeModules);
  const selectedModules = selectionDecisions
    .filter(decision => decision.selected)
    .map(decision => scopedModules.find(module => module.path === decision.repositoryPath))
    .filter((module): module is MavenRepository => Boolean(module));

  if (explainSelectionEnabled) {
    for (const decision of selectionDecisions) {
      emit(events, 'selection_explained', {
        repository: decision.repositoryPath,
        selected: decision.selected,
        reason: decision.reason,
      });
    }
  }

  const buildPlan = createBuildPlan(selectedModules, {
    goals,
    mavenExecutable,
    javaHome,
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
    return finalize(
      createReport({
        runId,
        command: 'build',
        mode: 'build-plan',
        startedAtMs,
        discovered: moduleGraph.modules,
        moduleGraph,
        profileScan,
        buildPlan,
        buildResults: [],
        events,
        maxParallelUsed,
        discoveryDurationMs,
        discoveryCacheHits,
        discoveryCacheMisses,
        discoveryRoots,
        selectionExplanation: explainSelectionEnabled ? selectionDecisions : undefined,
      })
    );
  }

  const buildOutcome = await executePlan(buildPlan, selectedModules, buildService, events, {
    defaults: {
      mavenExecutable,
      javaHome,
      failFast,
      verbose,
    },
    rules: toolchainRules,
    overrides: {
      mavenExecutable: input.mavenExecutable,
      javaHome: input.javaHome,
    },
  });

  emit(events, 'run_finished', {
    mode: 'build-run',
    durationMs: buildOutcome.wallDurationMs,
    estimatedSequentialDurationMs: buildOutcome.results.reduce((sum, result) => sum + result.durationMs, 0),
  });

  return finalize(
    createReport({
      runId,
      command: 'build',
      mode: 'build-run',
      startedAtMs,
      discovered: moduleGraph.modules,
      moduleGraph,
      profileScan,
      buildPlan,
      buildResults: buildOutcome.results,
      events,
      maxParallelUsed,
      discoveryDurationMs,
      discoveryCacheHits,
      discoveryCacheMisses,
      discoveryRoots,
      selectionExplanation: explainSelectionEnabled ? selectionDecisions : undefined,
    })
  );
}
