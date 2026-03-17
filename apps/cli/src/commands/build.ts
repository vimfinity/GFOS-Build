import path from 'node:path';
import type { AppRuntime, AppConfig, BuildStepConfig } from '@gfos-build/platform-node';
import { resolveStep, resolveStepPath } from '@gfos-build/platform-node';
import { renderBuildEvent, renderDryRunStep } from '../renderer.js';
import type { MavenBuildStep, RunEventEnvelope } from '@gfos-build/contracts';

export interface BuildCommandOptions {
  path: string;
  goals?: string[];
  flags?: string[];
  maven?: string;
  java?: string;
  dryRun: boolean;
  json: boolean;
}

export async function runBuild(
  runtime: AppRuntime,
  config: AppConfig,
  options: BuildCommandOptions,
): Promise<boolean> {
  const resolvedPath = resolveStepPath(options.path, config.roots);
  const goals = options.goals ?? config.maven.defaultGoals;
  const mavenExecutable = options.maven ?? config.maven.executable;
  const javaVersion = options.java;

  const step = resolveStep(
    {
      path: resolvedPath,
      buildSystem: 'maven',
      goals,
      optionKeys: config.maven.defaultOptionKeys,
      profileStates: {},
      extraOptions: options.flags ?? config.maven.defaultExtraOptions,
      executionMode: 'internal',
      label: path.basename(resolvedPath),
      maven: mavenExecutable,
      javaVersion,
    } satisfies BuildStepConfig,
    config,
  ) as MavenBuildStep;

  if (options.dryRun) {
    const pomExists = await runtime.inspectProject(resolvedPath).then((inspection: { project: { buildSystem: string } | null }) => inspection.project?.buildSystem === 'maven');
    console.log('\n[DRY RUN]');
    renderDryRunStep(step, 0, 1, pomExists);
    return pomExists;
  }

  let success = true;
  const { jobId } = runtime.runQuick({
    path: resolvedPath,
    buildSystem: 'maven',
    goals,
    optionKeys: config.maven.defaultOptionKeys,
    profileStates: {},
    extraOptions: options.flags ?? config.maven.defaultExtraOptions,
    java: javaVersion,
    executionMode: 'internal',
    label: path.basename(resolvedPath),
  });

  await new Promise<void>((resolve, reject) => {
    const unsubscribe = runtime.subscribeRun(jobId, (envelope: RunEventEnvelope) => {
      if (envelope.type === 'event' && envelope.event && 'type' in envelope.event && envelope.event.type !== 'scan:done' && envelope.event.type !== 'repo:found') {
        renderBuildEvent(envelope.event, options.json);
        if (envelope.event.type === 'run:done') {
          success = envelope.event.result.success;
        }
        return;
      }

      if (envelope.type === 'done') {
        unsubscribe();
        resolve();
        return;
      }

      unsubscribe();
      reject(new Error(envelope.message ?? 'Build failed.'));
    });
  });

  return success;
}
