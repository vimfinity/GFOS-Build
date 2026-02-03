/**
 * Mock Electron API for browser development
 * 
 * Provides fake data when running outside of Electron.
 */

import type { ElectronAPI, AppSettings, DiscoveredProject, JDK, MavenModule } from './index';

// Mock Data
const mockSettings: AppSettings = {
  scanRootPath: 'C:\\dev\\quellen',
  jdkScanPaths: 'C:\\dev\\java',
  defaultMavenHome: 'C:\\dev\\maven\\mvn3',
  defaultMavenGoal: 'clean install',
  maxParallelBuilds: 2,
  skipTestsByDefault: false,
  offlineMode: false,
  enableThreads: false,
  threadCount: '1C',
};

const mockProjects: DiscoveredProject[] = [
  { path: 'C:\\dev\\quellen\\gfos-workflow', name: 'gfos-workflow', isGitRepo: true, hasPom: true, pomPath: 'C:\\dev\\quellen\\gfos-workflow\\pom.xml' },
  { path: 'C:\\dev\\quellen\\gfos-core', name: 'gfos-core', isGitRepo: true, hasPom: true, pomPath: 'C:\\dev\\quellen\\gfos-core\\pom.xml' },
  { path: 'C:\\dev\\quellen\\gfos-webservices', name: 'gfos-webservices', isGitRepo: true, hasPom: true, pomPath: 'C:\\dev\\quellen\\gfos-webservices\\pom.xml' },
  { path: 'C:\\dev\\quellen\\gfos-time', name: 'gfos-time', isGitRepo: true, hasPom: true, pomPath: 'C:\\dev\\quellen\\gfos-time\\pom.xml' },
  { path: 'C:\\dev\\quellen\\gfos-portal', name: 'gfos-portal', isGitRepo: true, hasPom: true, pomPath: 'C:\\dev\\quellen\\gfos-portal\\pom.xml' },
];

const mockJDKs: JDK[] = [
  { jdkHome: 'C:\\dev\\java\\jdk-21', version: 'jdk-21.0.2', vendor: 'Eclipse Temurin', majorVersion: 21 },
  { jdkHome: 'C:\\dev\\java\\jdk-17', version: 'jdk-17.0.9', vendor: 'Eclipse Temurin', majorVersion: 17 },
  { jdkHome: 'C:\\dev\\java\\jdk-11', version: 'jdk-11.0.21', vendor: 'Eclipse Temurin', majorVersion: 11 },
  { jdkHome: 'C:\\dev\\java\\jdk-8', version: 'jdk1.8.0_392', vendor: 'Oracle', majorVersion: 8 },
];

const mockModules: MavenModule[] = [
  { artifactId: 'gfos-workflow', groupId: 'de.gfos', pomPath: 'pom.xml', packaging: 'pom', relativePath: '.' },
  { artifactId: 'workflow-api', groupId: 'de.gfos.workflow', pomPath: 'workflow-api/pom.xml', packaging: 'jar', relativePath: 'workflow-api' },
  { artifactId: 'workflow-core', groupId: 'de.gfos.workflow', pomPath: 'workflow-core/pom.xml', packaging: 'jar', relativePath: 'workflow-core' },
  { artifactId: 'workflow-engine', groupId: 'de.gfos.workflow', pomPath: 'workflow-engine/pom.xml', packaging: 'jar', relativePath: 'workflow-engine' },
];

const mockProfiles = ['development', 'production', 'test', 'jsminify', 'docker'];

// Event listeners storage
type EventCallback = (...args: unknown[]) => void;
const eventListeners: Record<string, Set<EventCallback>> = {};

// Simulate build progress
let buildSimulationInterval: ReturnType<typeof setInterval> | null = null;

