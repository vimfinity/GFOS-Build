/**
 * WorkspaceScanner Service
 * 
 * Analyzes the workspace to discover Git repositories, Maven modules,
 * and parse POM files for project information.
 */

import type { IFileSystem } from '../types/filesystem';
import type { GitRepository, MavenProject, JDK } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a discovered project (Git repository root).
 */
export interface DiscoveredProject {
  path: string;
  name: string;
  hasGit: boolean;
  hasMaven: boolean;
}

/**
 * Represents a Maven module within a project.
 */
export interface MavenModule {
  pomPath: string;
  projectPath: string;
  artifactId: string;
  groupId?: string;
  version?: string;
  packaging?: string;
  javaVersion?: string;
  parentArtifactId?: string;
  isRoot: boolean;
  /** The directory name containing the module (relative to project root) */
  directoryName: string;
  /** Available Maven profiles in this module */
  profiles?: string[];
}

/**
 * Parsed POM data.
 */
export interface ParsedPom {
  artifactId?: string;
  groupId?: string;
  version?: string;
  packaging?: string;
  javaVersion?: string;
  parentArtifactId?: string;
  modules?: string[];
  properties?: Record<string, string>;
  profiles?: string[];
}

/**
 * Scan options for repository discovery.
 */
export interface ScanOptions {
  maxDepth?: number;
  excludePatterns?: string[];
}

// ============================================================================
// POM Parser
// ============================================================================

/**
 * Simple XML/POM parser using regex.
 * Extracts key Maven project information without external dependencies.
 */
export class PomParser {
  /**
   * Parses a pom.xml content and extracts relevant information.
   */
  static parse(content: string): ParsedPom {
    const result: ParsedPom = {
      properties: {},
      profiles: [],
    };

    // Extract artifactId (direct child of project, not in parent)
    result.artifactId = this.extractDirectChild(content, 'artifactId');
    
    // Extract groupId (direct child, fallback to parent)
    result.groupId = this.extractDirectChild(content, 'groupId') 
      || this.extractFromParent(content, 'groupId');
    
    // Extract version (direct child, fallback to parent)
    result.version = this.extractDirectChild(content, 'version')
      || this.extractFromParent(content, 'version');
    
    // Extract packaging
    result.packaging = this.extractDirectChild(content, 'packaging') || 'jar';
    
    // Extract parent artifactId
    result.parentArtifactId = this.extractFromParent(content, 'artifactId');
    
    // Extract modules
    result.modules = this.extractModules(content);
    
    // Extract properties
    result.properties = this.extractProperties(content);
    
    // Extract Java version from various sources
    result.javaVersion = this.extractJavaVersion(content, result.properties || {});
    
    // Extract profiles
    result.profiles = this.extractProfiles(content);

    return result;
  }

  /**
   * Extracts a direct child element value from the project root.
   * Avoids matching elements inside <parent>, <dependencies>, etc.
   */
  private static extractDirectChild(content: string, tagName: string): string | undefined {
    // Remove parent block to avoid matching parent elements
    const withoutParent = content.replace(/<parent>[\s\S]*?<\/parent>/gi, '');
    // Remove dependencies block
    const withoutDeps = withoutParent.replace(/<dependencies>[\s\S]*?<\/dependencies>/gi, '');
    // Remove dependencyManagement block
    const withoutDepMgmt = withoutDeps.replace(/<dependencyManagement>[\s\S]*?<\/dependencyManagement>/gi, '');
    // Remove build block for cleaner extraction
    const cleaned = withoutDepMgmt.replace(/<build>[\s\S]*?<\/build>/gi, '');
    
    const regex = new RegExp(`<${tagName}>\\s*([^<]+)\\s*</${tagName}>`, 'i');
    const match = cleaned.match(regex);
    return match?.[1]?.trim();
  }

  /**
   * Extracts a value from the <parent> block.
   */
  private static extractFromParent(content: string, tagName: string): string | undefined {
    const parentMatch = content.match(/<parent>([\s\S]*?)<\/parent>/i);
    if (!parentMatch?.[1]) return undefined;
    
    const parentBlock = parentMatch[1];
    const regex = new RegExp(`<${tagName}>\\s*([^<]+)\\s*</${tagName}>`, 'i');
    const match = parentBlock.match(regex);
    return match?.[1]?.trim();
  }

