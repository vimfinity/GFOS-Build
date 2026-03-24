import path from 'node:path';
import type { AppConfig, BuildStepConfig, PipelineConfig } from './schema.js';
import type { BuildStep, Pipeline } from '@gfos-build/domain';
import { requireRegisteredJavaHome } from '@gfos-build/application';

export function resolveStepPath(rawPath: string, roots: AppConfig['roots']): string {
  const colonIndex = rawPath.indexOf(':');

  if (colonIndex === 1) {
    return path.normalize(rawPath);
  }

  if (colonIndex > 1) {
    const rootName = rawPath.slice(0, colonIndex);
    const relPath = rawPath.slice(colonIndex + 1);
    const rootValue = roots[rootName];
    if (rootValue === undefined) {
      const configured = Object.keys(roots);
      const hint =
        configured.length > 0
          ? `Configured roots: ${configured.join(', ')}`
          : 'No roots configured. Run "gfos-build config init" to set up.';
      throw new Error(`Unknown root "${rootName}" in path "${rawPath}". ${hint}`);
    }
    return path.join(path.normalize(rootValue), path.normalize(relPath));
  }

  return path.resolve(rawPath);
}

export function resolveStep(stepConfig: BuildStepConfig, config: AppConfig): BuildStep {
  const resolvedPath = resolveStepPath(stepConfig.path, config.roots);
  const label = stepConfig.label ?? path.basename(resolvedPath);

  if (stepConfig.buildSystem === 'node') {
    return {
      path: resolvedPath,
      buildSystem: 'node',
      label,
      commandType: stepConfig.commandType,
      script: stepConfig.script,
      args: stepConfig.args,
      executionMode: stepConfig.executionMode,
      nodeExecutables: config.node.executables,
    };
  }

  const goals = stepConfig.goals ?? config.maven.defaultGoals;
  const mavenExecutable = stepConfig.maven ?? config.maven.executable;
  const javaVersion = stepConfig.javaVersion;
  const javaHome = requireRegisteredJavaHome(config, javaVersion);

  return {
    path: resolvedPath,
    buildSystem: 'maven',
    mode: stepConfig.mode,
    modulePath: stepConfig.modulePath,
    submoduleBuildStrategy: stepConfig.submoduleBuildStrategy,
    goals,
    optionKeys: stepConfig.optionKeys ?? config.maven.defaultOptionKeys,
    profileStates: stepConfig.profileStates ?? {},
    extraOptions: stepConfig.extraOptions ?? config.maven.defaultExtraOptions,
    executionMode: stepConfig.executionMode ?? 'internal',
    label,
    mavenExecutable,
    javaVersion,
    javaHome,
    deploy: stepConfig.deploy,
  };
}

export function resolvePipeline(
  name: string,
  pipelineConfig: PipelineConfig,
  config: AppConfig,
): Pipeline {
  return {
    name,
    description: pipelineConfig.description,
    failFast: pipelineConfig.failFast,
    steps: pipelineConfig.steps.map((s) => resolveStep(s, config)),
  };
}
