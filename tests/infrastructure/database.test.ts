import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AppDatabase } from '../../packages/platform-node/src/database.js';

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
      const successRunId = db.createRun({ kind: 'quick', title: 'app' });
      const successId = db.createStepRun({
        runId: successRunId,
        projectPath: 'C:/repo/app',
        projectName: 'app',
        buildSystem: 'node',
        command: 'bun run build',
        stepLabel: 'app',
      });
      db.finishStepRun({ id: successId, exitCode: 0, durationMs: 1800, status: 'success' });
      db.finishRun({ id: successRunId, durationMs: 1800, status: 'success' });

      const launchedRunId = db.createRun({ kind: 'quick', title: 'app' });
      const launchedId = db.createStepRun({
        runId: launchedRunId,
        projectPath: 'C:/repo/app',
        projectName: 'app',
        buildSystem: 'node',
        executionMode: 'external',
        command: 'bun run dev',
        stepLabel: 'app',
      });
      db.finishStepRun({ id: launchedId, exitCode: 0, durationMs: 30, status: 'launched' });
      db.finishRun({ id: launchedRunId, durationMs: 30, status: 'launched' });

      const stats = db.getBuildStats();

      expect(stats.totalBuilds).toBe(1);
      expect(stats.successCount).toBe(1);
      expect(stats.failureCount).toBe(0);
      expect(stats.byProject).toEqual([
        expect.objectContaining({ path: 'C:/repo/app', runs: 2, successes: 1 }),
      ]);
    } finally {
      db.close();
    }
  });

  it('clears logs when deleting all builds', { timeout: 15_000 }, () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'gfos-build-db-'));
    const db = new AppDatabase(path.join(tempDir, 'builds.sqlite'));
    try {
      const pipelineRunId = db.createRun({ kind: 'quick', title: 'app' });
      const runId = db.createStepRun({
        runId: pipelineRunId,
        projectPath: 'C:/repo/app',
        projectName: 'app',
        buildSystem: 'node',
        command: 'bun run build',
        stepLabel: 'app',
      });
      db.appendStepLog(runId, 0, 'stdout', 'hello');
      db.finishStepRun({ id: runId, exitCode: 0, durationMs: 100, status: 'success' });
      db.finishRun({ id: pipelineRunId, durationMs: 100, status: 'success' });

      db.clearAllBuilds();

      expect(db.getRecentRuns({ limit: 10 })).toHaveLength(0);
      expect(db.getBuildLogs(runId).entries).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('paginates stored logs from newest to oldest chunks', { timeout: 15_000 }, () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'gfos-build-db-'));
    const db = new AppDatabase(path.join(tempDir, 'builds.sqlite'));
    try {
      const pipelineRunId = db.createRun({ kind: 'quick', title: 'app' });
      const runId = db.createStepRun({
        runId: pipelineRunId,
        projectPath: 'C:/repo/app',
        projectName: 'app',
        buildSystem: 'node',
        command: 'bun run build',
        stepLabel: 'app',
      });

      for (let seq = 0; seq < 5; seq++) {
        db.appendStepLog(runId, seq, 'stdout', `line-${seq}`);
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

  it('stores deployment workflows as first-class generic workflow definitions', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'gfos-build-db-'));
    const db = new AppDatabase(path.join(tempDir, 'builds.sqlite'));
    try {
      db.saveDeploymentWorkflowDefinition('local-web', {
        projectPath: 'C:/repo/web',
        build: {
          goals: ['clean', 'install'],
          optionKeys: [],
          profileStates: {},
          extraOptions: [],
          submoduleBuildStrategy: 'root-pl',
        },
        artifactSelector: { kind: 'auto' },
        environmentName: 'local',
        standaloneProfileName: 'dev',
        deployMode: 'filesystem-scanner',
        startServer: true,
      });

      expect(db.listDeploymentWorkflowDefinitions()).toEqual([
        expect.objectContaining({ name: 'local-web' }),
      ]);
      expect(db.getDeploymentWorkflowDefinition('local-web')?.definition.environmentName).toBe('local');
    } finally {
      db.close();
    }
  });
});
