/**
 * BuildRunner Service
 * 
 * Handles Maven build execution with dynamic JAVA_HOME injection.
 * Supports both real execution (via Bun.spawn) and mock mode for development.
 */

import { useAppStore } from '../store/useAppStore.js';
import type { BuildStatus } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Environment configuration for a build.
 */
export interface BuildEnvironment {
  /** JAVA_HOME path for this build */
  JAVA_HOME: string;
  /** Optional MAVEN_HOME override */
  MAVEN_HOME?: string;
  /** Additional environment variables */
  [key: string]: string | undefined;
}

/**
 * Build configuration for starting a new build.
 */
export interface BuildConfig {
  /** Project root path */
  projectPath: string;
  /** Display name for the build */
  name: string;
  /** Maven goals to execute (e.g., ['clean', 'install']) */
  goals: string[];
  /** Module paths to build (empty = entire project) */
  modules?: string[];
  /** Build environment configuration */
  environment: BuildEnvironment;
  /** Additional Maven arguments */
  mavenArgs?: string[];
  /** Skip tests flag */
  skipTests?: boolean;
  /** Offline mode flag */
  offline?: boolean;
  /** Custom arguments (profiles, etc.) */
  customArgs?: string[];
}

/**
 * Build result after completion.
 */
export interface BuildResult {
  /** Job ID */
  jobId: string;
  /** Final status */
  status: BuildStatus;
  /** Exit code (null if cancelled) */
  exitCode: number | null;
  /** Total duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Callback for build events.
 */
export interface BuildCallbacks {
  onStart?: (jobId: string) => void;
  onLog?: (jobId: string, line: string) => void;
  onProgress?: (jobId: string, progress: number) => void;
  onComplete?: (result: BuildResult) => void;
}

// ============================================================================
// Mock Build Simulation
// ============================================================================

/** Simulated Maven log lines for mock builds */
const MOCK_MAVEN_LOGS = [
  '[INFO] Scanning for projects...',
  '[INFO] ',
  '[INFO] ------------------------< ${groupId}:${artifactId} >------------------------',
  '[INFO] Building ${name} ${version}',
  '[INFO] --------------------------------[ ${packaging} ]---------------------------------',
  '[INFO] ',
  '[INFO] --- maven-clean-plugin:3.2.0:clean (default-clean) @ ${artifactId} ---',
  '[INFO] Deleting ${basedir}/target',
  '[INFO] ',
  '[INFO] --- maven-resources-plugin:3.3.0:resources (default-resources) @ ${artifactId} ---',
  '[INFO] Copying 3 resources',
  '[INFO] ',
  '[INFO] --- maven-compiler-plugin:3.11.0:compile (default-compile) @ ${artifactId} ---',
  '[INFO] Changes detected - recompiling the module!',
  '[INFO] Compiling 42 source files to ${basedir}/target/classes',
  '[INFO] ',
  '[INFO] --- maven-resources-plugin:3.3.0:testResources (default-testResources) @ ${artifactId} ---',
  '[INFO] Copying 2 resources',
  '[INFO] ',
  '[INFO] --- maven-compiler-plugin:3.11.0:testCompile (default-testCompile) @ ${artifactId} ---',
  '[INFO] Changes detected - recompiling the module!',
  '[INFO] Compiling 15 source files to ${basedir}/target/test-classes',
  '[INFO] ',
  '[INFO] --- maven-surefire-plugin:3.1.2:test (default-test) @ ${artifactId} ---',
  '[INFO] Using auto detected provider org.apache.maven.surefire.junitplatform.JUnitPlatformProvider',
  '[INFO] ',
  '[INFO] -------------------------------------------------------',
  '[INFO]  T E S T S',
  '[INFO] -------------------------------------------------------',
  '[INFO] Running ${groupId}.AppTest',
  '[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.123 s - in ${groupId}.AppTest',
  '[INFO] ',
  '[INFO] Results:',
  '[INFO] ',
  '[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0',
  '[INFO] ',
  '[INFO] --- maven-jar-plugin:3.3.0:jar (default-jar) @ ${artifactId} ---',
  '[INFO] Building jar: ${basedir}/target/${artifactId}-${version}.jar',
  '[INFO] ',
  '[INFO] --- maven-install-plugin:3.1.1:install (default-install) @ ${artifactId} ---',
  '[INFO] Installing ${basedir}/target/${artifactId}-${version}.jar to ~/.m2/repository/${groupPath}/${artifactId}/${version}/${artifactId}-${version}.jar',
  '[INFO] Installing ${basedir}/pom.xml to ~/.m2/repository/${groupPath}/${artifactId}/${version}/${artifactId}-${version}.pom',
  '[INFO] ------------------------------------------------------------------------',
  '[INFO] BUILD SUCCESS',
  '[INFO] ------------------------------------------------------------------------',
  '[INFO] Total time:  4.567 s',
  '[INFO] Finished at: ${timestamp}',
  '[INFO] ------------------------------------------------------------------------',
];

const MOCK_MAVEN_FAILURE_LOGS = [
  '[INFO] Scanning for projects...',
  '[INFO] ',
  '[INFO] ------------------------< ${groupId}:${artifactId} >------------------------',
  '[INFO] Building ${name} ${version}',
  '[INFO] --------------------------------[ ${packaging} ]---------------------------------',
  '[INFO] ',
  '[INFO] --- maven-clean-plugin:3.2.0:clean (default-clean) @ ${artifactId} ---',
  '[INFO] Deleting ${basedir}/target',
  '[INFO] ',
  '[INFO] --- maven-compiler-plugin:3.11.0:compile (default-compile) @ ${artifactId} ---',
  '[ERROR] COMPILATION ERROR : ',
  '[ERROR] /src/main/java/App.java:[15,10] cannot find symbol',
  '[ERROR]   symbol:   class SomeClass',
  '[ERROR]   location: package ${groupId}',
  '[INFO] 1 error',
  '[INFO] ------------------------------------------------------------------------',
  '[INFO] BUILD FAILURE',
  '[INFO] ------------------------------------------------------------------------',
  '[INFO] Total time:  1.234 s',
  '[INFO] Finished at: ${timestamp}',
  '[INFO] ------------------------------------------------------------------------',
  '[ERROR] Failed to execute goal org.apache.maven.plugins:maven-compiler-plugin:3.11.0:compile (default-compile) on project ${artifactId}: Compilation failure',
];

/**
 * Replace template variables in mock log lines.
 */
function interpolateMockLog(line: string, config: BuildConfig): string {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const artifactId = config.name || 'project';
  const groupId = 'de.gfos';
  const groupPath = groupId.replace(/\./g, '/');
  
  return line
    .replace(/\$\{groupId\}/g, groupId)
    .replace(/\$\{artifactId\}/g, artifactId)
    .replace(/\$\{name\}/g, config.name)
    .replace(/\$\{version\}/g, '1.0.0-SNAPSHOT')
    .replace(/\$\{packaging\}/g, 'jar')
    .replace(/\$\{basedir\}/g, config.projectPath)
    .replace(/\$\{groupPath\}/g, groupPath)
    .replace(/\$\{timestamp\}/g, timestamp);
}

/**
 * Simulate a mock build with fake Maven logs.
 */
async function runMockBuild(
  jobId: string,
  config: BuildConfig,
  callbacks: BuildCallbacks,
  shouldFail = false
): Promise<BuildResult> {
  const startTime = Date.now();
  const logs = shouldFail ? MOCK_MAVEN_FAILURE_LOGS : MOCK_MAVEN_LOGS;
  const store = useAppStore.getState();
  
  // Update status to running
  store.updateJobStatus(jobId, 'running');
  callbacks.onStart?.(jobId);
  
  // Emit logs with delays
  for (let i = 0; i < logs.length; i++) {
    const logLine = logs[i];
    if (!logLine) continue;
    
    const line = interpolateMockLog(logLine, config);
    
    // Append to store
    store.appendJobLog(jobId, line);
    callbacks.onLog?.(jobId, line);
    
    // Update progress
    const progress = Math.round(((i + 1) / logs.length) * 100);
    store.updateJobProgress(jobId, progress);
    callbacks.onProgress?.(jobId, progress);
    
    // Simulate processing time (faster for empty lines)
    const delay = line.trim() === '' ? 20 : Math.random() * 100 + 50;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Check if job was cancelled
    const currentJob = useAppStore.getState().activeJobs.find(j => j.id === jobId);
    if (!currentJob || currentJob.status === 'cancelled') {
      return {
        jobId,
        status: 'cancelled',
        exitCode: null,
        duration: Date.now() - startTime,
      };
    }
  }
  
  const duration = Date.now() - startTime;
  const status: BuildStatus = shouldFail ? 'failed' : 'success';
  const exitCode = shouldFail ? 1 : 0;
  
  // Update final status
  store.updateJobStatus(jobId, status);
  
  const result: BuildResult = {
    jobId,
    status,
    exitCode,
    duration,
    error: shouldFail ? 'Compilation failure' : undefined,
  };
  
  callbacks.onComplete?.(result);
  return result;
}

// ============================================================================
// Real Build Execution
// ============================================================================

/**
 * Build the Maven command arguments.
 */
function buildMavenCommand(config: BuildConfig): string[] {
  const args: string[] = [];
  
  // Add goals
  args.push(...config.goals);
  
  // Add module selection if specified (expects relative paths like "submodule" or "parent/child")
  // Only add -pl if modules are specified and not empty strings
  const validModules = config.modules?.filter(m => m && m.trim() !== '');
  if (validModules && validModules.length > 0) {
    args.push('-pl', validModules.join(','));
    args.push('-am'); // Also make dependencies
  }
  
  // Add skip tests flag
  if (config.skipTests) {
    args.push('-DskipTests');
  }
  
  // Add offline flag
  if (config.offline) {
    args.push('-o');
  }
  
  // Add additional arguments
  if (config.mavenArgs) {
    args.push(...config.mavenArgs);
  }
  
  // Add custom arguments (profiles, etc.)
  if (config.customArgs && config.customArgs.length > 0) {
    args.push(...config.customArgs);
  }
  
  // Batch mode (no interactive input)
  args.push('-B');
  
  return args;
}

/**
 * Build environment variables for the process.
 */
function buildProcessEnv(environment: BuildEnvironment): Record<string, string> {
  const env: Record<string, string> = { ...process.env as Record<string, string> };
  
  // Set JAVA_HOME
  if (environment.JAVA_HOME) {
    env.JAVA_HOME = environment.JAVA_HOME;
    
    // Update PATH to include Java bin directory
    const javaBin = `${environment.JAVA_HOME}\\bin`;
    const pathSep = process.platform === 'win32' ? ';' : ':';
    env.PATH = javaBin + pathSep + (env.PATH || '');
  }
  
  // Set MAVEN_HOME if provided
  if (environment.MAVEN_HOME) {
    env.MAVEN_HOME = environment.MAVEN_HOME;
    env.M2_HOME = environment.MAVEN_HOME;
    
    // Update PATH to include Maven bin directory
    const mavenBin = `${environment.MAVEN_HOME}\\bin`;
    const pathSep = process.platform === 'win32' ? ';' : ':';
    env.PATH = mavenBin + pathSep + (env.PATH || '');
  }
  
  // Add any additional environment variables
  for (const [key, value] of Object.entries(environment)) {
    if (key !== 'JAVA_HOME' && key !== 'MAVEN_HOME' && value !== undefined) {
      env[key] = value;
    }
  }
  
  return env;
}

/**
 * Run the actual Maven build using Bun.spawn.
 */
async function runRealBuild(
  jobId: string,
  config: BuildConfig,
  callbacks: BuildCallbacks
): Promise<BuildResult> {
  const startTime = Date.now();
  const store = useAppStore.getState();
  const settings = store.settings;
  
  // Determine Maven executable - use full path if MAVEN_HOME is configured
  const isWindows = process.platform === 'win32';
  let mavenCmd: string;
  
  if (config.environment.MAVEN_HOME) {
    // Use Maven from configured MAVEN_HOME
    mavenCmd = isWindows 
      ? `${config.environment.MAVEN_HOME}\\bin\\mvn.cmd`
      : `${config.environment.MAVEN_HOME}/bin/mvn`;
  } else if (settings.defaultMavenHome) {
    // Use Maven from settings
    mavenCmd = isWindows
      ? `${settings.defaultMavenHome}\\bin\\mvn.cmd`
      : `${settings.defaultMavenHome}/bin/mvn`;
  } else {
    // Fall back to PATH
    mavenCmd = isWindows ? 'mvn.cmd' : 'mvn';
  }
  
  const args = buildMavenCommand(config);
  const env = buildProcessEnv(config.environment);
  
  // Update status to running
  store.updateJobStatus(jobId, 'running');
  callbacks.onStart?.(jobId);
  
  // Log the command being executed
  const fullCommand = `${mavenCmd} ${args.join(' ')}`;
  store.appendJobLog(jobId, `[GFOS-Build] Executing: ${fullCommand}`);
  store.appendJobLog(jobId, `[GFOS-Build] JAVA_HOME: ${config.environment.JAVA_HOME || '(system default)'}`);
  store.appendJobLog(jobId, `[GFOS-Build] Working directory: ${config.projectPath}`);
  store.appendJobLog(jobId, '');
  
  return new Promise<BuildResult>((resolve) => {
    try {
      const proc = Bun.spawn([mavenCmd, ...args], {
        cwd: config.projectPath,
        env,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      // Track progress based on Maven output
      // Strategy: Use module-based progress for multi-module builds
      // Each module completion = 100/totalModules percent
      let totalModules = 1;
      let completedModules = 0;
      let lastReportedProgress = 0;
      
      // Track when we see "Building module (X/Y)" - use module count for progress
      // This is more reliable than tracking individual phases
      
      // Stream stdout
      const streamStdout = async () => {
        const reader = proc.stdout.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            store.appendJobLog(jobId, line);
            callbacks.onLog?.(jobId, line);
            
            // Detect multi-module build start: "[INFO] Reactor Build Order:"
            // This tells us it's a multi-module build before we see the count
            
            // Detect module build: "[INFO] Building moduleName (X/Y)"
            const multiModuleMatch = line.match(/\[INFO\] Building .+ \((\d+)\/(\d+)\)/);
            if (multiModuleMatch?.[1] && multiModuleMatch?.[2]) {
              const currentModule = parseInt(multiModuleMatch[1], 10);
              totalModules = parseInt(multiModuleMatch[2], 10);
              // Progress based on modules started (not completed)
              // Module 1/5 = 0%, 2/5 = 20%, 3/5 = 40%, etc.
              completedModules = currentModule - 1;
            }
            
            // Detect module completion: "[INFO] BUILD SUCCESS" within module
            // For individual module: "[INFO] --------" separator after install
            
            // Detect reactor summary (at end of multi-module build)
            if (line.includes('[INFO] Reactor Summary')) {
              completedModules = totalModules;
            }
            
            // Detect BUILD SUCCESS/FAILURE (final)
            if (line.includes('BUILD SUCCESS')) {
              completedModules = totalModules;
            }
            
            // Calculate progress: module-based for multi-module, simple for single
            let progress: number;
            if (totalModules > 1) {
              // Multi-module: progress = completed modules / total * 100
              // Add small increment for current module being processed
              const moduleProgress = (completedModules / totalModules) * 100;
              // Add 5% buffer for current module processing
              progress = Math.min(99, Math.round(moduleProgress + (completedModules < totalModules ? 3 : 0)));
            } else {
              // Single module: estimate based on log output
              // Just show steady progress based on output lines
              const job = useAppStore.getState().activeJobs.find(j => j.id === jobId);
              const logCount = job?.logs.length || 0;
              // Estimate: 500 lines for a typical build
              progress = Math.min(95, Math.round((logCount / 500) * 100));
            }
            
            // Only update if progress increased (prevents jumping backward)
            if (progress > lastReportedProgress) {
              lastReportedProgress = progress;
              store.updateJobProgress(jobId, progress);
              callbacks.onProgress?.(jobId, progress);
            }
            
            // Check for cancellation
            const currentJob = useAppStore.getState().activeJobs.find(j => j.id === jobId);
            if (!currentJob || currentJob.status === 'cancelled') {
              proc.kill();
              return;
            }
          }
        }
        
        // Handle remaining buffer
        if (buffer) {
          store.appendJobLog(jobId, buffer);
          callbacks.onLog?.(jobId, buffer);
        }
      };
      
      // Stream stderr
      const streamStderr = async () => {
        const reader = proc.stderr.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            store.appendJobLog(jobId, `[STDERR] ${line}`);
            callbacks.onLog?.(jobId, `[STDERR] ${line}`);
          }
        }
        
        if (buffer) {
          store.appendJobLog(jobId, `[STDERR] ${buffer}`);
          callbacks.onLog?.(jobId, `[STDERR] ${buffer}`);
        }
      };
      
      // Run streams in parallel and wait for process to exit
      Promise.all([streamStdout(), streamStderr(), proc.exited]).then(([, , exitCode]) => {
        const duration = Date.now() - startTime;
        const status: BuildStatus = exitCode === 0 ? 'success' : 'failed';
        
        // Check if cancelled
        const currentJob = useAppStore.getState().activeJobs.find(j => j.id === jobId);
        if (!currentJob || currentJob.status === 'cancelled') {
          resolve({
            jobId,
            status: 'cancelled',
            exitCode: null,
            duration,
          });
          return;
        }
        
        // Update final status
        store.updateJobStatus(jobId, status);
        store.updateJobProgress(jobId, 100);
        
        const result: BuildResult = {
          jobId,
          status,
          exitCode: exitCode ?? 1,
          duration,
          error: exitCode !== 0 ? `Build failed with exit code ${exitCode}` : undefined,
        };
        
        callbacks.onComplete?.(result);
        resolve(result);
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide helpful message if Maven not found
      if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
        errorMessage = `Maven not found: ${mavenCmd}\n\nTo fix this:\n1. Set 'defaultMavenHome' in Settings (e.g., C:\\apache-maven-3.9.6)\n2. Or add Maven to your system PATH`;
        store.appendJobLog(jobId, `[ERROR] ${errorMessage}`);
      }
      
      store.setJobError(jobId, errorMessage);
      
      const result: BuildResult = {
        jobId,
        status: 'failed',
        exitCode: 1,
        duration,
        error: errorMessage,
      };
      
      callbacks.onComplete?.(result);
      resolve(result);
    }
  });
}

