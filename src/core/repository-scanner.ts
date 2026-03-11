import path from 'node:path';
import type { FileSystem } from '../infrastructure/file-system.js';
import type { Project, MavenMetadata, NpmMetadata, ScanEvent, ScanOptions } from './types.js';
import { parsePomMetadata } from './pom-parser.js';
import { parsePackageJson, type PackageParsed } from './package-parser.js';

export type { ScanOptions } from './types.js';

export class RepositoryScanner {
  constructor(private readonly fs: FileSystem) {}

  async *scan(options: ScanOptions): AsyncGenerator<ScanEvent> {
    const startTime = Date.now();
    const discovered: Project[] = [];
    const seen = new Set<string>();

    for (const [rootName, rootPath] of Object.entries(options.roots)) {
      if (!(await this.fs.exists(rootPath))) continue;

      const queue: Array<{ dir: string; depth: number }> = [{ dir: rootPath, depth: 0 }];

      while (queue.length > 0) {
        const { dir, depth } = queue.shift()!;
        if (seen.has(dir)) continue;

        const pomPath = path.join(dir, 'pom.xml');
        if (await this.fs.exists(pomPath)) {
          seen.add(dir);
          const maven = await this.extractMavenMetadata(pomPath);
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
          continue; // do not traverse submodules
        }

        // Check for Angular workspace (angular.json takes priority over package.json)
        const angularJsonPath = path.join(dir, 'angular.json');
        if (await this.fs.exists(angularJsonPath)) {
          seen.add(dir);
          const npm = await this.extractNpmMetadata(path.join(dir, 'package.json'), true);
          const project: Project = {
            name: path.basename(dir),
            path: dir,
            depth,
            rootName,
            buildSystem: 'npm',
            npm,
          };
          discovered.push(project);
          yield { type: 'repo:found', project };
          continue;
        }

        // Check for plain npm project (package.json without pom.xml or angular.json)
        const packageJsonPath = path.join(dir, 'package.json');
        if (await this.fs.exists(packageJsonPath)) {
          seen.add(dir);
          const npm = await this.extractNpmMetadata(packageJsonPath, false);
          const project: Project = {
            name: path.basename(dir),
            path: dir,
            depth,
            rootName,
            buildSystem: 'npm',
            npm,
          };
          discovered.push(project);
          yield { type: 'repo:found', project };
          continue;
        }

        if (depth >= options.maxDepth) continue;

        let entries;
        try {
          entries = await this.fs.readDir(dir);
        } catch {
          continue;
        }

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (entry.name === 'node_modules') continue;
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

  private async extractMavenMetadata(pomPath: string): Promise<MavenMetadata> {
    const dir = path.dirname(pomPath);
    let artifactId = 'unknown';
    let packaging = 'jar';
    let isAggregator = false;
    let javaVersion: string | undefined;

    try {
      const content = await this.fs.readFile(pomPath);
      const meta = parsePomMetadata(content);
      artifactId = meta.artifactId;
      packaging = meta.packaging;
      isAggregator = meta.isAggregator;
      javaVersion = meta.javaVersion;
    } catch {
      // non-fatal
    }

    const mvnConfigPath = path.join(dir, '.mvn', 'maven.config');
    const hasMvnConfig = await this.fs.exists(mvnConfigPath);
    let mvnConfigContent: string | undefined;
    if (hasMvnConfig) {
      try {
        mvnConfigContent = (await this.fs.readFile(mvnConfigPath)).trim();
      } catch {
        // non-fatal
      }
    }

    return { pomPath, artifactId, packaging, isAggregator, javaVersion, hasMvnConfig, mvnConfigContent };
  }

  private async extractNpmMetadata(packageJsonPath: string, isAngular: boolean): Promise<NpmMetadata> {
    let parsed: PackageParsed = { name: path.basename(path.dirname(packageJsonPath)), scripts: {}, isAngular };
    try {
      const content = await this.fs.readFile(packageJsonPath);
      parsed = parsePackageJson(content);
      if (isAngular) parsed = { ...parsed, isAngular: true };
    } catch {
      // non-fatal
    }
    return {
      packageJsonPath,
      name: parsed.name,
      version: parsed.version,
      scripts: parsed.scripts,
      isAngular: parsed.isAngular,
      angularVersion: parsed.angularVersion,
    };
  }
}
