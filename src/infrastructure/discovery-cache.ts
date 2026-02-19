import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ModuleGraph } from '../core/types.js';

interface CacheEnvelope {
  createdAtMs: number;
  graph: ModuleGraph;
}

export interface DiscoveryCache {
  read(key: string, ttlMs: number): Promise<ModuleGraph | null>;
  write(key: string, graph: ModuleGraph): Promise<void>;
  createKey(input: { roots: string[]; maxDepth: number; includeHidden: boolean }): string;
}

export class NodeDiscoveryCache implements DiscoveryCache {
  private readonly cacheDir = path.resolve('.gfos-build-cache');

  createKey(input: { roots: string[]; maxDepth: number; includeHidden: boolean }): string {
    const digest = createHash('sha256')
      .update(JSON.stringify({
        roots: [...input.roots].sort(),
        maxDepth: input.maxDepth,
        includeHidden: input.includeHidden,
      }))
      .digest('hex');

    return `scan-${digest}`;
  }

  async read(key: string, ttlMs: number): Promise<ModuleGraph | null> {
    const filePath = this.getFilePath(key);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const envelope = JSON.parse(content) as CacheEnvelope;
      if (Date.now() - envelope.createdAtMs > ttlMs) {
        return null;
      }
      return envelope.graph;
    } catch {
      return null;
    }
  }

  async write(key: string, graph: ModuleGraph): Promise<void> {
    const filePath = this.getFilePath(key);
    await fs.mkdir(this.cacheDir, { recursive: true });

    const envelope: CacheEnvelope = {
      createdAtMs: Date.now(),
      graph,
    };

    await fs.writeFile(filePath, JSON.stringify(envelope), 'utf-8');
  }

  private getFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }
}
