import { loadConfig } from '../config/config.js';
import { RepositoryScanner } from '../core/repository-scanner.js';
import { BuildService } from '../core/build-service.js';
import { RunSummary } from '../core/types.js';

export interface RunCommandInput {
  command: 'scan' | 'build';
  roots?: string[];
  maxDepth?: number;
  includeHidden?: boolean;
  goals?: string[];
  mavenExecutable?: string;
  failFast?: boolean;
  configPath?: string;
}

export async function runCommand(
  input: RunCommandInput,
  scanner: RepositoryScanner,
  buildService: BuildService
): Promise<RunSummary> {
  const config = await loadConfig(input.configPath);

  const roots = input.roots && input.roots.length > 0 ? input.roots : config.roots;
  const maxDepth = input.maxDepth ?? config.scan.maxDepth;
  const includeHidden = input.includeHidden ?? config.scan.includeHidden;

  const discovered = await scanner.scan({
    rootPaths: roots,
    maxDepth,
    includeHidden,
  });

  if (input.command === 'scan' || discovered.length === 0) {
    return { discovered, buildResults: [] };
  }

  const goals = input.goals && input.goals.length > 0 ? input.goals : config.build.goals;
  const mavenExecutable = input.mavenExecutable ?? config.build.mavenExecutable;
  const failFast = input.failFast ?? config.build.failFast;

  const buildResults = await buildService.buildRepositories(discovered, {
    goals,
    mavenExecutable,
    failFast,
  });

  return { discovered, buildResults };
}
