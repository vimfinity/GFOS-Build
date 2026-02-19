import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ModuleGraph } from '../core/types.js';

interface CacheEnvelope {
  createdAtMs: number;
  graph: ModuleGraph;
  rootsFingerprint?: string;
}

export interface DiscoveryCache {
  read(key: string, ttlMs: number, context?: { roots: string[] }): Promise<ModuleGraph | null>;
  write(key: string, graph: ModuleGraph, context?: { roots: string[] }): Promise<void>;
  createKey(input: { roots: string[]; maxDepth: number; includeHidden: boolean }): string;
}

function getDefaultCacheDir(): string {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ?? process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'GFOS-Build', 'cache');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches', 'gfos-build');
  }

  const xdg = process.env.XDG_CACHE_HOME;
  return path.join(xdg ?? path.join(os.homedir(), '.cache'), 'gfos-build');
}

export class NodeDiscoveryCache implements DiscoveryCache {
  private readonly cacheDir = getDefaultCacheDir();

  createKey(input: { roots: string[]; maxDepth: number; includeHidden: boolean }): string {
    const digest = createHash('sha256')
      .update(
        JSON.stringify({
          roots: [...input.roots].sort(),
          maxDepth: input.maxDepth,
          includeHidden: input.includeHidden,
        })
      )
      .digest('hex');

    return `scan-${digest}`;
  }

  async read(key: string, ttlMs: number, context?: { roots: string[] }): Promise<ModuleGraph | null> {
    const filePath = this.getFilePath(key);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const envelope = JSON.parse(content) as CacheEnvelope;
      if (Date.now() - envelope.createdAtMs > ttlMs) {
        return null;
      }

      if (context?.roots?.length) {
        const currentFingerprint = await this.createRootsFingerprint(context.roots);
        if (envelope.rootsFingerprint && currentFingerprint !== envelope.rootsFingerprint) {
          return null;
        }
      }

      return envelope.graph;
    } catch {
      return null;
    }
  }

  async write(key: string, graph: ModuleGraph, context?: { roots: string[] }): Promise<void> {
    const filePath = this.getFilePath(key);
    await fs.mkdir(this.cacheDir, { recursive: true });

    const envelope: CacheEnvelope = {
      createdAtMs: Date.now(),
      graph,
      rootsFingerprint: context?.roots?.length ? await this.createRootsFingerprint(context.roots) : undefined,
    };

    await fs.writeFile(filePath, JSON.stringify(envelope), 'utf-8');
  }


  private async createRootsFingerprint(roots: string[]): Promise<string> {
    const snapshots = await Promise.all(
      roots
        .map(root => root.trim())
        .filter(Boolean)
        .sort()
        .map(async root => {
          try {
            const stat = await fs.stat(root);
            return `${root}|${Math.floor(stat.mtimeMs)}|${stat.size}`;
          } catch {
            return `${root}|missing`;
          }
        })
    );

    return createHash('sha256').update(snapshots.join('||')).digest('hex');
  }

  private getFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }
}
