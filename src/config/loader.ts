import { readFileSync } from 'node:fs';
import path from 'node:path';
import { configSchema, type AppConfig } from './schema.js';
import { getConfigPath } from './paths.js';

export type LoadConfigResult =
  | { found: true; config: AppConfig; configPath: string }
  | { found: false };

export function loadConfig(overridePath?: string): LoadConfigResult {
  const candidates: string[] = [];

  if (overridePath) {
    candidates.push(path.resolve(overridePath));
  } else {
    candidates.push(path.join(process.cwd(), 'gfos-build.config.json'));
    candidates.push(getConfigPath());
  }

  for (const candidate of candidates) {
    let raw: string;
    try {
      raw = readFileSync(candidate, 'utf-8');
    } catch (err: unknown) {
      if (isEnoent(err)) continue;
      throw new Error(`Failed to read config at "${candidate}": ${String(err)}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in config file "${candidate}". Check for syntax errors.`);
    }

    const result = configSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.errors
        .map((e) => `  ${e.path.join('.')} — ${e.message}`)
        .join('\n');
      throw new Error(`Config validation errors in "${candidate}":\n${issues}`);
    }

    return { found: true, config: result.data, configPath: candidate };
  }

  return { found: false };
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
