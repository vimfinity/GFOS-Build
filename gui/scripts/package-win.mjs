#!/usr/bin/env node
/**
 * Packages the Electron app for Windows using @electron/packager.
 * Avoids electron-builder's winCodeSign symlink issue on Windows hosts.
 */
import packager from '@electron/packager';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
const outDir = path.resolve(repoRoot, 'release', 'gui');

const extraResource = path.resolve(repoRoot, 'release', 'gfos-build.exe');

if (!fs.existsSync(extraResource)) {
  console.error(`ERROR: ${extraResource} not found. Run "bun run binary:build:win" first.`);
  process.exit(1);
}

console.log('Packaging GFOS Build GUI for Windows...');

const appPaths = await packager({
  dir: root,
  name: 'GFOS Build',
  platform: 'win32',
  arch: 'x64',
  out: outDir,
  overwrite: true,
  icon: path.resolve(repoRoot, 'assets', 'icon.ico'),
  extraResource: [extraResource],
  ignore: [
    /node_modules/,
    /\/src\//,
    /\/scripts\//,
    /\.git/,
    /electron-builder\.json/,
    /tsconfig/,
  ],
});

console.log('\nPackaged to:');
for (const p of appPaths) {
  console.log(' ', p);
  const exe = path.join(p, 'GFOS Build.exe');
  if (fs.existsSync(exe)) {
    const stat = fs.statSync(exe);
    console.log('  → GFOS Build.exe (' + (stat.size / 1024 / 1024).toFixed(0) + ' MB)');
  }
}
