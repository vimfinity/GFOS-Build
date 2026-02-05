/**
 * WorkspaceService - Project, JDK, module, and profile scanning.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { SCAN_EXCLUDE_DIRS } from '../../shared/constants';
import type { DiscoveredProject, JDK, MavenModule } from '../../shared/types';

class WorkspaceService {
  async scanProjects(
    rootPath: string,
    maxDepth = 5
  ): Promise<DiscoveredProject[]> {
    const projects: DiscoveredProject[] = [];

    if (!(await fs.pathExists(rootPath))) return projects;

    await this.scanProjectsRecursive(rootPath, rootPath, projects, 0, maxDepth);
    return projects.sort((a, b) => a.path.localeCompare(b.path));
  }

  private async scanProjectsRecursive(
    currentPath: string,
    rootPath: string,
    results: DiscoveredProject[],
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (this.shouldExclude(entry.name)) continue;
        if (!entry.isDirectory()) continue;

        const projectPath = path.join(currentPath, entry.name);
        const [isGitRepo, hasPom] = await Promise.all([
          fs.pathExists(path.join(projectPath, '.git')),
          fs.pathExists(path.join(projectPath, 'pom.xml')),
        ]);

        if (isGitRepo) {
          const relativePath = path.relative(rootPath, projectPath);
          const pathParts = relativePath.split(path.sep);
          const displayName =
            pathParts.length > 1
              ? pathParts.slice(-2).join('/')
              : entry.name;

          results.push({
            path: projectPath,
            name: displayName,
            isGitRepo: true,
            hasPom,
            pomPath: hasPom
              ? path.join(projectPath, 'pom.xml')
              : undefined,
            relativePath: relativePath.replace(/\\/g, '/'),
          });
        } else {
          await this.scanProjectsRecursive(
            projectPath,
            rootPath,
            results,
            depth + 1,
            maxDepth
          );
        }
      }
    } catch (error) {
      console.error(
        `[WorkspaceService] Error scanning ${currentPath}:`,
        error
      );
    }
  }

  async scanJDKs(scanPaths: string): Promise<JDK[]> {
    const jdks: JDK[] = [];
    const paths = scanPaths.split(';').filter(Boolean);

    for (const basePath of paths) {
      if (!(await fs.pathExists(basePath))) continue;

      try {
        const entries = await fs.readdir(basePath, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const jdkHome = path.join(basePath, entry.name);
          const javaExe = path.join(
            jdkHome,
            'bin',
            process.platform === 'win32' ? 'java.exe' : 'java'
          );

          if (await fs.pathExists(javaExe)) {
            const versionMatch = entry.name.match(/(\d+)(?:\.(\d+))?/);
            const majorVersion = versionMatch
              ? parseInt(versionMatch[1], 10)
              : 0;

            jdks.push({
              jdkHome,
              version: entry.name,
              majorVersion,
              vendor: this.detectVendor(entry.name),
            });
          }
        }
      } catch (error) {
        console.error(
          `[WorkspaceService] Error scanning JDKs in ${basePath}:`,
          error
        );
      }
    }

    return jdks.sort((a, b) => b.majorVersion - a.majorVersion);
  }

  async scanModules(pomPath: string): Promise<MavenModule[]> {
    const modules: MavenModule[] = [];
    const projectDir = path.dirname(pomPath);
    const scannedPaths = new Set<string>();

    await this.scanModulesRecursive(
      pomPath,
      projectDir,
      modules,
      scannedPaths,
      0
    );
    return modules.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  private async scanModulesRecursive(
    currentPomPath: string,
    basePath: string,
    results: MavenModule[],
    scannedPaths: Set<string>,
    depth: number
  ): Promise<void> {
    const normalizedPath = currentPomPath.toLowerCase();
    if (scannedPaths.has(normalizedPath)) return;
    scannedPaths.add(normalizedPath);

    try {
      const pomContent = await fs.readFile(currentPomPath, 'utf-8');
      const currentDir = path.dirname(currentPomPath);
      const relativePath = path.relative(basePath, currentDir) || '.';

      const groupIdMatch = pomContent.match(/<groupId>([^<]+)<\/groupId>/);
      const artifactIdMatch = pomContent.match(
        /<artifactId>([^<]+)<\/artifactId>/
      );
      const packagingMatch = pomContent.match(
        /<packaging>([^<]+)<\/packaging>/
      );
      const nameMatch = pomContent.match(/<name>([^<]+)<\/name>/);

      let groupId = groupIdMatch?.[1];
      if (!groupId) {
        const parentGroupMatch = pomContent.match(
          /<parent>[\s\S]*?<groupId>([^<]+)<\/groupId>/
        );
        groupId = parentGroupMatch?.[1] || 'unknown';
      }

      const artifactId = artifactIdMatch?.[1] || path.basename(currentDir);
      const displayName = nameMatch?.[1] || artifactId;
      const fullDisplayName =
        relativePath === '.'
          ? displayName
          : `${displayName} (${relativePath.replace(/\\/g, '/')})`;

      results.push({
        artifactId,
        groupId,
        pomPath: currentPomPath,
        packaging: packagingMatch?.[1] || 'jar',
        relativePath: relativePath.replace(/\\/g, '/'),
        displayName: fullDisplayName,
        depth,
      });

      // Find declared submodules
      const modulesMatch = pomContent.match(
        /<modules>([\s\S]*?)<\/modules>/
      );
      if (modulesMatch) {
        const moduleMatches = modulesMatch[1].matchAll(
          /<module>([^<]+)<\/module>/g
        );
        for (const match of moduleMatches) {
          const moduleName = match[1].trim();
          const modulePomPath = path.join(currentDir, moduleName, 'pom.xml');
          if (await fs.pathExists(modulePomPath)) {
            await this.scanModulesRecursive(
              modulePomPath,
              basePath,
              results,
              scannedPaths,
              depth + 1
            );
          }
        }
      }

      // Also scan subdirectories for pom.xml not declared in <modules>
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (
            entry.isDirectory() &&
            !entry.name.startsWith('.') &&
            entry.name !== 'target' &&
            entry.name !== 'src' &&
            entry.name !== 'node_modules'
          ) {
            const subPomPath = path.join(
              currentDir,
              entry.name,
              'pom.xml'
            );
            if (await fs.pathExists(subPomPath)) {
              await this.scanModulesRecursive(
                subPomPath,
                basePath,
                results,
                scannedPaths,
                depth + 1
              );
            }
          }
        }
      } catch {
        // Ignore errors when scanning subdirectories
      }
    } catch (error) {
      console.error(
        `[WorkspaceService] Error scanning module at ${currentPomPath}:`,
        error
      );
    }
  }

  async scanProfiles(pomPath: string): Promise<string[]> {
    const profiles = new Set<string>();
    await this.scanProfilesRecursive(pomPath, profiles);
    return Array.from(profiles).sort();
  }

  private async scanProfilesRecursive(
    currentPomPath: string,
    profiles: Set<string>
  ): Promise<void> {
    try {
      const pomContent = await fs.readFile(currentPomPath, 'utf-8');
      const currentDir = path.dirname(currentPomPath);

      const profileMatches = pomContent.matchAll(
        /<profile>\s*<id>([^<]+)<\/id>/g
      );
      for (const match of profileMatches) {
        profiles.add(match[1]);
      }

      const modulesMatch = pomContent.match(
        /<modules>([\s\S]*?)<\/modules>/
      );
      if (modulesMatch) {
        const moduleMatches = modulesMatch[1].matchAll(
          /<module>([^<]+)<\/module>/g
        );
        for (const match of moduleMatches) {
          const moduleName = match[1].trim();
          const modulePomPath = path.join(
            currentDir,
            moduleName,
            'pom.xml'
          );
          if (await fs.pathExists(modulePomPath)) {
            await this.scanProfilesRecursive(modulePomPath, profiles);
          }
        }
      }
    } catch (error) {
      console.error(
        `[WorkspaceService] Error scanning profiles at ${currentPomPath}:`,
        error
      );
    }
  }

  private shouldExclude(name: string): boolean {
    return (
      name.startsWith('.') ||
      SCAN_EXCLUDE_DIRS.includes(name.toLowerCase())
    );
  }

  private detectVendor(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('temurin') || lower.includes('adoptium'))
      return 'Eclipse Temurin';
    if (lower.includes('zulu')) return 'Azul Zulu';
    if (lower.includes('corretto')) return 'Amazon Corretto';
    if (lower.includes('graal')) return 'GraalVM';
    if (lower.includes('openjdk')) return 'OpenJDK';
    if (lower.includes('oracle')) return 'Oracle';
    return 'Unknown';
  }
}

export const workspaceService = new WorkspaceService();
