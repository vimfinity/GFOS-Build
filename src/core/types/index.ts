/**
 * Core Types for GFOS-Build
 * 
 * Central type definitions for the entire application.
 */

// ============================================================================
// File System Types
// ============================================================================

/**
 * Represents a directory entry when scanning the file system.
 */
export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
}

/**
 * Result of a directory scan operation.
 */
export interface ScanResult {
  entries: DirectoryEntry[];
  path: string;
}

// ============================================================================
// Git Repository Types
// ============================================================================

/**
 * Represents a Git repository discovered on the file system.
 */
export interface GitRepository {
  path: string;
  name: string;
  branch?: string;
}

// ============================================================================
// Maven Project Types
// ============================================================================

/**
 * Represents a Maven project (contains pom.xml).
 */
export interface MavenProject {
  projectPath: string;
  name: string;
  groupId?: string;
  artifactId?: string;
  version?: string;
  parentPath?: string;
}

// ============================================================================
// JDK Types
// ============================================================================

/**
 * Represents an installed JDK.
 */
export interface JDK {
  jdkHome: string;
  version: string;
  vendor?: string;
  majorVersion: number;
}

// ============================================================================
// Maven Installation Types
// ============================================================================

/**
 * Represents a Maven installation.
 */
export interface MavenInstallation {
  mavenHome: string;
  version?: string;
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Environment variables relevant for builds.
 */
export interface BuildEnvironment {
  javaHome?: string;
  mavenHome?: string;
  path?: string;
}

// ============================================================================
// Analysis Result Types (matching result.json structure)
// ============================================================================

/**
 * Complete analysis result from scanning the dev environment.
 */
export interface DevEnvironmentAnalysis {
  gitRepositories: string[];
  mavenProjects: MavenProjectEntry[];
  jdks: JDKEntry[];
  environmentVariables: EnvironmentVariables;
}

/**
 * Maven project entry from analysis.
 */
export interface MavenProjectEntry {
  projectPath: string;
}

/**
 * JDK entry from analysis.
 */
export interface JDKEntry {
  jdkHome: string;
  javaVersion: string;
}

/**
 * Environment variables from analysis.
 */
export interface EnvironmentVariables {
  MAVEN_HOME?: string;
  JAVA_HOME?: string;
}

// ============================================================================
// Maven Module Types
// ============================================================================

/**
 * Represents a Maven module within a project.
 */
export interface MavenModule {
  artifactId: string;
  groupId: string;
  pomPath: string;
  packaging: string;
  relativePath?: string;
}

// ============================================================================
// Build Types
// ============================================================================

/**
 * Build job status.
 * - pending: Ready to be picked up by job processor
 * - waiting: Waiting for previous sequential job to complete
 * - running: Currently executing
 * - success: Completed successfully
 * - failed: Completed with errors
 * - cancelled: Manually cancelled
 */
export type BuildStatus = 'pending' | 'waiting' | 'running' | 'success' | 'failed' | 'cancelled';

/**
 * Alias for BuildStatus (compatibility)
 */
export type JobStatus = BuildStatus;

/**
 * Represents a build job in the queue.
 */
export interface BuildJob {
  id: string;
  projectPath: string;
  modulePath?: string;
  name: string;
  jdkPath: string;
  mavenGoals: string[];
  status: BuildStatus;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  command?: string;
  logFilePath?: string;
  exitCode?: number | null;
  output?: string;
  error?: string;
  /** Skip tests flag */
  skipTests?: boolean;
  /** Offline mode */
  offline?: boolean;
  /** Enable Maven multi-threading (-T flag) */
  enableThreads?: boolean;
  /** Thread count for Maven -T option (e.g., '1C', '2C', '4') */
  threads?: string;
  /** Maven profiles (use ! prefix to deactivate, e.g., "!jsminify") */
  profiles?: string[];
  /** Custom Maven arguments */
  customArgs?: string[];
  /** Index in sequence for sequential builds */
  sequenceIndex?: number;
  /** Total jobs in sequence */
  sequenceTotal?: number;
  /** Unique ID for the sequence group */
  sequenceId?: string;
}

/**
 * Represents a selected module when configuring builds or pipelines.
 */
export interface SelectedModuleData {
  artifactId?: string;
  pomPath: string;
  projectPath: string;
  relativePath?: string;
}

// ============================================================================
// UI Navigation Types
// ============================================================================

/**
 * Application screens for navigation.
 */
export type Screen = 'home' | 'repositories' | 'projects' | 'jdks' | 'build' | 'queue' | 'settings';

/**
 * Navigation state for stack-based navigation.
 */
export interface NavigationState {
  currentScreen: Screen;
  history: Screen[];
  params?: Record<string, unknown>;
}
