import path from 'node:path';
import type { BuildCompletionStatus, BuildStep, BuildEvent, NodeBuildStep } from '@gfos-build/domain';
import type { BuildExecutor } from './build-executor.js';
import type { NodeExecutor } from './node-executor.js';
import { inspectNodeProject } from './node-project.js';
import type { FileSystem } from './file-system.js';

export class BuildRunner {
  constructor(
    private readonly executor: BuildExecutor,
    private readonly nodeExecutor: NodeExecutor,
    private readonly fs: FileSystem,
  ) {}

  async *run(
    step: BuildStep,
    index: number,
    total: number,
    pipelineName?: string,
    signal?: AbortSignal,
  ): AsyncGenerator<BuildEvent> {
    if (step.buildSystem === 'wildfly') {
      yield { type: 'step:start', step, index, total, pipelineName };
      yield {
        type: 'step:done',
        step,
        index,
        total,
        exitCode: 0,
        durationMs: 0,
        status: 'success',
        success: true,
      };
      return;
    }

    // Pre-flight: check the right manifest file exists and fail gracefully.
    const manifestFile = step.buildSystem === 'node' ? 'package.json' : 'pom.xml';
    const manifestPath = path.join(step.path, manifestFile);
    if (!(await this.fs.exists(manifestPath))) {
      const message =
        `No ${manifestFile} found at "${step.path}".` +
        (pipelineName ? ` Check step "${step.label}" in pipeline "${pipelineName}".` : '');
      yield { type: 'step:output', line: message, stream: 'stderr' };
      yield { type: 'step:done', step, index, total, exitCode: 1, durationMs: 0, status: 'failed', success: false };
      return;
    }

    const effectiveStep = step.buildSystem === 'node' ? await this.resolveNodeStep(step) : step;
    yield { type: 'step:start', step: effectiveStep, index, total, pipelineName };

    let exitCode = 0;
    let durationMs = 0;

    try {
      const events =
        effectiveStep.buildSystem === 'node'
          ? this.nodeExecutor.execute(effectiveStep, signal)
          : this.executor.execute(effectiveStep, signal);

      for await (const event of events) {
        if (event.type === 'stdout' || event.type === 'stderr') {
          yield { type: 'step:output', line: event.line, stream: event.type };
        } else {
          exitCode = event.exitCode;
          durationMs = event.durationMs;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield { type: 'step:output', line: message, stream: 'stderr' };
      exitCode = 1;
      durationMs = 0;
    }

    const status = this.getCompletionStatus(effectiveStep, exitCode);
    yield {
      type: 'step:done',
      step: effectiveStep,
      index,
      total,
      exitCode,
      durationMs,
      status,
      success: status !== 'failed',
    };
  }

  private async resolveNodeStep(step: NodeBuildStep): Promise<NodeBuildStep> {
    const metadata = await inspectNodeProject(this.fs, step.path);
    if (!metadata) {
      throw new Error(`No package.json found at "${step.path}".`);
    }
    if (step.commandType === 'script' && (!step.script || !(step.script in metadata.scripts))) {
      throw new Error(`Script "${step.script}" is not defined in "${metadata.packageJsonPath}".`);
    }
    return { ...step, packageManager: metadata.packageManager };
  }

  private getCompletionStatus(step: BuildStep, exitCode: number): BuildCompletionStatus {
    if (exitCode !== 0) {
      return 'failed';
    }
    if (step.buildSystem !== 'wildfly' && step.executionMode === 'external') {
      return 'launched';
    }
    return 'success';
  }
}