// ============================================================================
// BuildRunner Class
// ============================================================================

/**
 * BuildRunner - Manages build execution.
 */
export class BuildRunner {
  private isMockMode: boolean;
  
  constructor() {
    this.isMockMode = process.env.MOCK_MODE === 'true';
  }
  
  /**
   * Start a new build job.
   * 
   * @param config - Build configuration
   * @param callbacks - Optional callbacks for build events
   * @returns Promise resolving to build result
   */
  async startBuild(
    config: BuildConfig,
    callbacks: BuildCallbacks = {}
  ): Promise<BuildResult> {
    const store = useAppStore.getState();
    
    // Create job in store
    const jobId = store.addJob({
      projectPath: config.projectPath,
      name: config.name,
      jdkPath: config.environment.JAVA_HOME,
      mavenGoals: config.goals,
      status: 'pending',
    });
    
    // Add notification
    store.addNotification('info', `Build started: ${config.name}`);
    
    // Execute build (mock or real)
    if (this.isMockMode) {
      // In mock mode, randomly fail ~10% of builds for testing
      const shouldFail = Math.random() < 0.1;
      return runMockBuild(jobId, config, callbacks, shouldFail);
    }
    
    return runRealBuild(jobId, config, callbacks);
  }
  
  /**
   * Cancel a running build.
   * 
   * @param jobId - Job ID to cancel
   */
  cancelBuild(jobId: string): void {
    const store = useAppStore.getState();
    const job = store.activeJobs.find(j => j.id === jobId);
    
    if (job && job.status === 'running') {
      store.updateJobStatus(jobId, 'cancelled');
      store.addNotification('warning', `Build cancelled: ${job.name}`);
    }
  }
  
