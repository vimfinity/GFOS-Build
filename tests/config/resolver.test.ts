import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveStepPath } from '../../src/config/resolver.js';

const roots: Record<string, string> = {
  quellen: 'J:/dev/quellen',
  backup: 'D:/backup/repos',
};

describe('resolveStepPath', () => {
  it('treats single char before colon as Windows drive letter', () => {
    const result = resolveStepPath('J:/dev/quellen/2025/web', roots);
    expect(result).toBe(path.normalize('J:/dev/quellen/2025/web'));
  });

  it('resolves root-relative paths (2+ chars before colon)', () => {
    const result = resolveStepPath('quellen:2025/web', roots);
    expect(result).toBe(path.join(path.normalize('J:/dev/quellen'), path.normalize('2025/web')));
  });

  it('throws for unknown root name', () => {
    expect(() => resolveStepPath('unknown:2025/web', roots)).toThrow('Unknown root "unknown"');
    expect(() => resolveStepPath('unknown:2025/web', roots)).toThrow('quellen');
  });

  it('resolves paths without colon as relative to cwd', () => {
    const result = resolveStepPath('./my-project', roots);
    expect(result).toBe(path.resolve('./my-project'));
  });

  it('resolves bare paths without colon', () => {
    const result = resolveStepPath('my-project', roots);
    expect(result).toBe(path.resolve('my-project'));
  });

  it('throws with helpful message listing available roots', () => {
    try {
      resolveStepPath('missing:path', roots);
      expect.unreachable('Should have thrown');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('Unknown root "missing"');
      expect(msg).toContain('quellen');
      expect(msg).toContain('backup');
    }
  });

  it('handles root-relative paths with nested subdirectories', () => {
    const result = resolveStepPath('quellen:2025/web/xtimeweb/xtimeweb-ear-qs', roots);
    const expected = path.join(
      path.normalize('J:/dev/quellen'),
      path.normalize('2025/web/xtimeweb/xtimeweb-ear-qs')
    );
    expect(result).toBe(expected);
  });

  it('lists (none configured) when roots is empty', () => {
    expect(() => resolveStepPath('foo:bar', {})).toThrow('No roots configured');
  });
});
