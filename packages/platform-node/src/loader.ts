import { rmSync } from 'node:fs';
import path from 'node:path';
import { SettingsStore, type LoadSettingsResult } from './settings-store.js';
import { getCacheDir, getConfigPath, getDataDir } from './paths.js';
import type { AppConfig } from './schema.js';

export type LoadConfigResult =
  | { found: true; config: AppConfig; configPath: string }
  | { found: false; config: AppConfig; configPath: string };

export function loadSettings(overridePath?: string): LoadSettingsResult {
  const store = new SettingsStore(overridePath ?? getConfigPath());
  return store.load();
}

export function loadConfig(overridePath?: string): LoadConfigResult {
  return loadSettings(overridePath);
}

export function saveSettings(config: AppConfig, overridePath?: string): void {
  const store = new SettingsStore(overridePath ?? getConfigPath());
  store.save(config);
}

export function saveConfig(config: AppConfig, overridePath?: string): void {
  saveSettings(config, overridePath);
}

export function saveConfigPatch(patch: Record<string, unknown>, overridePath?: string): AppConfig {
  const store = new SettingsStore(overridePath ?? getConfigPath());
  return store.savePatch(patch);
}

export function ensureSettingsFile(config: AppConfig, overridePath?: string): void {
  saveSettings(config, overridePath ?? getConfigPath());
}

export function resetLocalState(rootDir: string): void {
  rmSync(getConfigPath(rootDir), { force: true });
  rmSync(getDataDir(rootDir), { recursive: true, force: true });
  rmSync(getCacheDir(rootDir), { recursive: true, force: true });
  const configDir = path.dirname(getConfigPath(rootDir));
  rmSync(configDir, { recursive: true, force: true });
}
