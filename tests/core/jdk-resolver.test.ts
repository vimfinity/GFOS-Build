import { describe, it, expect } from 'vitest';
import { resolveJavaHome, requireRegisteredJavaHome, detectJdks, buildEnvWithJavaHome } from '../../src/core/jdk-resolver.js';
import type { AppConfig } from '../../src/config/schema.js';
import type { FileSystem, DirEntry } from '../../src/infrastructure/file-system.js';

const config: AppConfig = {
  roots: {},
  maven: { executable: 'mvn', defaultGoals: ['clean', 'install'], defaultOptionKeys: [], defaultExtraOptions: [] },
  node: { executables: { npm: 'npm', pnpm: 'pnpm', bun: 'bun' } },
  jdkRegistry: {
    '8': 'J:/dev/java/jdk8',
    '11': 'J:/dev/java/jdk11',
    '17': 'J:/dev/java/jdk17',
    '21': 'J:/dev/java/jdk21',
  },
  scan: { includeHidden: false, exclude: [] },
  pipelines: {},
};

const emptyConfig: AppConfig = {
  ...config,
  jdkRegistry: {},
};

describe('resolveJavaHome', () => {
  it('returns the JDK path for a known version', () => {
    expect(resolveJavaHome(config, '21')).toBe('J:/dev/java/jdk21');
    expect(resolveJavaHome(config, '17')).toBe('J:/dev/java/jdk17');
  });

  it('returns undefined for an unknown version', () => {
    expect(resolveJavaHome(config, '99')).toBeUndefined();
  });

  it('returns undefined when javaVersion is undefined', () => {
    expect(resolveJavaHome(config, undefined)).toBeUndefined();
  });

  it('returns undefined for an empty registry', () => {
    expect(resolveJavaHome(emptyConfig, '21')).toBeUndefined();
  });
});

describe('requireRegisteredJavaHome', () => {
  it('returns the registered JAVA_HOME when a version exists', () => {
    expect(requireRegisteredJavaHome(config, '21')).toBe('J:/dev/java/jdk21');
  });

  it('throws when a selected Java version is not registered', () => {
    expect(() => requireRegisteredJavaHome(config, '99')).toThrow(
      'Java version "99" is not registered in the JDK registry.',
    );
  });

  it('returns undefined when no explicit Java version was selected', () => {
    expect(requireRegisteredJavaHome(config, undefined)).toBeUndefined();
  });
});

describe('buildEnvWithJavaHome', () => {
  it('adds JAVA_HOME without forwarding NODE_ENV', () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'gfos-build';

    try {
      const env = buildEnvWithJavaHome('J:/dev/java/jdk21');

      expect(env).toBeDefined();
      expect(env!['JAVA_HOME']).toBe('J:/dev/java/jdk21');
      expect(env!['NODE_ENV']).toBeUndefined();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnv;
      }
    }
  });
});

describe('detectJdks', () => {
  function createMockFs(files: Record<string, string>, dirs: Record<string, DirEntry[]>): FileSystem {
    return {
      exists: async (p: string) => p in files || p in dirs,
      readDir: async (p: string) => dirs[p] ?? [],
      readFile: async (p: string) => {
        if (p in files) return files[p]!;
        throw new Error(`File not found: ${p}`);
      },
      writeFile: async () => {},
      mkdir: async () => {},
    };
  }

  it('returns empty array for non-existent base directory', async () => {
    const fs = createMockFs({}, {});
    expect(await detectJdks('/nonexistent', fs)).toEqual([]);
  });

  it('detects JDKs by parsing release file', async () => {
    const dirEntry = (name: string): DirEntry => ({ name, isDirectory: () => true });

    // Need to handle path.join which on Windows will use backslashes
    const path = await import('node:path');
    const baseDir = 'J:/dev/java';
    const jdk21Dir = path.join(baseDir, 'jdk21');
    const javacPath = path.join(jdk21Dir, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
    const releasePath = path.join(jdk21Dir, 'release');

    const files: Record<string, string> = {
      [javacPath]: '',
      [releasePath]: 'JAVA_VERSION="21.0.1"\nOS_NAME="Windows"',
    };
    const dirs: Record<string, DirEntry[]> = {
      [baseDir]: [dirEntry('jdk21')],
    };

    const fs = createMockFs(files, dirs);
    const results = await detectJdks(baseDir, fs);

    expect(results).toHaveLength(1);
    expect(results[0]!.version).toBe('21');
    expect(results[0]!.path).toBe(jdk21Dir);
  });

  it('falls back to directory name for version when no release file', async () => {
    const dirEntry = (name: string): DirEntry => ({ name, isDirectory: () => true });
    const pathMod = await import('node:path');
    const baseDir = 'J:/dev/java';
    const jdk17Dir = pathMod.join(baseDir, 'jdk17');
    const javacPath = pathMod.join(jdk17Dir, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');

    const files: Record<string, string> = {
      [javacPath]: '',
    };
    const dirs: Record<string, DirEntry[]> = {
      [baseDir]: [dirEntry('jdk17')],
    };

    const fs = createMockFs(files, dirs);
    const results = await detectJdks(baseDir, fs);

    expect(results).toHaveLength(1);
    expect(results[0]!.version).toBe('17');
  });

  it('sorts results by version number', async () => {
    const dirEntry = (name: string): DirEntry => ({ name, isDirectory: () => true });
    const pathMod = await import('node:path');
    const baseDir = 'J:/dev/java';

    const files: Record<string, string> = {};
    const dirs: Record<string, DirEntry[]> = {
      [baseDir]: [dirEntry('jdk21'), dirEntry('jdk8'), dirEntry('jdk11')],
    };

    for (const name of ['jdk21', 'jdk8', 'jdk11']) {
      const javacPath = pathMod.join(baseDir, name, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
      files[javacPath] = '';
    }

    const fs = createMockFs(files, dirs);
    const results = await detectJdks(baseDir, fs);

    expect(results.map((r) => r.version)).toEqual(['8', '11', '21']);
  });

  it('detects a single JDK home when the selected folder is already the JDK root', async () => {
    const pathMod = await import('node:path');
    const jdkDir = 'J:/dev/java/jdk21';
    const javacPath = pathMod.join(jdkDir, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
    const releasePath = pathMod.join(jdkDir, 'release');

    const files: Record<string, string> = {
      [javacPath]: '',
      [releasePath]: 'JAVA_VERSION="21.0.2"\nOS_NAME="Windows"',
    };
    const dirs: Record<string, DirEntry[]> = {
      [jdkDir]: [],
    };

    const fs = createMockFs(files, dirs);
    const results = await detectJdks(jdkDir, fs);

    expect(results).toEqual([{ version: '21', path: jdkDir }]);
  });
});
