/**
 * Mock Electron API for browser development
 * 
 * Provides fake data when running outside of Electron.
 */

import type { ElectronAPI, AppSettings, DiscoveredProject, JDK, MavenModule, BuildJob, Pipeline } from './index';

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
  setupComplete: true,
};

// Mock projects with realistic structure like the user's environment
const mockProjects: DiscoveredProject[] = [
  { path: 'J:\\dev\\quellen\\2025\\dashboard', name: '2025/dashboard', isGitRepo: true, hasPom: true, pomPath: 'J:\\dev\\quellen\\2025\\dashboard\\pom.xml', relativePath: '2025/dashboard' },
  { path: 'J:\\dev\\quellen\\2025\\hintergrund', name: '2025/hintergrund', isGitRepo: true, hasPom: true, pomPath: 'J:\\dev\\quellen\\2025\\hintergrund\\pom.xml', relativePath: '2025/hintergrund' },
  { path: 'J:\\dev\\quellen\\2025\\shared', name: '2025/shared', isGitRepo: true, hasPom: true, pomPath: 'J:\\dev\\quellen\\2025\\shared\\pom.xml', relativePath: '2025/shared' },
  { path: 'J:\\dev\\quellen\\2025\\web', name: '2025/web', isGitRepo: true, hasPom: true, pomPath: 'J:\\dev\\quellen\\2025\\web\\pom.xml', relativePath: '2025/web' },
  { path: 'J:\\dev\\quellen\\4.8\\dashboard', name: '4.8/dashboard', isGitRepo: true, hasPom: true, pomPath: 'J:\\dev\\quellen\\4.8\\dashboard\\pom.xml', relativePath: '4.8/dashboard' },
  { path: 'J:\\dev\\quellen\\4.8\\shared', name: '4.8/shared', isGitRepo: true, hasPom: true, pomPath: 'J:\\dev\\quellen\\4.8\\shared\\pom.xml', relativePath: '4.8/shared' },
  { path: 'J:\\dev\\quellen\\4.8\\web', name: '4.8/web', isGitRepo: true, hasPom: true, pomPath: 'J:\\dev\\quellen\\4.8\\web\\pom.xml', relativePath: '4.8/web' },
  { path: 'J:\\dev\\quellen\\4.8plus\\dashboard', name: '4.8plus/dashboard', isGitRepo: true, hasPom: true, pomPath: 'J:\\dev\\quellen\\4.8plus\\dashboard\\pom.xml', relativePath: '4.8plus/dashboard' },
  { path: 'J:\\dev\\quellen\\4.8plus\\hintergrund', name: '4.8plus/hintergrund', isGitRepo: true, hasPom: true, pomPath: 'J:\\dev\\quellen\\4.8plus\\hintergrund\\pom.xml', relativePath: '4.8plus/hintergrund' },
  { path: 'J:\\dev\\quellen\\4.8plus\\shared', name: '4.8plus/shared', isGitRepo: true, hasPom: true, pomPath: 'J:\\dev\\quellen\\4.8plus\\shared\\pom.xml', relativePath: '4.8plus/shared' },
  { path: 'J:\\dev\\quellen\\4.8plus\\web', name: '4.8plus/web', isGitRepo: true, hasPom: true, pomPath: 'J:\\dev\\quellen\\4.8plus\\web\\pom.xml', relativePath: '4.8plus/web' },
  { path: 'J:\\dev\\quellen\\bruno', name: 'bruno', isGitRepo: true, hasPom: false, relativePath: 'bruno' },
  { path: 'J:\\dev\\quellen\\tools', name: 'tools', isGitRepo: true, hasPom: false, relativePath: 'tools' },
];

const mockJDKs: JDK[] = [
  { jdkHome: 'J:\\dev\\java\\jdk21', version: 'jdk21', vendor: 'OpenJDK', majorVersion: 21 },
  { jdkHome: 'J:\\dev\\java\\jdk17', version: 'jdk17', vendor: 'OpenJDK', majorVersion: 17 },
  { jdkHome: 'J:\\dev\\java\\jdk11', version: 'jdk11', vendor: 'OpenJDK', majorVersion: 11 },
  { jdkHome: 'J:\\dev\\java\\jdk8', version: 'jdk8', vendor: 'OpenJDK', majorVersion: 8 },
];

