import { describe, expect, it } from 'vitest';
import { mkdtempSync, chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function createFixtureWorkspace(): { workspaceRoot: string; mavenMockPath: string; mavenLogPath: string } {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'gfos-build-phase1-'));

  mkdirSync(path.join(workspaceRoot, '2025', 'web', 'module-a'), { recursive: true });
  mkdirSync(path.join(workspaceRoot, '2025', 'shared'), { recursive: true });

  writeFileSync(path.join(workspaceRoot, '2025', 'web', 'pom.xml'), '<project />');
  writeFileSync(path.join(workspaceRoot, '2025', 'web', 'module-a', 'pom.xml'), '<project />');
  writeFileSync(path.join(workspaceRoot, '2025', 'shared', 'pom.xml'), '<project />');

  const mavenMockPath = path.join(workspaceRoot, 'mvn-mock.sh');
  const mavenLogPath = path.join(workspaceRoot, 'maven-runs.log');

  writeFileSync(
    mavenMockPath,
    '#!/usr/bin/env bash\nset -euo pipefail\necho "${PWD}|$*" >> "${GFOS_MVN_LOG}"\necho "[mvn-stdout] building ${PWD}"\necho "[mvn-stderr] building ${PWD}" 1>&2\nexit 0\n'
  );
  chmodSync(mavenMockPath, 0o755);

  return { workspaceRoot, mavenMockPath, mavenLogPath };
}

function runCli(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync('bun', ['run', 'src/cli/index.ts', ...args], {
    encoding: 'utf-8',
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      GFOS_DISABLE_RUN_HISTORY: '1',
      ...env,
    },
  });
}

describe('CLI Phase-1 integration', () => {
  it('liefert bei --plan einen Build-Report ohne Maven-Ausführung', () => {
    const { workspaceRoot, mavenMockPath, mavenLogPath } = createFixtureWorkspace();

    const result = runCli(
      [
        'build',
        '--root',
        workspaceRoot,
        '--max-depth',
        '6',
        '--goals',
        'clean verify',
        '--mvn',
        mavenMockPath,
        '--plan',
        '--json',
      ],
      { GFOS_MVN_LOG: mavenLogPath }
    );

    try {
      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        schemaVersion: string;
        command: string;
        mode: string;
        events: unknown[];
        buildResults: unknown[];
        stats: {
          plannedCount: number;
          builtCount: number;
          totalBuildDurationMs: number;
          failedBuildDurationMs: number;
        };
      };

      expect(report.schemaVersion).toBe('1.1');
      expect(report.command).toBe('build');
      expect(report.mode).toBe('build-plan');
      expect(report.events.length).toBeGreaterThan(0);
      expect(report.buildResults).toHaveLength(0);
      expect(report.stats.plannedCount).toBe(2);
      expect(report.stats.builtCount).toBe(0);
      expect(report.stats.totalBuildDurationMs).toBe(0);
      expect(report.stats.failedBuildDurationMs).toBe(0);
      expect(() => readFileSync(mavenLogPath, 'utf-8')).toThrow();
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('führt geplante Repositories aus und schreibt konsistente Stats', () => {
    const { workspaceRoot, mavenMockPath, mavenLogPath } = createFixtureWorkspace();

    const result = runCli(
      [
        'build',
        '--root',
        workspaceRoot,
        '--max-depth',
        '6',
        '--goals',
        'clean verify',
        '--mvn',
        mavenMockPath,
        '--json',
      ],
      { GFOS_MVN_LOG: mavenLogPath }
    );

    try {
      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        schemaVersion: string;
        command: string;
        mode: string;
        events: unknown[];
        buildResults: Array<{ exitCode: number }>;
        stats: {
          plannedCount: number;
          builtCount: number;
          succeededCount: number;
          failedCount: number;
          totalBuildDurationMs: number;
          failedBuildDurationMs: number;
        };
      };

      expect(report.schemaVersion).toBe('1.1');
      expect(report.command).toBe('build');
      expect(report.mode).toBe('build-run');
      expect(report.events.length).toBeGreaterThan(0);
      expect(report.buildResults).toHaveLength(2);
      expect(report.stats.plannedCount).toBe(2);
      expect(report.stats.builtCount).toBe(2);
      expect(report.stats.succeededCount).toBe(2);
      expect(report.stats.failedCount).toBe(0);
      expect(report.stats.totalBuildDurationMs).toBeGreaterThanOrEqual(0);
      expect(report.stats.failedBuildDurationMs).toBe(0);
      expect(result.stderr).not.toContain('[mvn-stdout]');
      expect(result.stderr).not.toContain('[mvn-stderr]');

      const mavenRuns = readFileSync(mavenLogPath, 'utf-8')
        .trim()
        .split('\n')
        .filter(Boolean);

      expect(mavenRuns).toHaveLength(2);
      expect(mavenRuns[0]).toContain('clean verify');
      expect(mavenRuns[1]).toContain('clean verify');
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });


  it('leitet Maven-Logs bei --json nur mit --verbose auf stderr weiter', () => {
    const { workspaceRoot, mavenMockPath, mavenLogPath } = createFixtureWorkspace();

    const result = runCli(
      [
        'build',
        '--root',
        workspaceRoot,
        '--max-depth',
        '6',
        '--goals',
        'clean verify',
        '--mvn',
        mavenMockPath,
        '--json',
        '--verbose',
      ],
      { GFOS_MVN_LOG: mavenLogPath }
    );

    try {
      expect(result.status).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
      expect(result.stderr).toContain('[mvn-stdout]');
      expect(result.stderr).toContain('[mvn-stderr]');
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('liefert bei leerem Scan für build --plan weiterhin build-plan statt scan', () => {
    const result = runCli([
      'build',
      '--root',
      'Z:/__does_not_exist__',
      '--scope',
      'explicit-modules',
      '--module',
      'web',
      '--plan',
      '--json',
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      command: string;
      mode: string;
      buildPlan?: { repositories: Array<{ path: string }>; scope: string };
      discovered: unknown[];
    };

    expect(report.command).toBe('build');
    expect(report.mode).toBe('build-plan');
    expect(report.discovered).toHaveLength(0);
    expect(report.buildPlan?.scope).toBe('explicit-modules');
    expect(report.buildPlan?.repositories).toHaveLength(0);
  });


  it('beendet CLI mit Exit-Code 2 bei unbekanntem command', () => {
    const result = runCli(['deploy']);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Unbekannter Befehl');
  });

  it('liefert Exit-Code 3 bei ungültiger Konfiguration', () => {
    const { workspaceRoot } = createFixtureWorkspace();
    const configPath = path.join(workspaceRoot, 'gfos-build.config.json');
    writeFileSync(configPath, '{ invalid json');

    const result = runCli(['scan', '--config', configPath, '--json']);

    try {
      expect(result.status).toBe(3);
      expect(result.stderr).toContain('CONFIG_INVALID');
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('liefert Exit-Code 4 bei ungültiger Pipeline-Definition', () => {
    const { workspaceRoot } = createFixtureWorkspace();
    const pipelinePath = path.join(workspaceRoot, 'pipeline.json');
    writeFileSync(pipelinePath, JSON.stringify({ schemaVersion: '1.0', stages: [{ name: 'broken', scope: 'explicit-modules', goals: ['verify'] }] }));

    const result = runCli(['pipeline', 'lint', '--root', workspaceRoot, '--pipeline', pipelinePath, '--json']);

    try {
      expect(result.status).toBe(4);
      expect(result.stderr).toContain('PIPELINE_INVALID');
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

});
