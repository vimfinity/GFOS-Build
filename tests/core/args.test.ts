import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../src/cli/args.js';

describe('parseArgs', () => {
  it('parst scan defaults', () => {
    const parsed = parseArgs(['scan']);

    expect(parsed.command).toBe('scan');
    expect(parsed.roots).toEqual([]);
    expect(parsed.outputJson).toBe(false);
  });

  it('parst build Optionen', () => {
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
      '--no-fail-fast',
      '--json',
    ]);

    expect(parsed.command).toBe('build');
    expect(parsed.roots).toEqual(['J:/dev/quellen']);
    expect(parsed.maxDepth).toBe(5);
    expect(parsed.goals).toEqual(['clean', 'verify']);
    expect(parsed.mavenExecutable).toBe('mvnw');
    expect(parsed.failFast).toBe(false);
    expect(parsed.outputJson).toBe(true);
  });
});
