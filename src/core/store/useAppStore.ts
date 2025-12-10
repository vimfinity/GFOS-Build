/**
 * Global Application Store
 * 
 * Central state management using Zustand.
 * Manages settings, scanned data, navigation, and build jobs.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { JDK, BuildStatus, BuildJob } from '../types';
import type { DiscoveredProject, MavenModule } from '../services/WorkspaceScanner';
import { getJobLogService } from '../services/JobLogService.js';

// ============================================================================
// Store Types
// ============================================================================

/**
 * Application screens for navigation.
 */
export type AppScreen = 
  | 'HOME'
  | 'REPO_LIST'
  | 'REPO_DETAIL'
  | 'MODULE_DETAIL'
  | 'JDK_LIST'
  | 'BUILD_CONFIG'
  | 'BUILD_QUEUE'
  | 'BUILD_DETAIL'
  | 'SETTINGS';

/**
 * User settings and preferences.
 */
export interface AppSettings {
  /** Default Maven goals to run (e.g., 'clean install') */
  defaultMavenGoal: string;
  /** Default JAVA_HOME path */
  defaultJavaHome: string;
  /** Default Maven home path */
  defaultMavenHome: string;
  /** Root path to scan for projects */
  scanRootPath: string;
  /** Paths to scan for JDKs (semicolon-separated on Windows) */
  jdkScanPaths: string;
  /** Maximum parallel builds */
  maxParallelBuilds: number;
  /** Skip tests by default */
  skipTestsByDefault: boolean;
  /** Offline mode for Maven */
  offlineMode: boolean;
  /** Enable thread count option (-T) */
  enableThreads: boolean;
  /** Thread count value (e.g., '1C' for one thread per core, or '4' for 4 threads) */
  threadCount: string;
}

/**
 * Scanned environment data.
 */
export interface ScannedData {
  /** Discovered Git repositories / projects */
  projects: DiscoveredProject[];
  /** Available JDKs */
  jdks: JDK[];
  /** Maven modules per project (keyed by project path) */
  modulesByProject: Record<string, MavenModule[]>;
  /** Maven profiles per project (keyed by project path) */
  profilesByProject: Record<string, string[]>;
  /** Last scan timestamp */
  lastScanTime: Date | null;
  /** Whether scanning is in progress */
  isScanning: boolean;
}

/**
 * Navigation state for stack-based navigation.
 */
export interface NavigationState {
  /** Current active screen */
  currentScreen: AppScreen;
  /** Navigation history stack */
  history: AppScreen[];
  /** Screen-specific parameters */
  params: Record<string, unknown>;
}

/**
 * Notification message.
 */
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: Date;
}

// ============================================================================
// Store State
// ============================================================================

/**
 * Complete application state.
 */
export interface AppState {
  // Settings
  settings: AppSettings;
  
  // Scanned Data
  scannedData: ScannedData;
  
  // Navigation
  navigation: NavigationState;
  
  // Build Jobs
  activeJobs: BuildJob[];
  jobHistory: BuildJob[];
  jobLogs: Record<string, string[]>;
  
  // Notifications
  notifications: Notification[];
  
  // UI State
  selectedProjectPath: string | null;
  selectedModulePath: string | null;
  selectedJdkPath: string | null;
}

// ============================================================================
// Store Actions
// ============================================================================

/**
 * Store actions for state mutations.
 */
export interface AppActions {
  // Navigation Actions
  setScreen: (screen: AppScreen, params?: Record<string, unknown>) => void;
  goBack: () => void;
  resetNavigation: () => void;
  
  // Settings Actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  
  // Scanned Data Actions
  loadProjects: (projects: DiscoveredProject[]) => void;
  loadJdks: (jdks: JDK[]) => void;
  loadModules: (projectPath: string, modules: MavenModule[]) => void;
  loadProfiles: (projectPath: string, profiles: string[]) => void;
  setScanning: (isScanning: boolean) => void;
  clearScannedData: () => void;
  
  // Job Actions
  addJob: (job: Omit<BuildJob, 'id' | 'createdAt' | 'progress'>) => string;
  updateJobStatus: (id: string, status: BuildStatus) => void;
  updateJobProgress: (id: string, progress: number) => void;
  appendJobLog: (id: string, log: string) => void;
  setJobError: (id: string, error: string) => void;
  removeJob: (id: string) => void;
  clearCompletedJobs: () => void;
  loadJobHistory: (jobs: BuildJob[]) => void;
  setJobCommand: (id: string, command: string) => void;
  setJobExitCode: (id: string, exitCode: number | null) => void;
  removeJobLogs: (id: string) => void;
  
  // Selection Actions
  selectProject: (path: string | null) => void;
  selectModule: (path: string | null) => void;
  selectJdk: (path: string | null) => void;
  
