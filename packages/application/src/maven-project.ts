import path from 'node:path';
import type { MavenMetadata, MavenModuleMetadata, MavenProfileMetadata } from '@gfos-build/domain';
import { parsePom } from '@gfos-build/domain';
import type { FileSystem } from './file-system.js';

export async function inspectMavenProject(fs: FileSystem, projectPath: string): Promise<MavenMetadata | null> {
  const pomPath = path.join(projectPath, 'pom.xml');
  if (!(await fs.exists(pomPath))) {
    return null;
  }

  const visited = new Set<string>();
  const modules: MavenModuleMetadata[] = [];
  const profiles: MavenProfileMetadata[] = [];

  let rootArtifactId = 'unknown';
  let rootPackaging = 'jar';
  let rootJavaVersion: string | undefined;
  let isAggregator = false;

  async function visitModule(modulePath: string): Promise<void> {
    const normalizedModulePath = path.normalize(modulePath);
    if (visited.has(normalizedModulePath)) {
      return;
    }
    visited.add(normalizedModulePath);

    const currentPomPath = path.join(modulePath, 'pom.xml');
    if (!(await fs.exists(currentPomPath))) {
      return;
    }

    let parsed;
    try {
      parsed = parsePom(await fs.readFile(currentPomPath));
    } catch {
      return;
    }

    const relativePath = toPortablePath(path.relative(projectPath, modulePath));

    if (relativePath === '') {
      rootArtifactId = parsed.artifactId;
      rootPackaging = parsed.packaging;
      rootJavaVersion = parsed.javaVersion;
      isAggregator = parsed.isAggregator;
    } else {
      modules.push({
        id: parsed.artifactId,
        name: path.basename(modulePath),
        relativePath,
        fullPath: modulePath,
        packaging: parsed.packaging,
        javaVersion: parsed.javaVersion,
      });
    }

    for (const profile of parsed.profiles) {
      profiles.push({
        id: profile.id,
        activeByDefault: profile.activeByDefault,
        sourcePomPath: currentPomPath,
        sourceModulePath: relativePath,
      });
    }

    for (const childModule of parsed.modules) {
      const childModulePath = path.resolve(modulePath, childModule);
      await visitModule(childModulePath);
    }
  }

  await visitModule(projectPath);

  const mvnConfigPath = path.join(projectPath, '.mvn', 'maven.config');
  const hasMvnConfig = await fs.exists(mvnConfigPath);
  let mvnConfigContent: string | undefined;
  if (hasMvnConfig) {
    try {
      mvnConfigContent = (await fs.readFile(mvnConfigPath)).trim();
    } catch {
      // non-fatal
    }
  }

  return {
    pomPath,
    artifactId: rootArtifactId,
    packaging: rootPackaging,
    isAggregator,
    javaVersion: rootJavaVersion,
    modules: dedupeModules(modules),
    profiles: dedupeProfiles(profiles),
    hasMvnConfig,
    mvnConfigContent,
  };
}

function dedupeModules(modules: MavenModuleMetadata[]): MavenModuleMetadata[] {
  const byPath = new Map<string, MavenModuleMetadata>();
  for (const moduleEntry of modules) {
    byPath.set(moduleEntry.relativePath, moduleEntry);
  }
  return [...byPath.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function dedupeProfiles(profiles: MavenProfileMetadata[]): MavenProfileMetadata[] {
  const byKey = new Map<string, MavenProfileMetadata>();
  for (const profile of profiles) {
    byKey.set(`${profile.id}:${profile.sourceModulePath}`, profile);
  }
  return [...byKey.values()].sort(
    (a, b) => a.id.localeCompare(b.id) || a.sourceModulePath.localeCompare(b.sourceModulePath),
  );
}

function toPortablePath(value: string): string {
  return value.replace(/\\/g, '/');
}
