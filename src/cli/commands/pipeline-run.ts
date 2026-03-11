import type { AppConfig } from '../../config/schema.js';
import type { PipelineRunner } from '../../application/pipeline-runner.js';
import type { FileSystem } from '../../infrastructure/file-system.js';
import { resolvePipeline } from '../../config/resolver.js';
import { renderBuildEvent, renderPipelineDone, renderDryRunStep } from '../renderer.js';
import path from 'node:path';

export interface PipelineRunOptions {
  pipelineName: string;
  from?: string;
  continue: boolean;
  dryRun: boolean;
  json: boolean;
}

export async function runPipelineRun(
  runner: PipelineRunner,
  fs: FileSystem,
  config: AppConfig,
  options: PipelineRunOptions,
): Promise<boolean> {
  const pipelineConfig = config.pipelines[options.pipelineName];
  if (!pipelineConfig) {
    const available = Object.keys(config.pipelines);
    const hint =
      available.length > 0
        ? `Available: ${available.join(', ')}`
        : 'No pipelines configured. Edit your config to add them.';
    throw new Error(`Pipeline "${options.pipelineName}" not found. ${hint}`);
  }

  const pipeline = resolvePipeline(options.pipelineName, pipelineConfig, config);

  let fromIndex = 0;
  if (options.from) {
    fromIndex = resolveFromArg(pipeline.steps.map((s) => s.label), options.from, pipeline.name);
  } else if (options.continue) {
    fromIndex = runner.getResumeIndex(pipeline.name);
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
      const pomExists = await fs.exists(path.join(step.path, 'pom.xml'));
      renderDryRunStep(step, i, pipeline.steps.length, pomExists);
    }
    return true;
  }

  let success = true;
  for await (const event of runner.run(pipeline, fromIndex)) {
    renderBuildEvent(event, options.json);
    if (event.type === 'run:done') {
      success = event.result.success;
      renderPipelineDone(pipeline.name, event.result, pipeline.steps.length);
    }
  }

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
