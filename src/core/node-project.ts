import path from 'node:path';
import type { FileSystem } from '../infrastructure/file-system.js';
import type { NodeMetadata, PackageManager } from './types.js';
import { parsePackageJson, type PackageParsed } from './package-parser.js';

const PACKAGE_MANAGER_LOCKFILES: Array<{ packageManager: PackageManager; filenames: string[] }> = [
  { packageManager: 'bun', filenames: ['bun.lock', 'bun.lockb'] },
  { packageManager: 'pnpm', filenames: ['pnpm-lock.yaml'] },
  { packageManager: 'npm', filenames: ['package-lock.json', 'npm-shrinkwrap.json'] },
];

export async function inspectNodeProject(fs: FileSystem, dir: string, forceAngular = false): Promise<NodeMetadata | null> {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!(await fs.exists(packageJsonPath))) return null;

  let parsed: PackageParsed = { name: path.basename(dir), scripts: {}, isAngular: forceAngular };
  try {
    parsed = parsePackageJson(await fs.readFile(packageJsonPath));
  } catch {
    // non-fatal
  }

  return {
    packageJsonPath,
    name: parsed.name,
    version: parsed.version,
    scripts: parsed.scripts,
    packageManager: await detectPackageManager(fs, dir),
    isAngular: forceAngular || parsed.isAngular,
    angularVersion: parsed.angularVersion,
  };
}

export async function detectPackageManager(fs: FileSystem, dir: string): Promise<PackageManager> {
  for (const candidate of PACKAGE_MANAGER_LOCKFILES) {
    for (const filename of candidate.filenames) {
      if (await fs.exists(path.join(dir, filename))) {
        return candidate.packageManager;
      }
    }
  }
  return 'npm';
}