  /**
   * Execute an existing job (already in the queue).
   * Unlike startBuild, this doesn't create a new job.
   * 
   * @param jobId - The ID of the existing job to execute
   * @param config - Build configuration
   * @param callbacks - Optional callbacks for build events
   * @returns Promise resolving to build result
   */
  async executeJob(
    jobId: string,
    config: BuildConfig,
    callbacks: BuildCallbacks = {}
  ): Promise<BuildResult> {
    // Execute build (mock or real)
    if (this.isMockMode) {
      // In mock mode, randomly fail ~10% of builds for testing
      const shouldFail = Math.random() < 0.1;
      return runMockBuild(jobId, config, callbacks, shouldFail);
    }
    
    return runRealBuild(jobId, config, callbacks);
  }
  
  /**
   * Get the current status of a job.
   * 
   * @param jobId - Job ID to check
   * @returns Job status or null if not found
   */
  getJobStatus(jobId: string): BuildStatus | null {
    const store = useAppStore.getState();
    const job = store.activeJobs.find(j => j.id === jobId) 
      || store.jobHistory.find(j => j.id === jobId);
    return job?.status ?? null;
  }
  
  /**
   * Check if mock mode is active.
   */
  get mockMode(): boolean {
    return this.isMockMode;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let buildRunnerInstance: BuildRunner | null = null;

/**
 * Get the BuildRunner singleton instance.
 */
export function getBuildRunner(): BuildRunner {
  if (!buildRunnerInstance) {
    buildRunnerInstance = new BuildRunner();
  }
  return buildRunnerInstance;
}

export default BuildRunner;
