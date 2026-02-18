import { ProcessRunner } from '../infrastructure/process-runner.js';
import { BuildOptions, BuildResult, MavenRepository } from './types.js';

export class BuildService {
  constructor(private readonly processRunner: ProcessRunner) {}

  async buildRepository(
    repository: MavenRepository,
    options: BuildOptions
  ): Promise<BuildResult> {
    const result = await this.processRunner.run(
      options.mavenExecutable,
      options.goals,
      repository.path
    );

    return {
      repository,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    };
  }

  async buildRepositories(
    repositories: MavenRepository[],
    options: BuildOptions
  ): Promise<BuildResult[]> {
    const results: BuildResult[] = [];

    for (const repository of repositories) {
      const result = await this.buildRepository(repository, options);
      results.push(result);

      if (options.failFast && result.exitCode !== 0) {
        break;
      }
    }

    return results;
  }
}
