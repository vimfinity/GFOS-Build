import path from 'node:path';
import { z } from 'zod';
import { FileSystem, resolvePath } from '../infrastructure/file-system.js';
import { MavenRepository, ScanOptions } from './types.js';

const scanOptionsSchema = z.object({
  rootPaths: z.array(z.string().min(1)).min(1),
  maxDepth: z.number().int().min(0).max(12),
  includeHidden: z.boolean(),
});

interface QueueItem {
  directory: string;
  depth: number;
}

export class RepositoryScanner {
  constructor(private readonly fileSystem: FileSystem) {}

  async scan(options: ScanOptions): Promise<MavenRepository[]> {
    const parsedOptions = scanOptionsSchema.parse(options);
    const normalizedRoots = parsedOptions.rootPaths.map(root => resolvePath(root));

    const repositories = new Map<string, MavenRepository>();

    for (const rootPath of normalizedRoots) {
      const rootExists = await this.fileSystem.exists(rootPath);
      if (!rootExists) {
        continue;
      }

      const queue: QueueItem[] = [{ directory: rootPath, depth: 0 }];

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
          continue;
        }

        const pomPath = path.join(current.directory, 'pom.xml');
        if (await this.fileSystem.exists(pomPath)) {
          repositories.set(current.directory, {
            name: path.basename(current.directory),
            path: current.directory,
            pomPath,
            depth: current.depth,
          });
          continue;
        }

        if (current.depth >= parsedOptions.maxDepth) {
          continue;
        }

        const children = await this.fileSystem.readDir(current.directory);
        for (const child of children) {
          if (!child.isDirectory()) {
            continue;
          }

          if (!parsedOptions.includeHidden && child.name.startsWith('.')) {
            continue;
          }

          queue.push({
            directory: path.join(current.directory, child.name),
            depth: current.depth + 1,
          });
        }
      }
    }

    return [...repositories.values()].sort((a, b) => a.path.localeCompare(b.path));
  }
}
