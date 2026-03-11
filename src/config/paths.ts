import path from 'node:path';

export function getAppDataDir(): string {
  const base = process.env['APPDATA'] ?? process.env['HOME'] ?? '.';
  return path.join(base, 'gfos-build');
}

export function getConfigPath(): string {
  return path.join(getAppDataDir(), 'config.json');
}

export function getDbPath(): string {
  return path.join(getAppDataDir(), 'data.db');
}
