import type { BuildRunner } from './build-runner.js';
import type { IDatabase } from '../infrastructure/database.js';
import type { BuildCompletionStatus, Pipeline, BuildEvent, BuildStepResult, RunResult } from '../core/types.js';
import { buildCommandString } from '../core/build-command.js';

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

      for await (const event of this.buildRunner.run(step, displayIndex, total, pipeline.name, signal)) {
        if (event.type === 'step:start') {
          if (stepRunId === undefined) {
            try {
              stepRunId = this.db.startBuildRun({
                jobId,
                projectPath: event.step.path,
                projectName: event.step.label,
                buildSystem: event.step.buildSystem,
                packageManager: event.step.buildSystem === 'node' ? event.step.packageManager : undefined,
                executionMode: event.step.buildSystem === 'node' ? event.step.executionMode : undefined,
                command: buildCommandString(event.step),
                javaHome: event.step.buildSystem === 'maven' ? event.step.javaHome : undefined,
                pipelineName: pipeline.name,
                stepIndex: displayIndex,
              });
            } catch {
              // non-fatal DB error
            }
          }
          yield stepRunId !== undefined ? { ...event, runId: stepRunId } : event;
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
            status: event.status,
            success: event.success,
          });

          if (stepRunId !== undefined) {
            try {
              this.db.finishBuildRun({
                id: stepRunId,
                exitCode: event.exitCode,
                durationMs: event.durationMs,
                status: event.status,
              });
            } catch {
              // non-fatal
            }
          }

          if (event.status === 'failed' && pipeline.failFast) {
            failedAt = displayIndex;
          }
        }
      }

      if (failedAt !== undefined) break;
    }

    const status = deriveRunStatus(results, failedAt);
    const runResult: RunResult = {
      results,
      status,
      success: status !== 'failed',
      durationMs: Date.now() - startTime,
      stoppedAt: failedAt,
    };

    try {
      this.db.upsertPipelineState(pipeline.name, status === 'failed' ? (failedAt ?? fromIndex) : null);
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

function deriveRunStatus(results: BuildStepResult[], failedAt: number | undefined): BuildCompletionStatus {
  if (failedAt !== undefined || results.some((result) => result.status === 'failed')) {
    return 'failed';
  }
  if (results.some((result) => result.status === 'launched')) {
    return 'launched';
  }
  return 'success';
}
