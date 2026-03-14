import type { ProcessRunner } from '../infrastructure/process-runner.js';
import type { BuildStep, ProcessEvent } from './types.js';
import { buildEnvWithJavaHome } from './jdk-resolver.js';

export class BuildExecutor {
  constructor(private readonly runner: ProcessRunner) {}

  execute(step: BuildStep, signal?: AbortSignal): AsyncIterable<ProcessEvent> {
    const args = [...step.goals, ...step.flags];
    const env = buildEnvWithJavaHome(step.javaHome);
    return this.runner.spawn(step.mavenExecutable, args, { cwd: step.path, env, signal });
  }
}
