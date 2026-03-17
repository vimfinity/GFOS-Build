#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const guiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(guiRoot, '..');
const require = createRequire(import.meta.url);

const guiPackageJson = require(path.join(guiRoot, 'package.json'));
const productName = guiPackageJson.productName ?? 'GFOS Build';
const appVersion = guiPackageJson.version;
const zipArtifactName = `GFOS-Build-${appVersion}-win32-x64.zip`;
const desktopExeName = 'GFOS Build.exe';
const releaseRoot = path.resolve(repoRoot, 'release', 'desktop');
const unpackedRoot = path.resolve(releaseRoot, 'win-unpacked');
const managedReleaseRoot = path.resolve(releaseRoot, 'managed');
const zipPath = path.resolve(releaseRoot, zipArtifactName);
const zipStageRoot = path.resolve(releaseRoot, '.zip-stage');
const legacyGuiRelease = path.resolve(repoRoot, 'release', 'gui');
const legacySidecarBinary = path.resolve(repoRoot, 'release', 'gfos-build.exe');

function run(command, cwd) {
  execSync(command, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
}

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

function cleanupReleaseDirs() {
  fs.mkdirSync(releaseRoot, { recursive: true });
  for (const entry of fs.readdirSync(releaseRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.zip')) {
      fs.rmSync(path.join(releaseRoot, entry.name), { force: true });
    }
  }
  fs.rmSync(legacyGuiRelease, { recursive: true, force: true });
  fs.rmSync(legacySidecarBinary, { force: true });
  fs.rmSync(unpackedRoot, { recursive: true, force: true });
  fs.rmSync(managedReleaseRoot, { recursive: true, force: true });
  fs.rmSync(zipStageRoot, { recursive: true, force: true });
}

function stagePortableFolder() {
  const managedUnpackedRoot = path.join(managedReleaseRoot, 'win-unpacked');
  if (!fs.existsSync(managedUnpackedRoot)) {
    throw new Error(`Expected electron-builder unpacked output at ${managedUnpackedRoot}`);
  }

  fs.cpSync(managedUnpackedRoot, unpackedRoot, { recursive: true, force: true });
  writePortableShortcutScripts(unpackedRoot);

  const portableAppRoot = path.join(zipStageRoot, `${productName} ${appVersion}`);
  fs.mkdirSync(zipStageRoot, { recursive: true });
  fs.cpSync(unpackedRoot, portableAppRoot, { recursive: true, force: true });

  run(
    `powershell -NoProfile -Command "Compress-Archive -Path ${quotePowerShell(portableAppRoot)} -DestinationPath ${quotePowerShell(zipPath)} -Force"`,
    repoRoot,
  );
}

cleanupReleaseDirs();

console.log('Building desktop bundles...');
run('bun run build', guiRoot);

console.log('\nCreating unpacked desktop app...');
run('bunx electron-builder --config electron-builder.yml --dir --win --x64 --publish never', guiRoot);

console.log('\nCreating ZIP artifact...');
stagePortableFolder();

console.log('\nCreating managed installer...');
run('bunx electron-builder --config electron-builder.yml --win nsis --x64 --publish never', guiRoot);

console.log('\nCleaning managed release artifacts...');
run('node scripts/cleanup-managed-release.mjs', guiRoot);

const desktopExe = path.join(unpackedRoot, desktopExeName);

console.log('\nDesktop release ready:');
console.log(`  unpacked: ${unpackedRoot}`);
if (fs.existsSync(desktopExe)) {
  const stat = fs.statSync(desktopExe);
  console.log(`  exe:      ${desktopExe} (${(stat.size / 1024 / 1024).toFixed(0)} MB)`);
}
console.log(`  zip:      ${zipPath}`);

fs.rmSync(zipStageRoot, { recursive: true, force: true });
