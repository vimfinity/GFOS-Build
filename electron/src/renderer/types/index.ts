/**
 * Type definitions for Electron API
 */

export interface JDK {
  jdkHome: string;
  version: string;
  vendor?: string;
  majorVersion: number;
}

export interface DiscoveredProject {
  path: string;
  name: string;
  isGitRepo: boolean;
  hasPom: boolean;
  pomPath?: string;
  relativePath?: string; // Relative path from scan root for disambiguation
}

export interface MavenModule {
  artifactId: string;
  groupId: string;
  pomPath: string;
  packaging: string;
  relativePath: string;
  displayName: string;
  depth: number;
}

export interface AppSettings {
  scanRootPath: string;
  jdkScanPaths: string;
  defaultMavenHome: string;
  defaultMavenGoal: string;
  maxParallelBuilds: number;
  skipTestsByDefault: boolean;
  offlineMode: boolean;
  enableThreads: boolean;
  threadCount: string;
  setupComplete?: boolean;
}

// ============================================================================
// Pipeline Types
// ============================================================================

export interface PipelineStep {
  name: string;
  goals: string[];
  jdkPath?: string;
  skipTests?: boolean;
  offline?: boolean;
  enableThreads?: boolean;
  threads?: string;
  profiles?: string[];
  modulePath?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  projectPath: string;
  steps: PipelineStep[];
  createdAt: Date;
  lastRun?: Date;
}

export type BuildStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

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
  exitCode?: number | null;
  skipTests?: boolean;
  offline?: boolean;
  enableThreads?: boolean;
  threads?: string;
  profiles?: string[];
  pipelineId?: string;
  pipelineStep?: number;
}

export interface ElectronAPI {
  // Config
  loadConfig: () => Promise<AppSettings>;
  saveConfig: (config: AppSettings) => Promise<void>;
  
  // Jobs Persistence
  loadJobs: () => Promise<BuildJob[]>;
  saveJobs: (jobs: BuildJob[]) => Promise<void>;
  
  // Pipelines Persistence
  loadPipelines: () => Promise<Pipeline[]>;
  savePipelines: (pipelines: Pipeline[]) => Promise<void>;
  
  // Scanning
  scanProjects: (rootPath: string) => Promise<DiscoveredProject[]>;
  scanJDKs: (scanPaths: string) => Promise<JDK[]>;
  scanModules: (pomPath: string) => Promise<MavenModule[]>;
  scanProfiles: (pomPath: string) => Promise<string[]>;
  
  // Build
  startBuild: (job: BuildJob) => Promise<boolean>;
  cancelBuild: (jobId: string) => Promise<boolean>;
  
  // Events
  onBuildLog: (callback: (jobId: string, line: string) => void) => () => void;
  onBuildProgress: (callback: (jobId: string, progress: number) => void) => () => void;
  onBuildComplete: (callback: (jobId: string, status: string, exitCode: number | null) => void) => () => void;
  onBuildError: (callback: (jobId: string, error: string) => void) => () => void;
  onScanStatus: (callback: (status: string | null) => void) => () => void;
  
  // Dialogs
  selectFolder: () => Promise<string | null>;
  
  // Shell
  openPath: (filePath: string) => void;
  openExternal: (url: string) => void;
  
  // App
  getVersion: () => Promise<string>;
  getPath: (name: string) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