export const mockElectronAPI: ElectronAPI = {
  // Config
  loadConfig: async () => {
    await delay(100);
    return { ...mockSettings };
  },
  
  saveConfig: async (config) => {
    await delay(100);
    Object.assign(mockSettings, config);
  },

  // Scanning
  scanProjects: async (_rootPath) => {
    await delay(500);
    return mockProjects;
  },
  
  scanJDKs: async (_scanPaths) => {
    await delay(300);
    return mockJDKs;
  },
  
  scanModules: async (_pomPath) => {
    await delay(200);
    return mockModules;
  },
  
  scanProfiles: async (_pomPath) => {
    await delay(100);
    return mockProfiles;
  },

  // Build
  startBuild: async (job) => {
    // Simulate build progress
    let progress = 0;
    const logLines = [
      '[INFO] Scanning for projects...',
      '[INFO] ',
      '[INFO] ----------------------< de.gfos:' + job.name + ' >----------------------',
      '[INFO] Building ' + job.name + ' 1.0.0',
      '[INFO] --------------------------------[ pom ]---------------------------------',
      '[INFO] ',
      '[INFO] --- maven-clean-plugin:3.2.0:clean (default-clean) ---',
      '[INFO] Deleting target',
      '[INFO] ',
      '[INFO] --- maven-resources-plugin:3.3.0:resources (default-resources) ---',
      '[INFO] Copying 12 resources',
      '[INFO] ',
      '[INFO] --- maven-compiler-plugin:3.11.0:compile (default-compile) ---',
      '[INFO] Compiling 156 source files',
      '[INFO] ',
      '[INFO] --- maven-surefire-plugin:3.1.2:test (default-test) ---',
      job.skipTests ? '[INFO] Tests are skipped.' : '[INFO] Running tests...',
      job.skipTests ? '' : '[INFO] Tests run: 42, Failures: 0, Errors: 0, Skipped: 0',
      '[INFO] ',
      '[INFO] --- maven-jar-plugin:3.3.0:jar (default-jar) ---',
      '[INFO] Building jar: target/' + job.name + '-1.0.0.jar',
      '[INFO] ',
      '[INFO] --- maven-install-plugin:3.1.1:install (default-install) ---',
      '[INFO] Installing artifact to local repository',
      '[INFO] ',
      '[INFO] ------------------------------------------------------------------------',
      '[INFO] BUILD SUCCESS',
      '[INFO] ------------------------------------------------------------------------',
      '[INFO] Total time: 12.345 s',
    ].filter(Boolean);

    let logIndex = 0;
    
    buildSimulationInterval = setInterval(() => {
      if (logIndex < logLines.length) {
        emit('build:log', job.id, logLines[logIndex]);
        logIndex++;
        progress = Math.min(95, Math.floor((logIndex / logLines.length) * 100));
        emit('build:progress', job.id, progress);
      } else {
        if (buildSimulationInterval) {
          clearInterval(buildSimulationInterval);
          buildSimulationInterval = null;
        }
        emit('build:complete', job.id, 'success', 0);
      }
    }, 300);
    
    return true;
  },
  
  cancelBuild: async (jobId) => {
    if (buildSimulationInterval) {
      clearInterval(buildSimulationInterval);
      buildSimulationInterval = null;
    }
    emit('build:complete', jobId, 'cancelled', null);
    return true;
  },

  // Events
  onBuildLog: (callback) => {
    return addEventListener('build:log', callback as EventCallback);
  },
  
  onBuildProgress: (callback) => {
    return addEventListener('build:progress', callback as EventCallback);
  },
  
  onBuildComplete: (callback) => {
    return addEventListener('build:complete', callback as EventCallback);
  },
  
  onBuildError: (callback) => {
    return addEventListener('build:error', callback as EventCallback);
  },
  
  onScanStatus: (callback) => {
    return addEventListener('scan:status', callback as EventCallback);
  },

  // Dialogs
  selectFolder: async () => {
    // In browser, just return null
    return null;
  },

  // Shell
  openPath: (filePath) => {
    console.log('[Mock] Opening path:', filePath);
  },
  
  openExternal: (url) => {
    window.open(url, '_blank');
  },

  // App
  getVersion: async () => '1.0.0-dev',
  getPath: async (name) => '/mock/path/' + name,
};

// Helper functions
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function addEventListener(event: string, callback: EventCallback): () => void {
  if (!eventListeners[event]) {
    eventListeners[event] = new Set();
  }
  eventListeners[event].add(callback);
  return () => {
    eventListeners[event]?.delete(callback);
  };
}

function emit(event: string, ...args: unknown[]): void {
  eventListeners[event]?.forEach(callback => callback(...args));
}

// Check if running in Electron
export function isElectron(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.electronAPI !== 'undefined';
}

// Get the appropriate API
export function getElectronAPI(): ElectronAPI {
  if (isElectron()) {
    return window.electronAPI;
  }
  console.log('🔧 Running in browser mode with mock data');
  return mockElectronAPI;
}
