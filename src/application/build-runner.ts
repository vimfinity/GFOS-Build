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
  ): AsyncGenerator<BuildEvent> {
    // Pre-flight: check the right manifest file exists
    const manifestFile = step.buildSystem === 'npm' ? 'package.json' : 'pom.xml';
    const manifestPath = path.join(step.path, manifestFile);
    if (!(await this.fs.exists(manifestPath))) {
      throw new Error(
        `No ${manifestFile} found at "${step.path}".` +
          (pipelineName ? ` Check step "${step.label}" in pipeline "${pipelineName}".` : ''),
      );
    }

    yield { type: 'step:start', step, index, total, pipelineName };

    let exitCode = 0;
    let durationMs = 0;

    const events =
      step.buildSystem === 'npm' ? this.npmExecutor.execute(step) : this.executor.execute(step);

    for await (const event of events) {
      if (event.type === 'stdout' || event.type === 'stderr') {
        yield { type: 'step:output', line: event.line, stream: event.type };
      } else {
        exitCode = event.exitCode;
        durationMs = event.durationMs;
      }
    }

    yield { type: 'step:done', step, index, total, exitCode, durationMs, success: exitCode === 0 };
  }
}
