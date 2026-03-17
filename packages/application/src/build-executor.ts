import type { MavenBuildStep, ProcessEvent } from '@gfos-build/domain';
import { buildMavenArgs } from '@gfos-build/domain';
import { buildEnvWithJavaHome } from './jdk-resolver.js';
import type { ProcessRunner } from './process-runner.js';

export class BuildExecutor {
  constructor(private readonly runner: ProcessRunner) {}

  execute(step: MavenBuildStep, signal?: AbortSignal): AsyncIterable<ProcessEvent> {
    const args = buildMavenArgs(step);
    const env = buildEnvWithJavaHome(step.javaHome);
    if (step.executionMode === 'external') {
      return this.runner.launchExternal(step.mavenExecutable, args, { cwd: step.path, env });
    }
    return this.runner.spawn(step.mavenExecutable, args, { cwd: step.path, env, signal });
  }
}
