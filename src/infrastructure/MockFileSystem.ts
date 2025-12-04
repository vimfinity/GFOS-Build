/**
 * MockFileSystem - Mock File System Implementation
 * 
 * Returns static dummy data simulating a complex C:\dev structure.
 * Used when MOCK_MODE=true for development in environments without
 * access to the actual file system (e.g., Codespaces).
 */

import type { IFileSystem, FileStats } from '../core/types/filesystem';
import type { DirectoryEntry, ScanResult } from '../core/types';

/**
 * Mock data structure representing the simulated file system.
 */
interface MockFileSystemData {
  gitRepositories: string[];
  mavenProjects: string[];
  jdks: { path: string; version: string }[];
  files: Record<string, string>;
}

/**
 * Default mock data based on result.json structure.
 */
const DEFAULT_MOCK_DATA: MockFileSystemData = {
  gitRepositories: [
    'C:\\dev\\quellen\\2025\\delphi',
    'C:\\dev\\quellen\\2025\\gfosdashboard',
    'C:\\dev\\quellen\\2025\\gfoshg',
    'C:\\dev\\quellen\\2025\\gfoshg_2',
    'C:\\dev\\quellen\\2025\\gfosshared',
    'C:\\dev\\quellen\\2025\\gfosshared_2',
    'C:\\dev\\quellen\\2025\\gfosweb',
    'C:\\dev\\quellen\\2025\\gfosweb_2',
    'C:\\dev\\quellen\\2025\\gfosweb_3',
    'C:\\dev\\quellen\\4.8\\delphi',
    'C:\\dev\\quellen\\4.8\\gfosdashboard',
    'C:\\dev\\quellen\\4.8\\gfoshg',
    'C:\\dev\\quellen\\4.8\\gfosweb',
    'C:\\dev\\quellen\\4.8\\shared',
    'C:\\dev\\quellen\\4.8plus\\delphi',
    'C:\\dev\\quellen\\4.8plus\\gfosdashboard',
    'C:\\dev\\quellen\\4.8plus\\gfoshg',
    'C:\\dev\\quellen\\4.8plus\\gfosshared',
    'C:\\dev\\quellen\\4.8plus\\gfosweb',
    'C:\\dev\\quellen\\4.8plus\\gfosweb_2',
    'C:\\dev\\quellen\\bruno',
    'C:\\dev\\quellen\\gfosPlan\\scripts',
  ],
  mavenProjects: [
    'C:\\dev\\quellen\\2025\\gfosdashboard',
    'C:\\dev\\quellen\\2025\\gfoshg',
    'C:\\dev\\quellen\\2025\\gfoshg_2',
    'C:\\dev\\quellen\\2025\\gfosshared',
    'C:\\dev\\quellen\\2025\\gfosshared_2',
    'C:\\dev\\quellen\\2025\\gfosweb',
    'C:\\dev\\quellen\\2025\\gfosweb_2',
    'C:\\dev\\quellen\\2025\\gfosweb_3',
    'C:\\dev\\quellen\\4.8\\gfosweb',
    'C:\\dev\\quellen\\4.8\\shared',
    'C:\\dev\\quellen\\4.8plus\\gfosdashboard',
    'C:\\dev\\quellen\\4.8plus\\gfoshg',
    'C:\\dev\\quellen\\4.8plus\\gfosshared',
    'C:\\dev\\quellen\\4.8plus\\gfosweb',
    'C:\\dev\\quellen\\4.8plus\\gfosweb_2',
  ],
  jdks: [
    { path: 'C:\\dev\\java\\jdk8', version: '1.8.0_452' },
    { path: 'C:\\dev\\java\\jdk11', version: '11.0.27' },
    { path: 'C:\\dev\\java\\jdk17', version: '17.0.15' },
    { path: 'C:\\dev\\java\\jdk21', version: '21.0.7' },
  ],
  files: {
    // =========================================================================
    // 2025 Projects - Multi-module Maven with JDK 21
    // =========================================================================
    
    // gfosdashboard - Simple WAR project
    'C:\\dev\\quellen\\2025\\gfosdashboard\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>de.gfos.dashboard</groupId>
  <artifactId>gfosdashboard</artifactId>
  <version>2025.1.0-SNAPSHOT</version>
  <packaging>war</packaging>
  
  <properties>
    <java.version>21</java.version>
    <maven.compiler.source>21</maven.compiler.source>
    <maven.compiler.target>21</maven.compiler.target>
  </properties>
</project>`,

    // gfoshg - Multi-module parent POM
    'C:\\dev\\quellen\\2025\\gfoshg\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>de.gfos.hg</groupId>
  <artifactId>gfoshg-parent</artifactId>
  <version>2025.1.0-SNAPSHOT</version>
  <packaging>pom</packaging>
  
  <properties>
    <java.version>21</java.version>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
  
  <modules>
    <module>gfoshg-core</module>
    <module>gfoshg-api</module>
    <module>gfoshg-web</module>
  </modules>
</project>`,
    
    // gfoshg submodules
    'C:\\dev\\quellen\\2025\\gfoshg\\gfoshg-core\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>de.gfos.hg</groupId>
    <artifactId>gfoshg-parent</artifactId>
    <version>2025.1.0-SNAPSHOT</version>
  </parent>
  <artifactId>gfoshg-core</artifactId>
  <packaging>jar</packaging>
</project>`,

    'C:\\dev\\quellen\\2025\\gfoshg\\gfoshg-api\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>de.gfos.hg</groupId>
    <artifactId>gfoshg-parent</artifactId>
    <version>2025.1.0-SNAPSHOT</version>
  </parent>
  <artifactId>gfoshg-api</artifactId>
  <packaging>jar</packaging>
</project>`,

    'C:\\dev\\quellen\\2025\\gfoshg\\gfoshg-web\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>de.gfos.hg</groupId>
    <artifactId>gfoshg-parent</artifactId>
    <version>2025.1.0-SNAPSHOT</version>
  </parent>
  <artifactId>gfoshg-web</artifactId>
  <packaging>war</packaging>
</project>`,

    // gfosshared - Shared libraries multi-module
    'C:\\dev\\quellen\\2025\\gfosshared\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>de.gfos.shared</groupId>
  <artifactId>gfosshared-parent</artifactId>
  <version>2025.1.0-SNAPSHOT</version>
  <packaging>pom</packaging>
  
  <properties>
    <java.version>17</java.version>
  </properties>
  
  <modules>
    <module>shared-utils</module>
    <module>shared-dto</module>
  </modules>
</project>`,

    'C:\\dev\\quellen\\2025\\gfosshared\\shared-utils\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>de.gfos.shared</groupId>
    <artifactId>gfosshared-parent</artifactId>
    <version>2025.1.0-SNAPSHOT</version>
  </parent>
  <artifactId>shared-utils</artifactId>
  <packaging>jar</packaging>
</project>`,

    'C:\\dev\\quellen\\2025\\gfosshared\\shared-dto\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>de.gfos.shared</groupId>
    <artifactId>gfosshared-parent</artifactId>
    <version>2025.1.0-SNAPSHOT</version>
  </parent>
  <artifactId>shared-dto</artifactId>
  <packaging>jar</packaging>
</project>`,

    // gfosweb - Web application
    'C:\\dev\\quellen\\2025\\gfosweb\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>de.gfos.web</groupId>
  <artifactId>gfosweb</artifactId>
  <version>2025.1.0-SNAPSHOT</version>
  <packaging>war</packaging>
  
  <properties>
    <maven.compiler.release>21</maven.compiler.release>
  </properties>
  
  <profiles>
    <profile>
      <id>easyui</id>
    </profile>
    <profile>
      <id>envIntegration</id>
    </profile>
    <profile>
      <id>jasper</id>
    </profile>
    <profile>
      <id>jsminify</id>
    </profile>
    <profile>
      <id>ng-development</id>
    </profile>
    <profile>
      <id>ng-production</id>
    </profile>
    <profile>
      <id>release</id>
    </profile>
    <profile>
      <id>with_gfostools</id>
    </profile>
    <profile>
      <id>xtime</id>
    </profile>
  </profiles>
</project>`,

    // =========================================================================
    // 4.8 Projects - Legacy with JDK 11
    // =========================================================================
    
    'C:\\dev\\quellen\\4.8\\gfosweb\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>de.gfos.web</groupId>
  <artifactId>gfosweb</artifactId>
  <version>4.8.0-SNAPSHOT</version>
  <packaging>war</packaging>
  
  <properties>
    <java.version>11</java.version>
  </properties>
</project>`,

    'C:\\dev\\quellen\\4.8\\shared\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>de.gfos.shared</groupId>
  <artifactId>gfos-shared</artifactId>
  <version>4.8.0-SNAPSHOT</version>
  <packaging>jar</packaging>
  
  <properties>
    <java.version>11</java.version>
  </properties>
</project>`,

    // =========================================================================
    // 4.8plus Projects - Transition with JDK 17
    // =========================================================================
    
    'C:\\dev\\quellen\\4.8plus\\gfosweb\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>de.gfos.web</groupId>
  <artifactId>gfosweb</artifactId>
  <version>4.8.1-SNAPSHOT</version>
  <packaging>war</packaging>
  
  <properties>
    <java.version>17</java.version>
  </properties>
</project>`,

    'C:\\dev\\quellen\\4.8plus\\gfoshg\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>de.gfos.hg</groupId>
  <artifactId>gfoshg</artifactId>
  <version>4.8.1-SNAPSHOT</version>
  <packaging>pom</packaging>
  
  <properties>
    <java.version>17</java.version>
  </properties>
  
  <modules>
    <module>hg-core</module>
  </modules>
</project>`,

    'C:\\dev\\quellen\\4.8plus\\gfoshg\\hg-core\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>de.gfos.hg</groupId>
    <artifactId>gfoshg</artifactId>
    <version>4.8.1-SNAPSHOT</version>
  </parent>
  <artifactId>hg-core</artifactId>
  <packaging>jar</packaging>
</project>`,

    'C:\\dev\\quellen\\4.8plus\\gfosshared\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>de.gfos.shared</groupId>
  <artifactId>gfosshared</artifactId>
  <version>4.8.1-SNAPSHOT</version>
  <packaging>jar</packaging>
  
  <properties>
    <java.version>17</java.version>
  </properties>
</project>`,

    'C:\\dev\\quellen\\4.8plus\\gfosdashboard\\pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>de.gfos.dashboard</groupId>
  <artifactId>gfosdashboard</artifactId>
  <version>4.8.1-SNAPSHOT</version>
  <packaging>war</packaging>
  
  <properties>
    <java.version>17</java.version>
  </properties>
</project>`,
  },
};

