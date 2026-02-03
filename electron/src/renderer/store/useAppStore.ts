/**
 * Application Store using Zustand
 * 
 * Central state management for the Electron GUI.
 */

import { create } from 'zustand';
import type { 
  AppSettings, 
  BuildJob, 
  BuildStatus, 
  DiscoveredProject, 
  JDK, 
  MavenModule 
} from '../types';

// ============================================================================
// Store Types
// ============================================================================

export type AppScreen = 
  | 'HOME' 
  | 'PROJECTS' 
  | 'PROJECT_DETAIL'
  | 'BUILD_CONFIG'
  | 'JOBS' 
  | 'JOB_DETAIL'
  | 'SETTINGS';

interface NavigationState {
  currentScreen: AppScreen;
  history: AppScreen[];
  params: Record<string, unknown>;
}

interface AppState {
  // Settings
  settings: AppSettings;
  settingsLoaded: boolean;
  
  // Data
  projects: DiscoveredProject[];
  jdks: JDK[];
  modulesByProject: Record<string, MavenModule[]>;
  profilesByProject: Record<string, string[]>;
  
  // Jobs
  jobs: BuildJob[];
  jobLogs: Record<string, string[]>;
  
  // Navigation
  navigation: NavigationState;
  
  // UI State
  isScanning: boolean;
  scanStatus: string | null;
  selectedProjectPath: string | null;
  selectedJobId: string | null;
}

interface AppActions {
  // Settings
  setSettings: (settings: AppSettings) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  
  // Data
  setProjects: (projects: DiscoveredProject[]) => void;
  setJdks: (jdks: JDK[]) => void;
  setModules: (projectPath: string, modules: MavenModule[]) => void;
  setProfiles: (projectPath: string, profiles: string[]) => void;
  
  // Jobs
  addJob: (job: Omit<BuildJob, 'id' | 'createdAt' | 'progress' | 'status'>) => string;
  updateJob: (id: string, updates: Partial<BuildJob>) => void;
  removeJob: (id: string) => void;
  appendJobLog: (id: string, line: string) => void;
  clearJobLogs: (id: string) => void;
  
  // Navigation
  setScreen: (screen: AppScreen, params?: Record<string, unknown>) => void;
  goBack: () => void;
  
  // UI State
  setScanning: (isScanning: boolean) => void;
  setScanStatus: (status: string | null) => void;
  selectProject: (path: string | null) => void;
  selectJob: (id: string | null) => void;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_SETTINGS: AppSettings = {
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

const DEFAULT_NAVIGATION: NavigationState = {
  currentScreen: 'HOME',
  history: [],
  params: {},
};

// ============================================================================
// Store
// ============================================================================

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  // Initial State
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  projects: [],
  jdks: [],
  modulesByProject: {},
  profilesByProject: {},
  jobs: [],
  jobLogs: {},
  navigation: DEFAULT_NAVIGATION,
  isScanning: false,
  scanStatus: null,
  selectedProjectPath: null,
  selectedJobId: null,

  // Settings Actions
  setSettings: (settings) => set({ settings, settingsLoaded: true }),
  updateSettings: (partial) => set((state) => ({
    settings: { ...state.settings, ...partial },
  })),

  // Data Actions
  setProjects: (projects) => set({ projects }),
  setJdks: (jdks) => set({ jdks }),
  setModules: (projectPath, modules) => set((state) => ({
    modulesByProject: { ...state.modulesByProject, [projectPath]: modules },
  })),
  setProfiles: (projectPath, profiles) => set((state) => ({
    profilesByProject: { ...state.profilesByProject, [projectPath]: profiles },
  })),

  // Job Actions
  addJob: (jobData) => {
    const id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: BuildJob = {
      ...jobData,
      id,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };
    set((state) => ({
      jobs: [...state.jobs, job],
      jobLogs: { ...state.jobLogs, [id]: [] },
    }));
    return id;
  },
  
  updateJob: (id, updates) => set((state) => ({
    jobs: state.jobs.map((job) => 
      job.id === id ? { ...job, ...updates } : job
    ),
  })),
  
  removeJob: (id) => set((state) => ({
    jobs: state.jobs.filter((job) => job.id !== id),
    jobLogs: Object.fromEntries(
      Object.entries(state.jobLogs).filter(([key]) => key !== id)
    ),
  })),
  
  appendJobLog: (id, line) => set((state) => ({
    jobLogs: {
      ...state.jobLogs,
      [id]: [...(state.jobLogs[id] || []), line],
    },
  })),
  
  clearJobLogs: (id) => set((state) => ({
    jobLogs: { ...state.jobLogs, [id]: [] },
  })),

  // Navigation Actions
  setScreen: (screen, params = {}) => set((state) => ({
    navigation: {
      currentScreen: screen,
      history: [...state.navigation.history, state.navigation.currentScreen],
      params,
    },
  })),
  
  goBack: () => set((state) => {
    const history = [...state.navigation.history];
    const previousScreen = history.pop() || 'HOME';
    return {
      navigation: {
        currentScreen: previousScreen,
        history,
        params: {},
      },
    };
  }),

  // UI State Actions
  setScanning: (isScanning) => set({ isScanning }),
  setScanStatus: (scanStatus) => set({ scanStatus }),
  selectProject: (path) => set({ selectedProjectPath: path }),
  selectJob: (id) => set({ selectedJobId: id }),
}));
