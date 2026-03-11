import { describe, it, expect } from 'vitest';
import { BuildExecutor } from '../../src/core/build-executor.js';
import type { ProcessRunner } from '../../src/infrastructure/process-runner.js';
import type { ProcessEvent, BuildStep } from '../../src/core/types.js';

class FakeProcessRunner implements ProcessRunner {
  lastArgs?: { executable: string; args: string[]; options: { cwd: string; env?: Record<string, string | undefined> } };
  events: ProcessEvent[] = [];

  spawn(
    executable: string,
    args: string[],
    options: { cwd: string; env?: Record<string, string | undefined> }
  ): AsyncIterable<ProcessEvent> {
    this.lastArgs = { executable, args, options };
    const events = this.events;
    return {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          async next() {
            if (i < events.length) {
              return { value: events[i++]!, done: false };
            }
            return { value: undefined as never, done: true };
          },
        };
      },
    };
  }
}

function makeStep(overrides: Partial<BuildStep> = {}): BuildStep {
  return {
    path: 'J:/dev/quellen/2025/web',
    goals: ['clean', 'install'],
    flags: ['-DskipTests'],
    label: 'web',
    mavenExecutable: 'mvn',
    ...overrides,
  };
}

describe('BuildExecutor', () => {
  it('passes correct arguments to ProcessRunner', async () => {
    const runner = new FakeProcessRunner();
    runner.events = [{ type: 'done', exitCode: 0, durationMs: 100 }];

    const executor = new BuildExecutor(runner);
    const step = makeStep();

    const events: ProcessEvent[] = [];
    for await (const e of executor.execute(step)) {
      events.push(e);
    }

    expect(runner.lastArgs).toBeDefined();
    expect(runner.lastArgs!.executable).toBe('mvn');
    expect(runner.lastArgs!.args).toEqual(['clean', 'install', '-DskipTests']);
    expect(runner.lastArgs!.options.cwd).toBe('J:/dev/quellen/2025/web');
  });

  it('streams events from the process', async () => {
    const runner = new FakeProcessRunner();
    runner.events = [
      { type: 'stdout', line: '[INFO] Building...' },
      { type: 'stderr', line: 'WARNING: test' },
      { type: 'done', exitCode: 0, durationMs: 500 },
    ];

    const executor = new BuildExecutor(runner);
    const events: ProcessEvent[] = [];
    for await (const e of executor.execute(makeStep())) {
      events.push(e);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: 'stdout', line: '[INFO] Building...' });
    expect(events[1]).toEqual({ type: 'stderr', line: 'WARNING: test' });
    expect(events[2]!.type).toBe('done');
  });

  it('sets JAVA_HOME when javaHome is set on step', async () => {
    const runner = new FakeProcessRunner();
    runner.events = [{ type: 'done', exitCode: 0, durationMs: 100 }];

    const executor = new BuildExecutor(runner);
    const step = makeStep({ javaVersion: '21', javaHome: 'J:/dev/java/jdk21' });
    for await (const _event of executor.execute(step)) { /* consume */ }

    expect(runner.lastArgs!.options.env).toBeDefined();
    expect(runner.lastArgs!.options.env!['JAVA_HOME']).toBe('J:/dev/java/jdk21');
  });

  it('does not set env when javaHome is undefined', async () => {
    const runner = new FakeProcessRunner();
    runner.events = [{ type: 'done', exitCode: 0, durationMs: 100 }];

    const executor = new BuildExecutor(runner);
    const step = makeStep({ javaVersion: '99', javaHome: undefined });
    for await (const _event of executor.execute(step)) { /* consume */ }

    expect(runner.lastArgs!.options.env).toBeUndefined();
  });

  it('does not set env when no javaVersion specified', async () => {
    const runner = new FakeProcessRunner();
    runner.events = [{ type: 'done', exitCode: 0, durationMs: 100 }];

    const executor = new BuildExecutor(runner);
    const step = makeStep({ javaVersion: undefined, javaHome: undefined });
    for await (const _event of executor.execute(step)) { /* consume */ }

    expect(runner.lastArgs!.options.env).toBeUndefined();
  });
});