  /**
   * Extracts module names from a multi-module POM.
   */
  private static extractModules(content: string): string[] {
    const modulesMatch = content.match(/<modules>([\s\S]*?)<\/modules>/i);
    if (!modulesMatch?.[1]) return [];
    
    const modulesBlock = modulesMatch[1];
    const moduleRegex = /<module>\s*([^<]+)\s*<\/module>/gi;
    const modules: string[] = [];
    
    let match;
    while ((match = moduleRegex.exec(modulesBlock)) !== null) {
      const moduleName = match[1];
      if (moduleName) {
        modules.push(moduleName.trim());
      }
    }
    
    return modules;
  }

  /**
   * Extracts properties from the <properties> block.
   */
  private static extractProperties(content: string): Record<string, string> {
    const propsMatch = content.match(/<properties>([\s\S]*?)<\/properties>/i);
    if (!propsMatch?.[1]) return {};
    
    const propsBlock = propsMatch[1];
    const propRegex = /<([a-zA-Z0-9._-]+)>\s*([^<]*)\s*<\/\1>/g;
    const properties: Record<string, string> = {};
    
    let match;
    while ((match = propRegex.exec(propsBlock)) !== null) {
      const key = match[1];
      const value = match[2];
      if (key && value !== undefined) {
        properties[key] = value.trim();
      }
    }
    
    return properties;
  }

  /**
   * Extracts Java version from various common property names.
   */
  private static extractJavaVersion(
    content: string, 
    properties: Record<string, string>
  ): string | undefined {
    // Common property names for Java version
    const javaVersionProps = [
      'java.version',
      'maven.compiler.source',
      'maven.compiler.target',
      'maven.compiler.release',
      'jdk.version',
    ];

    for (const prop of javaVersionProps) {
      if (properties[prop]) {
        return properties[prop];
      }
    }

    // Check for maven-compiler-plugin configuration
    const compilerSourceMatch = content.match(
      /<source>\s*([^<]+)\s*<\/source>/i
    );
    if (compilerSourceMatch?.[1]) {
      return compilerSourceMatch[1].trim();
    }

    const releaseMatch = content.match(
      /<release>\s*([^<]+)\s*<\/release>/i
    );
    if (releaseMatch?.[1]) {
      return releaseMatch[1].trim();
    }

    return undefined;
  }

  /**
   * Extracts profile IDs from the <profiles> block.
   */
  private static extractProfiles(content: string): string[] {
    const profilesMatch = content.match(/<profiles>([\s\S]*?)<\/profiles>/i);
    if (!profilesMatch?.[1]) return [];
    
    const profilesBlock = profilesMatch[1];
    const profiles: string[] = [];
    
    // Match each <profile> block and extract its <id>
    const profileRegex = /<profile>([\s\S]*?)<\/profile>/gi;
    let profileMatch;
    
    while ((profileMatch = profileRegex.exec(profilesBlock)) !== null) {
      const profileContent = profileMatch[1];
      if (profileContent) {
        const idMatch = profileContent.match(/<id>\s*([^<]+)\s*<\/id>/i);
        if (idMatch?.[1]) {
          profiles.push(idMatch[1].trim());
        }
      }
    }
    
    return profiles;
  }
}

// ============================================================================
// Workspace Scanner
// ============================================================================

/**
 * Service for scanning workspaces to discover projects and Maven modules.
 */
export class WorkspaceScanner {
  private fs: IFileSystem;
  private excludePatterns: string[];

