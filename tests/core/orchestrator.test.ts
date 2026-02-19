import { describe, expect, it } from 'vitest';
import { runCommand } from '../../src/application/orchestrator.js';
import { BuildOptions, MavenProfile, MavenRepository, ModuleGraph } from '../../src/core/types.js';

const repositories: MavenRepository[] = [
  { name: 'shared', path: '/repos/shared', pomPath: '/repos/shared/pom.xml', depth: 1 },
  { name: 'web', path: '/repos/web', pomPath: '/repos/web/pom.xml', depth: 1 },
  {
    name: 'module-a',
    path: '/repos/web/module-a',
    pomPath: '/repos/web/module-a/pom.xml',
    depth: 2,
    parentPath: '/repos/web',
  },
];

const profiles: MavenProfile[] = [
  { id: 'dev', modulePath: '/repos/shared', pomPath: '/repos/shared/pom.xml' },
  { id: 'prod', modulePath: '/repos/web', pomPath: '/repos/web/pom.xml' },
];

const graph: ModuleGraph = {
  modules: repositories,
  rootModules: repositories.filter(repository => !repository.parentPath),
};

function createScanner(counter?: { count: number }) {
  return {
    scanGraph: async () => {
      if (counter) {
        counter.count += 1;
      }
      return graph;
    },
    scanProfiles: async (_modules: MavenRepository[], profileFilter?: string) => {
      if (!profileFilter) {
        return profiles;
      }
      return profiles.filter(profile => profile.id.includes(profileFilter));
    },
  };
}

function createBuildService(delays?: Record<string, number>) {
  return {
    buildRepository: async (repository: MavenRepository, _options: BuildOptions) => {
      const delay = delays?.[repository.path] ?? 0;
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      return { repository, exitCode: 0, durationMs: delay || 1000 };
    },
  };
}

function createCache() {
  const store = new Map<string, ModuleGraph>();

  return {
    createKey: (input: { roots: string[]; maxDepth: number; includeHidden: boolean }) =>
      JSON.stringify(input),
    read: async (key: string) => store.get(key) ?? null,
    write: async (key: string, value: ModuleGraph) => {
      store.set(key, value);
    },
  };
}

describe('runCommand', () => {
  it('liefert versionierten Report für scan inkl Modulgraph', async () => {
    const report = await runCommand(
      { command: 'scan', roots: ['/repos'], maxDepth: 4 },
      createScanner() as never,
      createBuildService() as never,
      createCache() as never
    );

    expect(report.schemaVersion).toBe('1.0');
    expect(report.mode).toBe('scan');
    expect(report.discovered).toHaveLength(3);
    expect(report.moduleGraph.rootModules).toHaveLength(2);
    expect(report.events.some(event => event.type === 'discovery_completed')).toBe(true);
    expect(report.profileScan.enabled).toBe(false);
  });

  it('scan kann profile discovery mit filter ausführen', async () => {
    const report = await runCommand(
      {
        command: 'scan',
        roots: ['/repos'],
        discoverProfiles: true,
        profileFilter: 'dev',
      },
      createScanner() as never,
      createBuildService() as never,
      createCache() as never
    );

    expect(report.profileScan.enabled).toBe(true);
    expect(report.profileScan.profiles).toHaveLength(1);
    expect(report.profileScan.profiles[0]?.id).toBe('dev');
    expect(report.stats.profileCount).toBe(1);
    expect(report.events.some(event => event.type === 'profile_discovery_completed')).toBe(true);
  });

  it('liefert Build-Plan mit include/exclude Filtern', async () => {
    const report = await runCommand(
      {
        command: 'build',
        roots: ['/repos'],
        goals: ['clean', 'verify'],
        mavenExecutable: 'mvn',
        buildScope: 'root-only',
        includeModules: ['web'],
        excludeModules: ['module-a'],
        planOnly: true,
      },
      createScanner() as never,
      createBuildService() as never,
      createCache() as never
    );

    expect(report.mode).toBe('build-plan');
    expect(report.buildPlan?.repositories).toHaveLength(1);
    expect(report.buildPlan?.repositories[0]?.path).toContain('/repos/web');
  });

  it('unterstützt explicit-modules Scope', async () => {
    const report = await runCommand(
      {
        command: 'build',
        roots: ['/repos'],
        goals: ['clean', 'verify'],
        mavenExecutable: 'mvn',
        buildScope: 'explicit-modules',
        modules: ['module-a'],
      },
      createScanner() as never,
      createBuildService() as never,
      createCache() as never
    );

    expect(report.mode).toBe('build-run');
    expect(report.buildPlan?.repositories).toHaveLength(1);
    expect(report.buildPlan?.repositories[0]?.path).toContain('module-a');
    expect(report.buildResults).toHaveLength(1);
  });

  it('reportet Build-Dauermetriken in stats', async () => {
    const buildService = {
      buildRepository: async (repository: MavenRepository, _options: BuildOptions) => {
        if (repository.path.endsWith('/shared')) {
          return { repository, exitCode: 0, durationMs: 120 };
        }
        return { repository, exitCode: 1, durationMs: 80 };
      },
    };

    const report = await runCommand(
      {
        command: 'build',
        roots: ['/repos'],
        goals: ['verify'],
        mavenExecutable: 'mvn',
        buildScope: 'root-only',
      },
      createScanner() as never,
      buildService as never,
      createCache() as never
    );

    expect(report.stats.totalBuildDurationMs).toBe(200);
    expect(report.stats.failedBuildDurationMs).toBe(80);
  });


  it('nutzt parallele Ausführung bei maxParallel > 1', async () => {
    const report = await runCommand(
      {
        command: 'build',
        roots: ['/repos'],
        goals: ['verify'],
        mavenExecutable: 'mvn',
        buildScope: 'root-only',
        maxParallel: 2,
      },
      createScanner() as never,
      createBuildService({ '/repos/shared': 120, '/repos/web': 120 }) as never,
      createCache() as never
    );

    expect(report.buildPlan?.strategy).toBe('parallel');
    expect(report.stats.maxParallelUsed).toBe(2);
    expect(report.durationMs).toBeLessThan(260);
  });

  it('verwendet discovery cache zwischen Aufrufen', async () => {
    const scanCounter = { count: 0 };
    const cache = createCache();

    await runCommand(
      {
        command: 'scan',
        roots: ['/repos'],
        useScanCache: true,
        scanCacheTtlSec: 300,
      },
      createScanner(scanCounter) as never,
      createBuildService() as never,
      cache as never
    );

    const second = await runCommand(
      {
        command: 'scan',
        roots: ['/repos'],
        useScanCache: true,
        scanCacheTtlSec: 300,
      },
      createScanner(scanCounter) as never,
      createBuildService() as never,
      cache as never
    );

    expect(scanCounter.count).toBe(1);
    expect(second.events.some(event => event.type === 'discovery_cache_hit')).toBe(true);
  });
});
