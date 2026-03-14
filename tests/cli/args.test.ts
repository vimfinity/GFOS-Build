import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../src/cli/args.js';

describe('parseArgs', () => {
  // Helper to create argv with 'bun' and 'script' as first two entries
  const argv = (...args: string[]) => ['bun', 'script.ts', ...args];

  describe('help and version', () => {
    it('parses help command', () => {
      expect(parseArgs(argv('help'))).toEqual({
        command: { name: 'help', topic: undefined },
        global: { json: false },
      });
    });

    it('parses help with topic', () => {
      expect(parseArgs(argv('help', 'build'))).toEqual({
        command: { name: 'help', topic: 'build' },
        global: { json: false },
      });
    });

    it('parses --help flag', () => {
      expect(parseArgs(argv('--help'))).toEqual({
        command: { name: 'help', topic: undefined },
        global: { json: false },
      });
    });

    it('parses -h flag', () => {
      expect(parseArgs(argv('-h'))).toEqual({
        command: { name: 'help', topic: undefined },
        global: { json: false },
      });
    });

    it('defaults to help when no args', () => {
      expect(parseArgs(argv())).toEqual({
        command: { name: 'help', topic: undefined },
        global: { json: false },
      });
    });

    it('parses version command', () => {
      expect(parseArgs(argv('version'))).toEqual({
        command: { name: 'version' },
        global: { json: false },
      });
    });

    it('parses --version flag', () => {
      expect(parseArgs(argv('--version'))).toEqual({
        command: { name: 'version' },
        global: { json: false },
      });
    });

    it('parses -v flag', () => {
      expect(parseArgs(argv('-v'))).toEqual({
        command: { name: 'version' },
        global: { json: false },
      });
    });
  });

  describe('build command', () => {
    it('parses build with path', () => {
      const result = parseArgs(argv('build', 'quellen:2025/web'));
      expect(result.command).toEqual({
        name: 'build',
        path: 'quellen:2025/web',
        goals: undefined,
        flags: undefined,
        maven: undefined,
        java: undefined,
        dryRun: false,
      });
      expect(result.global).toEqual({ json: false });
    });

    it('parses build with all options', () => {
      const result = parseArgs(argv(
        'build', 'quellen:2025/web',
        '--goals', 'clean install',
        '--flags', '-DskipTests -T 2C',
        '--maven', 'mvn.cmd',
        '--java', '21',
        '--dry-run',
        '--json',
        '--config', '/custom/config.json',
      ));
      expect(result.command).toEqual({
        name: 'build',
        path: 'quellen:2025/web',
        goals: ['clean', 'install'],
        flags: ['-DskipTests', '-T', '2C'],
        maven: 'mvn.cmd',
        java: '21',
        dryRun: true,
      });
      expect(result.global).toEqual({ json: true, config: '/custom/config.json' });
    });

    it('throws when path is missing', () => {
      expect(() => parseArgs(argv('build'))).toThrow('requires a path');
    });

    it('ignores unknown flags (no throw)', () => {
      // Unknown flags starting with '-' are silently ignored because
      // no positional path has been captured yet and arg.startsWith('-') is true
      expect(() => parseArgs(argv('build', 'path', '--unknown'))).not.toThrow();
      const result = parseArgs(argv('build', 'path', '--unknown'));
      expect(result.command.name).toBe('build');
    });
  });

  describe('pipeline commands', () => {
    it('parses pipeline run with name', () => {
      const result = parseArgs(argv('pipeline', 'run', 'web-2025'));
      expect(result.command).toEqual({
        name: 'pipeline:run',
        pipelineName: 'web-2025',
        from: undefined,
        continue: false,
        dryRun: false,
      });
      expect(result.global).toEqual({ json: false });
    });

    it('parses pipeline run with all options', () => {
      const result = parseArgs(argv(
        'pipeline', 'run', 'web-2025',
        '--from', '3',
        '--continue',
        '--dry-run',
        '--json',
      ));
      expect(result.command).toEqual({
        name: 'pipeline:run',
        pipelineName: 'web-2025',
        from: '3',
        continue: true,
        dryRun: true,
      });
      expect(result.global).toEqual({ json: true });
    });

    it('throws when pipeline name is missing', () => {
      expect(() => parseArgs(argv('pipeline', 'run'))).toThrow('requires a pipeline name');
    });

    it('parses pipeline list', () => {
      expect(parseArgs(argv('pipeline', 'list'))).toEqual({
        command: { name: 'pipeline:list' },
        global: { json: false },
      });
    });

    it('parses pipeline list with --json', () => {
      expect(parseArgs(argv('pipeline', 'list', '--json'))).toEqual({
        command: { name: 'pipeline:list' },
        global: { json: true },
      });
    });

    it('returns help for unknown pipeline subcommand', () => {
      expect(parseArgs(argv('pipeline', 'delete'))).toEqual({
        command: { name: 'help', topic: 'pipeline' },
        global: { json: false },
      });
    });
  });

  describe('scan command', () => {
    it('parses scan without path', () => {
      const result = parseArgs(argv('scan'));
      expect(result.command).toEqual({
        name: 'scan',
        path: undefined,
        noCache: false,
      });
      expect(result.global).toEqual({ json: false });
    });

    it('parses scan with path', () => {
      const result = parseArgs(argv('scan', 'quellen:2025'));
      expect(result.command).toEqual({
        name: 'scan',
        path: 'quellen:2025',
        noCache: false,
      });
      expect(result.global).toEqual({ json: false });
    });

    it('parses scan with all options', () => {
      const result = parseArgs(argv('scan', 'quellen:2025', '--no-cache', '--json'));
      expect(result.command).toEqual({
        name: 'scan',
        path: 'quellen:2025',
        noCache: true,
      });
      expect(result.global).toEqual({ json: true });
    });

    it('ignores removed depth flags', () => {
      const result = parseArgs(argv('scan', '--depth', 'abc'));
      expect(result.command).toEqual({
        name: 'scan',
        path: undefined,
        noCache: false,
      });
    });
  });

  describe('config commands', () => {
    it('parses config init', () => {
      expect(parseArgs(argv('config', 'init'))).toEqual({
        command: { name: 'config:init' },
        global: { json: false },
      });
    });

    it('parses config show', () => {
      expect(parseArgs(argv('config', 'show'))).toEqual({
        command: { name: 'config:show' },
        global: { json: false },
      });
    });

    it('parses config show --json', () => {
      expect(parseArgs(argv('config', 'show', '--json'))).toEqual({
        command: { name: 'config:show' },
        global: { json: true },
      });
    });

    it('returns help for unknown config subcommand', () => {
      expect(parseArgs(argv('config', 'delete'))).toEqual({
        command: { name: 'help', topic: 'config' },
        global: { json: false },
      });
    });
  });

  describe('global options', () => {
    it('parses --config with value', () => {
      const result = parseArgs(argv('--config', 'my.json', 'version'));
      expect(result.global).toEqual({ json: false, config: 'my.json' });
      expect(result.command).toEqual({ name: 'version' });
    });

    it('parses --json on any command', () => {
      const result = parseArgs(argv('scan', '--json'));
      expect(result.global.json).toBe(true);
    });
  });

  describe('unknown commands', () => {
    it('returns help for unknown command', () => {
      expect(parseArgs(argv('foobar'))).toEqual({
        command: { name: 'help' },
        global: { json: false },
      });
    });
  });
});
