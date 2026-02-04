/**
 * Electron Main Process
 * 
 * Handles window creation, IPC communication, and native operations.
 * The build logic runs in this process for maximum performance.
 */

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { spawn, ChildProcess } from 'child_process';
import fastGlob from 'fast-glob';

// ============================================================================
// Types
// ============================================================================

interface BuildJob {
  id: string;
  projectPath: string;
  modulePath?: string;
  name: string;
  jdkPath: string;
  mavenGoals: string[];
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
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

interface Pipeline {
  id: string;
  name: string;
  projectPath: string;
  steps: PipelineStep[];
  createdAt: Date;
  lastRun?: Date;
}

interface PipelineStep {
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

interface JDK {
  jdkHome: string;
  version: string;
  vendor?: string;
  majorVersion: number;
}

interface DiscoveredProject {
  path: string;
  name: string;
  isGitRepo: boolean;
  hasPom: boolean;
  pomPath?: string;
}

interface MavenModule {
  artifactId: string;
  groupId: string;
  pomPath: string;
  packaging: string;
  relativePath: string;
  displayName: string;
  depth: number;
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
  setupComplete?: boolean;
}

// ============================================================================
// Globals
// ============================================================================

let mainWindow: BrowserWindow | null = null;
const runningProcesses = new Map<string, ChildProcess>();
const CONFIG_FILE = 'gfos-build-config.json';
const JOBS_FILE = 'gfos-build-jobs.json';
const PIPELINES_FILE = 'gfos-build-pipelines.json';

// ============================================================================
// Window Management
// ============================================================================

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'GFOS Build',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  // Development or Production
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// Config Management
// ============================================================================

function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE);
}

function getJobsPath(): string {
  return path.join(app.getPath('userData'), JOBS_FILE);
}

function getPipelinesPath(): string {
  return path.join(app.getPath('userData'), PIPELINES_FILE);
}

async function loadConfig(): Promise<AppSettings> {
  const configPath = getConfigPath();
  const defaultConfig: AppSettings = {
    scanRootPath: 'C:\\dev\\quellen',
    jdkScanPaths: 'C:\\dev\\java',
    defaultMavenHome: 'C:\\dev\\maven\\mvn3',
    defaultMavenGoal: 'clean install',
    maxParallelBuilds: 2,
    skipTestsByDefault: false,
    offlineMode: false,
    enableThreads: false,
    threadCount: '1C',
    setupComplete: false,
  };

  try {
    if (await fs.pathExists(configPath)) {
      const data = await fs.readJson(configPath);
      return { ...defaultConfig, ...data };
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  return defaultConfig;
}

async function saveConfig(config: AppSettings): Promise<void> {
  const configPath = getConfigPath();
  await fs.writeJson(configPath, config, { spaces: 2 });
}

// ============================================================================
// Job Persistence
// ============================================================================

async function loadJobs(): Promise<BuildJob[]> {
  const jobsPath = getJobsPath();
  try {
    if (await fs.pathExists(jobsPath)) {
      const data = await fs.readJson(jobsPath);
      // Convert date strings back to Date objects
      return data.map((job: any) => ({
        ...job,
        createdAt: new Date(job.createdAt),
        startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
        completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
      }));
    }
  } catch (error) {
    console.error('Failed to load jobs:', error);
  }
  return [];
}

async function saveJobs(jobs: BuildJob[]): Promise<void> {
  const jobsPath = getJobsPath();
  // Only save completed/failed jobs, not running ones
  const jobsToSave = jobs.filter(j => j.status !== 'running' && j.status !== 'pending');
  await fs.writeJson(jobsPath, jobsToSave, { spaces: 2 });
}

// ============================================================================
// Pipeline Persistence
// ============================================================================

async function loadPipelines(): Promise<Pipeline[]> {
  const pipelinesPath = getPipelinesPath();
  try {
    if (await fs.pathExists(pipelinesPath)) {
      const data = await fs.readJson(pipelinesPath);
      return data.map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        lastRun: p.lastRun ? new Date(p.lastRun) : undefined,
      }));
    }
  } catch (error) {
    console.error('Failed to load pipelines:', error);
  }
  return [];
}