  constructor(fileSystem: IFileSystem) {
    this.fs = fileSystem;
    this.excludePatterns = [
      'target',
      'node_modules',
      '.git',
      'bin',
      'build',
      'dist',
      '.idea',
      '.vscode',
      '.settings',
    ];
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Finds all Git repositories under a root path.
   * Stops recursion when a .git folder is found.
   * 
   * @param rootPath - The root path to scan from.
   * @param options - Scan options.
   * @returns Array of discovered projects.
   */
  async findRepositories(
    rootPath: string, 
    options: ScanOptions = {}
  ): Promise<DiscoveredProject[]> {
    const maxDepth = options.maxDepth ?? 10;
    const projects: DiscoveredProject[] = [];
    
    await this.scanForGitRepos(rootPath, projects, 0, maxDepth);
    
    return projects;
  }

  /**
   * Finds all Maven modules within a project.
   * Excludes target, node_modules, and other build directories.
   * 
   * @param projectPath - The project root path.
   * @returns Array of Maven modules.
   */
  async findMavenModules(projectPath: string): Promise<MavenModule[]> {
    const modules: MavenModule[] = [];
    
    await this.scanForPomFiles(projectPath, projectPath, modules);
    
    return modules;
  }

  /**
   * Parses a single pom.xml file.
   * 
   * @param pomPath - Path to the pom.xml file.
   * @returns Parsed POM data.
   */
  async parsePom(pomPath: string): Promise<ParsedPom | null> {
    try {
      const exists = await this.fs.exists(pomPath);
      if (!exists) return null;
      
      const content = await this.fs.readFile(pomPath);
      return PomParser.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Gets a complete analysis of a project.
   * Combines repository info with all Maven modules.
   * 
   * @param projectPath - The project root path.
   * @returns Complete project analysis.
   */
  async analyzeProject(projectPath: string): Promise<{
    project: DiscoveredProject;
    modules: MavenModule[];
  }> {
    const name = this.getNameFromPath(projectPath);
    const hasGit = await this.fs.exists(this.joinPath(projectPath, '.git'));
    const hasMaven = await this.fs.exists(this.joinPath(projectPath, 'pom.xml'));
    
    const project: DiscoveredProject = {
      path: projectPath,
      name,
      hasGit,
      hasMaven,
    };
    
    const modules = hasMaven ? await this.findMavenModules(projectPath) : [];
    
    return { project, modules };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Recursively scans for .git directories.
   * Stops descending into a directory once .git is found.
   */
  private async scanForGitRepos(
    currentPath: string,
    results: DiscoveredProject[],
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth > maxDepth) return;

    // Check if this directory has a .git folder
    const gitPath = this.joinPath(currentPath, '.git');
    const hasGit = await this.fs.exists(gitPath);
    
    if (hasGit) {
      // Found a repository - don't recurse further
      const pomPath = this.joinPath(currentPath, 'pom.xml');
      const hasMaven = await this.fs.exists(pomPath);
      
      results.push({
        path: currentPath,
        name: this.getNameFromPath(currentPath),
        hasGit: true,
        hasMaven,
      });
      return;
    }

    // Not a git repo - scan subdirectories
    try {
      const scanResult = await this.fs.scanDirectory(currentPath);
      
      for (const entry of scanResult.entries) {
        if (!entry.isDirectory) continue;
        if (this.shouldExclude(entry.name)) continue;
        
        await this.scanForGitRepos(
          entry.path,
          results,
          currentDepth + 1,
          maxDepth
        );
      }
    } catch {
      // Ignore permission errors, etc.
    }
  }

  /**
   * Recursively scans for pom.xml files within a project.
   */
  private async scanForPomFiles(
    currentPath: string,
    rootPath: string,
    modules: MavenModule[]
  ): Promise<void> {
    // Check for pom.xml in current directory
    const pomPath = this.joinPath(currentPath, 'pom.xml');
    const hasPom = await this.fs.exists(pomPath);
    
    if (hasPom) {
      const parsed = await this.parsePom(pomPath);
      if (parsed) {
        // Calculate directory name relative to project root
        const relativePath = currentPath === rootPath 
          ? '.' 
          : currentPath.replace(rootPath, '').replace(/^[\\/]+/, '');
        const dirName = relativePath === '.' ? this.getNameFromPath(rootPath) : relativePath;
        
        modules.push({
          pomPath,
          projectPath: currentPath,
          artifactId: parsed.artifactId || this.getNameFromPath(currentPath),
          groupId: parsed.groupId,
          version: parsed.version,
          packaging: parsed.packaging,
          javaVersion: parsed.javaVersion,
          parentArtifactId: parsed.parentArtifactId,
          isRoot: currentPath === rootPath,
          directoryName: dirName,
          profiles: parsed.profiles,
        });
      }
    }

    // Scan subdirectories
    try {
      const scanResult = await this.fs.scanDirectory(currentPath);
      
      for (const entry of scanResult.entries) {
        if (!entry.isDirectory) continue;
        if (this.shouldExcludeForPomScan(entry.name)) continue;
        
        await this.scanForPomFiles(entry.path, rootPath, modules);
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Scans for installed JDKs in a base directory.
   * Looks for directories that look like JDK installations.
   * 
   * @param basePath - Base path to scan (e.g., C:\Program Files\Java)
   * @returns Array of discovered JDKs.
   */
  async scanJdks(basePath: string): Promise<JDK[]> {
    const jdks: JDK[] = [];
    
    try {
      const exists = await this.fs.exists(basePath);
      if (!exists) return jdks;
      
      const entries = await this.fs.scanDirectory(basePath);
      
      for (const entry of entries.entries) {
        if (!entry.isDirectory) continue;
        
        // Look for java executable to verify it's a JDK
        const javaBinPath = this.joinPath(entry.path, 'bin', 'java.exe');
        const javaUnixPath = this.joinPath(entry.path, 'bin', 'java');
        
        const hasJava = await this.fs.exists(javaBinPath) || await this.fs.exists(javaUnixPath);
        if (!hasJava) continue;
        
        // Extract version from directory name
        const versionMatch = entry.name.match(/(\d+)(?:\.\d+)?/);
        const majorVersion = versionMatch?.[1] ? parseInt(versionMatch[1], 10) : 0;
        
        // Determine vendor from name
        let vendor = '';
        const nameLower = entry.name.toLowerCase();
        if (nameLower.includes('temurin') || nameLower.includes('adoptium')) {
          vendor = 'Eclipse Temurin';
        } else if (nameLower.includes('corretto')) {
          vendor = 'Amazon Corretto';
        } else if (nameLower.includes('zulu')) {
          vendor = 'Azul Zulu';
        } else if (nameLower.includes('graalvm')) {
          vendor = 'GraalVM';
        } else if (nameLower.includes('openjdk')) {
          vendor = 'OpenJDK';
        } else if (nameLower.includes('oracle')) {
          vendor = 'Oracle';
        } else if (nameLower.match(/^jdk-?\d+/)) {
          // Generic JDK directory like "jdk17" or "jdk-21"
          vendor = 'JDK';
        }
        
        jdks.push({
          jdkHome: entry.path,
          version: entry.name,
          majorVersion,
          vendor,
        });
      }
      
      // Sort by major version descending
      jdks.sort((a, b) => b.majorVersion - a.majorVersion);
      
    } catch {
      // Ignore scan errors
    }
    
    return jdks;
  }

  /**
   * Checks if a directory should be excluded from git scanning.
   */
  private shouldExclude(name: string): boolean {
    return this.excludePatterns.includes(name.toLowerCase());
  }

  /**
   * Checks if a directory should be excluded from pom scanning.
   * More restrictive than general exclusion.
   */
  private shouldExcludeForPomScan(name: string): boolean {
    const lowerName = name.toLowerCase();
    return (
      lowerName === 'target' ||
      lowerName === 'node_modules' ||
      lowerName === '.git' ||
      lowerName === 'bin' ||
      lowerName === 'build' ||
      lowerName === 'dist' ||
      lowerName.startsWith('.')
    );
  }

  /**
   * Extracts the directory name from a path.
   */
  private getNameFromPath(filePath: string): string {
    // Handle both Windows and Unix paths
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || parts[parts.length - 2] || 'unknown';
  }

  /**
   * Joins path segments with the appropriate separator.
   */
  private joinPath(...segments: string[]): string {
    // Detect if we're dealing with Windows paths
    const isWindows = segments[0]?.includes('\\') || segments[0]?.match(/^[A-Z]:/i);
    const separator = isWindows ? '\\' : '/';
    
    return segments.join(separator);
  }
}
