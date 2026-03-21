import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileScanCacheStore } from '../../packages/platform-node/src/scan-cache.js';

const SCANNED_AT = '2026-03-21T12:00:00.000Z';

describe('FileScanCacheStore', () => {
  it('reuses cache entries while tracked paths stay unchanged', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'gfos-build-scan-cache-'));
    try {
      const cacheDir = path.join(tempDir, 'cache');
      const trackedDir = path.join(tempDir, 'workspace');
      const trackedFile = path.join(trackedDir, 'pom.xml');

      mkdirSync(trackedDir, { recursive: true });
      writeFileSync(trackedFile, '<project />', 'utf8');

      const store = new FileScanCacheStore(cacheDir);
      const projects = [{ name: 'demo', path: trackedDir, depth: 0, rootName: 'ws', buildSystem: 'maven' }] as const;

      store.set('scan-key', [...projects], [trackedDir, trackedFile], SCANNED_AT);

      expect(store.get('scan-key', 60_000)).toEqual({
        projects: [...projects],
        scannedAt: SCANNED_AT,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('invalidates cache entries when a tracked file changes', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'gfos-build-scan-cache-'));
    try {
      const cacheDir = path.join(tempDir, 'cache');
      const trackedDir = path.join(tempDir, 'workspace');
      const trackedFile = path.join(trackedDir, 'pom.xml');

      mkdirSync(trackedDir, { recursive: true });
      writeFileSync(trackedFile, '<project />', 'utf8');

      const store = new FileScanCacheStore(cacheDir);
      const projects = [{ name: 'demo', path: trackedDir, depth: 0, rootName: 'ws', buildSystem: 'maven' }] as const;

      store.set('scan-key', [...projects], [trackedDir, trackedFile], SCANNED_AT);
      await new Promise((resolve) => setTimeout(resolve, 20));
      writeFileSync(trackedFile, '<project><artifactId>demo</artifactId></project>', 'utf8');

      expect(store.get('scan-key', 60_000)).toBeNull();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('invalidates cache entries when a tracked directory changes', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'gfos-build-scan-cache-'));
    try {
      const cacheDir = path.join(tempDir, 'cache');
      const trackedDir = path.join(tempDir, 'workspace');
      const trackedFile = path.join(trackedDir, 'package.json');

      mkdirSync(trackedDir, { recursive: true });
      writeFileSync(trackedFile, '{"name":"demo"}', 'utf8');

      const store = new FileScanCacheStore(cacheDir);
      const projects = [{ name: 'demo', path: trackedDir, depth: 0, rootName: 'ws', buildSystem: 'node' }] as const;

      store.set('scan-key', [...projects], [trackedDir, trackedFile], SCANNED_AT);
      await new Promise((resolve) => setTimeout(resolve, 20));
      mkdirSync(path.join(trackedDir, 'packages'));

      expect(store.get('scan-key', 60_000)).toBeNull();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
