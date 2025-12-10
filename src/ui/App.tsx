/**
 * App Component
 * 
 * Main application component with screen routing and global input handling.
 * 
 * Features:
 * - Screen-based navigation using Zustand store
 * - Global keyboard shortcuts (Tab, Ctrl+S, ESC, Q)
 * - Automatic config loading and workspace scanning on startup
 * - Background job processor for build queue
 * - Graceful process cleanup on exit
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';

import {
  useAppStore,
  useCurrentScreen,
  useNavParams,
  useProjects,
  useIsScanning,
  useActiveJobs,
  usePendingJobsCount,
  useRunningJobsCount,
} from '../core/store/useAppStore.js';
import { getConfigService } from '../core/services/ConfigService.js';
import { processManager } from '../core/services/ProcessManager.js';
import { getBuildRunner } from '../core/services/BuildRunner.js';
import type { BuildConfig } from '../core/services/BuildRunner.js';
import type { BuildJob } from '../core/types/index.js';
import { WorkspaceScanner } from '../core/services/WorkspaceScanner.js';
import { getCacheService } from '../core/services/CacheService.js';
import { getFileSystem } from '../infrastructure/ServiceLocator.js';
import { getJobHistoryService, type PersistedJob } from '../core/services/JobHistoryService.js';

// Views
import { MainMenuView } from './views/MainMenuView.js';
import { RepoListView } from './views/RepoListView.js';
import { RepoDetailView } from './views/RepoDetailView.js';
import type { BuildConfigData, SelectedModuleData } from './views/RepoDetailView.js';
import { BuildConfigView } from './views/BuildConfigView.js';
import type { BuildOptions } from './views/BuildConfigView.js';
import { JobsView } from './views/JobsView.js';
import { SettingsView } from './views/SettingsView.js';

// Components
import { Header, StatusBar, FullscreenContainer } from './components/index.js';
import { colors } from './theme.js';

import type { Shortcut } from './components/index.js';

// ============================================================================
// Build Config State (stored between screens)
// ============================================================================

interface PendingBuildConfig {
  projectPath: string;
  projectName: string;
  selectedModules: SelectedModuleData[];
  availableProfiles: string[];
  jdkPath: string;
  jdkVersion: string;
}

function toBuildJob(data: PersistedJob): BuildJob {
  return {
    id: data.id,
    projectPath: data.projectPath,
    name: data.name,
    jdkPath: data.jdkPath,
    mavenGoals: data.mavenGoals,
    status: data.status,
    progress: data.progress,
    createdAt: new Date(data.createdAt),
    startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
    completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    command: data.command,
    logFilePath: data.logFilePath,
    exitCode: data.exitCode,
    error: data.error,
    sequenceId: data.sequenceId,
    sequenceIndex: data.sequenceIndex,
    sequenceTotal: data.sequenceTotal,
  };
}

// ============================================================================
// App Component
// ============================================================================

export function App(): React.ReactElement {
  const { exit } = useApp();
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [pendingBuildConfig, setPendingBuildConfig] = useState<PendingBuildConfig | null>(null);
  
  // Store selectors
  const currentScreen = useCurrentScreen();
  const navParams = useNavParams();
  const projects = useProjects();
  const isScanning = useIsScanning();
  const activeJobs = useActiveJobs();
  const pendingJobs = usePendingJobsCount();
  const runningJobs = useRunningJobsCount();
  
  // Store actions
  const setScreen = useAppStore((state) => state.setScreen);
  const goBack = useAppStore((state) => state.goBack);
  const loadProjects = useAppStore((state) => state.loadProjects);
  const loadJdks = useAppStore((state) => state.loadJdks);
  const loadJobHistory = useAppStore((state) => state.loadJobHistory);
  const setScanning = useAppStore((state) => state.setScanning);
  const addNotification = useAppStore((state) => state.addNotification);
  
  // ========================================================================
  // Initialization
  // ========================================================================
  
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Load configuration
        const configService = getConfigService();
        await configService.loadIntoStore();

        const historyService = getJobHistoryService();
        const persistedJobs = await historyService.load();
        if (persistedJobs.length > 0) {
          loadJobHistory(persistedJobs.map(toBuildJob));
        }
        
        // 2. Try to load from cache first
        const cacheService = getCacheService();
        const settings = useAppStore.getState().settings;
        const cachedData = await cacheService.loadCache(
          settings.scanRootPath,
          settings.jdkScanPaths
        );
        
        // If we have valid cached data, use it
        if (cachedData && cachedData.repositories.length > 0) {
          loadProjects(cachedData.repositories);
          loadJdks(cachedData.jdks);
          addNotification('info', `Loaded ${cachedData.repositories.length} repos from cache`);
          setIsInitialized(true);
          return;
        }
        
        // 3. No cache or cache expired - do a full scan
        const currentProjects = useAppStore.getState().scannedData.projects;
        if (currentProjects.length === 0) {
          setScanning(true);
          
          try {
            const fs = getFileSystem();
            const scanner = new WorkspaceScanner(fs);
            
            // Scan for repositories
            const discoveredProjects = await scanner.findRepositories(settings.scanRootPath);
            loadProjects(discoveredProjects);
            
            // Scan for JDKs in all configured paths
            const jdkPaths = settings.jdkScanPaths.split(';').filter(p => p.trim());
            const allJdks: Awaited<ReturnType<typeof scanner.scanJdks>>  = [];
            
            for (const jdkPath of jdkPaths) {
              try {
                const jdks = await scanner.scanJdks(jdkPath.trim());
                allJdks.push(...jdks);
              } catch {
                // Ignore errors for individual paths (path might not exist)
              }
            }
            
            // Remove duplicates by jdkHome path
            const uniqueJdks = allJdks.filter((jdk, index, self) => 
              index === self.findIndex(j => j.jdkHome === jdk.jdkHome)
            );
            
            loadJdks(uniqueJdks);
            
            // Save to cache for next time
            await cacheService.saveCache(
              settings.scanRootPath,
              settings.jdkScanPaths,
              discoveredProjects,
              uniqueJdks
            );
            
            addNotification('success', `Found ${discoveredProjects.length} repos, ${uniqueJdks.length} JDKs`);
          } catch (scanError) {
            const message = scanError instanceof Error ? scanError.message : 'Scan failed';
            addNotification('warning', `Scan: ${message}`);
          } finally {
            setScanning(false);
          }
        }
        
        setIsInitialized(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setInitError(message);
        setIsInitialized(true);
      }
    };
    
    // Run init immediately
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // ========================================================================
  // Job Processor - Automatically starts pending jobs
  // Handles sequential builds: waiting -> pending when previous completes
  // ========================================================================
  
  const processingJobRef = useRef<Set<string>>(new Set());
  const maxConcurrentJobs = useAppStore((state) => state.settings.maxParallelBuilds) || 2;
  
  useEffect(() => {
    // Find pending jobs that aren't being processed yet
    const pendingJobsList = activeJobs.filter(
      job => job.status === 'pending' && !processingJobRef.current.has(job.id)
    );
    
    // Count currently running jobs
    const runningCount = activeJobs.filter(j => j.status === 'running').length;
    
    // How many more jobs can we start?
    const slotsAvailable = maxConcurrentJobs - runningCount;
    
    if (slotsAvailable <= 0 || pendingJobsList.length === 0) {
      return;
    }
    
    // Start jobs up to available slots
    const jobsToStart = pendingJobsList.slice(0, slotsAvailable);
    
    for (const job of jobsToStart) {
      // Mark as being processed to avoid double-starting
      processingJobRef.current.add(job.id);
      
      // Get settings for build config
      const settings = useAppStore.getState().settings;
      
      // Create build config from job
      const buildConfig: BuildConfig = {
        projectPath: job.projectPath,
        name: job.name,
        goals: job.mavenGoals,
        environment: {
          JAVA_HOME: job.jdkPath || '',
        },
        skipTests: job.skipTests ?? settings.skipTestsByDefault,
        offline: job.offline,
        customArgs: job.customArgs,
      };
      
      // Execute the existing job using BuildRunner (not startBuild which creates a new job)
      const runner = getBuildRunner();
      
      // executeJob will update status to running internally
      runner.executeJob(job.id, buildConfig, {
        onLog: (_jobId: string, line: string) => {
          useAppStore.getState().appendJobLog(job.id, line);
        },
        onProgress: (_jobId: string, progress: number) => {
          useAppStore.getState().updateJobProgress(job.id, progress);
        },
        onComplete: (result) => {
          processingJobRef.current.delete(job.id);
          
          // Handle sequential builds
          if (job.sequenceId && job.sequenceIndex !== undefined && job.sequenceTotal !== undefined) {
            if (result.status === 'success') {
              // Activate next job in sequence
              const nextIndex = job.sequenceIndex + 1;
              if (nextIndex < job.sequenceTotal) {
                // Find the waiting job with the next sequence index in the same sequence
                const waitingJobs = useAppStore.getState().activeJobs.filter(
                  j => j.status === 'waiting' 
                    && j.sequenceId === job.sequenceId
                    && j.sequenceIndex === nextIndex
                );
                
                for (const waitingJob of waitingJobs) {
                  useAppStore.getState().updateJobStatus(waitingJob.id, 'pending');
                }
              }
            } else if (result.status === 'failed') {
              // Cancel all remaining waiting jobs in the sequence
              const waitingJobs = useAppStore.getState().activeJobs.filter(
                j => j.status === 'waiting' && j.sequenceId === job.sequenceId
              );
              
              for (const waitingJob of waitingJobs) {
                useAppStore.getState().updateJobStatus(waitingJob.id, 'cancelled');
                useAppStore.getState().appendJobLog(
                  waitingJob.id, 
                  `[CANCELLED] Previous job in sequence failed: ${job.name}`
                );
              }
            }
          }
        },
      }).catch((err: Error) => {
        // Handle any unexpected errors
        useAppStore.getState().updateJobStatus(job.id, 'failed');
        useAppStore.getState().appendJobLog(job.id, `Unexpected error: ${err.message}`);
        processingJobRef.current.delete(job.id);
      });
    }
  }, [activeJobs, maxConcurrentJobs]);
  
  // ========================================================================
  // Exit Handler with Process Cleanup
  // ========================================================================
  
  const handleExit = useCallback(async () => {
    // Cancel all running builds
    const runner = getBuildRunner();
    const runningBuildJobs = activeJobs.filter(j => j.status === 'running');
    
    for (const job of runningBuildJobs) {
      runner.cancelBuild(job.id);
    }
    
    // Kill all spawned processes
    await processManager.killAll();
    
    // Exit the application
    exit();
  }, [activeJobs, exit]);
  
  // ========================================================================
  // Global Keyboard Shortcuts
  // ========================================================================
  
  useInput((input, key) => {
    // Ctrl+Q to quit (global)
    if (key.ctrl && (input === 'q' || input === 'Q')) {
      handleExit();
      return;
    }
    
    // Ctrl+H to go to Home (global)
    if (key.ctrl && (input === 'h' || input === 'H')) {
      if (currentScreen !== 'HOME') {
        setScreen('HOME');
      }
      return;
    }
    
    // Ctrl+S to go to Settings (from any screen except settings)
    if (key.ctrl && input === 's') {
      if (currentScreen !== 'SETTINGS') {
        setScreen('SETTINGS');
      }
      return;
    }
    
    // Global ESC behavior for placeholder screens
    if (key.escape) {
      const placeholderScreens = ['MODULE_DETAIL', 'JDK_LIST'];
      if (placeholderScreens.includes(currentScreen)) {
        goBack();
      }
    }
  }, { isActive: true });
  
  // ========================================================================
  // Screen Routing
  // ========================================================================
  
  const renderScreen = (): React.ReactElement => {
    // Show loading state during initialization
    if (!isInitialized) {
      return (
        <Box flexDirection="column" alignItems="center" justifyContent="center" padding={4}>
          <Text color={colors.primary}>Initializing GFOS-Build...</Text>
          {isScanning && (
            <Text color={colors.textDim}>Scanning workspace...</Text>
          )}
        </Box>
      );
    }
    
    // Show error if initialization failed
    if (initError) {
      return (
        <Box flexDirection="column" padding={2}>
          <Text color={colors.error}>Initialization Error:</Text>
          <Text color={colors.textDim}>{initError}</Text>
          <Text color={colors.textDim}>Press Q to exit.</Text>
        </Box>
      );
    }
    
    switch (currentScreen) {
      case 'HOME':
        return (
          <MainMenuView 
            onNavigateToRepos={() => setScreen('REPO_LIST')}
            onNavigateToJobs={() => setScreen('BUILD_QUEUE')}
            onNavigateToSettings={() => setScreen('SETTINGS')}
            onExit={handleExit}
          />
        );
      
      case 'REPO_LIST':
        return (
          <RepoListView 
            onNavigateToRepo={(path) => {
              setScreen('REPO_DETAIL', { projectPath: path });
            }}
            onBack={goBack}
          />
        );
        
      case 'REPO_DETAIL':
        return (
          <RepoDetailView 
            projectPath={navParams.projectPath as string}
            onBack={goBack}
            onNavigateToBuildConfig={(data: BuildConfigData) => {
              setPendingBuildConfig(data);
              setScreen('BUILD_CONFIG');
            }}
            onNavigateToJobs={() => setScreen('BUILD_QUEUE')}
          />
        );
        
      case 'BUILD_CONFIG':
        if (!pendingBuildConfig) {
          // No build config data, go back
          goBack();
          return <Box />;
        }
        return (
          <BuildConfigView
            projectPath={pendingBuildConfig.projectPath}
            projectName={pendingBuildConfig.projectName}
            selectedModules={pendingBuildConfig.selectedModules}
            availableProfiles={pendingBuildConfig.availableProfiles}
            jdkPath={pendingBuildConfig.jdkPath}
            jdkVersion={pendingBuildConfig.jdkVersion}
            onConfirm={(options: BuildOptions) => {
              // Add jobs to queue based on options
              const addJob = useAppStore.getState().addJob;
              const addNotification = useAppStore.getState().addNotification;
              
              // Build customArgs array from profiles and custom args
              const customArgsArray: string[] = [];
              if (options.profiles.length > 0) {
                customArgsArray.push(`-P`, options.profiles.join(','));
              }
              if (options.batchMode) {
                customArgsArray.push('-B');
              }
              if (options.threads) {
                customArgsArray.push('-T', options.threads);
              }
              if (options.updateSnapshots) {
                customArgsArray.push('-U');
              }
              if (options.alsoMake) {
                customArgsArray.push('-am');
              }
              if (options.alsoMakeDependents) {
                customArgsArray.push('-amd');
              }
              if (options.showErrors) {
                customArgsArray.push('-e');
              }
              if (options.customArgs) {
                // Split custom args string into parts
                customArgsArray.push(...options.customArgs.split(/\s+/).filter(a => a));
              }
              
              // Sequential mode only makes sense for multiple modules
              const useSequential = options.sequential && pendingBuildConfig.selectedModules.length > 1;
              
              if (useSequential) {
                // For sequential builds, add jobs with a dependency chain
                // Generate a unique sequence ID to group these jobs
                const sequenceId = `seq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                // We'll mark all but the first as 'waiting' and handle them in job processor
                pendingBuildConfig.selectedModules.forEach((module, index) => {
                  const moduleProjectPath = module.projectPath || pendingBuildConfig.projectPath;
                  addJob({
                    projectPath: moduleProjectPath,
                    name: `${pendingBuildConfig.projectName}:${module.artifactId}`,
                    jdkPath: pendingBuildConfig.jdkPath,
                    mavenGoals: options.goals,
                    status: index === 0 ? 'pending' : 'waiting', // Only first job starts immediately
                    skipTests: options.skipTests,
                    offline: options.offline,
                    customArgs: customArgsArray,
                    sequenceIndex: index,
                    sequenceTotal: pendingBuildConfig.selectedModules.length,
                    sequenceId,
                  });
                });
              } else {
                // Parallel builds or single module - all jobs start as pending, no sequence
                pendingBuildConfig.selectedModules.forEach(module => {
                  const moduleProjectPath = module.projectPath || pendingBuildConfig.projectPath;
                  addJob({
                    projectPath: moduleProjectPath,
                    name: `${pendingBuildConfig.projectName}:${module.artifactId}`,
                    jdkPath: pendingBuildConfig.jdkPath,
                    mavenGoals: options.goals,
                    status: 'pending',
                    skipTests: options.skipTests,
                    offline: options.offline,
                    customArgs: customArgsArray,
                  });
                });
              }
              
              addNotification('success', `Added ${pendingBuildConfig.selectedModules.length} build job(s) to queue`);
              setPendingBuildConfig(null);
              setScreen('BUILD_QUEUE');
            }}
            onBack={() => {
              setPendingBuildConfig(null);
              goBack();
            }}
          />
        );
        
      case 'BUILD_QUEUE':
      case 'BUILD_DETAIL':
        return (
          <JobsView 
            onBack={goBack}
            initialJobId={navParams.jobId as string | undefined}
          />
        );
        
      case 'SETTINGS':
        return (
          <SettingsView 
            onBack={goBack}
          />
        );
        
      // Placeholder screens
      case 'MODULE_DETAIL':
      case 'JDK_LIST':
        return (
          <Box flexDirection="column" padding={2}>
            <Text color={colors.warning}>
              Screen "{currentScreen}" is not yet implemented.
            </Text>
            <Text color={colors.textDim}>
              Press ESC to go back.
            </Text>
          </Box>
        );
        
      default:
        return (
          <Box flexDirection="column" padding={2}>
            <Text color={colors.error}>
              Unknown screen: {currentScreen}
            </Text>
          </Box>
        );
    }
  };
  
  // ========================================================================
  // Global Shortcuts for StatusBar
  // ========================================================================
  
  const globalShortcuts: Shortcut[] = [
    { key: 'Ctrl+H', label: 'Home' },
    { key: 'Ctrl+S', label: 'Settings' },
    { key: 'Ctrl+Q', label: 'Quit' },
  ];
  
  // ========================================================================
  // Render
  // ========================================================================
  
  // All main views include their own Header/StatusBar, render them directly
  if (isInitialized && !initError) {
    const viewsWithOwnLayout = ['HOME', 'REPO_LIST', 'REPO_DETAIL', 'BUILD_QUEUE', 'BUILD_DETAIL', 'SETTINGS'];
    if (viewsWithOwnLayout.includes(currentScreen)) {
      return (
        <FullscreenContainer>
          {renderScreen()}
        </FullscreenContainer>
      );
    }
  }
  
  // For placeholder/error screens, wrap with Header and global StatusBar
  return (
    <FullscreenContainer>
      <Box flexDirection="column" flexGrow={1}>
        <Header 
          title="GFOS-Build" 
          version="1.0.0" 
          isMockMode={process.env.MOCK_MODE === 'true'} 
        />
        
        {renderScreen()}
        
        <StatusBar
          shortcuts={globalShortcuts}
          pendingJobs={pendingJobs}
          runningJobs={runningJobs}
          mode={process.env.MOCK_MODE === 'true' ? 'MOCK' : undefined}
        />
      </Box>
    </FullscreenContainer>
  );
}

export default App;