// More realistic module structure
const mockModules: MavenModule[] = [
  { artifactId: 'web', groupId: 'de.gfos', pomPath: 'pom.xml', packaging: 'pom', relativePath: '.', displayName: 'web (Root)', depth: 0 },
  { artifactId: 'xtimeweb', groupId: 'de.gfos.web', pomPath: 'xtimeweb/pom.xml', packaging: 'pom', relativePath: 'xtimeweb', displayName: 'xtimeweb (xtimeweb)', depth: 1 },
  { artifactId: 'xtimeweb-api', groupId: 'de.gfos.web', pomPath: 'xtimeweb/xtimeweb-api/pom.xml', packaging: 'jar', relativePath: 'xtimeweb/xtimeweb-api', displayName: 'xtimeweb-api (xtimeweb/xtimeweb-api)', depth: 2 },
  { artifactId: 'xtimeweb-core', groupId: 'de.gfos.web', pomPath: 'xtimeweb/xtimeweb-core/pom.xml', packaging: 'jar', relativePath: 'xtimeweb/xtimeweb-core', displayName: 'xtimeweb-core (xtimeweb/xtimeweb-core)', depth: 2 },
  { artifactId: 'xtimeweb-web', groupId: 'de.gfos.web', pomPath: 'xtimeweb/xtimeweb-web/pom.xml', packaging: 'war', relativePath: 'xtimeweb/xtimeweb-web', displayName: 'xtimeweb-web (xtimeweb/xtimeweb-web)', depth: 2 },
  { artifactId: 'xtimeweb-ear', groupId: 'de.gfos.web', pomPath: 'xtimeweb/xtimeweb-ear/pom.xml', packaging: 'ear', relativePath: 'xtimeweb/xtimeweb-ear', displayName: 'xtimeweb-ear (xtimeweb/xtimeweb-ear)', depth: 2 },
  { artifactId: 'xtimeweb-ear-qs', groupId: 'de.gfos.web', pomPath: 'xtimeweb/xtimeweb-ear-qs/pom.xml', packaging: 'ear', relativePath: 'xtimeweb/xtimeweb-ear-qs', displayName: 'xtimeweb-ear-qs (xtimeweb/xtimeweb-ear-qs)', depth: 2 },
  { artifactId: 'xtimeweb-services', groupId: 'de.gfos.web', pomPath: 'xtimeweb/xtimeweb-services/pom.xml', packaging: 'jar', relativePath: 'xtimeweb/xtimeweb-services', displayName: 'xtimeweb-services (xtimeweb/xtimeweb-services)', depth: 2 },
  { artifactId: 'webportal', groupId: 'de.gfos.web', pomPath: 'webportal/pom.xml', packaging: 'pom', relativePath: 'webportal', displayName: 'webportal (webportal)', depth: 1 },
  { artifactId: 'webportal-api', groupId: 'de.gfos.web', pomPath: 'webportal/webportal-api/pom.xml', packaging: 'jar', relativePath: 'webportal/webportal-api', displayName: 'webportal-api (webportal/webportal-api)', depth: 2 },
  { artifactId: 'webportal-core', groupId: 'de.gfos.web', pomPath: 'webportal/webportal-core/pom.xml', packaging: 'jar', relativePath: 'webportal/webportal-core', displayName: 'webportal-core (webportal/webportal-core)', depth: 2 },
];

const mockProfiles = ['development', 'production', 'test', 'jsminify', 'docker', 'wildfly', 'tomcat'];

// Stored jobs and pipelines (mock persistence)
let storedJobs: BuildJob[] = [];
let storedPipelines: Pipeline[] = [];

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

  // Jobs Persistence
  loadJobs: async () => {
    await delay(50);
    return [...storedJobs];
  },
  
  saveJobs: async (jobs) => {
    await delay(50);
    storedJobs = [...jobs];
  },
  
  // Pipelines Persistence
  loadPipelines: async () => {
    await delay(50);
    return [...storedPipelines];
  },
  
  savePipelines: async (pipelines) => {
    await delay(50);
    storedPipelines = [...pipelines];
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