/**
 * Mock file system implementation for development.
 */
export class MockFileSystem implements IFileSystem {
  private data: MockFileSystemData;
  private virtualFS: Map<string, { isDirectory: boolean; content?: string }>;

  constructor(customData?: Partial<MockFileSystemData>) {
    this.data = { ...DEFAULT_MOCK_DATA, ...customData };
    this.virtualFS = new Map();
    this.buildVirtualFS();
  }

  /**
   * Builds the virtual file system structure from mock data.
   */
  private buildVirtualFS(): void {
    // Add root directories
    this.virtualFS.set('C:\\', { isDirectory: true });
    this.virtualFS.set('C:\\dev', { isDirectory: true });
    this.virtualFS.set('C:\\dev\\quellen', { isDirectory: true });
    this.virtualFS.set('C:\\dev\\quellen\\2025', { isDirectory: true });
    this.virtualFS.set('C:\\dev\\quellen\\4.8', { isDirectory: true });
    this.virtualFS.set('C:\\dev\\quellen\\4.8plus', { isDirectory: true });
    this.virtualFS.set('C:\\dev\\java', { isDirectory: true });
    this.virtualFS.set('C:\\dev\\maven', { isDirectory: true });
    this.virtualFS.set('C:\\dev\\maven\\mvn3', { isDirectory: true });

    // Add Git repositories as directories with .git folders
    for (const repo of this.data.gitRepositories) {
      this.addPathHierarchy(repo);
      this.virtualFS.set(`${repo}\\.git`, { isDirectory: true });
    }

    // Add Maven projects with pom.xml
    for (const project of this.data.mavenProjects) {
      this.addPathHierarchy(project);
      const pomPath = `${project}\\pom.xml`;
      const pomContent = this.data.files[pomPath] || this.generateMockPom(project);
      this.virtualFS.set(pomPath, { isDirectory: false, content: pomContent });
    }

    // Add JDKs
    for (const jdk of this.data.jdks) {
      this.addPathHierarchy(jdk.path);
      this.virtualFS.set(`${jdk.path}\\bin`, { isDirectory: true });
      this.virtualFS.set(`${jdk.path}\\bin\\java.exe`, { isDirectory: false });
      this.virtualFS.set(`${jdk.path}\\bin\\javac.exe`, { isDirectory: false });
      this.virtualFS.set(`${jdk.path}\\release`, { 
        isDirectory: false, 
        content: `JAVA_VERSION="${jdk.version}"` 
      });
    }

    // Add additional mock files (including submodule pom.xml files)
    for (const [filePath, content] of Object.entries(this.data.files)) {
      // Add the directory containing the file
      const parentDir = filePath.substring(0, filePath.lastIndexOf('\\'));
      this.addPathHierarchy(parentDir);
      this.virtualFS.set(filePath, { isDirectory: false, content });
    }
  }

