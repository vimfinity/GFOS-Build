import type { BuildRunner } from './build-runner.js';
import type { BuildCompletionStatus, Pipeline, BuildEvent, BuildStepResult, RunResult } from '@gfos-build/domain';
import { buildCommandString } from '@gfos-build/domain';

export interface PipelineRunStore {
  createRun(params: { jobId?: string; kind: 'pipeline'; pipelineName: string; title: string }): number;
  finishRun(params: { id: number; status: BuildCompletionStatus; durationMs: number; stoppedAt?: number }): void;
  createStepRun(params: {
    runId: number;
    jobId?: string;
    projectPath: string;
    projectName: string;
    buildSystem: string;
    packageManager?: string;
    executionMode?: string;
    command: string;
    javaHome?: string;
    pipelineName?: string;
    stepIndex?: number;
    stepLabel: string;
  }): number;
  finishStepRun(params: { id: number; exitCode: number; durationMs: number; status: BuildCompletionStatus }): void;
  appendStepLog(stepRunId: number, seq: number, stream: string, line: string): void;
  getLastFailedStepIndex(pipelineName: string): number | null;
}

export class PipelineRunner {
  constructor(
    private readonly buildRunner: BuildRunner,
    private readonly db: PipelineRunStore,
  ) {}

  async *run(
    pipeline: Pipeline,
    fromIndex = 0,
    jobId?: string,
    signal?: AbortSignal,
    existingRunId?: number,
  ): AsyncGenerator<BuildEvent> {
    const startTime = Date.now();
    const runId =
      existingRunId ??
      this.db.createRun({
        jobId,
        kind: 'pipeline',
        pipelineName: pipeline.name,
        title: pipeline.name,
      });
    const results: BuildStepResult[] = [];
    const stepsToRun = pipeline.steps.slice(fromIndex);
    const total = pipeline.steps.length;
    let failedAt: number | undefined;

    yield { type: 'run:start', startedAt: startTime, runId };

    for (let i = 0; i < stepsToRun.length; i++) {
      const step = stepsToRun[i]!;
      const displayIndex = fromIndex + i;
      let logSeq = 0;
      let stepRunId: number | undefined;

      for await (const event of this.buildRunner.run(step, displayIndex, total, pipeline.name, signal)) {
        if (event.type === 'step:start') {
          if (stepRunId === undefined) {
            try {
              stepRunId = this.db.createStepRun({
                runId,
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
                stepLabel: event.step.label,
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
            this.db.appendStepLog(stepRunId, logSeq++, event.stream, event.line);
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
              this.db.finishStepRun({
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
      this.db.finishRun({
        id: runId,
        status,
        durationMs: runResult.durationMs,
        stoppedAt: failedAt,
      });
    } catch {
      // non-fatal
    }

    yield { type: 'run:done', result: runResult };
  }

  getResumeIndex(pipelineName: string): number {
    try {
      const index = this.db.getLastFailedStepIndex(pipelineName);
      if (index !== null && index !== undefined) {
        return index;
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
