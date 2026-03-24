import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { RepositoryScanner } from '../../packages/application/src/repository-scanner.js';
import type { FileSystem, DirEntry } from '../../packages/application/src/file-system.js';
import type { ScanEvent, ScanOptions } from '../../packages/domain/src/types.js';

class InMemoryFileSystem implements FileSystem {
  private files = new Map<string, string>();
  private directories = new Map<string, DirEntry[]>();

  addFile(p: string, content: string): void {
    this.files.set(path.normalize(p), content);
  }

  addDirectory(p: string, entries: DirEntry[]): void {
    this.directories.set(path.normalize(p), entries);
  }

  async exists(p: string): Promise<boolean> {
    const norm = path.normalize(p);
    return this.files.has(norm) || this.directories.has(norm);
  }

  async readDir(p: string): Promise<DirEntry[]> {
    return this.directories.get(path.normalize(p)) ?? [];
  }

  async readFile(p: string): Promise<string> {
    const content = this.files.get(path.normalize(p));
    if (content === undefined) throw new Error(`File not found: ${p}`);
    return content;
  }

  async writeFile(): Promise<void> {}
  async mkdir(): Promise<void> {}
}

function dirEntry(name: string, isDir: boolean): DirEntry {
  return { name, isDirectory: () => isDir };
}

async function collectEvents(scanner: RepositoryScanner, options: ScanOptions): Promise<ScanEvent[]> {
  const events: ScanEvent[] = [];
  for await (const event of scanner.scan(options)) {
    events.push(event);
  }
  return events;
}