  // Notification Actions
  addNotification: (type: Notification['type'], message: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_SETTINGS: AppSettings = {
  defaultMavenGoal: 'clean install',
  defaultJavaHome: '',
  defaultMavenHome: 'C:\\dev\\maven\\mvn3',
  scanRootPath: 'C:\\dev\\quellen',
  jdkScanPaths: 'C:\\dev\\java',
  maxParallelBuilds: 2,
  skipTestsByDefault: false,
  offlineMode: false,
  enableThreads: false,
  threadCount: '1C',
};

const DEFAULT_SCANNED_DATA: ScannedData = {
  projects: [],
  jdks: [],
  modulesByProject: {},
  profilesByProject: {},
  lastScanTime: null,
  isScanning: false,
};

const DEFAULT_NAVIGATION: NavigationState = {
  currentScreen: 'HOME',
  history: [],
  params: {},
};

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Global application store.
 */
export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    settings: DEFAULT_SETTINGS,
    scannedData: DEFAULT_SCANNED_DATA,
    navigation: DEFAULT_NAVIGATION,
    activeJobs: [],
    jobHistory: [],
    jobLogs: {},
    notifications: [],
    selectedProjectPath: null,
    selectedModulePath: null,
    selectedJdkPath: null,

    // ========================================================================
    // Navigation Actions
    // ========================================================================
    
    setScreen: (screen, params = {}) => {
      set((state) => ({
        navigation: {
          currentScreen: screen,
          history: [...state.navigation.history, state.navigation.currentScreen],
          params,
        },
      }));
    },

    goBack: () => {
      set((state) => {
        const history = [...state.navigation.history];
        const previousScreen = history.pop() || 'HOME';
        
        return {
          navigation: {
            currentScreen: previousScreen,
            history,
            params: {},
          },
        };
      });
    },

    resetNavigation: () => {
      set({ navigation: DEFAULT_NAVIGATION });
    },

    // ========================================================================
    // Settings Actions
    // ========================================================================
    
    updateSettings: (newSettings) => {
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
      }));
    },

    resetSettings: () => {
      set({ settings: DEFAULT_SETTINGS });
    },

    // ========================================================================
    // Scanned Data Actions
    // ========================================================================
    
    loadProjects: (projects) => {
      set((state) => ({
        scannedData: {
          ...state.scannedData,
          projects,
          lastScanTime: new Date(),
        },
      }));
    },

    loadJdks: (jdks) => {
      set((state) => ({
        scannedData: {
          ...state.scannedData,
          jdks,
        },
      }));
    },

    loadModules: (projectPath, modules) => {
      set((state) => ({
        scannedData: {
          ...state.scannedData,
          modulesByProject: {
            ...state.scannedData.modulesByProject,
            [projectPath]: modules,
          },
        },
      }));
    },

    loadProfiles: (projectPath, profiles) => {
      set((state) => ({
        scannedData: {
          ...state.scannedData,
          profilesByProject: {
            ...state.scannedData.profilesByProject,
            [projectPath]: profiles,
          },
        },
      }));
    },

    setScanning: (isScanning) => {
      set((state) => ({
        scannedData: {
          ...state.scannedData,
          isScanning,
        },
      }));
    },

    clearScannedData: () => {
      set({ scannedData: DEFAULT_SCANNED_DATA });
    },

    // ========================================================================
    // Job Actions
    // ========================================================================
    
    addJob: (jobData) => {
      const id = `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const logFilePath = getJobLogService().getLogPath(id);
      const job: BuildJob = {
        ...jobData,
        id,
        createdAt: new Date(),
        progress: 0,
        logFilePath,
      };
      
      set((state) => ({
        activeJobs: [...state.activeJobs, job],
        jobLogs: {
          ...state.jobLogs,
          [id]: [],
        },
      }));
      
      return id;
    },

    updateJobStatus: (id, status) => {
      set((state) => {
        const jobIndex = state.activeJobs.findIndex((j) => j.id === id);
        if (jobIndex === -1) return state;
        
        const job = state.activeJobs[jobIndex];
        if (!job) return state;
        
        const updatedJob: BuildJob = {
          ...job,
          status,
          startedAt: status === 'running' && !job.startedAt ? new Date() : job.startedAt,
          completedAt: ['success', 'failed', 'cancelled'].includes(status) ? new Date() : job.completedAt,
          progress: status === 'success' ? 100 : job.progress,
        };
        
        if (['success', 'failed', 'cancelled'].includes(status)) {
          const trimmedHistory = [updatedJob, ...state.jobHistory].slice(0, 50);
          return {
            activeJobs: state.activeJobs.filter((j) => j.id !== id),
            jobHistory: trimmedHistory,
          };
        }
        
        const activeJobs = [...state.activeJobs];
        activeJobs[jobIndex] = updatedJob;
        return { activeJobs };
      });
    },

    updateJobProgress: (id, progress) => {
      set((state) => {
        const activeJobs = state.activeJobs.map((job) =>
          job.id === id ? { ...job, progress: Math.min(100, Math.max(0, progress)) } : job
        );
        return { activeJobs };
      });
    },

    appendJobLog: (id, log) => {
      set((state) => {
        const currentLogs = state.jobLogs[id] ?? [];
        return {
          jobLogs: {
            ...state.jobLogs,
            [id]: [...currentLogs, log],
          },
        };
      });
    },

    setJobError: (id, error) => {
      set((state) => {
        const updateList = (list: BuildJob[]) =>
          list.map((job) =>
            job.id === id ? { ...job, error, status: 'failed' as BuildStatus } : job
          );
        return {
          activeJobs: updateList(state.activeJobs),
          jobHistory: updateList(state.jobHistory),
        };
      });
    },

    removeJob: (id) => {
      set((state) => ({
        activeJobs: state.activeJobs.filter((j) => j.id !== id),
        jobHistory: state.jobHistory.filter((j) => j.id !== id),
        jobLogs: Object.fromEntries(
          Object.entries(state.jobLogs).filter(([key]) => key !== id)
        ),
      }));
    },

    clearCompletedJobs: () => {
      set((state) => {
        const jobLogs = { ...state.jobLogs };
        for (const job of state.jobHistory) {
          delete jobLogs[job.id];
        }
        return {
          jobHistory: [],
          jobLogs,
        };
      });
    },

    loadJobHistory: (jobs) => {
      set({ jobHistory: jobs });
    },

    setJobCommand: (id, command) => {
      set((state) => {
        const updateList = (list: BuildJob[]) =>
          list.map((job) => (job.id === id ? { ...job, command } : job));

        return {
          activeJobs: updateList(state.activeJobs),
          jobHistory: updateList(state.jobHistory),
        };
      });
    },

    setJobExitCode: (id, exitCode) => {
      set((state) => {
        const updateList = (list: BuildJob[]) =>
          list.map((job) => (job.id === id ? { ...job, exitCode } : job));

        return {
          activeJobs: updateList(state.activeJobs),
          jobHistory: updateList(state.jobHistory),
        };
      });
    },

    removeJobLogs: (id) => {
      set((state) => {
        const jobLogs = { ...state.jobLogs };
        delete jobLogs[id];
        return { jobLogs };
      });
    },

    // ========================================================================
    // Selection Actions
    // ========================================================================
    
    selectProject: (path) => {
      set({ selectedProjectPath: path, selectedModulePath: null });
    },

    selectModule: (path) => {
      set({ selectedModulePath: path });
    },

    selectJdk: (path) => {
      set({ selectedJdkPath: path });
    },

    // ========================================================================
    // Notification Actions
    // ========================================================================
    
    addNotification: (type, message) => {
      const notification: Notification = {
        id: `notif-${Date.now()}`,
        type,
        message,
        timestamp: new Date(),
      };
      
      set((state) => ({
        notifications: [...state.notifications, notification].slice(-10), // Keep last 10
      }));
    },

    removeNotification: (id) => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    },

    clearNotifications: () => {
      set({ notifications: [] });
    },
  }))
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * Selects the current screen.
 */
export const useCurrentScreen = () => useAppStore((state) => state.navigation.currentScreen);

/**
 * Selects navigation params.
 */
export const useNavParams = () => useAppStore((state) => state.navigation.params);

/**
 * Selects all projects.
 */
export const useProjects = () => useAppStore((state) => state.scannedData.projects);

/**
 * Selects all JDKs.
 */
export const useJdks = () => useAppStore((state) => state.scannedData.jdks);

const EMPTY_MODULES: MavenModule[] = [];
const EMPTY_PROFILES: string[] = [];

/**
 * Selects modules for a specific project.
 */
export const useProjectModules = (projectPath: string) => 
  useAppStore((state) => state.scannedData.modulesByProject[projectPath] ?? EMPTY_MODULES);

/**
 * Selects profiles for a specific project.
 */
export const useProjectProfiles = (projectPath: string) => 
  useAppStore((state) => state.scannedData.profilesByProject[projectPath] ?? EMPTY_PROFILES);

/**
 * Selects active jobs.
 */
export const useActiveJobs = () => useAppStore((state) => state.activeJobs);

/**
 * Selects job history.
 */
export const useJobHistory = () => useAppStore((state) => state.jobHistory);

export const useJobLogs = (jobId: string) =>
  useAppStore((state) => state.jobLogs[jobId] ?? []);

/**
 * Selects pending jobs count.
 */
export const usePendingJobsCount = () => 
  useAppStore((state) => state.activeJobs.filter((j) => j.status === 'pending').length);

/**
 * Selects running jobs count.
 */
export const useRunningJobsCount = () => 
  useAppStore((state) => state.activeJobs.filter((j) => j.status === 'running').length);

/**
 * Selects app settings.
 */
export const useSettings = () => useAppStore((state) => state.settings);

/**
 * Selects scanning status.
 */
export const useIsScanning = () => useAppStore((state) => state.scannedData.isScanning);

/**
 * Selects notifications.
 */
export const useNotifications = () => useAppStore((state) => state.notifications);

/**
 * Selects the currently selected project.
 */
export const useSelectedProject = () => {
  const path = useAppStore((state) => state.selectedProjectPath);
  const projects = useProjects();
  return projects.find((p) => p.path === path) || null;
};

/**
 * Selects the currently selected JDK.
 */
export const useSelectedJdk = () => {
  const path = useAppStore((state) => state.selectedJdkPath);
  const jdks = useJdks();
  return jdks.find((j) => j.jdkHome === path) || null;
};
