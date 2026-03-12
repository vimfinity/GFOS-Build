import path from 'node:path';
import type { AppConfig } from '../../config/schema.js';
import type { BuildRunner } from '../../application/build-runner.js';
import type { IDatabase } from '../../infrastructure/database.js';
import type { FileSystem } from '../../infrastructure/file-system.js';
import { resolveStepPath } from '../../config/resolver.js';
import { resolveJavaHome } from '../../core/jdk-resolver.js';
import { renderBuildEvent, renderDryRunStep } from '../renderer.js';
import type { BuildStep } from '../../core/types.js';

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
  buildRunner: BuildRunner,
  db: IDatabase,
  fs: FileSystem,
  config: AppConfig,
  options: BuildCommandOptions,
): Promise<boolean> {
  const resolvedPath = resolveStepPath(options.path, config.roots);
  const goals = options.goals ?? config.maven.defaultGoals;
  const flags = options.flags ?? config.maven.defaultFlags;
  const mavenExecutable = options.maven ?? config.maven.executable;
  const javaVersion = options.java;
  const javaHome = resolveJavaHome(config, javaVersion);

  const step: BuildStep = {
    path: resolvedPath,
    buildSystem: 'maven',
    goals,
    flags,
    label: path.basename(resolvedPath),
    mavenExecutable,
    javaVersion,
    javaHome,
  };

  if (options.dryRun) {
    const pomExists = await fs.exists(path.join(resolvedPath, 'pom.xml'));
    console.log('\n[DRY RUN]');
    renderDryRunStep(step, 0, 1, pomExists);
    return pomExists;
  }

  let stepRunId: number | undefined;
  try {
    const command = [step.mavenExecutable, ...step.goals, ...step.flags].join(' ');
    stepRunId = db.startBuildRun({
      projectPath: step.path,
      projectName: step.label,
      buildSystem: 'maven',
      command,
      javaHome: step.javaHome,
    });
  } catch {
    // non-fatal
  }

  let success = true;
  for await (const event of buildRunner.run(step, 0, 1)) {
    renderBuildEvent(event, options.json);
    if (event.type === 'step:done') {
      success = event.success;
      if (stepRunId !== undefined) {
        try {
          db.finishBuildRun({
            id: stepRunId,
            exitCode: event.exitCode,
            durationMs: event.durationMs,
            status: event.success ? 'success' : 'failed',
          });
        } catch {
          // non-fatal
        }
      }
    }
  }

  return success;
}