  /**
   * Adds all parent directories for a path.
   */
  private addPathHierarchy(targetPath: string): void {
    const parts = targetPath.split('\\').filter(Boolean);
    let currentPath = '';
    
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}\\${part}` : part;
      if (currentPath.length === 1) {
        currentPath = `${currentPath}:\\`;
      }
      if (!this.virtualFS.has(currentPath)) {
        this.virtualFS.set(currentPath, { isDirectory: true });
      }
    }
  }

  /**
   * Generates a mock pom.xml content.
   */
  private generateMockPom(projectPath: string): string {
    const projectName = projectPath.split('\\').pop() || 'unknown';
    return `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>de.gfos</groupId>
  <artifactId>${projectName}</artifactId>
  <version>1.0.0-SNAPSHOT</version>
</project>`;
  }

  /**
   * Normalizes path separators to Windows format.
   */
  private normalizePath(inputPath: string): string {
    return inputPath.replace(/\//g, '\\');
  }

  async scanDirectory(dirPath: string): Promise<ScanResult> {
    const normalizedPath = this.normalizePath(dirPath);
    const entries: DirectoryEntry[] = [];

    // Find all direct children of this directory
    const prefix = normalizedPath.endsWith('\\') ? normalizedPath : `${normalizedPath}\\`;
    
    const childPaths = new Set<string>();
    
    for (const [path] of this.virtualFS) {
      if (path.startsWith(prefix) && path !== normalizedPath) {
        // Extract the immediate child name
        const relativePath = path.substring(prefix.length);
        const childName = relativePath.split('\\')[0];
        if (childName) {
          childPaths.add(childName);
        }
      }
    }

    for (const childName of childPaths) {
      const childPath = `${prefix}${childName}`;
      const entry = this.virtualFS.get(childPath);
      
      entries.push({
        name: childName,
        path: childPath,
        isDirectory: entry?.isDirectory ?? true,
        isFile: !entry?.isDirectory,
      });
    }

    return {
      entries: entries.sort((a, b) => a.name.localeCompare(b.name)),
      path: normalizedPath,
    };
  }

  async exists(filePath: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(filePath);
    return this.virtualFS.has(normalizedPath);
  }

  async readFile(filePath: string): Promise<string> {
    const normalizedPath = this.normalizePath(filePath);
    const entry = this.virtualFS.get(normalizedPath);
    
    if (!entry || entry.isDirectory) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }
    
    return entry.content || '';
  }

  async findFiles(basePath: string, pattern: string): Promise<string[]> {
    const normalizedBase = this.normalizePath(basePath);
    const results: string[] = [];

    // Simple pattern matching for common cases
    const isGitPattern = pattern.includes('.git');
    const isPomPattern = pattern.includes('pom.xml');

    for (const [path, entry] of this.virtualFS) {
      if (!path.startsWith(normalizedBase)) continue;

      if (isGitPattern && path.endsWith('.git') && entry.isDirectory) {
        results.push(path);
      } else if (isPomPattern && path.endsWith('pom.xml') && !entry.isDirectory) {
        results.push(path);
      }
    }

    return results;
  }

  async stat(filePath: string): Promise<FileStats | null> {
    const normalizedPath = this.normalizePath(filePath);
    const entry = this.virtualFS.get(normalizedPath);
    
    if (!entry) {
      return null;
    }

    const now = new Date();
    return {
      isFile: !entry.isDirectory,
      isDirectory: entry.isDirectory,
      size: entry.content?.length || 0,
      modifiedTime: now,
      createdTime: now,
    };
  }

  // ============================================================================
  // Mock-specific methods for testing
  // ============================================================================

  /**
   * Gets all mock Git repositories.
   */
  getGitRepositories(): string[] {
    return [...this.data.gitRepositories];
  }

  /**
   * Gets all mock Maven projects.
   */
  getMavenProjects(): string[] {
    return [...this.data.mavenProjects];
  }

  /**
   * Gets all mock JDKs.
   */
  getJdks(): { path: string; version: string }[] {
    return [...this.data.jdks];
  }
}
