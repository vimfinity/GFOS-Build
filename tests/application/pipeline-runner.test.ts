import { describe, it, expect } from 'vitest';
import { PipelineRunner } from '../../src/application/pipeline-runner.js';
import { BuildRunner } from '../../src/application/build-runner.js';
import { BuildExecutor } from '../../src/core/build-executor.js';
import { NpmExecutor } from '../../src/core/npm-executor.js';
import type { ProcessRunner } from '../../src/infrastructure/process-runner.js';
import type { ProcessEvent, BuildStep, BuildEvent, Pipeline } from '../../src/core/types.js';
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
}

function createMockFs(existingFiles: string[]): FileSystem {
  return {
    exists: async (p: string) => existingFiles.includes(p),
    readDir: async (): Promise<DirEntry[]> => [],
    readFile: async () => '',
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
  close(): void {}
}

function makeStep(label: string, stepPath?: string): BuildStep {
  const p = stepPath ?? path.resolve(`/project/${label}`);
  return {
    path: p,
    buildSystem: 'maven',
    goals: ['clean', 'install'],
    flags: [],
    label,
    mavenExecutable: 'mvn',
  };
}

function makePipeline(steps: BuildStep[], overrides: Partial<Pipeline> = {}): Pipeline {
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
    const npmExecutor = new NpmExecutor(processRunner);
    const buildRunner = new BuildRunner(executor, npmExecutor, fs);
    const pipelineRunner = new PipelineRunner(buildRunner, new NullDatabase() as unknown as AppDatabase);

    const pipeline = makePipeline(steps);
    const events = await collectEvents(pipelineRunner.run(pipeline));

    const startEvents = events.filter((e) => e.type === 'step:start');
    expect(startEvents).toHaveLength(2);

    const runDone = events.find((e) => e.type === 'run:done');
    expect(runDone).toBeDefined();
    if (runDone?.type === 'run:done') {
      expect(runDone.result.success).toBe(true);
    }
  });

  it('stops at first failure with failFast', async () => {
    const processRunner = new FakeProcessRunner();
    processRunner.exitCodes = [1]; // first step fails

    const steps = [makeStep('step1'), makeStep('step2')];
    const pomFiles = steps.map((s) => path.join(s.path, 'pom.xml'));
    const fs = createMockFs(pomFiles);
    const executor = new BuildExecutor(processRunner);
    const npmExecutor = new NpmExecutor(processRunner);
    const buildRunner = new BuildRunner(executor, npmExecutor, fs);
    const pipelineRunner = new PipelineRunner(buildRunner, new NullDatabase() as unknown as AppDatabase);

    const pipeline = makePipeline(steps, { failFast: true });
    const events = await collectEvents(pipelineRunner.run(pipeline));

    const startEvents = events.filter((e) => e.type === 'step:start');
    expect(startEvents).toHaveLength(1); // only first step ran

    const runDone = events.find((e) => e.type === 'run:done');
    expect(runDone).toBeDefined();
    if (runDone?.type === 'run:done') {
      expect(runDone.result.success).toBe(false);
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
    const npmExecutor = new NpmExecutor(processRunner);
    const buildRunner = new BuildRunner(executor, npmExecutor, fs);
    const pipelineRunner = new PipelineRunner(buildRunner, new NullDatabase() as unknown as AppDatabase);

    const pipeline = makePipeline(steps);
    const events = await collectEvents(pipelineRunner.run(pipeline, 2));

    const startEvents = events.filter((e) => e.type === 'step:start');
    expect(startEvents).toHaveLength(1); // only step3

    if (startEvents[0]?.type === 'step:start') {
      expect(startEvents[0].index).toBe(2); // 0-based display index
    }
  });
});
