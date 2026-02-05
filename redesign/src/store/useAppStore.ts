/**
 * GFOS Build - Application State Store
 * Using Zustand for state management
 */

import { create } from 'zustand';

// Types
export interface Project {
  id: string;
  name: string;
  path: string;
  branch: string;
  lastBuild?: {
    status: 'success' | 'failed' | 'running' | 'pending';
    duration: string;
    timestamp: string;
  };
  jdk: string;
  mavenGoals?: string;
}

export interface JDK {
  id: string;
  version: string;
  vendor: string;
  path: string;
  isDefault?: boolean;
}

export interface BuildJob {
  id: string;
  projectId: string;
  projectName: string;
  status: 'success' | 'failed' | 'running' | 'pending' | 'cancelled';
  progress: number;
  startTime: string;
  endTime?: string;
  duration?: string;
  jdk: string;
  goals: string;
  logs?: string[];
}

export interface AppSettings {
  mavenPath: string;
  defaultGoals: string;
  parallelBuilds: number;
  autoScan: boolean;
  scanPaths: string[];
}

interface AppState {
  // Navigation
  activeView: 'overview' | 'projects' | 'builds' | 'jdks' | 'settings';
  setActiveView: (view: AppState['activeView']) => void;
  
  // Projects
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  
  // JDKs
  jdks: JDK[];
  addJdk: (jdk: JDK) => void;
  removeJdk: (id: string) => void;
  setDefaultJdk: (id: string) => void;
  
  // Build Jobs
  buildJobs: BuildJob[];
  addBuildJob: (job: BuildJob) => void;
  updateBuildJob: (id: string, updates: Partial<BuildJob>) => void;
  cancelBuildJob: (id: string) => void;
  clearCompletedJobs: () => void;
  
  // Build Queue
  startBuild: (projectId: string, goals?: string) => void;
  
  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // UI State
  isLoading: boolean;
  notifications: { id: string; type: 'info' | 'success' | 'error'; message: string }[];
  addNotification: (type: 'info' | 'success' | 'error', message: string) => void;
  removeNotification: (id: string) => void;
}

// Initial Data
const initialProjects: Project[] = [
  { id: '1', name: 'gfosweb', path: 'C:\\dev\\quellen\\2025\\gfosweb', branch: 'main', lastBuild: { status: 'success', duration: '2m 34s', timestamp: '10 min ago' }, jdk: 'JDK 21', mavenGoals: 'clean install' },
  { id: '2', name: 'gfoshg', path: 'C:\\dev\\quellen\\2025\\gfoshg', branch: 'develop', lastBuild: { status: 'running', duration: '1m 12s', timestamp: 'now' }, jdk: 'JDK 17', mavenGoals: 'clean install' },
  { id: '3', name: 'gfosdashboard', path: 'C:\\dev\\quellen\\2025\\gfosdashboard', branch: 'feature/auth', lastBuild: { status: 'failed', duration: '45s', timestamp: '1h ago' }, jdk: 'JDK 21', mavenGoals: 'clean install' },
  { id: '4', name: 'gfosshared', path: 'C:\\dev\\quellen\\2025\\gfosshared', branch: 'main', lastBuild: { status: 'success', duration: '1m 58s', timestamp: '2h ago' }, jdk: 'JDK 17', mavenGoals: 'clean install -Pproduction' },
  { id: '5', name: 'gfosweb_2', path: 'C:\\dev\\quellen\\2025\\gfosweb_2', branch: 'release/4.9', jdk: 'JDK 11', mavenGoals: 'clean package' },
  { id: '6', name: 'delphi', path: 'C:\\dev\\quellen\\2025\\delphi', branch: 'main', lastBuild: { status: 'success', duration: '3m 12s', timestamp: '3h ago' }, jdk: 'JDK 21', mavenGoals: 'clean install' },
];

const initialJdks: JDK[] = [
  { id: '1', version: '21.0.2', vendor: 'Eclipse Temurin', path: 'C:\\dev\\java\\jdk21', isDefault: true },
  { id: '2', version: '17.0.10', vendor: 'Eclipse Temurin', path: 'C:\\dev\\java\\jdk17' },
  { id: '3', version: '11.0.27', vendor: 'OpenJDK', path: 'C:\\dev\\java\\jdk11' },
  { id: '4', version: '8u402', vendor: 'Amazon Corretto', path: 'C:\\dev\\java\\jdk8' },
];

