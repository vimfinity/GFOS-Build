import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AppRuntime, StateCompatibilityError } from '../../packages/platform-node/src/index.js';

describe('AppRuntime', () => {
  it('fails fast when settings are invalid', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'gfos-build-runtime-'));
    try {
      const settingsPath = path.join(tempDir, 'config', 'settings.json');
      mkdirSync(path.dirname(settingsPath), { recursive: true });
      writeFileSync(settingsPath, '{"scan":{"includeHidden":"yes"}}', 'utf8');

      expect(
        () =>
          new AppRuntime({
            version: 'test',
            stateRootDir: tempDir,
            settingsPath,
          }),
      ).toThrow(StateCompatibilityError);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
