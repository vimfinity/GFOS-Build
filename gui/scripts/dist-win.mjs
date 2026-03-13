#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { appVersion, packageDesktopApp, productName, repoRoot, guiRoot, run, stageDesktopRuntime, zipArtifactName } from './lib/desktop-runtime.mjs';

const releaseRoot = path.resolve(repoRoot, 'release', 'desktop');
const unpackedRoot = path.resolve(releaseRoot, 'win-unpacked');
const zipPath = path.resolve(releaseRoot, zipArtifactName);
const legacyGuiRelease = path.resolve(repoRoot, 'release', 'gui');
const legacySidecarBinary = path.resolve(repoRoot, 'release', 'gfos-build.exe');
const stagingRoot = path.resolve(releaseRoot, '.stage-win');
const zipStageRoot = path.resolve(releaseRoot, '.zip-stage');
const desktopExeName = 'GFOS Build.exe';

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function writePortableShortcutScripts(appRoot) {
  const addShortcutScript = `@echo off
setlocal
set "APP_DIR=%~dp0"
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ^
  "$appDir = [System.IO.Path]::GetFullPath($env:APP_DIR); " ^
  "$shortcutPath = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\GFOS Build.lnk'; " ^
  "$targetPath = Join-Path $appDir '${desktopExeName}'; " ^
  "$shell = New-Object -ComObject WScript.Shell; " ^
  "$shortcut = $shell.CreateShortcut($shortcutPath); " ^
  "$shortcut.TargetPath = $targetPath; " ^
  "$shortcut.WorkingDirectory = $appDir; " ^
  "$shortcut.Description = 'GFOS Build desktop application'; " ^
  "$shortcut.IconLocation = ($targetPath + ',0'); " ^
  "$shortcut.Save()"
if errorlevel 1 (
  echo Failed to add GFOS Build to the Start Menu.
  exit /b 1
)
echo GFOS Build has been added to the Start Menu for the current user.
`;

  const removeShortcutScript = `@echo off
setlocal
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ^
  "$shortcutPath = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\GFOS Build.lnk'; " ^
  "if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force }"
if errorlevel 1 (
  echo Failed to remove the Start Menu shortcut.
  exit /b 1
)
echo GFOS Build has been removed from the Start Menu for the current user.
`;

  fs.writeFileSync(path.join(appRoot, 'Add GFOS Build to Start Menu.cmd'), addShortcutScript, 'utf8');
  fs.writeFileSync(path.join(appRoot, 'Remove GFOS Build from Start Menu.cmd'), removeShortcutScript, 'utf8');
}

fs.mkdirSync(releaseRoot, { recursive: true });
for (const entry of fs.readdirSync(releaseRoot, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.zip')) {
    fs.rmSync(path.join(releaseRoot, entry.name), { force: true });
  }
}
fs.rmSync(legacyGuiRelease, { recursive: true, force: true });
fs.rmSync(legacySidecarBinary, { force: true });
fs.rmSync(stagingRoot, { recursive: true, force: true });
fs.rmSync(zipStageRoot, { recursive: true, force: true });

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
writePortableShortcutScripts(packagedAppPath);

console.log('\nCreating ZIP artifact...');
const portableAppRoot = path.join(zipStageRoot, `${productName} ${appVersion}`);
fs.mkdirSync(zipStageRoot, { recursive: true });
fs.cpSync(packagedAppPath, portableAppRoot, { recursive: true, force: true });

run(
  `powershell -NoProfile -Command "Compress-Archive -Path ${quotePowerShell(portableAppRoot)} -DestinationPath ${quotePowerShell(zipPath)} -Force"`,
  repoRoot,
);

const desktopExe = path.join(packagedAppPath, desktopExeName);

console.log('\nDesktop release ready:');
console.log(`  unpacked: ${packagedAppPath}`);
if (fs.existsSync(desktopExe)) {
  const stat = fs.statSync(desktopExe);
  console.log(`  exe:      ${desktopExe} (${(stat.size / 1024 / 1024).toFixed(0)} MB)`);
}
console.log(`  zip:      ${zipPath}`);

fs.rmSync(stagingRoot, { recursive: true, force: true });
fs.rmSync(zipStageRoot, { recursive: true, force: true });
