#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const guiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(guiRoot, '..', '..');
const extraArgs = process.argv.slice(2);
const isSmokeTest = extraArgs.includes('--smoke-test');
const forwardedArgs = extraArgs.filter((arg) => arg !== '--smoke-test');
const packagedExe = path.resolve(
  repoRoot,
  'release',
  'desktop',
  'win-unpacked',
  'GFOS Build.exe',
);

function getLatestModified(targetPath) {
  if (!fs.existsSync(targetPath)) return 0;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return stat.mtimeMs;

  let latest = stat.mtimeMs;
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    latest = Math.max(latest, getLatestModified(path.join(targetPath, entry.name)));
  }
  return latest;
}

const sourcePaths = [
  path.join(guiRoot, 'src'),
  path.join(guiRoot, 'package.json'),
  path.join(guiRoot, 'electron.vite.config.ts'),
  path.join(repoRoot, 'packages'),
  path.join(repoRoot, 'apps', 'cli'),
  path.join(repoRoot, 'assets', 'icon.ico'),
];

const latestSourceMtime = Math.max(...sourcePaths.map((targetPath) => getLatestModified(targetPath)));
const packagedExeMtime = fs.existsSync(packagedExe) ? fs.statSync(packagedExe).mtimeMs : 0;
const needsRebuild = !fs.existsSync(packagedExe) || latestSourceMtime > packagedExeMtime;

if (needsRebuild) {
  console.log(
    fs.existsSync(packagedExe)
      ? 'Packaged desktop app is out of date. Rebuilding it first...'
      : 'No packaged desktop app found. Building it first...',
  );
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
