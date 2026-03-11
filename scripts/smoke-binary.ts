import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';

const binaryName = process.platform === 'win32' ? 'gfos-build.exe' : 'gfos-build';
const binaryPath = path.resolve('release', binaryName);
const fixtureRoot = path.resolve('tests/fixtures/workspaces');

// Minimal config for smoke testing
const smokeConfig = JSON.stringify({
  roots: { fixtures: fixtureRoot },
  maven: { executable: 'mvn', defaultGoals: ['clean', 'install'], defaultFlags: [] },
  jdkRegistry: {},
  scan: { maxDepth: 4, includeHidden: false, exclude: [] },
  pipelines: {
    'smoke-test': {
      description: 'Smoke test pipeline',
      failFast: true,
      steps: [
        { path: `fixtures:2025/shared`, goals: ['clean', 'install'], label: 'shared' },
        { path: `fixtures:2025/web`, goals: ['clean', 'install'], label: 'web' },
      ],
    },
  },
});

const configPath = path.resolve('tests/fixtures/smoke-config.json');
writeFileSync(configPath, smokeConfig);

let exitCode = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}: ${(e as Error).message}`);
    exitCode = 1;
  }
}

try {
  if (!existsSync(binaryPath)) {
    console.error(`Binary not found: ${binaryPath}`);
    process.exit(1);
  }

  console.log(`Smoke testing: ${binaryPath}\n`);

  // --- Test 1: version ---
  check('version', () => {
    const result = spawnSync(binaryPath, ['version'], { encoding: 'utf-8' });
    if (result.status !== 0) throw new Error(`Exit ${result.status}: ${result.stderr}`);
    if (!result.stdout.includes('gfos-build v')) throw new Error(`Unexpected output: ${result.stdout}`);
  });

  // --- Test 2: help ---
  check('help', () => {
    const result = spawnSync(binaryPath, ['help'], { encoding: 'utf-8' });
    if (result.status !== 0) throw new Error(`Exit ${result.status}: ${result.stderr}`);
    if (!result.stdout.includes('build')) throw new Error(`Help missing 'build'`);
    if (!result.stdout.includes('pipeline')) throw new Error(`Help missing 'pipeline'`);
  });

  // --- Test 3: scan --json ---
  check('scan --json', () => {
    const result = spawnSync(binaryPath, ['scan', '--json', '--no-cache', '--config', configPath], {
      encoding: 'utf-8',
    });
    if (result.status !== 0) throw new Error(`Exit ${result.status}: ${result.stderr}`);

    // Parse NDJSON lines
    const lines = result.stdout.trim().split('\n').filter(Boolean);
    const events = lines.map((line) => JSON.parse(line));

    const found = events.filter((e: { type: string }) => e.type === 'repo:found');
    if (found.length < 2) {
      throw new Error(`Expected at least 2 repo:found events, got ${found.length}`);
    }

    const done = events.find((e: { type: string }) => e.type === 'scan:done');
    if (!done) throw new Error('Missing scan:done event');
  });

  // --- Test 4: pipeline list ---
  check('pipeline list', () => {
    const result = spawnSync(binaryPath, ['pipeline', 'list', '--config', configPath], {
      encoding: 'utf-8',
    });
    if (result.status !== 0) throw new Error(`Exit ${result.status}: ${result.stderr}`);
    if (!result.stdout.includes('smoke-test')) throw new Error('Pipeline name not in output');
  });

  // --- Test 5: pipeline run --dry-run ---
  check('pipeline run --dry-run', () => {
    const result = spawnSync(
      binaryPath,
      ['pipeline', 'run', 'smoke-test', '--dry-run', '--config', configPath],
      { encoding: 'utf-8' }
    );
    if (result.status !== 0) throw new Error(`Exit ${result.status}: ${result.stderr}`);
    if (!result.stdout.includes('DRY RUN')) throw new Error('Missing DRY RUN header');
    if (!result.stdout.includes('shared')) throw new Error('Missing step label');
  });

  // --- Test 6: config show --json ---
  check('config show --json', () => {
    const result = spawnSync(binaryPath, ['config', 'show', '--json', '--config', configPath], {
      encoding: 'utf-8',
    });
    if (result.status !== 0) throw new Error(`Exit ${result.status}: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout.trim());
    if (!parsed.config) throw new Error('Missing config in output');
    if (!parsed.source) throw new Error('Missing source in output');
  });

  console.log(exitCode === 0 ? '\nAll smoke tests passed.' : '\nSome smoke tests failed.');
} finally {
  try {
    unlinkSync(configPath);
  } catch {
    // Ignore cleanup failures
  }
}

process.exit(exitCode);
