/**
 * Preload Script
 *
 * Exposes safe IPC methods to the renderer process.
 * This is the bridge between the sandboxed renderer and the main process.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Inline types for preload (cannot import shared types in preload context)
interface BuildJob {
  id: string;
  projectPath: string;
  modulePath?: string;
  name: string;
  jdkPath: string;
  mavenGoals: string[];
  status: string;
  progress: number;
  createdAt: Date;
  skipTests?: boolean;
  offline?: boolean;
  enableThreads?: boolean;
  threads?: string;
  profiles?: string[];
}

interface AppSettings {
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

const electronAPI = {
  // Config
  loadConfig: (): Promise<AppSettings> => ipcRenderer.invoke('config:load'),
  saveConfig: (config: AppSettings): Promise<void> =>
    ipcRenderer.invoke('config:save', config),

  // Jobs Persistence
  loadJobs: () => ipcRenderer.invoke('jobs:load'),
  saveJobs: (jobs: BuildJob[]) => ipcRenderer.invoke('jobs:save', jobs),

  // Pipelines Persistence
  loadPipelines: () => ipcRenderer.invoke('pipelines:load'),
  savePipelines: (pipelines: unknown[]) =>
    ipcRenderer.invoke('pipelines:save', pipelines),

  // Scanning
  scanProjects: (rootPath: string) =>
    ipcRenderer.invoke('scan:projects', rootPath),
  scanJDKs: (scanPaths: string) =>
    ipcRenderer.invoke('scan:jdks', scanPaths),
  scanModules: (pomPath: string) =>
    ipcRenderer.invoke('scan:modules', pomPath),
  scanProfiles: (pomPath: string) =>
    ipcRenderer.invoke('scan:profiles', pomPath),

  // Build
  startBuild: (job: BuildJob): Promise<boolean> =>
    ipcRenderer.invoke('build:start', job),
  cancelBuild: (jobId: string): Promise<boolean> =>
    ipcRenderer.invoke('build:cancel', jobId),

  // Events
  onBuildLog: (callback: (jobId: string, line: string) => void) => {
    const handler = (
      _event: IpcRendererEvent,
      jobId: string,
      line: string
    ) => callback(jobId, line);
    ipcRenderer.on('build:log', handler);
    return () => ipcRenderer.removeListener('build:log', handler);
  },
  onBuildProgress: (
    callback: (jobId: string, progress: number) => void
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      jobId: string,
      progress: number
    ) => callback(jobId, progress);
    ipcRenderer.on('build:progress', handler);
    return () => ipcRenderer.removeListener('build:progress', handler);
  },
  onBuildComplete: (
    callback: (
      jobId: string,
      status: string,
      exitCode: number | null
    ) => void
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      jobId: string,
      status: string,
      exitCode: number | null
    ) => callback(jobId, status, exitCode);
    ipcRenderer.on('build:complete', handler);
    return () => ipcRenderer.removeListener('build:complete', handler);
  },
  onBuildError: (callback: (jobId: string, error: string) => void) => {
    const handler = (
      _event: IpcRendererEvent,
      jobId: string,
      error: string
    ) => callback(jobId, error);
    ipcRenderer.on('build:error', handler);
    return () => ipcRenderer.removeListener('build:error', handler);
  },
  onScanStatus: (callback: (status: string | null) => void) => {
    const handler = (
      _event: IpcRendererEvent,
      status: string | null
    ) => callback(status);
    ipcRenderer.on('scan:status', handler);
    return () => ipcRenderer.removeListener('scan:status', handler);
  },

  // Dialogs
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectFolder'),

  // Shell
  openPath: (filePath: string): void => {
    ipcRenderer.invoke('shell:openPath', filePath);
  },
  openExternal: (url: string): void => {
    ipcRenderer.invoke('shell:openExternal', url);
  },

  // App
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  getPath: (name: string): Promise<string> =>
    ipcRenderer.invoke('app:getPath', name),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
