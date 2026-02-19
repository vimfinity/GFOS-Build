import { spawn } from 'node:child_process';

export interface ProcessResult {
  exitCode: number;
  durationMs: number;
}

export interface ProcessRunOptions {
  verbose: boolean;
  javaHome?: string;
}

export interface ProcessRunner {
  run(command: string, args: string[], cwd: string, options: ProcessRunOptions): Promise<ProcessResult>;
}

function resolvePathKey(env: NodeJS.ProcessEnv): string {
  const matched = Object.keys(env).find(key => key.toLowerCase() === 'path');
  return matched ?? 'PATH';
}

function createProcessEnv(options: ProcessRunOptions): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };

  if (!options.javaHome) {
    return env;
  }

  env.JAVA_HOME = options.javaHome;

  const pathKey = resolvePathKey(env);
  const currentPath = env[pathKey] ?? '';
  const separator = process.platform === 'win32' ? ';' : ':';
  const javaBin = `${options.javaHome}${process.platform === 'win32' ? '\\bin' : '/bin'}`;

  env[pathKey] = currentPath ? `${javaBin}${separator}${currentPath}` : javaBin;
  return env;
}

export class NodeProcessRunner implements ProcessRunner {
  run(command: string, args: string[], cwd: string, options: ProcessRunOptions): Promise<ProcessResult> {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env: createProcessEnv(options),
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
