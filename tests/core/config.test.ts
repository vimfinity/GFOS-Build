import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig } from '../../src/config/config.js';

describe('loadConfig', () => {
  it('liefert Defaults wenn keine Datei existiert', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'gfos-build-'));
    const configPath = path.join(dir, 'missing.json');

    const config = await loadConfig(configPath);

    expect(config.roots).toEqual(['.']);
    expect(config.scan.maxDepth).toBe(4);
    expect(config.build.failFast).toBe(true);
    expect(config.build.maxParallel).toBe(1);
    expect(config.build.toolchains).toEqual([]);
    expect(config.scan.cacheEnabled).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });

  it('lädt und validiert gültige Konfiguration', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'gfos-build-'));
    const configPath = path.join(dir, 'gfos-build.config.json');

    writeFileSync(
      configPath,
      JSON.stringify({
        roots: ['J:/dev/quellen'],
        scan: { maxDepth: 6, includeHidden: true, cacheEnabled: true, cacheTtlSec: 900 },
        build: {
          goals: ['clean', 'verify'],
          mavenExecutable: 'mvnw',
          javaHome: 'J:/dev/java/jdk21',
          toolchains: [
            { selector: 'legacy', javaHome: 'J:/dev/java/jdk11' },
            { selector: 'web', mavenExecutable: 'J:/dev/maven/mvn3/bin/mvn.cmd' }
          ],
          failFast: false,
          maxParallel: 4
        },
      })
    );

    const config = await loadConfig(configPath);

    expect(config.roots).toEqual(['J:/dev/quellen']);
    expect(config.scan.maxDepth).toBe(6);
    expect(config.scan.includeHidden).toBe(true);
    expect(config.build.goals).toEqual(['clean', 'verify']);
    expect(config.build.mavenExecutable).toBe('mvnw');
    expect(config.build.javaHome).toBe('J:/dev/java/jdk21');
    expect(config.build.toolchains).toHaveLength(2);
    expect(config.build.failFast).toBe(false);
    expect(config.build.maxParallel).toBe(4);
    expect(config.scan.cacheEnabled).toBe(true);
    expect(config.scan.cacheTtlSec).toBe(900);

    rmSync(dir, { recursive: true, force: true });
  });
});
