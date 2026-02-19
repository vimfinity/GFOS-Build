import { describe, expect, it } from 'vitest';
import { FileSystem } from '../../src/infrastructure/file-system.js';
import { RepositoryScanner } from '../../src/core/repository-scanner.js';

class InMemoryFileSystem implements FileSystem {
  constructor(
    private readonly tree: Record<string, { dirs?: string[]; files?: string[] }>,
    private readonly fileContent: Record<string, string> = {}
  ) {}

  async readDir(targetPath: string) {
    const node = this.tree[targetPath];
    if (!node) {
      return [];
    }

    return (node.dirs ?? []).map(
      name =>
        ({
          name,
          isDirectory: () => true,
          isFile: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        }) as unknown as import('node:fs').Dirent
    );
  }

  async exists(targetPath: string) {
    if (this.tree[targetPath]) {
      return true;
    }

    const separatorIndex = targetPath.lastIndexOf('/');
    const parent = targetPath.slice(0, separatorIndex);
    const file = targetPath.slice(separatorIndex + 1);
    return this.tree[parent]?.files?.includes(file) ?? false;
  }

  async readFile(targetPath: string): Promise<string> {
    const value = this.fileContent[targetPath];
    if (!value) {
      throw new Error(`Missing file: ${targetPath}`);
    }
    return value;
  }
}

describe('RepositoryScanner', () => {
  it('scan liefert Root-Module für Builds', async () => {
    const fs = new InMemoryFileSystem({
      '/root': { dirs: ['2025', 'docs'] },
      '/root/2025': { dirs: ['web', 'shared'] },
      '/root/2025/web': { dirs: ['module-a'], files: ['pom.xml'] },
      '/root/2025/web/module-a': { files: ['pom.xml'] },
      '/root/2025/shared': { files: ['pom.xml'] },
      '/root/docs': { files: ['readme.txt'] },
    });

    const scanner = new RepositoryScanner(fs);
    const repos = await scanner.scan({ rootPaths: ['/root'], maxDepth: 4, includeHidden: false });

    expect(repos.map(repo => repo.path)).toEqual(['/root/2025/shared', '/root/2025/web']);
  });

  it('scanGraph liefert verschachtelte Module inkl parentPath', async () => {
    const fs = new InMemoryFileSystem({
      '/root': { dirs: ['2025'] },
      '/root/2025': { dirs: ['web'] },
      '/root/2025/web': { dirs: ['module-a'], files: ['pom.xml'] },
      '/root/2025/web/module-a': { files: ['pom.xml'] },
    });

    const scanner = new RepositoryScanner(fs);
    const graph = await scanner.scanGraph({ rootPaths: ['/root'], maxDepth: 4, includeHidden: false });

    expect(graph.modules).toHaveLength(2);
    const sub = graph.modules.find(module => module.name === 'module-a');
    expect(sub?.parentPath).toBe('/root/2025/web');
    expect(graph.rootModules.map(module => module.path)).toEqual(['/root/2025/web']);
  });

  it('scanProfiles findet Profile in Modulen und filtert nach Name', async () => {
    const fs = new InMemoryFileSystem(
      {
        '/root': { dirs: ['shared'] },
        '/root/shared': { files: ['pom.xml'] },
      },
      {
        '/root/shared/pom.xml': `<project><profiles><profile><id>dev</id></profile><profile><id>prod</id></profile></profiles></project>`,
      }
    );

    const scanner = new RepositoryScanner(fs);
    const graph = await scanner.scanGraph({ rootPaths: ['/root'], maxDepth: 2, includeHidden: false });

    const all = await scanner.scanProfiles(graph.modules);
    const filtered = await scanner.scanProfiles(graph.modules, 'pro');

    expect(all.map(profile => profile.id)).toEqual(['dev', 'prod']);
    expect(filtered.map(profile => profile.id)).toEqual(['prod']);
  });

  it('respektiert maxDepth', async () => {
    const fs = new InMemoryFileSystem({
      '/root': { dirs: ['level1'] },
      '/root/level1': { dirs: ['level2'] },
      '/root/level1/level2': { files: ['pom.xml'] },
    });

    const scanner = new RepositoryScanner(fs);
    const repos = await scanner.scan({ rootPaths: ['/root'], maxDepth: 1, includeHidden: false });

    expect(repos).toHaveLength(0);
  });

  it('kann mehrere Roots zusammenführen und hidden Ordner ignorieren', async () => {
    const fs = new InMemoryFileSystem({
      '/a': { dirs: ['.cache', 'repo-a'] },
      '/a/.cache': { files: ['pom.xml'] },
      '/a/repo-a': { files: ['pom.xml'] },
      '/b': { dirs: ['repo-b'] },
      '/b/repo-b': { files: ['pom.xml'] },
    });

    const scanner = new RepositoryScanner(fs);
    const repos = await scanner.scan({ rootPaths: ['/a', '/b'], maxDepth: 2, includeHidden: false });

    expect(repos.map(repo => repo.path)).toEqual(['/a/repo-a', '/b/repo-b']);
  });
});
