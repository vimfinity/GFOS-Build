import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';

const binaryName = process.platform === 'win32' ? 'gfos-build.exe' : 'gfos-build';
const binaryPath = path.resolve('release', binaryName);
const fixtureRoot = path.resolve('tests/fixtures/workspaces');

if (!existsSync(binaryPath)) {
  console.error(`Binary not found: ${binaryPath}`);
  process.exit(1);
}

const run = spawnSync(binaryPath, ['scan', '--root', fixtureRoot, '--max-depth', '4', '--json'], {
  encoding: 'utf-8',
});

if (run.status !== 0) {
  console.error(run.stdout);
  console.error(run.stderr);
  process.exit(run.status ?? 1);
}

const output = run.stdout.trim();
let parsed: unknown;

try {
  parsed = JSON.parse(output);
} catch {
  console.error(`Invalid JSON output from binary: ${output}`);
  process.exit(1);
}

const discovered = (parsed as { discovered?: Array<{ path: string }> }).discovered ?? [];

if (!Array.isArray(discovered) || discovered.length !== 2) {
  console.error(`Expected exactly 2 repositories, got ${discovered.length}`);
  process.exit(1);
}

console.log('Binary smoke test passed.');
