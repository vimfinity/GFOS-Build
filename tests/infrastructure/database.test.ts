import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AppDatabase } from '../../src/infrastructure/database.js';

describe('AppDatabase', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // SQLite WAL files can stay locked briefly on Windows; ignore temp cleanup failures in tests.
      }
      tempDir = undefined;
    }
  });

  it('excludes launched runs from aggregated stats', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'gfos-build-db-'));
    const db = new AppDatabase(path.join(tempDir, 'builds.sqlite'));
    try {
      const successId = db.startBuildRun({
        projectPath: 'C:/repo/app',
        projectName: 'app',
        buildSystem: 'node',
        command: 'bun run build',
      });
      db.finishBuildRun({ id: successId, exitCode: 0, durationMs: 1800, status: 'success' });

      const launchedId = db.startBuildRun({
        projectPath: 'C:/repo/app',
        projectName: 'app',
        buildSystem: 'node',
        executionMode: 'external',
        command: 'bun run dev',
      });
      db.finishBuildRun({ id: launchedId, exitCode: 0, durationMs: 30, status: 'launched' });

      const stats = db.getBuildStats();

      expect(stats.totalBuilds).toBe(1);
      expect(stats.successCount).toBe(1);
      expect(stats.failureCount).toBe(0);
      expect(stats.byProject).toEqual([
        expect.objectContaining({ path: 'C:/repo/app', runs: 1, successes: 1 }),
      ]);
    } finally {
      db.close();
    }
  });
});
