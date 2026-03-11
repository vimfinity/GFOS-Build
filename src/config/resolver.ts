import path from 'node:path';
import type { AppConfig, BuildStepConfig, PipelineConfig } from './schema.js';
import type { BuildStep, Pipeline } from '../core/types.js';
import { resolveJavaHome } from '../core/jdk-resolver.js';

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
  const buildSystem = stepConfig.buildSystem ?? 'maven';

  if (buildSystem === 'npm') {
    return {
      path: resolvedPath,
      buildSystem: 'npm',
      goals: [],
      flags: [],
      label,
      mavenExecutable: config.maven.executable,
      npmExecutable: config.npm.executable,
      npmScript: stepConfig.npmScript ?? config.npm.defaultBuildScript,
    };
  }

  const goals = stepConfig.goals ?? config.maven.defaultGoals;
  const flags = stepConfig.flags ?? config.maven.defaultFlags;
  const mavenExecutable = stepConfig.maven ?? config.maven.executable;
  const javaVersion = stepConfig.javaVersion;
  const javaHome = resolveJavaHome(config, javaVersion);

  return { path: resolvedPath, buildSystem: 'maven', goals, flags, label, mavenExecutable, javaVersion, javaHome };
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
