import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../src/cli/args.js';

describe('parseArgs', () => {
  it('parst scan defaults', () => {
    const parsed = parseArgs(['scan']);

    expect(parsed.command).toBe('scan');
    expect(parsed.roots).toEqual([]);
    expect(parsed.outputJson).toBe(false);
  });

  it('parst build Optionen inkl scope/module/filter/profiles/plan', () => {
    const parsed = parseArgs([
      'build',
      '--root',
      'J:/dev/quellen',
      '--max-depth',
      '5',
      '--goals',
      'clean verify',
      '--mvn',
      'mvnw',
      '--scope',
      'explicit-modules',
      '--module',
      'shared',
      '--include-module',
      'web',
      '--exclude-module',
      'legacy',
      '--profiles',
      '--profile-filter',
      'dev',
      '--no-fail-fast',
      '--max-parallel',
      '3',
      '--scan-cache',
      '--scan-cache-ttl-sec',
      '600',
      '--plan',
      '--json',
    ]);

    expect(parsed.command).toBe('build');
    expect(parsed.roots).toEqual(['J:/dev/quellen']);
    expect(parsed.maxDepth).toBe(5);
    expect(parsed.goals).toEqual(['clean', 'verify']);
    expect(parsed.mavenExecutable).toBe('mvnw');
    expect(parsed.buildScope).toBe('explicit-modules');
    expect(parsed.modules).toEqual(['shared']);
    expect(parsed.includeModules).toEqual(['web']);
    expect(parsed.excludeModules).toEqual(['legacy']);
    expect(parsed.discoverProfiles).toBe(true);
    expect(parsed.profileFilter).toBe('dev');
    expect(parsed.failFast).toBe(false);
    expect(parsed.maxParallel).toBe(3);
    expect(parsed.useScanCache).toBe(true);
    expect(parsed.scanCacheTtlSec).toBe(600);
    expect(parsed.planOnly).toBe(true);
    expect(parsed.outputJson).toBe(true);
  });

  it('parst pipeline plan/run', () => {
    const plan = parseArgs(['pipeline', 'plan', '--pipeline', './pipeline.json', '--json']);
    expect(plan.command).toBe('pipeline');
    expect(plan.pipelineAction).toBe('plan');
    expect(plan.pipelinePath).toBe('./pipeline.json');

    const run = parseArgs(['pipeline', 'run', '--pipeline', './pipeline.json']);
    expect(run.command).toBe('pipeline');
    expect(run.pipelineAction).toBe('run');
  });
});
