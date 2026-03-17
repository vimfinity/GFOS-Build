import type { AppRuntime } from '@gfos-build/platform-node';
import { renderBuildEvent, renderPipelineDone, renderDryRunStep } from '../renderer.js';
import type { RunEventEnvelope } from '@gfos-build/contracts';

export interface PipelineRunOptions {
  pipelineName: string;
  from?: string;
  continue: boolean;
  dryRun: boolean;
  json: boolean;
}

export async function runPipelineRun(
  runtime: AppRuntime,
  options: PipelineRunOptions,
): Promise<boolean> {
  const pipeline = runtime.getResolvedPipeline(options.pipelineName);

  let fromIndex = 0;
  if (options.from) {
    fromIndex = resolveFromArg(pipeline.steps.map((s) => s.label), options.from, pipeline.name);
  } else if (options.continue) {
    fromIndex = runtime.getResumeIndex(pipeline.name);
    if (fromIndex > 0) {
      console.log(`Resuming pipeline "${pipeline.name}" from step ${fromIndex + 1}.`);
    }
  }

  if (options.dryRun) {
    console.log(`\n[DRY RUN] Pipeline: ${pipeline.name}`);
    if (pipeline.description) {
      console.log(`  ${pipeline.description}`);
    }
    console.log('');

    for (let i = 0; i < pipeline.steps.length; i++) {
      const step = pipeline.steps[i]!;
      const skipped = i < fromIndex;
      if (skipped) {
        console.log(`  Step ${i + 1}/${pipeline.steps.length}  ${step.label}  (skipped)\n`);
        continue;
      }
      const pomExists = step.buildSystem === 'maven'
        ? Boolean((await runtime.inspectProject(step.path)).project?.buildSystem === 'maven')
        : Boolean((await runtime.inspectProject(step.path)).project?.buildSystem === 'node');
      renderDryRunStep(step, i, pipeline.steps.length, pomExists);
    }
    return true;
  }

  let success = true;
  const { jobId } = runtime.runPipeline({
    name: pipeline.name,
    from: fromIndex > 0 ? String(fromIndex + 1) : undefined,
  });

  await new Promise<void>((resolve, reject) => {
    const unsubscribe = runtime.subscribeRun(jobId, (envelope: RunEventEnvelope) => {
      if (envelope.type === 'event' && envelope.event && 'type' in envelope.event && envelope.event.type !== 'scan:done' && envelope.event.type !== 'repo:found') {
        renderBuildEvent(envelope.event, options.json);
        if (envelope.event.type === 'run:done') {
          success = envelope.event.result.success;
          renderPipelineDone(pipeline.name, envelope.event.result, pipeline.steps.length);
        }
        return;
      }

      if (envelope.type === 'done') {
        unsubscribe();
        resolve();
        return;
      }

      unsubscribe();
      reject(new Error(envelope.message ?? 'Pipeline failed.'));
    });
  });

  return success;
}

function resolveFromArg(labels: string[], fromArg: string, pipelineName: string): number {
  const n = parseInt(fromArg, 10);
  if (!isNaN(n)) {
    if (n < 1 || n > labels.length) {
      throw new Error(
        `--from ${n} is out of range. Pipeline "${pipelineName}" has ${labels.length} step(s).`,
      );
    }
    return n - 1;
  }

  const idx = labels.findIndex((l) => l.toLowerCase() === fromArg.toLowerCase());
  if (idx === -1) {
    const list = labels.map((l, i) => `  ${i + 1}. ${l}`).join('\n');
    throw new Error(`No step with label "${fromArg}" in pipeline "${pipelineName}".\nSteps:\n${list}`);
  }
  return idx;
}
