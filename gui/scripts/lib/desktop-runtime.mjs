import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packager } from '@electron/packager';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export const guiRoot = path.resolve(__dirname, '..', '..');
export const repoRoot = path.resolve(guiRoot, '..');
export const guiPackageJson = require(path.join(guiRoot, 'package.json'));
export const productName = guiPackageJson.productName ?? 'GFOS Build';
export const electronVersion = require('electron/package.json').version;

export function run(command, cwd) {
  execSync(command, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
}

function resolveModuleDir(specifier, fromPath) {
  return fs.realpathSync(path.dirname(require.resolve(`${specifier}/package.json`, { paths: [fromPath] })));
}

function copyRuntimeModule(specifier, sourceDir, targetNodeModules) {
  const destDir = path.join(targetNodeModules, specifier);
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  fs.cpSync(sourceDir, destDir, { recursive: true, force: true });
}

export function stageDesktopRuntime(stageRoot) {
  fs.rmSync(stageRoot, { recursive: true, force: true });
  fs.mkdirSync(stageRoot, { recursive: true });
  fs.cpSync(path.join(guiRoot, 'out'), path.join(stageRoot, 'out'), { recursive: true, force: true });

  const assetsDir = path.join(stageRoot, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'assets', 'icon.ico'), path.join(assetsDir, 'icon.ico'));

  fs.writeFileSync(
    path.join(stageRoot, 'package.json'),
    JSON.stringify(
      {
        name: 'gfos-build-desktop',
        productName,
        version: guiPackageJson.version,
        private: true,
        description: guiPackageJson.description,
        main: 'out/main/index.js',
        dependencies: {
          'better-sqlite3': guiPackageJson.dependencies['better-sqlite3'],
          ws: guiPackageJson.dependencies.ws,
          bindings: '^1.5.0',
          'file-uri-to-path': '^1.0.0',
        },
      },
      null,
      2,
    ) + '\n',
  );

  const stagedNodeModules = path.join(stageRoot, 'node_modules');
  const betterSqlite3Dir = resolveModuleDir('better-sqlite3', guiRoot);
  const wsDir = resolveModuleDir('ws', guiRoot);
  const bindingsDir = fs.realpathSync(path.join(betterSqlite3Dir, '..', 'bindings'));
  const fileUriToPathDir = resolveModuleDir('file-uri-to-path', bindingsDir);

  copyRuntimeModule('better-sqlite3', betterSqlite3Dir, stagedNodeModules);
  copyRuntimeModule('ws', wsDir, stagedNodeModules);
  copyRuntimeModule('bindings', bindingsDir, stagedNodeModules);
  copyRuntimeModule('file-uri-to-path', fileUriToPathDir, stagedNodeModules);
}

export async function packageDesktopApp({ stageRoot, outDir }) {
  return packager({
    dir: stageRoot,
    name: productName,
    platform: 'win32',
    arch: 'x64',
    electronVersion,
    out: outDir,
    overwrite: true,
    prune: false,
    icon: path.resolve(repoRoot, 'assets', 'icon.ico'),
    asar: {
      unpack: '**/*.node',
    },
    ignore: [/\/src\//, /\/scripts\//, /\.git/, /tsconfig/],
  });
}