const initialBuildJobs: BuildJob[] = [
  { id: '1', projectId: '2', projectName: 'gfoshg', status: 'running', progress: 67, startTime: '14:32', jdk: 'JDK 17', goals: 'clean install' },
  { id: '2', projectId: '1', projectName: 'gfosweb', status: 'pending', progress: 0, startTime: 'Queued', jdk: 'JDK 21', goals: 'clean package -DskipTests' },
  { id: '3', projectId: '3', projectName: 'gfosdashboard', status: 'failed', progress: 100, startTime: '14:15', duration: '45s', jdk: 'JDK 21', goals: 'clean install' },
  { id: '4', projectId: '4', projectName: 'gfosshared', status: 'success', progress: 100, startTime: '13:45', duration: '1m 58s', jdk: 'JDK 17', goals: 'clean install -Pproduction' },
  { id: '5', projectId: '6', projectName: 'delphi', status: 'success', progress: 100, startTime: '13:20', duration: '3m 12s', jdk: 'JDK 21', goals: 'clean install' },
];

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  activeView: 'overview',
  setActiveView: (view) => set({ activeView: view }),
  
  // Projects
  projects: initialProjects,
  selectedProject: null,
  setSelectedProject: (project) => set({ selectedProject: project }),
  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
  })),
  removeProject: (id) => set((state) => ({
    projects: state.projects.filter(p => p.id !== id)
  })),
  
  // JDKs
  jdks: initialJdks,
  addJdk: (jdk) => set((state) => ({ jdks: [...state.jdks, jdk] })),
  removeJdk: (id) => set((state) => ({
    jdks: state.jdks.filter(j => j.id !== id)
  })),
  setDefaultJdk: (id) => set((state) => ({
    jdks: state.jdks.map(j => ({ ...j, isDefault: j.id === id }))
  })),
  
  // Build Jobs
  buildJobs: initialBuildJobs,
  addBuildJob: (job) => set((state) => ({ buildJobs: [job, ...state.buildJobs] })),
  updateBuildJob: (id, updates) => set((state) => ({
    buildJobs: state.buildJobs.map(j => j.id === id ? { ...j, ...updates } : j)
  })),
  cancelBuildJob: (id) => set((state) => ({
    buildJobs: state.buildJobs.map(j => 
      j.id === id && (j.status === 'running' || j.status === 'pending') 
        ? { ...j, status: 'cancelled' as const } 
        : j
    )
  })),
  clearCompletedJobs: () => set((state) => ({
    buildJobs: state.buildJobs.filter(j => j.status === 'running' || j.status === 'pending')
  })),
  
  // Start Build
  startBuild: (projectId, goals) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;
    
    const newJob: BuildJob = {
      id: Date.now().toString(),
      projectId,
      projectName: project.name,
      status: 'pending',
      progress: 0,
      startTime: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      jdk: project.jdk,
      goals: goals || project.mavenGoals || 'clean install',
    };
    
    set((state) => ({ 
      buildJobs: [newJob, ...state.buildJobs],
      notifications: [...state.notifications, {
        id: Date.now().toString(),
        type: 'info',
        message: `Build gestartet: ${project.name}`
      }]
    }));
    
    // Simulate build progress
    setTimeout(() => {
      set((state) => ({
        buildJobs: state.buildJobs.map(j => 
          j.id === newJob.id ? { ...j, status: 'running' as const, progress: 0 } : j
        )
      }));
      
      // Progress simulation
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          
          const success = Math.random() > 0.2;
          set((state) => ({
            buildJobs: state.buildJobs.map(j => 
              j.id === newJob.id ? { 
                ...j, 
                status: success ? 'success' as const : 'failed' as const, 
                progress: 100,
                duration: `${Math.floor(Math.random() * 3) + 1}m ${Math.floor(Math.random() * 50) + 10}s`
              } : j
            ),
            projects: state.projects.map(p =>
              p.id === projectId ? {
                ...p,
                lastBuild: {
                  status: success ? 'success' as const : 'failed' as const,
                  duration: `${Math.floor(Math.random() * 3) + 1}m ${Math.floor(Math.random() * 50) + 10}s`,
                  timestamp: 'just now'
                }
              } : p
            )
          }));
        } else {
          set((state) => ({
            buildJobs: state.buildJobs.map(j => 
              j.id === newJob.id ? { ...j, progress: Math.floor(progress) } : j
            )
          }));
        }
      }, 500);
    }, 1000);
  },
  
  // Settings
  settings: {
    mavenPath: 'C:\\dev\\maven\\bin\\mvn.cmd',
    defaultGoals: 'clean install',
    parallelBuilds: 2,
    autoScan: true,
    scanPaths: ['C:\\dev\\quellen\\2025'],
  },
  updateSettings: (updates) => set((state) => ({
    settings: { ...state.settings, ...updates }
  })),
  
  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  // UI State
  isLoading: false,
  notifications: [],
  addNotification: (type, message) => set((state) => ({
    notifications: [...state.notifications, { id: Date.now().toString(), type, message }]
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
}));

// Computed selectors
export const useStats = () => {
  const { projects, buildJobs, jdks } = useAppStore();
  
  return {
    totalProjects: projects.length,
    mavenProjects: projects.length,
    activeBuilds: buildJobs.filter(j => j.status === 'running').length,
    queuedBuilds: buildJobs.filter(j => j.status === 'pending').length,
    successfulBuilds: buildJobs.filter(j => j.status === 'success').length,
    failedBuilds: buildJobs.filter(j => j.status === 'failed').length,
    jdkCount: jdks.length,
  };
};
