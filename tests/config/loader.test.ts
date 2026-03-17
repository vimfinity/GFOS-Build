import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig } from '../../packages/platform-node/src/loader.js';
import * as fs from 'node:fs';

vi.mock('node:fs', () => ({ readFileSync: vi.fn() }));

const mockedReadFileSync = fs.readFileSync as unknown as ReturnType<typeof vi.fn>;

function makeEnoent(): NodeJS.ErrnoException {
  const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
  err.code = 'ENOENT';
  return err;
}

const validConfig = JSON.stringify({
  roots: { quellen: 'J:/dev/quellen' },
  maven: { executable: 'mvn', defaultGoals: ['clean', 'install'], defaultOptionKeys: [], defaultExtraOptions: [] },
  node: { executables: { npm: 'npm', pnpm: 'pnpm', bun: 'bun' } },
  jdkRegistry: { '21': 'J:/dev/java/jdk21' },
  scan: { includeHidden: false, exclude: [] },
});

const minimalConfig = JSON.stringify({});

describe('loadConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { found: false } when no config file found', () => {
    mockedReadFileSync.mockImplementation(() => {
      throw makeEnoent();
    });
    const result = loadConfig('/nonexistent/config.json');
    expect(result.found).toBe(false);
    expect(result.config.roots).toEqual({});
    expect(result.configPath).toBe('/nonexistent/config.json');
  });

  it('loads config from explicit path', () => {
    mockedReadFileSync.mockReturnValue(validConfig);
    const result = loadConfig('/custom/config.json');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.config.roots.quellen).toBe('J:/dev/quellen');
      expect(result.configPath).toContain('config.json');
    }
  });

  it('applies defaults for a minimal config', () => {
    mockedReadFileSync.mockReturnValue(minimalConfig);
    const result = loadConfig('/custom/config.json');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.config.maven.executable).toBe('mvn');
      expect(result.config.maven.defaultGoals).toEqual(['clean', 'install']);
      expect(result.config.maven.defaultOptionKeys).toEqual([]);
      expect(result.config.maven.defaultExtraOptions).toEqual([]);
      expect(result.config.scan.includeHidden).toBe(false);
      expect(result.config.scan.exclude).toEqual([]);
    }
  });

  it('throws on invalid JSON', () => {
    mockedReadFileSync.mockReturnValue('not json{');
    expect(() => loadConfig('/custom/config.json')).toThrow(
      'Invalid JSON in local settings file',
    );
  });

  it('throws on Zod validation errors', () => {
    const badConfig = JSON.stringify({
      scan: { includeHidden: 'yes' },
    });
    mockedReadFileSync.mockReturnValue(badConfig);
    expect(() => loadConfig('/custom/config.json')).toThrow(
      'Local settings file',
    );
  });

  it('rejects root names shorter than 2 characters', () => {
    const badConfig = JSON.stringify({
      roots: { x: 'J:/dev/something' },
    });
    mockedReadFileSync.mockReturnValue(badConfig);
    expect(() => loadConfig('/custom/config.json')).toThrow(
      'Local settings file',
    );
  });

  it('rejects obsolete top-level npm config', () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        npm: { executable: 'npm' },
      }),
    );
    expect(() => loadConfig('/custom/config.json')).toThrow('Local settings file');
  });

  it('rejects embedded pipeline definitions in settings.json', () => {
    const fullConfig = JSON.stringify({
      roots: { quellen: 'J:/dev/quellen' },
      pipelines: {
        'web-2025': {
          description: 'Build web',
          failFast: true,
          steps: [
            {
              path: 'quellen:2025/web',
              buildSystem: 'maven',
              goals: ['clean', 'install'],
              optionKeys: ['skipTests'],
              profileStates: {},
              extraOptions: [],
              executionMode: 'internal',
            },
          ],
        },
      },
    });
    mockedReadFileSync.mockReturnValue(fullConfig);
    expect(() => loadConfig('/custom/config.json')).toThrow('Unrecognized key(s) in object: \'pipelines\'');
  });
});
