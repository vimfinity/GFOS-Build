import { describe, expect, it } from 'vitest';
import { buildChildProcessEnv } from '../../src/infrastructure/process-env.js';

describe('buildChildProcessEnv', () => {
  it('does not inherit NODE_ENV from the parent process', () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'gfos-build';

    try {
      const env = buildChildProcessEnv();
      expect(env['NODE_ENV']).toBeUndefined();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnv;
      }
    }
  });

  it('preserves an explicitly provided NODE_ENV override', () => {
    const env = buildChildProcessEnv({ NODE_ENV: 'production' });
    expect(env['NODE_ENV']).toBe('production');
  });
});
