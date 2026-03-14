import path from 'node:path';
import type { FileSystem } from '../infrastructure/file-system.js';
import type { BuildExecutor } from '../core/build-executor.js';
import type { NpmExecutor } from '../core/npm-executor.js';
import type { BuildStep, BuildEvent } from '../core/types.js';

export class BuildRunner {
  constructor(
    private readonly executor: BuildExecutor,
    private readonly npmExecutor: NpmExecutor,
    private readonly fs: FileSystem,
  ) {}

  async *run(
    step: BuildStep,
    index: number,
    total: number,
    pipelineName?: string,
    signal?: AbortSignal,
  ): AsyncGenerator<BuildEvent> {
    yield { type: 'step:start', step, index, total, pipelineName };

    // Pre-flight: check the right manifest file exists and fail gracefully.
    const manifestFile = step.buildSystem === 'npm' ? 'package.json' : 'pom.xml';
    const manifestPath = path.join(step.path, manifestFile);
    if (!(await this.fs.exists(manifestPath))) {
      const message =
        `No ${manifestFile} found at "${step.path}".` +
        (pipelineName ? ` Check step "${step.label}" in pipeline "${pipelineName}".` : '');
      yield { type: 'step:output', line: message, stream: 'stderr' };
      yield { type: 'step:done', step, index, total, exitCode: 1, durationMs: 0, success: false };
      return;
    }

    let exitCode = 0;
    let durationMs = 0;

    try {
      const events =
        step.buildSystem === 'npm' ? this.npmExecutor.execute(step, signal) : this.executor.execute(step, signal);

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

    yield { type: 'step:done', step, index, total, exitCode, durationMs, success: exitCode === 0 };
  }
}
