import path from 'node:path';
import { z } from 'zod';
import { FileSystem, resolvePath } from '../infrastructure/file-system.js';
import { MavenProfile, MavenRepository, ModuleGraph, ScanOptions } from './types.js';

const scanOptionsSchema = z.object({
  rootPaths: z.array(z.string().min(1)).min(1),
  maxDepth: z.number().int().min(0).max(12),
  includeHidden: z.boolean(),
});

interface QueueItem {
  directory: string;
  depth: number;
}

function buildModuleGraph(modules: MavenRepository[]): ModuleGraph {
  const sorted = [...modules]
    .map(module => ({ ...module, path: path.normalize(module.path), pomPath: path.normalize(module.pomPath) }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const moduleMap = new Map(sorted.map(module => [module.path, module]));

  const modulesWithParent = sorted.map(module => {
    let parentPath: string | undefined;
    let cursor = path.dirname(module.path);

    while (cursor !== module.path && cursor !== '.') {
      if (moduleMap.has(cursor)) {
        parentPath = cursor;
        break;
      }

      const next = path.dirname(cursor);
      if (next === cursor) {
        break;
      }
      cursor = next;
    }

    return {
      ...module,
      parentPath,
    };
  });

  return {
    modules: modulesWithParent,
    rootModules: modulesWithParent.filter(module => !module.parentPath),
  };
}

function parseProfilesFromPom(content: string): string[] {
  const profileBlocks = content.match(/<profile\b[\s\S]*?<\/profile>/g) ?? [];
  const ids: string[] = [];

  for (const block of profileBlocks) {
    const match = block.match(/<id>\s*([^<\s][^<]*)\s*<\/id>/);
    if (match?.[1]) {
      ids.push(match[1].trim());
    }
  }

  return [...new Set(ids)].sort();
}

export class RepositoryScanner {
  constructor(private readonly fileSystem: FileSystem) {}

  async scanGraph(options: ScanOptions): Promise<ModuleGraph> {
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

    return buildModuleGraph([...repositories.values()]);
  }

  async scanProfiles(modules: MavenRepository[], profileFilter?: string): Promise<MavenProfile[]> {
    const normalizedFilter = profileFilter?.trim().toLowerCase();
    const profiles: MavenProfile[] = [];

    for (const module of modules) {
      let content = '';
      try {
        content = await this.fileSystem.readFile(module.pomPath);
      } catch {
        continue;
      }

      const ids = parseProfilesFromPom(content);
      for (const id of ids) {
        if (normalizedFilter && !id.toLowerCase().includes(normalizedFilter)) {
          continue;
        }

        profiles.push({
          id,
          modulePath: module.path,
          pomPath: module.pomPath,
        });
      }
    }

    return profiles.sort((a, b) =>
      a.id === b.id ? a.modulePath.localeCompare(b.modulePath) : a.id.localeCompare(b.id)
    );
  }

  async scan(options: ScanOptions): Promise<MavenRepository[]> {
    const graph = await this.scanGraph(options);
    return graph.rootModules;
  }
}
