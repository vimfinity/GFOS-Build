import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import os, { tmpdir } from 'node:os';

const binaryName = process.platform === 'win32' ? 'gfos-build.exe' : 'gfos-build';
const binaryPath = path.resolve('release', binaryName);
const fixtureRoot = path.resolve('tests/fixtures/workspaces');

if (!existsSync(binaryPath)) {
  console.error(`Binary not found: ${binaryPath}`);
  process.exit(1);
}


function validateSchema(schema: unknown, value: unknown, pointer = '$'): string[] {
  const schemaObj = (schema ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  if (schemaObj.const !== undefined && value !== schemaObj.const) {
    errors.push(`${pointer}: expected const ${String(schemaObj.const)}`);
    return errors;
  }

  if (Array.isArray(schemaObj.enum) && !schemaObj.enum.includes(value)) {
    errors.push(`${pointer}: expected one of ${schemaObj.enum.join(', ')}`);
    return errors;
  }

  if (schemaObj.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push(`${pointer}: expected object`);
      return errors;
    }

    const objectValue = value as Record<string, unknown>;
    const required = (schemaObj.required ?? []) as string[];
    for (const key of required) {
      if (!(key in objectValue)) {
        errors.push(`${pointer}.${key}: missing required property`);
      }
    }

    const properties = (schemaObj.properties ?? {}) as Record<string, unknown>;
    for (const [key, nestedSchema] of Object.entries(properties)) {
      if (key in objectValue) {
        errors.push(...validateSchema(nestedSchema, objectValue[key], `${pointer}.${key}`));
      }
    }

    if (schemaObj.additionalProperties === false) {
      for (const key of Object.keys(objectValue)) {
        if (!(key in properties)) {
          errors.push(`${pointer}.${key}: additional property is not allowed`);
        }
      }
    }

    return errors;
  }

  if (schemaObj.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${pointer}: expected array`);
      return errors;
    }

    if (typeof schemaObj.minItems === 'number' && value.length < schemaObj.minItems) {
      errors.push(`${pointer}: expected at least ${schemaObj.minItems} item(s)`);
    }

    if (schemaObj.items) {
      value.forEach((entry, index) => {
        errors.push(...validateSchema(schemaObj.items, entry, `${pointer}[${index}]`));
      });
    }

    return errors;
  }

  if (schemaObj.type === 'number') {
    if (typeof value !== 'number') {
      errors.push(`${pointer}: expected number`);
      return errors;
    }

    if (typeof schemaObj.minimum === 'number' && value < schemaObj.minimum) {
      errors.push(`${pointer}: expected >= ${schemaObj.minimum}`);
    }

    return errors;
  }

  if (schemaObj.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(`${pointer}: expected string`);
      return errors;
    }

    if (typeof schemaObj.minLength === 'number' && value.length < schemaObj.minLength) {
      errors.push(`${pointer}: expected minLength ${schemaObj.minLength}`);
    }

    return errors;
  }

  if (schemaObj.type === 'boolean' && typeof value !== 'boolean') {
    errors.push(`${pointer}: expected boolean`);
  }

  return errors;
}

const runReportSchema = JSON.parse(
  readFileSync(path.resolve('assets/contracts/run-report.v1.1.schema.json'), 'utf-8')
) as Record<string, unknown>;

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

  const roots = stats.discoveryRoots as unknown[] | undefined;
  if (!Array.isArray(roots)) {
    console.error('Expected stats.discoveryRoots to be an array');
    process.exit(1);
  }
}


function assertBaseReport(report: Record<string, unknown>, expectedCommand: string): void {
  if (report.schemaVersion !== '1.1') {
    console.error(`Expected schemaVersion 1.1, got ${String(report.schemaVersion)}`);
    process.exit(1);
  }

  const schemaErrors = validateSchema(runReportSchema, report);
  if (schemaErrors.length > 0) {
    console.error(`Schema validation failed for report: ${schemaErrors.join(' | ')}`);
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

  for (const field of ['discoveredCount', 'plannedCount', 'builtCount', 'totalBuildDurationMs', 'discoveryCacheHitRate', 'discoveryCacheHits', 'discoveryCacheMisses']) {
    if (typeof stats[field] !== 'number') {
      console.error(`Expected stats.${field} to be a number`);
      process.exit(1);
    }
  }

  const roots = stats.discoveryRoots as unknown[] | undefined;
  if (!Array.isArray(roots)) {
    console.error('Expected stats.discoveryRoots to be an array');
    process.exit(1);
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
