import { afterEach, describe, expect, test } from 'bun:test';
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

  test('excludes launched runs from aggregated stats', () => {
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

  test('clears logs when deleting all builds', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'gfos-build-db-'));
    const db = new AppDatabase(path.join(tempDir, 'builds.sqlite'));
    try {
      const runId = db.startBuildRun({
        projectPath: 'C:/repo/app',
        projectName: 'app',
        buildSystem: 'node',
        command: 'bun run build',
      });
      db.appendBuildLog(runId, 0, 'stdout', 'hello');
      db.finishBuildRun({ id: runId, exitCode: 0, durationMs: 100, status: 'success' });

      db.clearAllBuilds();

      expect(db.getRecentBuilds({ limit: 10 })).toHaveLength(0);
      expect(db.getBuildLogs(runId).entries).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  test('paginates stored logs from newest to oldest chunks', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'gfos-build-db-'));
    const db = new AppDatabase(path.join(tempDir, 'builds.sqlite'));
    try {
      const runId = db.startBuildRun({
        projectPath: 'C:/repo/app',
        projectName: 'app',
        buildSystem: 'node',
        command: 'bun run build',
      });

      for (let seq = 0; seq < 5; seq++) {
        db.appendBuildLog(runId, seq, 'stdout', `line-${seq}`);
      }

      const latestPage = db.getBuildLogs(runId, { limit: 2 });
      expect(latestPage.entries.map((entry) => entry.line)).toEqual(['line-3', 'line-4']);
      expect(latestPage.nextBeforeSeq).toBe(3);

      const olderPage = db.getBuildLogs(runId, { limit: 2, beforeSeq: latestPage.nextBeforeSeq ?? undefined });
      expect(olderPage.entries.map((entry) => entry.line)).toEqual(['line-1', 'line-2']);
      expect(olderPage.nextBeforeSeq).toBe(1);
    } finally {
      db.close();
    }
  });
});
