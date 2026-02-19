import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { existsSync, mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import os, { tmpdir } from 'node:os';

const binaryName = process.platform === 'win32' ? 'gfos-build.exe' : 'gfos-build';
const binaryPath = path.resolve('release', binaryName);
const fixtureRoot = path.resolve('tests/fixtures/workspaces');

if (!existsSync(binaryPath)) {
  console.error(`Binary not found: ${binaryPath}`);
  process.exit(1);
}

function runAndParse(args: string[], env?: NodeJS.ProcessEnv): Record<string, unknown> {
  const run = spawnSync(binaryPath, args, {
    encoding: 'utf-8',
    env: {
      ...process.env,
      ...env,
    },
  });

  if (run.status !== 0) {
    console.error(run.stdout);
    console.error(run.stderr);
    process.exit(run.status ?? 1);
  }

  const output = run.stdout.trim();
  try {
    return JSON.parse(output) as Record<string, unknown>;
  } catch {
    console.error(`Invalid JSON output from binary: ${output}`);
    process.exit(1);
  }
}


function assertBaseReport(report: Record<string, unknown>, expectedCommand: string): void {
  if (report.schemaVersion !== '1.1') {
    console.error(`Expected schemaVersion 1.1, got ${String(report.schemaVersion)}`);
    process.exit(1);
  }

  if (report.command !== expectedCommand) {
    console.error(`Expected command ${expectedCommand}, got ${String(report.command)}`);
    process.exit(1);
  }

  const events = report.events as unknown[] | undefined;
  if (!Array.isArray(events) || events.length === 0) {
    console.error('Expected non-empty events array');
    process.exit(1);
  }

  const stats = report.stats as Record<string, unknown> | undefined;
  if (!stats) {
    console.error('Expected stats object');
    process.exit(1);
  }

  for (const field of ['discoveredCount', 'plannedCount', 'builtCount', 'totalBuildDurationMs']) {
    if (typeof stats[field] !== 'number') {
      console.error(`Expected stats.${field} to be a number`);
      process.exit(1);
    }
  }
}

const scanReport = runAndParse(['scan', '--root', fixtureRoot, '--max-depth', '4', '--json']);
assertBaseReport(scanReport, 'scan');
const discovered = (scanReport.discovered as Array<{ path: string }> | undefined) ?? [];

if (!Array.isArray(discovered) || discovered.length !== 3) {
  console.error(`Expected exactly 3 modules, got ${discovered.length}`);
  process.exit(1);
}

const graph = scanReport.moduleGraph as { rootModules?: unknown[] } | undefined;
if (!graph || !Array.isArray(graph.rootModules) || graph.rootModules.length !== 2) {
  console.error('Expected moduleGraph.rootModules to include 2 roots');
  process.exit(1);
}

const profileReport = runAndParse([
  'scan',
  '--root',
  fixtureRoot,
  '--max-depth',
  '4',
  '--profiles',
  '--profile-filter',
  'dev',
  '--json',
]);
assertBaseReport(profileReport, 'scan');
const profileScan = profileReport.profileScan as { profiles?: Array<{ id?: string }> } | undefined;
if (!profileScan || !Array.isArray(profileScan.profiles) || profileScan.profiles.length < 2) {
  console.error('Expected profile scan to return at least 2 profiles');
  process.exit(1);
}


const planReport = runAndParse([
  'build',
  '--root',
  fixtureRoot,
  '--max-depth',
  '4',
  '--goals',
  'clean verify',
  '--scope',
  'root-only',
  '--max-parallel',
  '3',
  '--plan',
  '--json',
]);
assertBaseReport(planReport, 'build');

if (planReport.mode !== 'build-plan') {
  console.error(`Expected build-plan mode, got ${String(planReport.mode)}`);
  process.exit(1);
}

const buildPlan = planReport.buildPlan as { repositories?: unknown[]; scope?: string; strategy?: string; maxParallel?: number } | undefined;
if (!buildPlan || !Array.isArray(buildPlan.repositories) || buildPlan.repositories.length !== 2) {
  console.error('Expected build plan with exactly 2 repositories');
  process.exit(1);
}
if (buildPlan.scope !== 'root-only') {
  console.error(`Expected build scope root-only, got ${String(buildPlan.scope)}`);
  process.exit(1);
}

const expectedMaxParallel = Math.min(3, Math.max(1, os.cpus().length));
if (buildPlan.strategy !== 'parallel' || buildPlan.maxParallel !== expectedMaxParallel) {
  console.error(
    `Expected parallel plan with maxParallel=${expectedMaxParallel}, got strategy=${String(buildPlan.strategy)} maxParallel=${String(buildPlan.maxParallel)}`
  );
  process.exit(1);
}

const tmp = mkdtempSync(path.join(tmpdir(), 'gfos-build-smoke-'));
const pipelinePath = path.join(tmp, 'pipeline.json');
const mockMvnPath = path.join(tmp, 'mvn-mock.sh');
const mockLogPath = path.join(tmp, 'mvn.log');

writeFileSync(
  mockMvnPath,
  '#!/usr/bin/env bash\nset -euo pipefail\necho "${PWD}|$*" >> "${GFOS_MVN_LOG}"\nexit 0\n'
);
chmodSync(mockMvnPath, 0o755);

writeFileSync(
  pipelinePath,
  JSON.stringify(
    {
      schemaVersion: '1.0',
      mavenExecutable: mockMvnPath,
      stages: [
        { name: 'shared', scope: 'explicit-modules', modules: ['shared'], goals: ['clean'] },
        { name: 'roots', scope: 'root-only', goals: ['verify'], maxParallel: 2 },
      ],
    },
    null,
    2
  )
);

const pipelineReport = runAndParse(
  ['pipeline', 'plan', '--root', fixtureRoot, '--max-depth', '4', '--pipeline', pipelinePath, '--json'],
  { GFOS_MVN_LOG: mockLogPath }
);
assertBaseReport(pipelineReport, 'pipeline');

if (pipelineReport.mode !== 'pipeline-plan') {
  console.error(`Expected pipeline-plan mode, got ${String(pipelineReport.mode)}`);
  process.exit(1);
}

const pipeline = pipelineReport.pipeline as { stages?: unknown[] } | undefined;
if (!pipeline || !Array.isArray(pipeline.stages) || pipeline.stages.length !== 2) {
  console.error('Expected pipeline report with 2 stages');
  process.exit(1);
}

const pipelineStages = pipeline.stages as Array<{ plan?: { maxParallel?: number } }>;
if ((pipelineStages[1]?.plan?.maxParallel ?? 0) !== 2) {
  console.error('Expected second pipeline stage maxParallel=2');
  process.exit(1);
}

rmSync(tmp, { recursive: true, force: true });
console.log('Binary smoke test passed.');
