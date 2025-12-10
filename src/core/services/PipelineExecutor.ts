import type { PipelineDefinition, PipelineStepOptions } from './PipelineService.js';
import type { BuildJob } from '../types/index.js';

export type PipelineJobPayload = Omit<BuildJob, 'id' | 'createdAt' | 'progress'>;

export function buildCustomArgsFromOptions(options: PipelineStepOptions): string[] {
  const parts: string[] = [];

  if (options.profiles.length > 0) {
    parts.push('-P', options.profiles.join(','));
  }
  if (options.batchMode) {
    parts.push('-B');
  }
  if (options.threads) {
    parts.push('-T', options.threads);
  }
  if (options.updateSnapshots) {
    parts.push('-U');
  }
  if (options.alsoMake) {
    parts.push('-am');
  }
  if (options.alsoMakeDependents) {
    parts.push('-amd');
  }
  if (options.showErrors) {
    parts.push('-e');
  }
  if (options.customArgs.trim()) {
    parts.push(...options.customArgs.split(/\s+/).filter(Boolean));
  }

  return parts;
}

export function createJobsForPipeline(pipeline: PipelineDefinition): PipelineJobPayload[] {
  const jobs: PipelineJobPayload[] = [];
  const totalModules = pipeline.steps.reduce((sum, step) => sum + step.selectedModules.length, 0);
  const sequenceId = `${pipeline.id}-${Date.now()}`;
  let globalIndex = 0;

  for (const step of pipeline.steps) {
    const baseArgs = buildCustomArgsFromOptions(step.options);
    for (const module of step.selectedModules) {
      const projectPath = module.projectPath || step.projectPath;
      const moduleLabel = module.artifactId || 'module';

      jobs.push({
        projectPath,
        modulePath: module.relativePath,
        name: `${step.projectName}: ${moduleLabel}`,
        jdkPath: step.jdkPath,
        mavenGoals: step.options.goals,
        status: globalIndex === 0 ? 'pending' : 'waiting',
        skipTests: step.options.skipTests,
        offline: step.options.offline,
        customArgs: baseArgs,
        sequenceId,
        sequenceIndex: globalIndex,
        sequenceTotal: totalModules,
      });

      globalIndex += 1;
    }
  }

  return jobs;
}
