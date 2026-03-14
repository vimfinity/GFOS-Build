import type { ProcessRunner } from '../infrastructure/process-runner.js';
import type { BuildStep, ProcessEvent } from './types.js';

export class NpmExecutor {
  constructor(private readonly runner: ProcessRunner) {}

  execute(step: BuildStep, signal?: AbortSignal): AsyncIterable<ProcessEvent> {
    const script = step.npmScript ?? 'build';
    const executable = step.npmExecutable ?? 'npm';
    return this.runner.spawn(executable, ['run', script], { cwd: step.path, signal });
  }
}
