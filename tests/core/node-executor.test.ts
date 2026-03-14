import { describe, expect, it } from 'vitest';
import { NodeExecutor } from '../../src/core/node-executor.js';
import type { NodeBuildStep, ProcessEvent } from '../../src/core/types.js';
import type { ProcessRunner } from '../../src/infrastructure/process-runner.js';

class FakeProcessRunner implements ProcessRunner {
  lastSpawn?: { executable: string; args: string[]; cwd: string };
  lastExternal?: { executable: string; args: string[]; cwd: string };
  events: ProcessEvent[] = [{ type: 'done', exitCode: 0, durationMs: 10 }];

  spawn(executable: string, args: string[], options: { cwd: string }): AsyncIterable<ProcessEvent> {
    this.lastSpawn = { executable, args, cwd: options.cwd };
    return this.makeIterable();
  }

  launchExternal(executable: string, args: string[], options: { cwd: string }): AsyncIterable<ProcessEvent> {
    this.lastExternal = { executable, args, cwd: options.cwd };
    return this.makeIterable();
  }

  private makeIterable(): AsyncIterable<ProcessEvent> {
    const events = this.events;
    return {
      [Symbol.asyncIterator]() {
        let index = 0;
        return {
          async next() {
            if (index < events.length) return { value: events[index++]!, done: false };
            return { value: undefined as never, done: true };
          },
        };
      },
    };
  }
}

function makeStep(overrides: Partial<NodeBuildStep> = {}): NodeBuildStep {
  return {
    path: 'C:/repo/app',
    buildSystem: 'node',
    label: 'app',
    commandType: 'script',
    script: 'dev',
    args: ['--host', '0.0.0.0'],
    executionMode: 'internal',
    packageManager: 'pnpm',
    nodeExecutables: { npm: 'npm', pnpm: 'pnpm', bun: 'bun' },
    ...overrides,
  };
}

describe('NodeExecutor', () => {
  it('uses the detected package manager for internal runs', async () => {
    const runner = new FakeProcessRunner();
    const executor = new NodeExecutor(runner);

    for await (const _event of executor.execute(makeStep())) {
      // consume
    }

    expect(runner.lastSpawn).toEqual({
      executable: 'pnpm',
      args: ['run', 'dev', '--', '--host', '0.0.0.0'],
      cwd: 'C:/repo/app',
    });
  });

  it('launches external runs through the external process path', async () => {
    const runner = new FakeProcessRunner();
    const executor = new NodeExecutor(runner);

    for await (const _event of executor.execute(makeStep({ executionMode: 'external', packageManager: 'bun' }))) {
      // consume
    }

    expect(runner.lastExternal).toEqual({
      executable: 'bun',
      args: ['run', 'dev', '--', '--host', '0.0.0.0'],
      cwd: 'C:/repo/app',
    });
  });

  it('uses install for standard dependency commands', async () => {
    const runner = new FakeProcessRunner();
    const executor = new NodeExecutor(runner);

    for await (const _event of executor.execute(makeStep({
      commandType: 'install',
      script: undefined,
      args: ['--frozen-lockfile'],
      packageManager: 'bun',
    }))) {
      // consume
    }

    expect(runner.lastSpawn).toEqual({
      executable: 'bun',
      args: ['install', '--frozen-lockfile'],
      cwd: 'C:/repo/app',
    });
  });
});
