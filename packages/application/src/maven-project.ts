import path from 'node:path';
import type {
  DeployableArtifactCandidate,
  MavenMetadata,
  MavenModuleMetadata,
  MavenProfileMetadata,
} from '@gfos-build/domain';
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
  let rootVersion: string | undefined;
  let rootPackaging = 'jar';
  let rootJavaVersion: string | undefined;
  let rootBuildDirectory: string | undefined;
  let rootFinalName: string | undefined;
  let isAggregator = false;
  const deployableCandidates: DeployableArtifactCandidate[] = [];

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
        rootVersion = parsed.version;
        rootPackaging = parsed.packaging;
        rootJavaVersion = parsed.javaVersion;
        rootBuildDirectory = parsed.buildDirectory;
        rootFinalName = parsed.finalName;
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

      const deployableCandidate = toDeployableCandidate(parsed, relativePath);
      if (deployableCandidate) {
        deployableCandidates.push(deployableCandidate);
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

  const dedupedModules = dedupeModules(modules);

  return {
    pomPath,
    artifactId: rootArtifactId,
    version: rootVersion,
    packaging: rootPackaging,
    isAggregator,
    javaVersion: highestJavaVersion([rootJavaVersion, ...dedupedModules.map((m) => m.javaVersion)]),
    buildDirectory: rootBuildDirectory,
    finalName: rootFinalName,
    modules: dedupedModules,
    profiles: dedupeProfiles(profiles),
    deployableCandidates: dedupeDeployableCandidates(deployableCandidates),
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

function highestJavaVersion(versions: (string | undefined)[]): string | undefined {
  const parsed = versions
    .filter((v): v is string => v !== undefined)
    .map((v) => ({ raw: v, numeric: parseInt(v, 10) }))
    .filter((v) => !isNaN(v.numeric));

  if (parsed.length === 0) return undefined;
  return parsed.reduce((a, b) => (b.numeric > a.numeric ? b : a)).raw;
}

function toPortablePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function toDeployableCandidate(
  parsed: ReturnType<typeof parsePom>,
  relativePath: string,
): DeployableArtifactCandidate | null {
  const packaging = parsed.packaging.toLowerCase();
  if (packaging === 'pom') {
    return null;
  }
  if (!['ear', 'war', 'rar', 'jar'].includes(packaging)) {
    return null;
  }

  return {
    modulePath: relativePath,
    artifactId: parsed.artifactId,
    packaging: packaging as DeployableArtifactCandidate['packaging'],
    declaredFinalName: parsed.finalName,
    declaredBuildDirectory: parsed.buildDirectory,
    expectedDefaultFileName: `${parsed.finalName ?? defaultFinalName(parsed.artifactId, parsed.version)}.${packaging}`,
    selectionConfidence: packaging === 'jar' ? 'manual' : 'high',
  };
}

function dedupeDeployableCandidates(candidates: DeployableArtifactCandidate[]): DeployableArtifactCandidate[] {
  const byKey = new Map<string, DeployableArtifactCandidate>();
  for (const candidate of candidates) {
    byKey.set(`${candidate.modulePath}:${candidate.artifactId}:${candidate.packaging}`, candidate);
  }
  return [...byKey.values()].sort(
    (a, b) => a.modulePath.localeCompare(b.modulePath) || a.artifactId.localeCompare(b.artifactId),
  );
}

function defaultFinalName(artifactId: string, version?: string): string {
  return version ? `${artifactId}-${version}` : artifactId;
}
