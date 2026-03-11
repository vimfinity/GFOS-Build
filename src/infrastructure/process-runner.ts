import * as childProcess from 'node:child_process';
import * as readline from 'node:readline';
import type { ProcessEvent } from '../core/types.js';

export interface ProcessRunner {
  spawn(
    executable: string,
    args: string[],
    options: { cwd: string; env?: NodeJS.ProcessEnv },
  ): AsyncIterable<ProcessEvent>;
}

class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly buffer: T[] = [];
  private readonly resolvers: Array<(result: IteratorResult<T, undefined>) => void> = [];
  private closed = false;

  push(item: T): void {
    if (this.resolvers.length > 0) {
      this.resolvers.shift()!({ value: item, done: false });
    } else {
      this.buffer.push(item);
    }
  }

  close(): void {
    this.closed = true;
    while (this.resolvers.length > 0) {
      this.resolvers.shift()!({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T, undefined>> => {
        if (this.buffer.length > 0) {
          return Promise.resolve({ value: this.buffer.shift()!, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise<IteratorResult<T, undefined>>((resolve) => {
          this.resolvers.push(resolve);
        });
      },
    };
  }
}

export class NodeProcessRunner implements ProcessRunner {
  spawn(
    executable: string,
    args: string[],
    options: { cwd: string; env?: NodeJS.ProcessEnv },
  ): AsyncIterable<ProcessEvent> {
    const queue = new AsyncQueue<ProcessEvent>();
    const startMs = Date.now();
    let exitCode = 0;
    let stdoutClosed = false;
    let stderrClosed = false;
    let processClosed = false;

    function tryFinalize(): void {
      if (stdoutClosed && stderrClosed && processClosed) {
        queue.push({ type: 'done', exitCode, durationMs: Date.now() - startMs });
        queue.close();
      }
    }

    const proc = childProcess.spawn(executable, args, {
      cwd: options.cwd,
      env: options.env ?? (process.env as NodeJS.ProcessEnv),
      shell: process.platform === 'win32',
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    const rlStdout = readline.createInterface({ input: proc.stdout!, crlfDelay: Infinity });
    const rlStderr = readline.createInterface({ input: proc.stderr!, crlfDelay: Infinity });

    rlStdout.on('line', (line) => queue.push({ type: 'stdout', line }));
    rlStdout.on('close', () => { stdoutClosed = true; tryFinalize(); });

    rlStderr.on('line', (line) => queue.push({ type: 'stderr', line }));
    rlStderr.on('close', () => { stderrClosed = true; tryFinalize(); });

    proc.on('close', (code) => {
      exitCode = code ?? 1;
      processClosed = true;
      tryFinalize();
    });

    proc.on('error', (err) => {
      queue.push({ type: 'stderr', line: `Process error: ${err.message}` });
      exitCode = 1;
      stdoutClosed = true;
      stderrClosed = true;
      processClosed = true;
      tryFinalize();
    });

    return queue;
  }
}
