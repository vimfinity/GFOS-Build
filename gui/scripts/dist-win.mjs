#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { packageDesktopApp, productName, repoRoot, guiRoot, run, stageDesktopRuntime } from './lib/desktop-runtime.mjs';

const releaseRoot = path.resolve(repoRoot, 'release', 'desktop');
const unpackedRoot = path.resolve(releaseRoot, 'win-unpacked');
const zipPath = path.resolve(releaseRoot, 'GFOS-Build-win32-x64.zip');
const legacyGuiRelease = path.resolve(repoRoot, 'release', 'gui');
const legacySidecarBinary = path.resolve(repoRoot, 'release', 'gfos-build.exe');
const stagingRoot = path.resolve(releaseRoot, '.stage-win');

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

fs.mkdirSync(releaseRoot, { recursive: true });
fs.rmSync(zipPath, { force: true });
fs.rmSync(legacyGuiRelease, { recursive: true, force: true });
fs.rmSync(legacySidecarBinary, { force: true });
fs.rmSync(stagingRoot, { recursive: true, force: true });

console.log('Building desktop bundles...');
run('bun run build', guiRoot);

console.log('\nStaging desktop runtime files...');
stageDesktopRuntime(stagingRoot);

console.log('\nPackaging Windows desktop app...');
const appPaths = await packageDesktopApp({ stageRoot: stagingRoot, outDir: unpackedRoot });

const packagedAppPath = appPaths[0];
if (!packagedAppPath) {
  throw new Error('Packaging completed without returning an app path.');
}

console.log('\nCreating ZIP artifact...');
run(
  `powershell -NoProfile -Command "Compress-Archive -Path ${quotePowerShell(packagedAppPath)} -DestinationPath ${quotePowerShell(zipPath)} -Force"`,
  repoRoot,
);

const desktopExe = path.join(packagedAppPath, 'GFOS Build.exe');

console.log('\nDesktop release ready:');
console.log(`  unpacked: ${packagedAppPath}`);
if (fs.existsSync(desktopExe)) {
  const stat = fs.statSync(desktopExe);
  console.log(`  exe:      ${desktopExe} (${(stat.size / 1024 / 1024).toFixed(0)} MB)`);
}
console.log(`  zip:      ${zipPath}`);

fs.rmSync(stagingRoot, { recursive: true, force: true });