describe('RepositoryScanner', () => {
  it('discovers a Maven project at root level', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces/2025/shared');

    fs.addDirectory(path.resolve('/workspaces/2025'), [dirEntry('shared', true)]);
    fs.addDirectory(rootPath, []);
    fs.addFile(path.join(rootPath, 'pom.xml'), '<project><artifactId>shared</artifactId><packaging>pom</packaging><modules><module>core</module></modules></project>');

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: false,
      exclude: [],
    });

    const found = events.filter((e) => e.type === 'repo:found');
    expect(found).toHaveLength(1);
    expect(found[0]!.type === 'repo:found' && found[0]!.project.name).toBe('shared');

    const done = events.find((e) => e.type === 'scan:done');
    expect(done).toBeDefined();
    if (done?.type === 'scan:done') {
      expect(done.projects).toHaveLength(1);
      expect(done.fromCache).toBe(false);
    }
  });

  it('collapses nested Maven modules under the broader project entry', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces');

    fs.addDirectory(rootPath, [dirEntry('parent', true)]);
    fs.addDirectory(path.join(rootPath, 'parent'), [dirEntry('child', true)]);
    fs.addFile(path.join(rootPath, 'parent', 'pom.xml'), '<project><artifactId>parent</artifactId><modules><module>child</module></modules></project>');
    fs.addFile(path.join(rootPath, 'parent', 'child', 'pom.xml'), '<project><artifactId>child</artifactId></project>');

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: false,
      exclude: [],
    });

    const found = events.filter((e) => e.type === 'repo:found');
    expect(found).toHaveLength(1);
    if (found[0]?.type === 'repo:found') {
      expect(found[0].project.name).toBe('parent');
      expect(found[0].project.maven?.modules.map((moduleEntry) => moduleEntry.relativePath)).toEqual(['child']);
    }
  });

  it('skips hidden directories by default', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces');

    fs.addDirectory(rootPath, [dirEntry('.hidden', true), dirEntry('visible', true)]);
    fs.addDirectory(path.join(rootPath, '.hidden'), []);
    fs.addDirectory(path.join(rootPath, 'visible'), []);
    fs.addFile(path.join(rootPath, '.hidden', 'pom.xml'), '<project><artifactId>hidden</artifactId></project>');
    fs.addFile(path.join(rootPath, 'visible', 'pom.xml'), '<project><artifactId>visible</artifactId></project>');

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: false,
      exclude: [],
    });

    const found = events.filter((e) => e.type === 'repo:found');
    expect(found).toHaveLength(1);
    expect(found[0]!.type === 'repo:found' && found[0]!.project.name).toBe('visible');
  });

  it('includes hidden directories when includeHidden is true', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces');

    fs.addDirectory(rootPath, [dirEntry('.hidden', true), dirEntry('visible', true)]);
    fs.addDirectory(path.join(rootPath, '.hidden'), []);
    fs.addDirectory(path.join(rootPath, 'visible'), []);
    fs.addFile(path.join(rootPath, '.hidden', 'pom.xml'), '<project><artifactId>hidden</artifactId></project>');
    fs.addFile(path.join(rootPath, 'visible', 'pom.xml'), '<project><artifactId>visible</artifactId></project>');

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: true,
      exclude: [],
    });

    const found = events.filter((e) => e.type === 'repo:found');
    expect(found).toHaveLength(2);
  });

  it('respects exclude list', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces');

    fs.addDirectory(rootPath, [dirEntry('keep', true), dirEntry('skip', true)]);
    fs.addDirectory(path.join(rootPath, 'keep'), []);
    fs.addDirectory(path.join(rootPath, 'skip'), []);
    fs.addFile(path.join(rootPath, 'keep', 'pom.xml'), '<project><artifactId>keep</artifactId></project>');
    fs.addFile(path.join(rootPath, 'skip', 'pom.xml'), '<project><artifactId>skip</artifactId></project>');

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: false,
      exclude: ['skip'],
    });

    const found = events.filter((e) => e.type === 'repo:found');
    expect(found).toHaveLength(1);
    expect(found[0]!.type === 'repo:found' && found[0]!.project.name).toBe('keep');
  });

  it('recursively scans without a depth limit', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces');

    fs.addDirectory(rootPath, [dirEntry('level1', true)]);
    fs.addDirectory(path.join(rootPath, 'level1'), [dirEntry('level2', true)]);
    fs.addDirectory(path.join(rootPath, 'level1', 'level2'), []);
    fs.addFile(path.join(rootPath, 'level1', 'level2', 'pom.xml'), '<project><artifactId>deep</artifactId></project>');

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: false,
      exclude: [],
    });

    expect(events.filter((e) => e.type === 'repo:found')).toHaveLength(1);
  });

  it('detects .mvn/maven.config', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces/shared');

    fs.addDirectory(rootPath, []);
    fs.addFile(path.join(rootPath, 'pom.xml'), '<project><artifactId>shared</artifactId></project>');
    fs.addFile(path.join(rootPath, '.mvn', 'maven.config'), '-T0.8C --show-version');

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: false,
      exclude: [],
    });

    const found = events.filter((e) => e.type === 'repo:found');
    expect(found).toHaveLength(1);
    if (found[0]!.type === 'repo:found') {
      expect(found[0]!.project.maven?.hasMvnConfig).toBe(true);
      expect(found[0]!.project.maven?.mvnConfigContent).toBe('-T0.8C --show-version');
    }
  });

  it('falls back to sub-module java version when root pom.xml has none', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces/gfoshg');

    fs.addDirectory(rootPath, [dirEntry('standard', true)]);
    fs.addDirectory(path.join(rootPath, 'standard'), [dirEntry('maven', true)]);
    fs.addDirectory(path.join(rootPath, 'standard', 'maven'), []);
    fs.addFile(
      path.join(rootPath, 'pom.xml'),
      '<project><artifactId>gfoshg-2025</artifactId><packaging>pom</packaging><modules><module>standard/maven</module></modules></project>',
    );
    fs.addFile(
      path.join(rootPath, 'standard', 'maven', 'pom.xml'),
      '<project><artifactId>standard</artifactId><properties><maven.compiler.source>21</maven.compiler.source></properties></project>',
    );

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: false,
      exclude: [],
    });

    const found = events.find((e) => e.type === 'repo:found');
    expect(found).toBeDefined();
    if (found?.type === 'repo:found') {
      expect(found.project.maven?.javaVersion).toBe('21');
    }
  });

  it('picks highest java version when sub-modules differ', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces/mixed');

    fs.addDirectory(rootPath, [dirEntry('moduleA', true), dirEntry('moduleB', true)]);
    fs.addDirectory(path.join(rootPath, 'moduleA'), []);
    fs.addDirectory(path.join(rootPath, 'moduleB'), []);
    fs.addFile(
      path.join(rootPath, 'pom.xml'),
      '<project><artifactId>mixed</artifactId><packaging>pom</packaging><modules><module>moduleA</module><module>moduleB</module></modules></project>',
    );
    fs.addFile(
      path.join(rootPath, 'moduleA', 'pom.xml'),
      '<project><artifactId>moduleA</artifactId><properties><maven.compiler.source>17</maven.compiler.source></properties></project>',
    );
    fs.addFile(
      path.join(rootPath, 'moduleB', 'pom.xml'),
      '<project><artifactId>moduleB</artifactId><properties><maven.compiler.source>21</maven.compiler.source></properties></project>',
    );

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: false,
      exclude: [],
    });

    const found = events.find((e) => e.type === 'repo:found');
    expect(found).toBeDefined();
    if (found?.type === 'repo:found') {
      expect(found.project.maven?.javaVersion).toBe('21');
    }
  });

  it('scans multiple roots', async () => {
    const fs = new InMemoryFileSystem();
    const root1 = path.resolve('/workspaces/root1');
    const root2 = path.resolve('/workspaces/root2');

    fs.addDirectory(root1, []);
    fs.addFile(path.join(root1, 'pom.xml'), '<project><artifactId>proj1</artifactId></project>');
    fs.addDirectory(root2, []);
    fs.addFile(path.join(root2, 'pom.xml'), '<project><artifactId>proj2</artifactId></project>');

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { r1: root1, r2: root2 },
      includeHidden: false,
      exclude: [],
    });

    const found = events.filter((e) => e.type === 'repo:found');
    expect(found).toHaveLength(2);
  });

  it('skips non-existent roots gracefully', async () => {
    const fs = new InMemoryFileSystem();
    const scanner = new RepositoryScanner(fs);

    const events = await collectEvents(scanner, {
      roots: { test: path.resolve('/nonexistent') },
      includeHidden: false,
      exclude: [],
    });

    const done = events.find((e) => e.type === 'scan:done');
    expect(done).toBeDefined();
    if (done?.type === 'scan:done') {
      expect(done.projects).toHaveLength(0);
    }
  });

  it('detects pnpm projects from lockfiles', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces/web');

    fs.addDirectory(rootPath, []);
    fs.addFile(path.join(rootPath, 'package.json'), JSON.stringify({ name: 'web', scripts: { build: 'vite build' } }));
    fs.addFile(path.join(rootPath, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: false,
      exclude: [],
    });

    const found = events.find((event) => event.type === 'repo:found');
    expect(found).toBeDefined();
    if (found?.type === 'repo:found') {
      expect(found.project.buildSystem).toBe('node');
      expect(found.project.node?.packageManager).toBe('pnpm');
      expect(found.project.node?.scripts.build).toBe('vite build');
    }
  });

  it('falls back to npm when no known lockfile exists', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces/app');

    fs.addDirectory(rootPath, []);
    fs.addFile(path.join(rootPath, 'package.json'), JSON.stringify({ name: 'app', scripts: { dev: 'vite' } }));

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: false,
      exclude: [],
    });

    const found = events.find((event) => event.type === 'repo:found');
    expect(found).toBeDefined();
    if (found?.type === 'repo:found') {
      expect(found.project.buildSystem).toBe('node');
      expect(found.project.node?.packageManager).toBe('npm');
    }
  });

  it('surfaces static deployable Maven candidates from pom.xml metadata', async () => {
    const fs = new InMemoryFileSystem();
    const rootPath = path.resolve('/workspaces/deployable-parent');

    fs.addDirectory(rootPath, [dirEntry('web', true), dirEntry('batch', true)]);
    fs.addDirectory(path.join(rootPath, 'web'), []);
    fs.addDirectory(path.join(rootPath, 'batch'), []);
    fs.addFile(
      path.join(rootPath, 'pom.xml'),
      `<project>
        <artifactId>deployable-parent</artifactId>
        <version>2.0.0</version>
        <packaging>pom</packaging>
        <modules>
          <module>web</module>
          <module>batch</module>
        </modules>
      </project>`,
    );
    fs.addFile(
      path.join(rootPath, 'web', 'pom.xml'),
      `<project>
        <artifactId>web</artifactId>
        <version>2.0.0</version>
        <packaging>war</packaging>
        <build>
          <directory>custom-target</directory>
          <finalName>web-dev</finalName>
        </build>
      </project>`,
    );
    fs.addFile(
      path.join(rootPath, 'batch', 'pom.xml'),
      `<project>
        <artifactId>batch</artifactId>
        <version>2.0.0</version>
        <packaging>jar</packaging>
      </project>`,
    );

    const scanner = new RepositoryScanner(fs);
    const events = await collectEvents(scanner, {
      roots: { test: rootPath },
      includeHidden: false,
      exclude: [],
    });

    const found = events.find((event) => event.type === 'repo:found');
    expect(found).toBeDefined();
    if (found?.type === 'repo:found') {
      expect(found.project.maven?.deployableCandidates).toEqual([
        {
          modulePath: 'batch',
          artifactId: 'batch',
          packaging: 'jar',
          declaredFinalName: undefined,
          declaredBuildDirectory: undefined,
          expectedDefaultFileName: 'batch-2.0.0.jar',
          selectionConfidence: 'manual',
        },
        {
          modulePath: 'web',
          artifactId: 'web',
          packaging: 'war',
          declaredFinalName: 'web-dev',
          declaredBuildDirectory: 'custom-target',
          expectedDefaultFileName: 'web-dev.war',
          selectionConfidence: 'high',
        },
      ]);
    }
  });
});
