#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const guiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(guiRoot, '..');
const extraArgs = process.argv.slice(2);
const isSmokeTest = extraArgs.includes('--smoke-test');
const forwardedArgs = extraArgs.filter((arg) => arg !== '--smoke-test');
const packagedExe = path.resolve(
  repoRoot,
  'release',
  'desktop',
  'win-unpacked',
  'GFOS Build-win32-x64',
  'GFOS Build.exe',
);

if (!fs.existsSync(packagedExe)) {
  console.log('No packaged desktop app found. Building it first...');
  const { execSync } = await import('node:child_process');
  execSync('bun run dist:win', {
    cwd: guiRoot,
    stdio: 'inherit',
    shell: true,
  });
}

const child = spawn(packagedExe, forwardedArgs, {
  cwd: path.dirname(packagedExe),
  env: {
    ...process.env,
    ...(isSmokeTest ? { GFOS_BUILD_SMOKE_TEST: '1' } : {}),
  },
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
