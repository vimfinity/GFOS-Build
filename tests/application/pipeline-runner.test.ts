import { describe, it, expect } from 'vitest';
import { PipelineRunner } from '../../src/application/pipeline-runner.js';
import { BuildRunner } from '../../src/application/build-runner.js';
import { BuildExecutor } from '../../src/core/build-executor.js';
import { NodeExecutor } from '../../src/core/node-executor.js';
import type { ProcessRunner } from '../../src/infrastructure/process-runner.js';
import type { BuildEvent, MavenBuildStep, NodeBuildStep, Pipeline, ProcessEvent } from '../../src/core/types.js';
import type { FileSystem, DirEntry } from '../../src/infrastructure/file-system.js';
import type { AppDatabase } from '../../src/infrastructure/database.js';
import path from 'node:path';

class FakeProcessRunner implements ProcessRunner {
  exitCodes: number[] = [];
  private callIndex = 0;

  spawn(): AsyncIterable<ProcessEvent> {
    const exitCode = this.exitCodes[this.callIndex] ?? 0;
    this.callIndex++;
    const events: ProcessEvent[] = [{ type: 'done', exitCode, durationMs: 100 }];
    return {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          async next() {
            if (i < events.length) return { value: events[i++]!, done: false };
            return { value: undefined as never, done: true };
          },
        };
      },
    };
  }

  launchExternal(): AsyncIterable<ProcessEvent> {
    return this.spawn();
  }
}

function createMockFs(existingFiles: string[], fileContents: Record<string, string> = {}): FileSystem {
  return {
    exists: async (p: string) => existingFiles.includes(p),
    readDir: async (): Promise<DirEntry[]> => [],
    readFile: async (p: string) => fileContents[p] ?? '',
    writeFile: async () => {},
    mkdir: async () => {},
  };
}

class NullDatabase {
  startBuildRun(): number {
    return 0;
  }
  finishBuildRun(): void {}
  getPipelineState(): { last_failed_step: number | null } | null {
    return null;
  }
  upsertPipelineState(): void {}
  getScanCache(): null {
    return null;
  }
  setScanCache(): void {}
  getRecentBuilds(): [] {
    return [];
  }
  getBuildStats() {
    return { totalBuilds: 0, successCount: 0, failureCount: 0, avgDurationMs: null, byPipeline: [], byProject: [], slowestSteps: [] };
  }
  getLastRunsByPipeline(): Record<string, { status: string; startedAt: string; durationMs: number | null }> {
    return {};
  }
  appendBuildLog(): void {}
  getBuildLogs(): [] {
    return [];
  }
  clearBuildLogs(): void {}
  clearAllBuilds(): void {}
  reconcileRunningBuilds(): void {}
  close(): void {}
}

function makeStep(label: string, stepPath?: string): MavenBuildStep {
  const p = stepPath ?? path.resolve(`/project/${label}`);
  return {
    path: p,
    buildSystem: 'maven',
    goals: ['clean', 'install'],
    optionKeys: [],
    profileStates: {},
    extraOptions: [],
    executionMode: 'internal',
    label,
    mavenExecutable: 'mvn',
  };
}

function makePipeline(steps: MavenBuildStep[], overrides: Partial<Pipeline> = {}): Pipeline {
  return {
    name: 'test-pipeline',
    failFast: true,
    steps,
    ...overrides,
  };
}

async function collectEvents(gen: AsyncGenerator<BuildEvent>): Promise<BuildEvent[]> {
  const events: BuildEvent[] = [];
  for await (const e of gen) {
    events.push(e);
  }
  return events;
}

