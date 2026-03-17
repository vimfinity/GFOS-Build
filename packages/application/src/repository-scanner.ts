import path from 'node:path';
import type { Project, ScanEvent, ScanOptions } from '@gfos-build/domain';
import { inspectMavenProject } from './maven-project.js';
import { inspectNodeProject } from './node-project.js';
import type { FileSystem } from './file-system.js';

export type { ScanOptions } from '@gfos-build/domain';

const HARD_SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'target',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '.turbo',
]);

export class RepositoryScanner {
  constructor(private readonly fs: FileSystem) {}

  async *scan(options: ScanOptions): AsyncGenerator<ScanEvent> {
    const startTime = Date.now();
    const discovered: Project[] = [];
    const seen = new Set<string>();
    const claimedMavenModuleDirs = new Set<string>();

    for (const [rootName, rootPath] of Object.entries(options.roots)) {
      if (!(await this.fs.exists(rootPath))) continue;

      const queue: Array<{ dir: string; depth: number }> = [{ dir: rootPath, depth: 0 }];

      while (queue.length > 0) {
        const { dir, depth } = queue.shift()!;
        if (seen.has(dir)) continue;
        if (claimedMavenModuleDirs.has(path.normalize(dir))) {
          seen.add(dir);
          continue;
        }

        const pomPath = path.join(dir, 'pom.xml');
        if (await this.fs.exists(pomPath)) {
          seen.add(dir);
          const maven = await inspectMavenProject(this.fs, dir);
          if (!maven) {
            continue;
          }
          for (const moduleEntry of maven.modules) {
            claimedMavenModuleDirs.add(path.normalize(moduleEntry.fullPath));
          }
          const project: Project = {
            name: path.basename(dir),
            path: dir,
            depth,
            rootName,
            buildSystem: 'maven',
            maven,
          };
          discovered.push(project);
          yield { type: 'repo:found', project };
          continue;
        }

        // Check for Angular workspace (angular.json takes priority over package.json)
        const angularJsonPath = path.join(dir, 'angular.json');
        if (await this.fs.exists(angularJsonPath)) {
          seen.add(dir);
          const node = await inspectNodeProject(this.fs, dir, true);
          const project: Project = {
            name: path.basename(dir),
            path: dir,
            depth,
            rootName,
            buildSystem: 'node',
            node: node ?? undefined,
          };
          discovered.push(project);
          yield { type: 'repo:found', project };
          continue;
        }

        // Check for a plain Node project (package.json without pom.xml or angular.json)
        const packageJsonPath = path.join(dir, 'package.json');
        if (await this.fs.exists(packageJsonPath)) {
          seen.add(dir);
          const node = await inspectNodeProject(this.fs, dir, false);
          const project: Project = {
            name: path.basename(dir),
            path: dir,
            depth,
            rootName,
            buildSystem: 'node',
            node: node ?? undefined,
          };
          discovered.push(project);
          yield { type: 'repo:found', project };
          continue;
        }

        let entries;
        try {
          entries = await this.fs.readDir(dir);
        } catch {
          continue;
        }

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (HARD_SKIPPED_DIRECTORIES.has(entry.name)) continue;
          if (!options.includeHidden && entry.name.startsWith('.')) continue;
          if (options.exclude.includes(entry.name)) continue;
          queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
        }
      }
    }

    yield {
      type: 'scan:done',
      projects: [...discovered].sort((a, b) => a.path.localeCompare(b.path)),
      durationMs: Date.now() - startTime,
      fromCache: false,
    };
  }
}
