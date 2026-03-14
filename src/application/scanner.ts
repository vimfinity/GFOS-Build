import * as crypto from 'node:crypto';
import type { RepositoryScanner, ScanOptions } from '../core/repository-scanner.js';
import type { ScanEvent } from '../core/types.js';
import type { IDatabase } from '../infrastructure/database.js';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

export class CachedScanner {
  constructor(
    private readonly scanner: RepositoryScanner,
    private readonly db: IDatabase,
  ) {}

  async *scan(
    options: ScanOptions,
    ttlMs = DEFAULT_CACHE_TTL_MS,
    noCache = false,
  ): AsyncGenerator<ScanEvent> {
    const cacheKey = buildCacheKey(options);

    if (!noCache) {
      const cached = this.db.getScanCache(cacheKey, ttlMs);
      if (cached) {
        for (const project of cached) {
          yield { type: 'repo:found', project };
        }
        yield { type: 'scan:done', projects: cached, durationMs: 0, fromCache: true };
        return;
      }
    }

    for await (const event of this.scanner.scan(options)) {
      yield event;
      if (event.type === 'scan:done') {
        this.db.setScanCache(cacheKey, event.projects);
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
