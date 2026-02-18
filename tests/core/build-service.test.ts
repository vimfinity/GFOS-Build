import { describe, expect, it } from 'vitest';
import { BuildService } from '../../src/core/build-service.js';
import { ProcessRunner } from '../../src/infrastructure/process-runner.js';
import { MavenRepository } from '../../src/core/types.js';

class FakeRunner implements ProcessRunner {
  constructor(private readonly exitCodes: number[]) {}

  async run(_command: string, _args: string[], _cwd: string) {
    const exitCode = this.exitCodes.shift() ?? 0;
    return { exitCode, durationMs: 1000 };
  }
}

const repositories: MavenRepository[] = [
  { name: 'repo-1', path: '/repo-1', pomPath: '/repo-1/pom.xml', depth: 1 },
  { name: 'repo-2', path: '/repo-2', pomPath: '/repo-2/pom.xml', depth: 1 },
  { name: 'repo-3', path: '/repo-3', pomPath: '/repo-3/pom.xml', depth: 1 },
];

describe('BuildService', () => {
  it('stoppt nach dem ersten Fehler wenn failFast=true', async () => {
    const service = new BuildService(new FakeRunner([0, 1, 0]));

    const results = await service.buildRepositories(repositories, {
      goals: ['clean', 'install'],
      mavenExecutable: 'mvn',
      failFast: true,
    });

    expect(results).toHaveLength(2);
    expect(results[1]?.exitCode).toBe(1);
  });

  it('baut alle Repositories wenn failFast=false', async () => {
    const service = new BuildService(new FakeRunner([0, 1, 0]));

    const results = await service.buildRepositories(repositories, {
      goals: ['clean', 'install'],
      mavenExecutable: 'mvn',
      failFast: false,
    });

    expect(results).toHaveLength(3);
    expect(results[1]?.exitCode).toBe(1);
    expect(results[2]?.exitCode).toBe(0);
  });
});
