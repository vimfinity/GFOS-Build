/**
 * GFOS-Build - Professional CLI Application
 * 
 * Main application component with:
 * - Proper initialization lifecycle
 * - State machine navigation
 * - Global command system
 * - Performance-optimized rendering
 * - Clean process management
 */

import React, { useEffect, useCallback, useState, useRef, useMemo, Component } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';

// ============================================================================
// Error Boundary
// ============================================================================

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, resetError: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // Log error for debugging
    console.error('[GFOS-Build] React error caught:', error);
    console.error('[GFOS-Build] Component stack:', errorInfo.componentStack);
  }

  resetError = () => {
    this.setState({ error: null, errorInfo: null });
  };

  override render() {
    const { error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (fallback) {
        return fallback(error, this.resetError);
      }

      return (
        <Box flexDirection="column" padding={2}>
          <Box marginBottom={1}>
            <Text color="red" bold>
              [x] Ein unerwarteter Fehler ist aufgetreten
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="yellow">{error.message}</Text>
          </Box>
          {errorInfo && (
            <Box flexDirection="column">
              <Text color="gray" dimColor>Stack Trace:</Text>
              <Text color="gray" dimColor wrap="truncate-end">
                {error.stack?.split('\n').slice(0, 5).join('\n')}
              </Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="blue">Drücke ESC um neu zu laden oder Ctrl+C zum Beenden</Text>
          </Box>
        </Box>
      );
    }

    return children;
  }
}

// Core systems
import {
  useNavigation,
  useNavigator,
  useNavigationKeyboard,
  useGlobalInputHandler,
  useTerminalSize,
  type Route,
} from './hooks/index.js';

import {
  useCommandStore,
  useGlobalShortcuts,
  useCoreCommands,
  useAvailableCommands,
} from './system/commands.js';

import {
  useNotifications,
  useNotificationAutoDismiss,
  useLatestNotification,
} from './system/notifications.js';

// UI Primitives
import {
  Screen,
  Toast,
  CommandPalette,
  Spinner,
  type CommandItem,
} from './primitives/index.js';

import { theme, icons, LOGO } from './theme/index.js';

// Types
import type { BuildStatus } from '../core/types/index.js';

// Views
import { HomeView } from './views/HomeView.js';
import { RepoListView } from './views/RepoListView.js';
import { RepoDetailView } from './views/RepoDetailView.js';
import { JobsView } from './views/JobsView.js';
import { JobDetailView } from './views/JobDetailView.js';
import { SettingsView } from './views/SettingsView.js';
import { HelpView } from './views/HelpView.js';
import { PipelineListView } from './views/PipelineListView.js';
import { PipelineEditorView } from './views/PipelineEditorView.js';
import { SetupWizardView } from './views/SetupWizardView.js';

// Core services
import { useAppStore } from '../core/store/useAppStore.js';
import { getConfigService } from '../core/services/ConfigService.js';
import { processManager } from '../core/services/ProcessManager.js';
import { getBuildRunner, type BuildConfig } from '../core/services/BuildRunner.js';
import { WorkspaceScanner } from '../core/services/WorkspaceScanner.js';
import { getCacheService } from '../core/services/CacheService.js';
import { getFileSystem } from '../infrastructure/ServiceLocator.js';
import { getJobHistoryService, type PersistedJob } from '../core/services/JobHistoryService.js';
import { getPipelineService } from '../core/services/PipelineService.js';
import type { BuildJob } from '../core/types/index.js';

// ============================================================================
// App State
// ============================================================================

type AppPhase = 'initializing' | 'setup' | 'loading' | 'ready' | 'error';

interface AppState {
  phase: AppPhase;
  error: string | null;
  loadingMessage: string;
}

// ============================================================================
// Job Processor Hook
// ============================================================================

function useJobProcessor() {
  const activeJobs = useAppStore((s) => s.activeJobs);
  const maxConcurrentJobs = useAppStore((s) => s.settings.maxParallelBuilds);
  const processingJobsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pendingJobs = activeJobs.filter(
      (job) => job.status === 'pending' && !processingJobsRef.current.has(job.id)
    );

    const runningCount = activeJobs.filter((j) => j.status === 'running').length;
    const slotsAvailable = maxConcurrentJobs - runningCount;

    if (slotsAvailable <= 0 || pendingJobs.length === 0) return;

    const jobsToStart = pendingJobs.slice(0, slotsAvailable);

    for (const job of jobsToStart) {
      processingJobsRef.current.add(job.id);
      
      const settings = useAppStore.getState().settings;
      
      // Build custom args array including profiles
      const customArgs: string[] = [...(job.customArgs || [])];
      if (job.profiles && job.profiles.length > 0) {
        customArgs.push('-P', job.profiles.join(','));
      }
      
      // Determine thread settings: use job-specific if set, otherwise use global settings
      const enableThreads = job.enableThreads ?? settings.enableThreads;
      const threads = job.threads ?? settings.threadCount;
      
      const buildConfig: BuildConfig = {
        projectPath: job.projectPath,
        name: job.name,
        goals: job.mavenGoals,
        environment: { JAVA_HOME: job.jdkPath || '' },
        skipTests: job.skipTests ?? settings.skipTestsByDefault,
        offline: job.offline,
        customArgs: customArgs.length > 0 ? customArgs : undefined,
        enableThreads,
        threads,
      };

      const runner = getBuildRunner();
      runner.executeJob(job.id, buildConfig, {
        // PERFORMANCE: Don't use onLog callback - logs are written to file directly by BuildRunner
        // The JobDetailView reads logs from file, not from state
        onProgress: (_id: string, progress: number) => {
          useAppStore.getState().updateJobProgress(job.id, progress);
        },
        onComplete: (result) => {
          processingJobsRef.current.delete(job.id);
          handleSequentialJobs(job, result.status);
        },
      }).catch((err: Error) => {
        useAppStore.getState().updateJobStatus(job.id, 'failed');
        processingJobsRef.current.delete(job.id);
      });
    }
  }, [activeJobs, maxConcurrentJobs]);
}

