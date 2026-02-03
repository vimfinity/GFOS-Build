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
}

export interface MavenModule {
  artifactId: string;
  groupId: string;
  pomPath: string;
  packaging: string;
  relativePath?: string;
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
}

export interface ElectronAPI {
  // Config
  loadConfig: () => Promise<AppSettings>;
  saveConfig: (config: AppSettings) => Promise<void>;
  
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
