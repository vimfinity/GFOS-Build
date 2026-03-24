import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { configSchema, type AppConfig } from './schema.js';
import { StateCompatibilityError } from './state-errors.js';

export interface LoadSettingsResult {
  found: boolean;
  config: AppConfig;
  configPath: string;
}

export class SettingsStore {
  constructor(private readonly settingsPath: string) {}

  load(): LoadSettingsResult {
    try {
      const raw = readFileSync(this.settingsPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      const result = configSchema.safeParse(parsed);
      if (!result.success) {
        throw new StateCompatibilityError(formatValidationError(this.settingsPath, result.error.issues));
      }
      return {
        found: true,
        config: result.data,
        configPath: this.settingsPath,
      };
    } catch (error) {
      if (isEnoent(error)) {
        return {
          found: false,
          config: configSchema.parse({}),
          configPath: this.settingsPath,
        };
      }
      if (error instanceof SyntaxError) {
        throw new StateCompatibilityError(`Invalid JSON in local settings file "${this.settingsPath}".`);
      }
      if (error instanceof StateCompatibilityError) {
        throw error;
      }
      throw new StateCompatibilityError(
        error instanceof Error ? error.message : 'Local settings could not be read.',
      );
    }
  }

  save(config: AppConfig): void {
    const result = configSchema.safeParse(config);
    if (!result.success) {
      throw new Error(formatSaveValidationError(result.error.issues));
    }
    const validated = result.data;
    mkdirSync(path.dirname(this.settingsPath), { recursive: true });
    const tempPath = `${this.settingsPath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
    renameSync(tempPath, this.settingsPath);
  }

  savePatch(patch: Record<string, unknown>): AppConfig {
    const current = this.load().config;
    const merged = mergePlainObjects(current as Record<string, unknown>, patch);
    const result = configSchema.safeParse(merged);
    if (!result.success) {
      throw new Error(formatSaveValidationError(result.error.issues));
    }
    const validated = result.data;
    this.save(validated);
    return validated;
  }

  reset(): void {
    rmSync(this.settingsPath, { force: true });
  }
}

function mergePlainObjects(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(next[key])) {
      next[key] = mergePlainObjects(next[key] as Record<string, unknown>, value);
      continue;
    }
    next[key] = value;
  }
  return next;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValidationError(
  settingsPath: string,
  issues: Array<{ path: PropertyKey[]; message: string }>,
): string {
  const detail = issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
  return `Local settings file "${settingsPath}" is invalid. ${detail}`;
}

function formatSaveValidationError(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): string {
  const detail = issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
  return `Settings update is invalid. ${detail}`;
}

function isEnoent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
