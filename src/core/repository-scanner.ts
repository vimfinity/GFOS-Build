import path from 'node:path';
import { z } from 'zod';
import { FileSystem, resolvePath } from '../infrastructure/file-system.js';
import { DiscoveryRootMetric, MavenProfile, MavenRepository, ModuleGraph, ScanOptions } from './types.js';

const scanOptionsSchema = z.object({
  rootPaths: z.array(z.string().min(1)).min(1),
  maxDepth: z.number().int().min(0).max(12),
  includeHidden: z.boolean(),
});

interface QueueItem {
  directory: string;
  depth: number;
}


export interface ScanGraphResult {
  graph: ModuleGraph;
  rootMetrics: DiscoveryRootMetric[];
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
  const withoutComments = content.replace(/<!--[\s\S]*?-->/g, '');
  const profileSectionMatches = withoutComments.matchAll(
    /<(?:[A-Za-z0-9_-]+:)?profiles\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?profiles>/g
  );
  const ids = new Set<string>();

  for (const section of profileSectionMatches) {
    const sectionContent = section[1] ?? '';
    const profileMatches = sectionContent.matchAll(
      /<(?:[A-Za-z0-9_-]+:)?profile\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?profile>/g
    );

    for (const profileMatch of profileMatches) {
      const profileContent = profileMatch[1] ?? '';
      const idMatch = profileContent.match(
        /<(?:[A-Za-z0-9_-]+:)?id\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?id>/i
      );

      if (!idMatch?.[1]) {
        continue;
      }

      const normalized = idMatch[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();

      if (normalized.length > 0) {
        ids.add(normalized);
      }
    }
  }

  return [...ids].sort((a, b) => a.localeCompare(b));
}


export class RepositoryScanner {
  constructor(private readonly fileSystem: FileSystem) {}

  async scanGraph(options: ScanOptions): Promise<ModuleGraph> {
    const result = await this.scanGraphWithMetrics(options);
    return result.graph;
  }

  async scanGraphWithMetrics(options: ScanOptions): Promise<ScanGraphResult> {
    const parsedOptions = scanOptionsSchema.parse(options);
    const normalizedRoots = parsedOptions.rootPaths.map(root => resolvePath(root));

    const repositories = new Map<string, MavenRepository>();
    const rootMetrics: DiscoveryRootMetric[] = [];

    for (const rootPath of normalizedRoots) {
      const rootStartedAt = Date.now();
      let directoriesVisited = 0;
      let modulesFound = 0;

      const rootExists = await this.fileSystem.exists(rootPath);
      if (!rootExists) {
        rootMetrics.push({
          rootPath,
          durationMs: Date.now() - rootStartedAt,
          directoriesVisited: 0,
          modulesFound: 0,
          cacheHit: false,
        });
        continue;
      }

      const queue: QueueItem[] = [{ directory: rootPath, depth: 0 }];

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
          continue;
        }

        directoriesVisited += 1;
        const pomPath = path.join(current.directory, 'pom.xml');
        if (await this.fileSystem.exists(pomPath)) {
          repositories.set(current.directory, {
            name: path.basename(current.directory),
            path: current.directory,
            pomPath,
            depth: current.depth,
          });
          modulesFound += 1;
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

      rootMetrics.push({
        rootPath,
        durationMs: Date.now() - rootStartedAt,
        directoriesVisited,
        modulesFound,
        cacheHit: false,
      });
    }

    return {
      graph: buildModuleGraph([...repositories.values()]),
      rootMetrics,
    };
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
