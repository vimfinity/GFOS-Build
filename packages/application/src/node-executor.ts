import type { NodeBuildStep, ProcessEvent } from '@gfos-build/domain';
import type { ProcessRunner } from './process-runner.js';

export class NodeExecutor {
  constructor(private readonly runner: ProcessRunner) {}

  execute(step: NodeBuildStep, signal?: AbortSignal): AsyncIterable<ProcessEvent> {
    const executable = step.nodeExecutables[step.packageManager ?? 'npm'];
    const args =
      step.commandType === 'install'
        ? ['install', ...step.args]
        : ['run', step.script ?? '', ...(step.args.length > 0 ? ['--', ...step.args] : [])];

    if (step.executionMode === 'external') {
      return this.runner.launchExternal(executable, args, { cwd: step.path });
    }

    return this.runner.spawn(executable, args, { cwd: step.path, signal });
  }
}
