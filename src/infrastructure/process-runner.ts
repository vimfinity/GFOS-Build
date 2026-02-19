import { spawn } from 'node:child_process';

export interface ProcessResult {
  exitCode: number;
  durationMs: number;
}

export interface ProcessRunOptions {
  verbose: boolean;
}

export interface ProcessRunner {
  run(command: string, args: string[], cwd: string, options: ProcessRunOptions): Promise<ProcessResult>;
}

export class NodeProcessRunner implements ProcessRunner {
  run(command: string, args: string[], cwd: string, options: ProcessRunOptions): Promise<ProcessResult> {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      if (options.verbose) {
        child.stdout?.on('data', chunk => {
          process.stderr.write(chunk);
        });

        child.stderr?.on('data', chunk => {
          process.stderr.write(chunk);
        });
      }

      child.on('error', reject);

      child.on('close', code => {
        resolve({
          exitCode: code ?? 1,
          durationMs: Date.now() - startedAt,
        });
      });
    });
  }
}
