import { describe, it, expect } from 'vitest';
import { BuildRunner } from '../../src/application/build-runner.js';
import { BuildExecutor } from '../../src/core/build-executor.js';
import { NpmExecutor } from '../../src/core/npm-executor.js';
import type { ProcessRunner } from '../../src/infrastructure/process-runner.js';
import type { ProcessEvent, BuildStep, BuildEvent } from '../../src/core/types.js';
import type { FileSystem, DirEntry } from '../../src/infrastructure/file-system.js';

class FakeProcessRunner implements ProcessRunner {
  events: ProcessEvent[] = [];

  spawn(): AsyncIterable<ProcessEvent> {
    const events = this.events;
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

import path from 'node:path';

function makeStep(overrides: Partial<BuildStep> = {}): BuildStep {
  return {
    path: path.resolve('/project'),
    buildSystem: 'maven',
    goals: ['clean', 'install'],
    flags: [],
    label: 'test-project',
    mavenExecutable: 'mvn',
    ...overrides,
  };
}

async function collectBuildEvents(gen: AsyncGenerator<BuildEvent>): Promise<BuildEvent[]> {
  const events: BuildEvent[] = [];
  for await (const e of gen) {
    events.push(e);
  }
  return events;
}

describe('BuildRunner', () => {
  it('throws when pom.xml does not exist', async () => {
    const runner = new FakeProcessRunner();
    const executor = new BuildExecutor(runner);
    const npmExecutor = new NpmExecutor(runner);
    const fs = createMockFs([]);
    const buildRunner = new BuildRunner(executor, npmExecutor, fs);
    const step = makeStep();

    await expect(async () => {
      await collectBuildEvents(buildRunner.run(step, 0, 1));
    }).rejects.toThrow('No pom.xml found');
  });

  it('emits step:start, step:output, step:done events in order', async () => {
    const runner = new FakeProcessRunner();
    runner.events = [
      { type: 'stdout', line: '[INFO] Building...' },
      { type: 'done', exitCode: 0, durationMs: 1000 },
    ];

    const step = makeStep();
    const pomPath = path.join(step.path, 'pom.xml');
    const executor = new BuildExecutor(runner);
    const npmExecutor = new NpmExecutor(runner);
    const fs = createMockFs([pomPath]);
    const buildRunner = new BuildRunner(executor, npmExecutor, fs);

    const events = await collectBuildEvents(buildRunner.run(step, 0, 1));

    expect(events[0]!.type).toBe('step:start');
    expect(events[1]!.type).toBe('step:output');
    expect(events[2]!.type).toBe('step:done');
  });

  it('reports failure correctly', async () => {
    const runner = new FakeProcessRunner();
    runner.events = [{ type: 'done', exitCode: 1, durationMs: 300 }];

    const step = makeStep();
    const pomPath = path.join(step.path, 'pom.xml');
    const executor = new BuildExecutor(runner);
    const npmExecutor = new NpmExecutor(runner);
    const fs = createMockFs([pomPath]);
    const buildRunner = new BuildRunner(executor, npmExecutor, fs);

    const events = await collectBuildEvents(buildRunner.run(step, 0, 1));
    const stepDone = events.find((e) => e.type === 'step:done');

    expect(stepDone).toBeDefined();
    if (stepDone?.type === 'step:done') {
      expect(stepDone.success).toBe(false);
      expect(stepDone.exitCode).toBe(1);
    }
  });
});