async function savePipelines(pipelines: Pipeline[]): Promise<void> {
  const pipelinesPath = getPipelinesPath();
  await fs.writeJson(pipelinesPath, pipelines, { spaces: 2 });
}

// ============================================================================
// File System Operations
// ============================================================================

async function scanForProjects(rootPath: string): Promise<DiscoveredProject[]> {
  const projects: DiscoveredProject[] = [];
  
  if (!(await fs.pathExists(rootPath))) {
    return projects;
  }

  try {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const projectPath = path.join(rootPath, entry.name);
        const gitPath = path.join(projectPath, '.git');
        const pomPath = path.join(projectPath, 'pom.xml');
        
        const isGitRepo = await fs.pathExists(gitPath);
        const hasPom = await fs.pathExists(pomPath);
        
        if (isGitRepo || hasPom) {
          projects.push({
            path: projectPath,
            name: entry.name,
            isGitRepo,
            hasPom,
            pomPath: hasPom ? pomPath : undefined,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error scanning projects:', error);
  }

  return projects;
}

async function scanForJDKs(scanPaths: string): Promise<JDK[]> {
  const jdks: JDK[] = [];
  const paths = scanPaths.split(';').filter(Boolean);

  for (const basePath of paths) {
    if (!(await fs.pathExists(basePath))) continue;

    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const jdkHome = path.join(basePath, entry.name);
          const javaExe = path.join(jdkHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
          
          if (await fs.pathExists(javaExe)) {
            // Parse version from folder name (e.g., "jdk-17.0.1", "jdk1.8.0_291")
            const versionMatch = entry.name.match(/(\d+)(?:\.(\d+))?/);
            const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;
            
            jdks.push({
              jdkHome,
              version: entry.name,
              majorVersion,
              vendor: detectJdkVendor(entry.name),
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning JDKs in ${basePath}:`, error);
    }
  }

  return jdks.sort((a, b) => b.majorVersion - a.majorVersion);
}

function detectJdkVendor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('temurin') || lower.includes('adoptium')) return 'Eclipse Temurin';
  if (lower.includes('zulu')) return 'Azul Zulu';
  if (lower.includes('corretto')) return 'Amazon Corretto';
  if (lower.includes('graal')) return 'GraalVM';
  if (lower.includes('openjdk')) return 'OpenJDK';
  if (lower.includes('oracle')) return 'Oracle';
  return 'Unknown';
}

async function scanMavenModules(pomPath: string): Promise<MavenModule[]> {
  const modules: MavenModule[] = [];
  const projectDir = path.dirname(pomPath);

  // Recursive function to scan modules
  async function scanModuleRecursive(
    currentPomPath: string, 
    basePath: string, 
    depth: number = 0
  ): Promise<void> {
    try {
      const pomContent = await fs.readFile(currentPomPath, 'utf-8');
      const currentDir = path.dirname(currentPomPath);
      const relativePath = path.relative(basePath, currentDir) || '.';
      
      // Parse module info
      const groupIdMatch = pomContent.match(/<groupId>([^<]+)<\/groupId>/);
      const artifactIdMatch = pomContent.match(/<artifactId>([^<]+)<\/artifactId>/);
      const packagingMatch = pomContent.match(/<packaging>([^<]+)<\/packaging>/);
      const nameMatch = pomContent.match(/<name>([^<]+)<\/name>/);
      
      // Get parent groupId if not defined locally
      let groupId = groupIdMatch?.[1];
      if (!groupId) {
        const parentGroupMatch = pomContent.match(/<parent>[\s\S]*?<groupId>([^<]+)<\/groupId>/);
        groupId = parentGroupMatch?.[1] || 'unknown';
      }

      const artifactId = artifactIdMatch?.[1] || path.basename(currentDir);
      const displayName = nameMatch?.[1] || artifactId;
      const dirName = path.basename(currentDir);
      
      // Create a more informative display name showing directory
      const fullDisplayName = relativePath === '.' 
        ? displayName 
        : `${displayName} (${relativePath.replace(/\\/g, '/')})`;

      modules.push({
        artifactId,
        groupId,
        pomPath: currentPomPath,
        packaging: packagingMatch?.[1] || 'jar',
        relativePath: relativePath.replace(/\\/g, '/'),
        displayName: fullDisplayName,
        depth,
      });

      // Find and process submodules recursively
      const modulesMatch = pomContent.match(/<modules>([\s\S]*?)<\/modules>/);
      if (modulesMatch) {
        const moduleMatches = modulesMatch[1].matchAll(/<module>([^<]+)<\/module>/g);
        for (const match of moduleMatches) {
          const moduleName = match[1].trim();
          const modulePomPath = path.join(currentDir, moduleName, 'pom.xml');
          
          if (await fs.pathExists(modulePomPath)) {
            await scanModuleRecursive(modulePomPath, basePath, depth + 1);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning module at ${currentPomPath}:`, error);
    }
  }

  await scanModuleRecursive(pomPath, projectDir, 0);
  return modules;
}

async function scanMavenProfiles(pomPath: string): Promise<string[]> {
  const profiles = new Set<string>();
  const projectDir = path.dirname(pomPath);
  
  // Recursive function to scan profiles from all pom.xml files
  async function scanProfilesRecursive(currentPomPath: string): Promise<void> {
    try {
      const pomContent = await fs.readFile(currentPomPath, 'utf-8');
      const currentDir = path.dirname(currentPomPath);
      
      // Extract profiles from this pom.xml
      const profileMatches = pomContent.matchAll(/<profile>\s*<id>([^<]+)<\/id>/g);
      for (const match of profileMatches) {
        profiles.add(match[1]);
      }
      
      // Find and process submodules recursively
      const modulesMatch = pomContent.match(/<modules>([\s\S]*?)<\/modules>/);
      if (modulesMatch) {
        const moduleMatches = modulesMatch[1].matchAll(/<module>([^<]+)<\/module>/g);
        for (const match of moduleMatches) {
          const moduleName = match[1].trim();
          const modulePomPath = path.join(currentDir, moduleName, 'pom.xml');
          
          if (await fs.pathExists(modulePomPath)) {
            await scanProfilesRecursive(modulePomPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning profiles at ${currentPomPath}:`, error);
    }
  }
  
  await scanProfilesRecursive(pomPath);
  return Array.from(profiles).sort();
}

// ============================================================================
// Build Execution
// ============================================================================

async function executeBuild(job: BuildJob, settings: AppSettings): Promise<void> {
  const mavenExecutable = process.platform === 'win32' 
    ? path.join(settings.defaultMavenHome, 'bin', 'mvn.cmd')
    : path.join(settings.defaultMavenHome, 'bin', 'mvn');

  // Build Maven command args
  const args: string[] = [...job.mavenGoals];

  if (job.skipTests) {
    args.push('-DskipTests');
  }
  if (job.offline) {
    args.push('-o');
  }
  if (job.enableThreads && job.threads) {
    args.push('-T', job.threads);
  }
  if (job.profiles && job.profiles.length > 0) {
    args.push('-P', job.profiles.join(','));
  }
  if (job.modulePath) {
    args.push('-pl', job.modulePath, '-am');
  }

  // Environment with JAVA_HOME
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    JAVA_HOME: job.jdkPath,
    PATH: `${path.join(job.jdkPath, 'bin')}${path.delimiter}${process.env.PATH}`,
  };

  const childProcess = spawn(mavenExecutable, args, {
    cwd: job.projectPath,
    env,
    shell: true,
  });

  runningProcesses.set(job.id, childProcess);

  childProcess.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        mainWindow?.webContents.send('build:log', job.id, line);
        
        // Estimate progress from log output
        const progress = estimateProgress(line);
        if (progress !== null) {
          mainWindow?.webContents.send('build:progress', job.id, progress);
        }
      }
    }
  });

  childProcess.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        mainWindow?.webContents.send('build:log', job.id, `[ERROR] ${line}`);
      }
    }
  });

  childProcess.on('close', (code: number | null) => {
    runningProcesses.delete(job.id);
    const status = code === 0 ? 'success' : 'failed';
    mainWindow?.webContents.send('build:complete', job.id, status, code);
  });

  childProcess.on('error', (error: Error) => {
    runningProcesses.delete(job.id);
    mainWindow?.webContents.send('build:error', job.id, error.message);
  });
}

function estimateProgress(logLine: string): number | null {
  if (logLine.includes('Scanning for projects')) return 5;
  if (logLine.includes('maven-clean-plugin')) return 10;
  if (logLine.includes('maven-resources-plugin')) return 20;
  if (logLine.includes('maven-compiler-plugin')) return 40;
  if (logLine.includes('maven-surefire-plugin')) return 60;
  if (logLine.includes('maven-jar-plugin')) return 75;
  if (logLine.includes('maven-install-plugin')) return 90;
  if (logLine.includes('BUILD SUCCESS')) return 100;
  if (logLine.includes('BUILD FAILURE')) return 100;
  return null;
}

function cancelBuild(jobId: string): boolean {
  const proc = runningProcesses.get(jobId);
  if (proc) {
    proc.kill('SIGTERM');
    runningProcesses.delete(jobId);
    return true;
  }
  return false;
}

// ============================================================================
// IPC Handlers
// ============================================================================

function setupIpcHandlers(): void {
  // Config
  ipcMain.handle('config:load', loadConfig);
  ipcMain.handle('config:save', (_event, config: AppSettings) => saveConfig(config));

  // Jobs persistence
  ipcMain.handle('jobs:load', loadJobs);
  ipcMain.handle('jobs:save', (_event, jobs: BuildJob[]) => saveJobs(jobs));

  // Pipelines
  ipcMain.handle('pipelines:load', loadPipelines);
  ipcMain.handle('pipelines:save', (_event, pipelines: Pipeline[]) => savePipelines(pipelines));

  // Scanning
  ipcMain.handle('scan:projects', async (_event, rootPath: string) => {
    mainWindow?.webContents.send('scan:status', 'Scanning projects...');
    const projects = await scanForProjects(rootPath);
    mainWindow?.webContents.send('scan:status', null);
    return projects;
  });

  ipcMain.handle('scan:jdks', async (_event, scanPaths: string) => {
    mainWindow?.webContents.send('scan:status', 'Scanning JDKs...');
    const jdks = await scanForJDKs(scanPaths);
    mainWindow?.webContents.send('scan:status', null);
    return jdks;
  });

  ipcMain.handle('scan:modules', async (_event, pomPath: string) => {
    return scanMavenModules(pomPath);
  });

  ipcMain.handle('scan:profiles', async (_event, pomPath: string) => {
    return scanMavenProfiles(pomPath);
  });

  // Build execution
  ipcMain.handle('build:start', async (_event, job: BuildJob) => {
    const settings = await loadConfig();
    executeBuild(job, settings);
    return true;
  });

  ipcMain.handle('build:cancel', (_event, jobId: string) => {
    return cancelBuild(jobId);
  });

  // File dialogs
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Shell operations
  ipcMain.handle('shell:openPath', (_event, filePath: string) => {
    shell.openPath(filePath);
  });

  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    shell.openExternal(url);
  });

  // App info
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPath', (_event, name: string) => {
    return app.getPath(name as any);
  });
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Cancel all running builds
  for (const [jobId, proc] of runningProcesses) {
    proc.kill('SIGTERM');
  }
  runningProcesses.clear();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cleanup
  for (const [jobId, proc] of runningProcesses) {
    proc.kill('SIGTERM');
  }
});
