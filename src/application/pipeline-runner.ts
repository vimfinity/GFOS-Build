import type { BuildRunner } from './build-runner.js';
import type { IDatabase } from '../infrastructure/database.js';
import type { Pipeline, BuildEvent, BuildStepResult, RunResult } from '../core/types.js';

export class PipelineRunner {
  constructor(
    private readonly buildRunner: BuildRunner,
    private readonly db: IDatabase,
  ) {}

  async *run(
    pipeline: Pipeline,
    fromIndex = 0,
    jobId?: string,
    signal?: AbortSignal,
  ): AsyncGenerator<BuildEvent> {
    const startTime = Date.now();
    const results: BuildStepResult[] = [];
    const stepsToRun = pipeline.steps.slice(fromIndex);
    const total = pipeline.steps.length;
    let failedAt: number | undefined;

    for (let i = 0; i < stepsToRun.length; i++) {
      const step = stepsToRun[i]!;
      const displayIndex = fromIndex + i;
      let logSeq = 0;

      let stepRunId: number | undefined;
      try {
        const command =
          step.buildSystem === 'npm'
            ? [step.npmExecutable ?? 'npm', 'run', step.npmScript ?? 'build'].join(' ')
            : [step.mavenExecutable, ...step.goals, ...step.flags].join(' ');
        stepRunId = this.db.startBuildRun({
          jobId,
          projectPath: step.path,
          projectName: step.label,
          buildSystem: step.buildSystem,
          command,
          javaHome: step.javaHome,
          pipelineName: pipeline.name,
          stepIndex: displayIndex,
        });
      } catch {
        // non-fatal DB error
      }

      for await (const event of this.buildRunner.run(step, displayIndex, total, pipeline.name, signal)) {
        if (event.type === 'step:start' && stepRunId !== undefined) {
          yield { ...event, runId: stepRunId };
        } else {
          yield event;
        }

        if (event.type === 'step:output' && stepRunId !== undefined) {
          try {
            this.db.appendBuildLog(stepRunId, logSeq++, event.stream, event.line);
          } catch {
            // non-fatal
          }
        }

        if (event.type === 'step:done') {
          results.push({
            step: event.step,
            exitCode: event.exitCode,
            durationMs: event.durationMs,
            success: event.success,
          });

          if (stepRunId !== undefined) {
            try {
              this.db.finishBuildRun({
                id: stepRunId,
                exitCode: event.exitCode,
                durationMs: event.durationMs,
                status: event.success ? 'success' : 'failed',
              });
            } catch {
              // non-fatal
            }
          }

          if (!event.success && pipeline.failFast) {
            failedAt = displayIndex;
          }
        }
      }

      if (failedAt !== undefined) break;
    }

    const success = failedAt === undefined && results.every((r) => r.success);
    const runResult: RunResult = {
      results,
      success,
      durationMs: Date.now() - startTime,
      stoppedAt: failedAt,
    };

    try {
      this.db.upsertPipelineState(pipeline.name, success ? null : (failedAt ?? fromIndex));
    } catch {
      // non-fatal
    }

    yield { type: 'run:done', result: runResult };
  }

  getResumeIndex(pipelineName: string): number {
    try {
      const state = this.db.getPipelineState(pipelineName);
      if (state?.last_failed_step !== null && state?.last_failed_step !== undefined) {
        return state.last_failed_step;
      }
    } catch {
      // non-fatal
    }
    return 0;
  }
}