function handleSequentialJobs(job: BuildJob, status: BuildStatus) {
  if (!job.sequenceId || job.sequenceIndex === undefined || job.sequenceTotal === undefined) {
    return;
  }

  const store = useAppStore.getState();

  if (status === 'success') {
    const nextIndex = job.sequenceIndex + 1;
    if (nextIndex < job.sequenceTotal) {
      const waitingJobs = store.activeJobs.filter(
        (j) => j.status === 'waiting' && 
               j.sequenceId === job.sequenceId && 
               j.sequenceIndex === nextIndex
      );
      for (const waitingJob of waitingJobs) {
        store.updateJobStatus(waitingJob.id, 'pending');
      }
    }
  } else if (status === 'failed') {
    const waitingJobs = store.activeJobs.filter(
      (j) => j.status === 'waiting' && j.sequenceId === job.sequenceId
    );
    for (const waitingJob of waitingJobs) {
      store.updateJobStatus(waitingJob.id, 'cancelled');
      store.appendJobLog(waitingJob.id, `[CANCELLED] Previous job failed: ${job.name}`);
    }
  }
}

// ============================================================================
// Initialization Hook
// ============================================================================

function useAppInitialization() {
  const [state, setState] = useState<AppState>({
    phase: 'initializing',
    error: null,
    loadingMessage: 'Starting up...',
  });
  
  // Callback to continue initialization after setup wizard
  const continueAfterSetup = useCallback(async () => {
    try {
      // Get store actions once
      const store = useAppStore.getState();
      const { loadProjects, loadJdks, loadJobHistory, loadPipelines, setScanning } = store;
      
      setState((s) => ({ ...s, phase: 'loading', loadingMessage: 'Loading configuration...' }));
      
      // Load config
      const configService = getConfigService();
      await configService.loadIntoStore();

      // Load job history
      setState((s) => ({ ...s, loadingMessage: 'Loading job history...' }));
      const historyService = getJobHistoryService();
      const persistedJobs = await historyService.load();
      if (persistedJobs.length > 0) {
        loadJobHistory(persistedJobs.map(toBuildJob));
      }

      // Load pipelines
      const pipelineService = getPipelineService();
      const persistedPipelines = await pipelineService.loadAll();
      if (persistedPipelines.length > 0) {
        loadPipelines(persistedPipelines);
      }

      // Try cache first
      setState((s) => ({ ...s, loadingMessage: 'Checking cache...' }));
      const cacheService = getCacheService();
      const settings = useAppStore.getState().settings;
      const cachedData = await cacheService.loadCache(
        settings.scanRootPath,
        settings.jdkScanPaths
      );

      if (cachedData && cachedData.repositories.length > 0) {
        loadProjects(cachedData.repositories);
        loadJdks(cachedData.jdks);
        setState({ phase: 'ready', error: null, loadingMessage: '' });
        return;
      }

      // Full scan
      setState((s) => ({ ...s, loadingMessage: 'Scanning workspace...' }));
      setScanning(true);

      try {
        const fs = getFileSystem();
        const scanner = new WorkspaceScanner(fs);
        const projects = await scanner.findRepositories(settings.scanRootPath);
        loadProjects(projects);

        setState((s) => ({ ...s, loadingMessage: 'Scanning JDKs...' }));
        const jdkPaths = settings.jdkScanPaths.split(';').filter((p) => p.trim());
        const allJdks: Awaited<ReturnType<typeof scanner.scanJdks>> = [];

        for (const jdkPath of jdkPaths) {
          try {
            const jdks = await scanner.scanJdks(jdkPath.trim());
            allJdks.push(...jdks);
          } catch {
            // Ignore individual path errors
          }
        }

        const uniqueJdks = allJdks.filter(
          (jdk, idx, self) => idx === self.findIndex((j) => j.jdkHome === jdk.jdkHome)
        );
        loadJdks(uniqueJdks);

        // Save to cache
        await cacheService.saveCache(
          settings.scanRootPath,
          settings.jdkScanPaths,
          projects,
          uniqueJdks
        );
      } finally {
        setScanning(false);
      }

      setState({ phase: 'ready', error: null, loadingMessage: '' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState({ phase: 'error', error: message, loadingMessage: '' });
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const configService = getConfigService();
        
        // Check if this is the first run
        const isFirstRun = await configService.isFirstRun();
        
        if (isFirstRun) {
          // Show setup wizard
          setState({ phase: 'setup', error: null, loadingMessage: '' });
          return;
        }
        
        // Continue with normal initialization
        await continueAfterSetup();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState({ phase: 'error', error: message, loadingMessage: '' });
      }
    };

    init();
  }, [continueAfterSetup]);

  return { state, continueAfterSetup };
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
// Router Component
// ============================================================================

function Router(): React.ReactElement {
  const currentRoute = useNavigation((s) => s.currentRoute);

  switch (currentRoute.type) {
    case 'home':
      return <HomeView />;
    
    case 'repos':
      return <RepoListView initialSearch={currentRoute.search} />;
    
    case 'repo-detail':
      return <RepoDetailView repoPath={currentRoute.projectPath} />;
    
    case 'jobs':
      return <JobsView initialFilter={currentRoute.filter} />;
    
    case 'job-detail':
      return <JobDetailView jobId={currentRoute.jobId} />;
    
    case 'settings':
      return <SettingsView />;
    
    case 'pipelines':
      return <PipelineListView />;
    
    case 'pipeline-detail':
      return <PipelineListView />;
    
    case 'pipeline-editor':
      return <PipelineEditorView pipelineId={currentRoute.pipelineId} />;
    
    case 'help':
      return <HelpView />;
    
    default:
      return <HomeView />;
  }
}

// ============================================================================
// Main App Component
// ============================================================================

export function App(): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { width, height } = useTerminalSize();
  
  // Initialize app
  const { state: appState, continueAfterSetup } = useAppInitialization();
  
  // Process jobs
  useJobProcessor();
  
  // Navigation
  const { goHome, goBack, toJobs, toSettings, currentRoute, canGoBack } = useNavigator();
  useNavigationKeyboard();
  
  // Global input handling
  useGlobalInputHandler();
  
  // Notifications
  const notification = useLatestNotification();
  useNotificationAutoDismiss();
  const { dismiss } = useNotifications();
  
  // Command palette
  const paletteOpen = useCommandStore((s) => s.paletteOpen);
  const closePalette = useCommandStore((s) => s.closePalette);
  const executeCommand = useCommandStore((s) => s.execute);
  const availableCommands = useAvailableCommands();
  
  // Exit handler
  const handleExit = useCallback(async () => {
    const runner = getBuildRunner();
    const activeJobs = useAppStore.getState().activeJobs;
    
    for (const job of activeJobs.filter((j) => j.status === 'running')) {
      runner.cancelBuild(job.id);
    }
    
    await processManager.killAll();
    
    if (stdout) {
      stdout.write('\x1B[?25h'); // Show cursor
      stdout.write('\x1B[?1049l'); // Exit alternate screen
    }
    
    exit();
  }, [exit, stdout]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    const settings = useAppStore.getState().settings;
    const loadProjects = useAppStore.getState().loadProjects;
    const loadJdks = useAppStore.getState().loadJdks;
    const setScanning = useAppStore.getState().setScanning;

    setScanning(true);
    try {
      const fs = getFileSystem();
      const scanner = new WorkspaceScanner(fs);
      const projects = await scanner.findRepositories(settings.scanRootPath);
      loadProjects(projects);

      const jdkPaths = settings.jdkScanPaths.split(';').filter((p) => p.trim());
      const allJdks: Awaited<ReturnType<typeof scanner.scanJdks>> = [];
      for (const path of jdkPaths) {
        try {
          const jdks = await scanner.scanJdks(path.trim());
          allJdks.push(...jdks);
        } catch {}
      }
      loadJdks(allJdks);
    } finally {
      setScanning(false);
    }
  }, []);

  // Register core commands
  useCoreCommands({
    onExit: handleExit,
    onGoHome: () => goHome(),
    onGoBack: () => goBack(),
    onOpenSettings: () => toSettings(),
    onOpenJobs: () => toJobs(),
    onRefresh: handleRefresh,
  });
  
  // Global shortcuts
  useGlobalShortcuts();

  // Convert commands for palette
  const paletteCommands: CommandItem[] = useMemo(() => 
    availableCommands.map((cmd) => ({
      id: cmd.id,
      label: cmd.label,
      description: cmd.description,
      shortcut: cmd.shortcut,
      action: () => executeCommand(cmd.id),
    })),
    [availableCommands, executeCommand]
  );

  // Get status bar shortcuts based on current route
  const shortcuts = useMemo(() => {
    const base = [
      { key: 'Ctrl+P', label: 'Commands' },
      { key: 'Ctrl+Q', label: 'Quit' },
    ];
    
    if (canGoBack) {
      return [{ key: 'Esc', label: 'Back' }, ...base];
    }
    return base;
  }, [canGoBack]);

  // Get route title
  const routeTitle = useMemo(() => {
    switch (currentRoute.type) {
      case 'home': return undefined;
      case 'repos': return 'Repositories';
      case 'repo-detail': return 'Repository';
      case 'jobs': return 'Build Jobs';
      case 'settings': return 'Settings';
      case 'pipelines': return 'Pipelines';
      case 'help': return 'Help';
      default: return undefined;
    }
  }, [currentRoute]);

  // Setup wizard state (first run)
  if (appState.phase === 'setup') {
    return (
      <SetupWizardView onComplete={continueAfterSetup} />
    );
  }

  // Loading state
  if (appState.phase === 'initializing' || appState.phase === 'loading') {
    return (
      <Screen 
        showHeader={false} 
        showFooter={false}
        fullscreen={true}
      >
        <Box 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center" 
          flexGrow={1}
        >
          {/* Logo */}
          <Box flexDirection="column" alignItems="center" marginBottom={2}>
            {LOGO.map((line, i) => (
              <Text key={i} color={theme.accent.primary}>
                {line}
              </Text>
            ))}
          </Box>
          
          {/* Loading spinner */}
          <Box>
            <Spinner label={appState.loadingMessage} />
          </Box>
        </Box>
      </Screen>
    );
  }

  // Error state
  if (appState.phase === 'error') {
    return (
      <Screen 
        title="Error"
        shortcuts={[{ key: 'q', label: 'Quit' }]}
        fullscreen={true}
      >
        <Box flexDirection="column" padding={2}>
          <Text color={theme.status.error}>
            {icons.error} Initialization Failed
          </Text>
          <Box marginTop={1}>
            <Text color={theme.text.muted}>{appState.error}</Text>
          </Box>
          <Box marginTop={2}>
            <Text color={theme.text.secondary}>Press 'q' to exit</Text>
          </Box>
        </Box>
      </Screen>
    );
  }

  // Main app
  return (
    <Screen
      title={routeTitle}
      shortcuts={shortcuts}
      fullscreen={true}
    >
      {/* Main content with error boundary */}
      <ErrorBoundary>
        <Router />
      </ErrorBoundary>

      {/* Command Palette */}
      <CommandPalette
        commands={paletteCommands}
        open={paletteOpen}
        onClose={closePalette}
      />

      {/* Toast notification */}
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onDismiss={() => dismiss(notification.id)}
        />
      )}
    </Screen>
  );
}

export default App;
