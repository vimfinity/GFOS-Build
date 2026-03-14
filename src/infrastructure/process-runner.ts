import * as childProcess from 'node:child_process';
import type { ProcessEvent } from '../core/types.js';

export interface ProcessRunner {
  spawn(
    executable: string,
    args: string[],
    options: { cwd: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal },
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
    options: { cwd: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal },
  ): AsyncIterable<ProcessEvent> {
    const queue = new AsyncQueue<ProcessEvent>();
    const startMs = Date.now();
    let exitCode = 0;
    let stdoutClosed = false;
    let stderrClosed = false;
    let processClosed = false;
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let aborted = false;

    function emitBufferedLines(chunk: string, stream: 'stdout' | 'stderr'): string {
      const next = (stream === 'stdout' ? stdoutBuffer : stderrBuffer) + chunk;
      const parts = next.split(/\r\n|[\r\n]/);
      const remainder = parts.pop() ?? '';
      for (const line of parts) {
        queue.push({ type: stream, line });
      }
      return remainder;
    }

    function flushBuffer(stream: 'stdout' | 'stderr'): void {
      const buffer = stream === 'stdout' ? stdoutBuffer : stderrBuffer;
      if (buffer.length > 0) {
        queue.push({ type: stream, line: buffer });
        if (stream === 'stdout') stdoutBuffer = '';
        else stderrBuffer = '';
      }
    }

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

    const handleAbort = () => {
      if (processClosed || aborted) return;
      aborted = true;
      queue.push({ type: 'stderr', line: 'Build cancelled.' });
      if (process.platform === 'win32' && proc.pid) {
        void childProcess.spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } else {
        proc.kill('SIGTERM');
      }
    };

    if (options.signal) {
      if (options.signal.aborted) handleAbort();
      else options.signal.addEventListener('abort', handleAbort, { once: true });
    }

    proc.stdout?.setEncoding('utf8');
    proc.stderr?.setEncoding('utf8');

    proc.stdout?.on('data', (chunk: string) => {
      stdoutBuffer = emitBufferedLines(chunk, 'stdout');
    });
    proc.stdout?.on('close', () => {
      flushBuffer('stdout');
      stdoutClosed = true;
      tryFinalize();
    });

    proc.stderr?.on('data', (chunk: string) => {
      stderrBuffer = emitBufferedLines(chunk, 'stderr');
    });
    proc.stderr?.on('close', () => {
      flushBuffer('stderr');
      stderrClosed = true;
      tryFinalize();
    });

    proc.on('close', (code) => {
      exitCode = code ?? 1;
      processClosed = true;
      if (options.signal) options.signal.removeEventListener('abort', handleAbort);
      tryFinalize();
    });

    proc.on('error', (err) => {
      queue.push({ type: 'stderr', line: `Process error: ${err.message}` });
      exitCode = 1;
      stdoutClosed = true;
      stderrClosed = true;
      processClosed = true;
      if (options.signal) options.signal.removeEventListener('abort', handleAbort);
      tryFinalize();
    });

    return queue;
  }
}
