import { describe, it, expect } from 'vitest';
import { BuildRunner } from '../../packages/application/src/build-runner.js';
import { BuildExecutor } from '../../packages/application/src/build-executor.js';
import { NodeExecutor } from '../../packages/application/src/node-executor.js';
import type { ProcessRunner } from '../../packages/platform-node/src/process-runner.js';
import type { BuildEvent, MavenBuildStep, NodeBuildStep, ProcessEvent } from '../../packages/domain/src/types.js';
import type { FileSystem, DirEntry } from '../../packages/application/src/file-system.js';

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

import path from 'node:path';

function makeStep(overrides: Partial<MavenBuildStep> = {}): MavenBuildStep {
  return {
    path: path.resolve('/project'),
    buildSystem: 'maven',
    goals: ['clean', 'install'],
    optionKeys: [],
    profileStates: {},
    extraOptions: [],
    executionMode: 'internal',
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
    const nodeExecutor = new NodeExecutor(runner);
    const fs = createMockFs([]);
    const buildRunner = new BuildRunner(executor, nodeExecutor, fs);
    const step = makeStep();
    const events = await collectBuildEvents(buildRunner.run(step, 0, 1));
    expect(events[0]).toEqual({ type: 'step:output', line: `No pom.xml found at "${step.path}".`, stream: 'stderr' });
    expect(events[1]!.type).toBe('step:done');
    if (events[1]?.type === 'step:done') {
      expect(events[1].success).toBe(false);
      expect(events[1].status).toBe('failed');
    }
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
    const nodeExecutor = new NodeExecutor(runner);
    const fs = createMockFs([pomPath]);
    const buildRunner = new BuildRunner(executor, nodeExecutor, fs);

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
    const nodeExecutor = new NodeExecutor(runner);
    const fs = createMockFs([pomPath]);
    const buildRunner = new BuildRunner(executor, nodeExecutor, fs);

    const events = await collectBuildEvents(buildRunner.run(step, 0, 1));
    const stepDone = events.find((e) => e.type === 'step:done');

    expect(stepDone).toBeDefined();
    if (stepDone?.type === 'step:done') {
      expect(stepDone.success).toBe(false);
      expect(stepDone.status).toBe('failed');
      expect(stepDone.exitCode).toBe(1);
    }
  });

  it('marks successful external node handoff as launched', async () => {
    const runner = new FakeProcessRunner();
    runner.events = [{ type: 'done', exitCode: 0, durationMs: 120 }];

    const packageJsonPath = path.join('C:/repo/app', 'package.json');
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
    const executor = new BuildExecutor(runner);
    const nodeExecutor = new NodeExecutor(runner);
    const fs = createMockFs(
      [packageJsonPath],
      { [packageJsonPath]: JSON.stringify({ name: 'app', scripts: { dev: 'next dev' } }) },
    );
    const buildRunner = new BuildRunner(executor, nodeExecutor, fs);

    const events = await collectBuildEvents(buildRunner.run(step, 0, 1));
    const stepDone = events.find((event) => event.type === 'step:done');

    expect(stepDone?.type).toBe('step:done');
    if (stepDone?.type === 'step:done') {
      expect(stepDone.status).toBe('launched');
      expect(stepDone.success).toBe(true);
    }
  });
});
