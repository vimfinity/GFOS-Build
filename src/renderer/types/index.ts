/**
 * GFOS Build - Type Definitions
 * Unified types for the application
 */

// ============================================
// Theme Types
// ============================================

export type Theme = 'light' | 'dark' | 'system';

// ============================================
// Build Status
// ============================================

export type BuildStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';

// ============================================
// JDK Types
// ============================================

export interface JDK {
  id: string;
  jdkHome: string;
  version: string;
  vendor: string;
  majorVersion: number;
  isDefault?: boolean;
}

// ============================================
// Project Types
// ============================================

export interface DiscoveredProject {
  path: string;
  name: string;
  isGitRepo: boolean;
  hasPom: boolean;
  pomPath?: string;
  relativePath?: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  branch: string;
  lastBuild?: {
    status: BuildStatus;
    duration: string;
    timestamp: string;
  };
  jdk: string;
  mavenGoals?: string;
}

// ============================================
// Maven Types
// ============================================

export interface MavenModule {
  artifactId: string;
  groupId: string;
  pomPath: string;
  packaging: string;
  relativePath: string;
  displayName: string;
  depth: number;
}

// ============================================
// Pipeline Types
// ============================================

export interface PipelineStep {
  id: string;
  name: string;
  goals: string[];
  jdkId?: string;
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
  projectId: string;
  steps: PipelineStep[];
  createdAt: Date;
  lastRun?: Date;
  isRunning?: boolean;
  currentStep?: number;
}

// ============================================
// Build Job Types
// ============================================

export interface BuildJob {
  id: string;
  projectId: string;
  projectName: string;
  status: BuildStatus;
  progress: number;
  startTime: string;
  endTime?: string;
  duration?: string;
  jdk: string;
  goals: string;
  logs?: string[];
  pipelineId?: string;
  pipelineStep?: number;
}

// ============================================
// Log Types
// ============================================

export type AnsiColor = 
  | 'black' | 'red' | 'green' | 'yellow' 
  | 'blue' | 'magenta' | 'cyan' | 'white'
  | 'brightBlack' | 'brightRed' | 'brightGreen' | 'brightYellow'
  | 'brightBlue' | 'brightMagenta' | 'brightCyan' | 'brightWhite';

export interface LogStyle {
  color?: AnsiColor;
  bgColor?: AnsiColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface LogSegment {
  text: string;
  style: LogStyle;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  rawText: string;
  segments: LogSegment[];
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
}

// ============================================
// Settings Types
// ============================================

export interface AppSettings {
  scanRootPath: string;
  jdkScanPaths: string;
  mavenPath: string;
  defaultGoals: string;
  parallelBuilds: number;
  autoScan: boolean;
  scanPaths: string[];
  skipTestsByDefault: boolean;
  offlineMode: boolean;
  enableThreads: boolean;
  threadCount: string;
  setupComplete?: boolean;
}

// ============================================
// Setup Wizard Types
// ============================================

export type SetupWizardStep = 
  | 'welcome' 
  | 'paths' 
  | 'jdk-scan' 
  | 'project-scan' 
  | 'complete';

export interface SetupWizardState {
  currentStep: SetupWizardStep;
  scanRootPath: string;
  jdkScanPaths: string;
  mavenPath: string;
  isScanning: boolean;
  scanError?: string;
  foundProjects: number;
  foundJdks: number;
}

// ============================================
// Search Types
// ============================================

export interface SearchResult {
  type: 'project' | 'build' | 'pipeline' | 'jdk';
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
}

// ============================================
// Keyboard Shortcuts
// ============================================

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  action: () => void;
  category?: 'navigation' | 'action' | 'dialog';
}

// ============================================
// Notification Types
// ============================================

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  duration?: number;
}

// ============================================
// View Types
// ============================================

export type AppView = 
  | 'overview' 
  | 'projects' 
  | 'builds' 
  | 'jdks' 
  | 'settings'
  | 'pipelines'
  | 'pipeline-editor'
  | 'job-log'
  | 'setup-wizard';

// ============================================
// Electron API Types
// ============================================

export interface ElectronAPI {
  loadConfig: () => Promise<AppSettings>;
  saveConfig: (config: AppSettings) => Promise<void>;
  loadJobs: () => Promise<BuildJob[]>;
  saveJobs: (jobs: BuildJob[]) => Promise<void>;
  loadPipelines: () => Promise<Pipeline[]>;
  savePipelines: (pipelines: Pipeline[]) => Promise<void>;
  scanProjects: (rootPath: string) => Promise<DiscoveredProject[]>;
  scanJDKs: (scanPaths: string) => Promise<JDK[]>;
  scanModules: (pomPath: string) => Promise<MavenModule[]>;
  scanProfiles: (pomPath: string) => Promise<string[]>;
  startBuild: (job: BuildJob) => Promise<boolean>;
  cancelBuild: (jobId: string) => Promise<boolean>;
  onBuildLog: (callback: (jobId: string, line: string) => void) => () => void;
  onBuildProgress: (callback: (jobId: string, progress: number) => void) => () => void;
  onBuildComplete: (callback: (jobId: string, status: string, exitCode: number | null) => void) => () => void;
  onBuildError: (callback: (jobId: string, error: string) => void) => () => void;
  onScanStatus: (callback: (status: string | null) => void) => () => void;
  selectFolder: () => Promise<string | null>;
  openPath: (filePath: string) => void;
  openExternal: (url: string) => void;
  getVersion: () => Promise<string>;
  getPath: (name: string) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
