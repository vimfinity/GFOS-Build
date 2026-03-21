import * as crypto from 'node:crypto';
import type { ScanEvent } from '@gfos-build/domain';
import type { RepositoryScanner, ScanOptions } from './repository-scanner.js';

export interface ScanCacheStore {
  get(key: string, ttlMs: number): { projects: import('@gfos-build/domain').Project[]; scannedAt: string } | null;
  set(key: string, projects: import('@gfos-build/domain').Project[], validationPaths: string[], scannedAt: string): void;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

export class CachedScanner {
  constructor(
    private readonly scanner: RepositoryScanner,
    private readonly cache: ScanCacheStore,
  ) {}

  async *scan(
    options: ScanOptions,
    ttlMs = DEFAULT_CACHE_TTL_MS,
    noCache = false,
  ): AsyncGenerator<ScanEvent> {
    const cacheKey = buildCacheKey(options);
    const validationPaths = new Set<string>();

    if (!noCache) {
      const cached = this.cache.get(cacheKey, ttlMs);
      if (cached) {
        for (const project of cached.projects) {
          yield { type: 'repo:found', project };
        }
        yield { type: 'scan:done', projects: cached.projects, durationMs: 0, fromCache: true, scannedAt: cached.scannedAt };
        return;
      }
    }

    for await (const event of this.scanner.scan(options, {
      trackPath: (trackedPath) => {
        validationPaths.add(trackedPath);
      },
    })) {
      yield event;
      if (event.type === 'scan:done') {
        this.cache.set(cacheKey, event.projects, [...validationPaths].sort(), event.scannedAt);
      }
    }
  }
}

function buildCacheKey(options: ScanOptions): string {
  const data = JSON.stringify({
    roots: Object.entries(options.roots).sort(),
    includeHidden: options.includeHidden,
    exclude: [...options.exclude].sort(),
  });
  return crypto.createHash('sha1').update(data).digest('hex').slice(0, 16);
}
