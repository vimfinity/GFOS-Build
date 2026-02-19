import { describe, expect, it } from 'vitest';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function createFixtureWorkspace() {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'gfos-build-pipeline-'));
  mkdirSync(path.join(workspaceRoot, 'repos', 'shared'), { recursive: true });
  mkdirSync(path.join(workspaceRoot, 'repos', 'web', 'module-a'), { recursive: true });

  writeFileSync(path.join(workspaceRoot, 'repos', 'shared', 'pom.xml'), '<project />');
  writeFileSync(path.join(workspaceRoot, 'repos', 'web', 'pom.xml'), '<project />');
  writeFileSync(path.join(workspaceRoot, 'repos', 'web', 'module-a', 'pom.xml'), '<project />');

  const mavenMockPath = path.join(workspaceRoot, 'mvn-mock.sh');
  const mavenLogPath = path.join(workspaceRoot, 'maven-runs.log');
  const pipelinePath = path.join(workspaceRoot, 'pipeline.json');

  writeFileSync(
    mavenMockPath,
    '#!/usr/bin/env bash\nset -euo pipefail\necho "${PWD}|$*" >> "${GFOS_MVN_LOG}"\nexit 0\n'
  );
  chmodSync(mavenMockPath, 0o755);

  writeFileSync(
    pipelinePath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        mavenExecutable: mavenMockPath,
        stages: [
          {
            name: 'shared-first',
            scope: 'explicit-modules',
            modules: ['shared'],
            goals: ['clean', 'install'],
          },
          {
            name: 'web-root',
            scope: 'root-only',
            goals: ['verify'],
            maxParallel: 2,
          },
        ],
      },
      null,
      2
    )
  );

  return { workspaceRoot, pipelinePath, mavenLogPath };
}

function runCli(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync('bun', ['run', 'src/cli/index.ts', ...args], {
    encoding: 'utf-8',
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      ...env,
    },
  });
}

describe('pipeline integration', () => {

  it('pipeline lint validiert Definition ohne Ausführung', () => {
    const { workspaceRoot, pipelinePath, mavenLogPath } = createFixtureWorkspace();

    const result = runCli(
      ['pipeline', 'lint', '--root', workspaceRoot, '--max-depth', '6', '--pipeline', pipelinePath, '--json'],
      { GFOS_MVN_LOG: mavenLogPath }
    );

    try {
      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as { mode: string; buildResults: unknown[] };
      expect(report.mode).toBe('pipeline-lint');
      expect(report.buildResults).toHaveLength(0);
      expect(() => readFileSync(mavenLogPath, 'utf-8')).toThrow();
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('pipeline plan liefert Stage-Pläne ohne Ausführung', () => {
    const { workspaceRoot, pipelinePath, mavenLogPath } = createFixtureWorkspace();

    const result = runCli(
      ['pipeline', 'plan', '--root', workspaceRoot, '--max-depth', '6', '--pipeline', pipelinePath, '--json'],
      { GFOS_MVN_LOG: mavenLogPath }
    );

    try {
      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        schemaVersion: string;
        command: string;
        mode: string;
        events: unknown[];
        stats: { discoveredCount: number; plannedCount: number };
        pipeline?: { action: string; stages: Array<{ stageName: string; plan: { repositories: unknown[] } }> };
      };

      expect(report.schemaVersion).toBe('1.1');
      expect(report.command).toBe('pipeline');
      expect(report.mode).toBe('pipeline-plan');
      expect(report.pipeline?.action).toBe('plan');
      expect(report.pipeline?.stages).toHaveLength(2);
      expect(report.pipeline?.stages[0]?.plan.repositories).toHaveLength(1);
      expect(report.pipeline?.stages[1]?.plan.repositories.length).toBeGreaterThanOrEqual(2);
      expect(report.events.length).toBeGreaterThan(0);
      expect(report.stats.plannedCount).toBeGreaterThanOrEqual(3);
      expect(() => readFileSync(mavenLogPath, 'utf-8')).toThrow();
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });


  it('pipeline lint meldet semantische Fehler mit Exit-Code 4', () => {
    const { workspaceRoot, mavenLogPath } = createFixtureWorkspace();
    const pipelinePath = path.join(workspaceRoot, 'pipeline-invalid.json');
    writeFileSync(
      pipelinePath,
      JSON.stringify(
        {
          schemaVersion: '1.0',
          stages: [
            { name: 'dup', scope: 'explicit-modules', modules: ['shared'], goals: ['verify'] },
            { name: 'dup', scope: 'explicit-modules', goals: ['verify'] },
          ],
        },
        null,
        2
      )
    );

    const result = runCli(
      ['pipeline', 'lint', '--root', workspaceRoot, '--max-depth', '6', '--pipeline', pipelinePath, '--json'],
      { GFOS_MVN_LOG: mavenLogPath }
    );

    try {
      expect(result.status).toBe(4);
      expect(result.stderr).toContain('PIPELINE_INVALID');
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('pipeline run führt Stages sequentiell aus', () => {
    const { workspaceRoot, pipelinePath, mavenLogPath } = createFixtureWorkspace();

    const result = runCli(
      ['pipeline', 'run', '--root', workspaceRoot, '--max-depth', '6', '--pipeline', pipelinePath, '--json'],
      { GFOS_MVN_LOG: mavenLogPath }
    );

    try {
      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        schemaVersion: string;
        command: string;
        mode: string;
        pipeline?: { action: string; stages: Array<{ buildResults: unknown[]; speedupFactor?: number; plan: { maxParallel: number } }> };
        stats: {
          builtCount: number;
          maxParallelUsed: number;
          totalBuildDurationMs: number;
          failedBuildDurationMs: number;
        };
      };

      expect(report.schemaVersion).toBe('1.1');
      expect(report.command).toBe('pipeline');
      expect(report.mode).toBe('pipeline-run');
      expect(report.pipeline?.action).toBe('run');
      expect(report.pipeline?.stages).toHaveLength(2);
      expect(report.stats.builtCount).toBeGreaterThanOrEqual(3);
      expect(report.stats.maxParallelUsed).toBe(2);
      expect(report.stats.totalBuildDurationMs).toBeGreaterThanOrEqual(0);
      expect(report.stats.failedBuildDurationMs).toBe(0);
      expect(report.pipeline?.stages[1]?.plan.maxParallel).toBe(2);

      const mavenRuns = readFileSync(mavenLogPath, 'utf-8').trim().split('\n').filter(Boolean);
      expect(mavenRuns.length).toBeGreaterThanOrEqual(3);
      expect(mavenRuns[0]).toContain('/repos/shared');
    } finally {
      try {
        unlinkSync(mavenLogPath);
      } catch {
        // ignore cleanup errors
      }
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