describe('PipelineRunner', () => {
  it('runs all steps in order', async () => {
    const processRunner = new FakeProcessRunner();
    processRunner.exitCodes = [0, 0];

    const steps = [makeStep('step1'), makeStep('step2')];
    const pomFiles = steps.map((s) => path.join(s.path, 'pom.xml'));
    const fs = createMockFs(pomFiles);
    const executor = new BuildExecutor(processRunner);
    const nodeExecutor = new NodeExecutor(processRunner);
    const buildRunner = new BuildRunner(executor, nodeExecutor, fs);
    const pipelineRunner = new PipelineRunner(buildRunner, new NullDatabase() as unknown as AppDatabase);

    const pipeline = makePipeline(steps);
    const events = await collectEvents(pipelineRunner.run(pipeline));

    const startEvents = events.filter((e) => e.type === 'step:start');
    expect(startEvents).toHaveLength(2);

    const runDone = events.find((e) => e.type === 'run:done');
    expect(runDone).toBeDefined();
    if (runDone?.type === 'run:done') {
      expect(runDone.result.success).toBe(true);
      expect(runDone.result.status).toBe('success');
    }
  });

  it('stops at first failure with failFast', async () => {
    const processRunner = new FakeProcessRunner();
    processRunner.exitCodes = [1]; // first step fails

    const steps = [makeStep('step1'), makeStep('step2')];
    const pomFiles = steps.map((s) => path.join(s.path, 'pom.xml'));
    const fs = createMockFs(pomFiles);
    const executor = new BuildExecutor(processRunner);
    const nodeExecutor = new NodeExecutor(processRunner);
    const buildRunner = new BuildRunner(executor, nodeExecutor, fs);
    const pipelineRunner = new PipelineRunner(buildRunner, new NullDatabase() as unknown as AppDatabase);

    const pipeline = makePipeline(steps, { failFast: true });
    const events = await collectEvents(pipelineRunner.run(pipeline));

    const startEvents = events.filter((e) => e.type === 'step:start');
    expect(startEvents).toHaveLength(1); // only first step ran

    const runDone = events.find((e) => e.type === 'run:done');
    expect(runDone).toBeDefined();
    if (runDone?.type === 'run:done') {
      expect(runDone.result.success).toBe(false);
      expect(runDone.result.status).toBe('failed');
      expect(runDone.result.stoppedAt).toBe(0);
    }
  });

  it('skips steps before fromIndex', async () => {
    const processRunner = new FakeProcessRunner();
    processRunner.exitCodes = [0];

    const steps = [makeStep('step1'), makeStep('step2'), makeStep('step3')];
    const pomFiles = steps.map((s) => path.join(s.path, 'pom.xml'));
    const fs = createMockFs(pomFiles);
    const executor = new BuildExecutor(processRunner);
    const nodeExecutor = new NodeExecutor(processRunner);
    const buildRunner = new BuildRunner(executor, nodeExecutor, fs);
    const pipelineRunner = new PipelineRunner(buildRunner, new NullDatabase() as unknown as AppDatabase);

    const pipeline = makePipeline(steps);
    const events = await collectEvents(pipelineRunner.run(pipeline, 2));

    const startEvents = events.filter((e) => e.type === 'step:start');
    expect(startEvents).toHaveLength(1); // only step3

    if (startEvents[0]?.type === 'step:start') {
      expect(startEvents[0].index).toBe(2); // 0-based display index
    }
  });

  it('reports external-only pipelines as launched', async () => {
    const processRunner = new FakeProcessRunner();
    processRunner.exitCodes = [0];

    const step: NodeBuildStep = {
      path: 'C:/repo/app',
      buildSystem: 'node',
      label: 'app',
      commandType: 'script',
      script: 'dev',
      args: [],
      executionMode: 'external',
      nodeExecutables: { npm: 'npm', pnpm: 'pnpm', bun: 'bun' },
    };
    const packageJsonPath = path.join(step.path, 'package.json');
    const fs = createMockFs(
      [packageJsonPath],
      { [packageJsonPath]: JSON.stringify({ name: 'app', scripts: { dev: 'next dev' } }) },
    );
    const executor = new BuildExecutor(processRunner);
    const nodeExecutor = new NodeExecutor(processRunner);
    const buildRunner = new BuildRunner(executor, nodeExecutor, fs);
    const pipelineRunner = new PipelineRunner(buildRunner, new NullDatabase() as unknown as AppDatabase);

    const pipeline: Pipeline = {
      name: 'dev',
      failFast: true,
      steps: [step],
    };

    const events = await collectEvents(pipelineRunner.run(pipeline));
    const runDone = events.find((event) => event.type === 'run:done');

    expect(runDone?.type).toBe('run:done');
    if (runDone?.type === 'run:done') {
      expect(runDone.result.status).toBe('launched');
      expect(runDone.result.success).toBe(true);
      expect(runDone.result.results[0]?.status).toBe('launched');
    }
  });
});
