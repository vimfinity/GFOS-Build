import path from 'node:path';

export function getDefaultStateRootDir(): string {
  const base = process.env['APPDATA'] ?? process.env['HOME'] ?? '.';
  return path.join(base, 'gfos-build');
}

export function getStateRootDir(rootDir = getDefaultStateRootDir()): string {
  return rootDir;
}

export function getConfigDir(rootDir = getDefaultStateRootDir()): string {
  return path.join(getStateRootDir(rootDir), 'config');
}

export function getConfigPath(rootDir = getDefaultStateRootDir()): string {
  return path.join(getConfigDir(rootDir), 'settings.json');
}

export function getDataDir(rootDir = getDefaultStateRootDir()): string {
  return path.join(getStateRootDir(rootDir), 'data');
}

export function getDbPath(rootDir = getDefaultStateRootDir()): string {
  return path.join(getDataDir(rootDir), 'state.sqlite');
}

export function getCacheDir(rootDir = getDefaultStateRootDir()): string {
  return path.join(getStateRootDir(rootDir), 'cache');
}

export function getScanCacheDir(rootDir = getDefaultStateRootDir()): string {
  return path.join(getCacheDir(rootDir), 'scan');
}

export function getSessionDataDir(rootDir = getDefaultStateRootDir()): string {
  return path.join(getCacheDir(rootDir), 'chromium');
}
