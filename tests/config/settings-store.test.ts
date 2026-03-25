import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SettingsStore } from '../../packages/platform-node/src/settings-store.js';
import { configSchema } from '../../packages/platform-node/src/schema.js';

describe('SettingsStore.savePatch', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('replaces wildcard environment records so deleted environments stay deleted', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'gfos-build-settings-'));
    const settingsPath = path.join(tempDir, 'settings.json');
    const store = new SettingsStore(settingsPath);

    store.save(
      configSchema.parse({
        wildfly: {
          environments: {
            local: {
              homeDir: 'C:/wildfly/home',
              baseDir: 'C:/wildfly/base',
              standaloneProfiles: {},
              cleanupPresets: {},
              startupPresets: {},
            },
            qa: {
              homeDir: 'C:/wildfly/qa-home',
              baseDir: 'C:/wildfly/qa-base',
              standaloneProfiles: {},
              cleanupPresets: {},
              startupPresets: {},
            },
          },
        },
      }),
    );

    const updated = store.savePatch({
      wildfly: {
        environments: {
          qa: {
            homeDir: 'C:/wildfly/qa-home',
            baseDir: 'C:/wildfly/qa-base',
            standaloneProfiles: {},
            cleanupPresets: {},
            startupPresets: {},
          },
        },
      },
    });

    expect(updated.wildfly.environments).toEqual({
      qa: expect.objectContaining({
        homeDir: 'C:/wildfly/qa-home',
        baseDir: 'C:/wildfly/qa-base',
      }),
    });
    expect(updated.wildfly.environments.local).toBeUndefined();
    expect(store.load().config.wildfly.environments.local).toBeUndefined();
  });
});
