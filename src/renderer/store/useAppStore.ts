/**
 * GFOS Build - Application State Store
 * Using Zustand for state management with extended pipeline, theme, and search functionality
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api';
import type { 
  AppView, 
  LogEntry,
  SetupWizardStep,
  Theme,
  SearchResult
} from '../types';

// ============================================
// Types (kept inline for backwards compatibility)
// ============================================

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
  pipelineId?: string;
  pipelineStep?: number;
}

export interface AppSettings {
  mavenPath: string;
  defaultGoals: string;
  parallelBuilds: number;
  autoScan: boolean;
  scanPaths: string[];
  jdkScanPath: string;
  setupComplete?: boolean;
  skipTestsByDefault: boolean;
  offlineMode: boolean;
  enableThreads: boolean;
  threadCount: string;
}

// ============================================
// Pipeline Types
// ============================================

export interface StorePipeline {
  id: string;
  name: string;
  projectId: string;
  steps: StorePipelineStep[];
  createdAt: string;
  lastRun?: string;
  isRunning?: boolean;
  currentStep?: number;
}

export interface StorePipelineStep {
  id: string;
  name: string;
  goals: string[];
  jdkId?: string;
  skipTests?: boolean;
  profiles?: string[];
  modules?: string[];  // Selected Maven modules (artifactIds)
}

// ============================================
// Store State Interface
// ============================================

interface AppState {
  // Navigation
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  previousView: AppView | null;
  goBack: () => void;
  
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  setResolvedTheme: (theme: 'light' | 'dark') => void;
  
  // Projects
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  
  // JDKs
  jdks: JDK[];
  setJdks: (jdks: JDK[]) => void;
  addJdk: (jdk: JDK) => void;
  removeJdk: (id: string) => void;
  setDefaultJdk: (id: string) => void;
  
  // Build Jobs
  buildJobs: BuildJob[];
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  addBuildJob: (job: BuildJob) => void;
  updateBuildJob: (id: string, updates: Partial<BuildJob>) => void;
  cancelBuildJob: (id: string) => void;
  clearCompletedJobs: () => void;
  
  // Job Logs
  jobLogs: Record<string, LogEntry[]>;
  addLogEntry: (jobId: string, entry: LogEntry) => void;
  clearJobLogs: (jobId: string) => void;
  
  // Pipelines
  pipelines: StorePipeline[];
  selectedPipelineId: string | null;
  setSelectedPipelineId: (id: string | null) => void;
  addPipeline: (name: string, projectId: string, steps: StorePipelineStep[]) => string;
  updatePipeline: (id: string, updates: Partial<StorePipeline>) => void;
  removePipeline: (id: string) => void;
  runPipeline: (id: string) => void;
  stopPipeline: (id: string) => void;
  
  // Build Queue
  startBuild: (projectId: string, goals?: string) => void;
  
  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  
  // Setup Wizard
  setupWizard: {
    currentStep: SetupWizardStep;
    scanRootPath: string;
    jdkScanPaths: string;
    mavenPath: string;
    isScanning: boolean;
    scanError?: string;
    foundProjects: number;
    foundJdks: number;
  };
  updateSetupWizard: (updates: Partial<AppState['setupWizard']>) => void;
  completeSetup: () => void;
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  searchResults: SearchResult[];
  performSearch: (query: string) => void;
  
  // Keyboard Shortcuts
  isShortcutsHelpOpen: boolean;
  setIsShortcutsHelpOpen: (open: boolean) => void;
  
  // UI State
  isLoading: boolean;
  notifications: { id: string; type: 'info' | 'success' | 'error' | 'warning'; message: string }[];
  addNotification: (type: 'info' | 'success' | 'error' | 'warning', message: string) => void;
  removeNotification: (id: string) => void;
}

// ============================================
// Initial Data (Empty - will be loaded from API)
// ============================================

const initialProjects: Project[] = [];

const initialJdks: JDK[] = [];

const initialBuildJobs: BuildJob[] = [];

const initialPipelines: StorePipeline[] = [];

// ============================================
// Store Creation with Persistence
// ============================================

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Navigation
      activeView: 'overview',
      previousView: null,
      setActiveView: (view) => set((state) => ({ 
        activeView: view,
        previousView: state.activeView !== view ? state.activeView : state.previousView
      })),
      goBack: () => {
        const { previousView } = get();
        if (previousView) {
          set({ activeView: previousView, previousView: null });
        }
      },
      
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      resolvedTheme: 'light',
      setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
      
      // Projects
      projects: initialProjects,
      selectedProject: null,
      setSelectedProject: (project) => set({ selectedProject: project }),
      setProjects: (projects) => set({ projects }),
      addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
      })),
      removeProject: (id) => set((state) => ({
        projects: state.projects.filter(p => p.id !== id)
      })),
      
      // JDKs
      jdks: initialJdks,
      setJdks: (jdks) => set({ jdks }),
      addJdk: (jdk) => set((state) => ({ jdks: [...state.jdks, jdk] })),
      removeJdk: (id) => set((state) => ({
        jdks: state.jdks.filter(j => j.id !== id)
      })),
      setDefaultJdk: (id) => set((state) => ({
        jdks: state.jdks.map(j => ({ ...j, isDefault: j.id === id }))
      })),
      
      // Build Jobs
      buildJobs: initialBuildJobs,
      selectedJobId: null,
      setSelectedJobId: (id) => set({ selectedJobId: id }),
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
      
      // Job Logs
      jobLogs: {},
      addLogEntry: (jobId, entry) => set((state) => ({
        jobLogs: {
          ...state.jobLogs,
          [jobId]: [...(state.jobLogs[jobId] || []), entry]
        }
      })),
      clearJobLogs: (jobId) => set((state) => {
        const newLogs = { ...state.jobLogs };
        delete newLogs[jobId];
        return { jobLogs: newLogs };
      }),
      
      // Pipelines
      pipelines: initialPipelines,
      selectedPipelineId: null,
      setSelectedPipelineId: (id) => set({ selectedPipelineId: id }),
      
      addPipeline: (name, projectId, steps) => {
        const id = Date.now().toString();
        set((state) => ({
          pipelines: [...state.pipelines, {
            id,
            name,
            projectId,
            steps,
            createdAt: new Date().toISOString(),
          }]
        }));
        return id;
      },
      
      updatePipeline: (id, updates) => set((state) => ({
        pipelines: state.pipelines.map(p => p.id === id ? { ...p, ...updates } : p)
      })),
      
      removePipeline: (id) => set((state) => ({
        pipelines: state.pipelines.filter(p => p.id !== id)
      })),
      
      runPipeline: (id) => {
        const state = get();
        const pipeline = state.pipelines.find(p => p.id === id);
        if (!pipeline) return;
        
        const project = state.projects.find(p => p.id === pipeline.projectId);
        if (!project) return;
        
        // Mark pipeline as running
        set((s) => ({
          pipelines: s.pipelines.map(p => 
            p.id === id ? { ...p, isRunning: true, currentStep: 0, lastRun: new Date().toISOString() } : p
          )
        }));
        
        // Create job for first step
        const firstStep = pipeline.steps[0];
        if (firstStep) {
          const jdk = state.jdks.find(j => j.id === firstStep.jdkId) || state.jdks.find(j => j.isDefault);
          const newJob: BuildJob = {
            id: Date.now().toString(),
            projectId: pipeline.projectId,
            projectName: `${project.name} - ${firstStep.name}`,
            status: 'running',
            progress: 0,
            startTime: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
            jdk: jdk ? `JDK ${jdk.version.split('.')[0]}` : 'JDK 21',
            goals: firstStep.goals.join(' '),
            pipelineId: id,
            pipelineStep: 0,
          };
          
          set((s) => ({ 
            buildJobs: [newJob, ...s.buildJobs],
            notifications: [...s.notifications, {
              id: Date.now().toString(),
              type: 'info' as const,
              message: `Pipeline "${pipeline.name}" gestartet`
            }]
          }));
          
          // Simulate progress
          let progress = 0;
          const interval = setInterval(() => {
            progress += Math.random() * 20;
            if (progress >= 100) {
              progress = 100;
              clearInterval(interval);
              
              set((s) => ({
                buildJobs: s.buildJobs.map(j => 
                  j.id === newJob.id ? { ...j, status: 'success' as const, progress: 100, duration: '1m 23s' } : j
                ),
                pipelines: s.pipelines.map(p => 
                  p.id === id ? { ...p, isRunning: false, currentStep: undefined } : p
                ),
                notifications: [...s.notifications, {
                  id: Date.now().toString(),
                  type: 'success' as const,
                  message: `Pipeline "${pipeline.name}" erfolgreich`
                }]
              }));
            } else {
              set((s) => ({
                buildJobs: s.buildJobs.map(j => 
                  j.id === newJob.id ? { ...j, progress: Math.floor(progress) } : j
                )
              }));
            }
          }, 800);
        }
      },
      
      stopPipeline: (id) => {
        const state = get();
        const pipeline = state.pipelines.find(p => p.id === id);
        if (!pipeline) return;
        
        // Cancel all running jobs for this pipeline
        set((s) => ({
          buildJobs: s.buildJobs.map(j => 
            j.pipelineId === id && (j.status === 'running' || j.status === 'pending')
              ? { ...j, status: 'cancelled' as const }
              : j
          ),
          pipelines: s.pipelines.map(p => 
            p.id === id ? { ...p, isRunning: false, currentStep: undefined } : p
          ),
          notifications: [...s.notifications, {
            id: Date.now().toString(),
            type: 'warning' as const,
            message: `Pipeline "${pipeline.name}" abgebrochen`
          }]
        }));
      },
      
      // Start Build - Calls real API and listens to events  
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
            type: 'info' as const,
            message: `Build gestartet: ${project.name}`
          }]
        }));
        
        // Set up event listeners for this build
        const cleanupFunctions: (() => void)[] = [];
        
        const cleanupListeners = () => {
          cleanupFunctions.forEach(fn => fn());
        };
        
        // Log listener
        cleanupFunctions.push(
          api.onBuildLog((jobId, line) => {
            if (jobId !== newJob.id) return;
            
            // Determine log level from line content
            let level: LogEntry['level'] = 'info';
            if (line.includes('[ERROR]') || line.includes('FAILURE')) level = 'error';
            else if (line.includes('[WARNING]')) level = 'warn';
            else if (line.includes('BUILD SUCCESS') || line.includes('[SUCCESS]')) level = 'success';
            else if (line.includes('[DEBUG]')) level = 'debug';
            
            const entry: LogEntry = {
              id: `${jobId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date(),
              rawText: line,
              segments: [{ text: line, style: {} }],
              level,
            };
            
            get().addLogEntry(jobId, entry);
          })
        );
        
        // Progress listener
        cleanupFunctions.push(
          api.onBuildProgress((jobId, progress) => {
            if (jobId !== newJob.id) return;
            
            set((state) => ({
              buildJobs: state.buildJobs.map(j => 
                j.id === jobId ? { ...j, status: 'running' as const, progress } : j
              )
            }));
          })
        );
        
        // Complete listener
        cleanupFunctions.push(
          api.onBuildComplete((jobId, status, _exitCode) => {
            if (jobId !== newJob.id) return;
            
            const finalStatus = status === 'success' ? 'success' as const : 
                               status === 'cancelled' ? 'cancelled' as const : 'failed' as const;
            
            // Calculate duration
            const job = get().buildJobs.find(j => j.id === jobId);
            let duration = '';
            if (job) {
              const [hours, minutes] = job.startTime.split(':').map(Number);
              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
              const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
              if (diff >= 60) {
                duration = `${Math.floor(diff / 60)}m ${diff % 60}s`;
              } else {
                duration = `${diff}s`;
              }
            }
            
            set((state) => ({
              buildJobs: state.buildJobs.map(j => 
                j.id === jobId ? { 
                  ...j, 
                  status: finalStatus, 
                  progress: finalStatus === 'success' ? 100 : j.progress,
                  duration,
                  endTime: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                } : j
              ),
              projects: state.projects.map(p =>
                p.id === projectId ? {
                  ...p,
                  lastBuild: {
                    status: finalStatus as 'success' | 'failed' | 'running' | 'pending',
                    duration,
                    timestamp: 'gerade eben'
                  }
                } : p
              ),
              notifications: [...state.notifications, {
                id: Date.now().toString(),
                type: finalStatus === 'success' ? 'success' as const : 
                      finalStatus === 'cancelled' ? 'warning' as const : 'error' as const,
                message: finalStatus === 'success' ? `Build erfolgreich: ${project.name}` :
                         finalStatus === 'cancelled' ? `Build abgebrochen: ${project.name}` :
                         `Build fehlgeschlagen: ${project.name}`
              }]
            }));
            
            cleanupListeners();
          })
        );
        
        // Error listener
        cleanupFunctions.push(
          api.onBuildError((jobId, error) => {
            if (jobId !== newJob.id) return;
            
            const entry: LogEntry = {
              id: `${jobId}-error-${Date.now()}`,
              timestamp: new Date(),
              rawText: `[ERROR] ${error}`,
              segments: [{ text: `[ERROR] ${error}`, style: { color: 'red' } }],
              level: 'error',
            };
            get().addLogEntry(jobId, entry);
          })
        );
        
        // Mark as running and call the API
        set((state) => ({
          buildJobs: state.buildJobs.map(j => 
            j.id === newJob.id ? { ...j, status: 'running' as const } : j
          )
        }));
        
        // Call the actual API
        api.startBuild(newJob).catch((err) => {
          console.error('Build start failed:', err);
          set((state) => ({
            buildJobs: state.buildJobs.map(j => 
              j.id === newJob.id ? { ...j, status: 'failed' as const } : j
            ),
            notifications: [...state.notifications, {
              id: Date.now().toString(),
              type: 'error' as const,
              message: `Build konnte nicht gestartet werden: ${project.name}`
            }]
          }));
          cleanupListeners();
        });
      },
      
      // Settings
      settings: {
        mavenPath: '',
        defaultGoals: 'clean install',
        parallelBuilds: 2,
        autoScan: true,
        scanPaths: [],
        jdkScanPath: '',
        setupComplete: false,
        skipTestsByDefault: false,
        offlineMode: false,
        enableThreads: false,
        threadCount: '1C',
      },
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),
      
      // Setup Wizard
      setupWizard: {
        currentStep: 'welcome',
        scanRootPath: 'C:\\dev\\quellen',
        jdkScanPaths: 'C:\\dev\\java',
        mavenPath: 'C:\\dev\\maven\\bin\\mvn.cmd',
        isScanning: false,
        foundProjects: 0,
        foundJdks: 0,
      },
      updateSetupWizard: (updates) => set((state) => ({
        setupWizard: { ...state.setupWizard, ...updates }
      })),
      completeSetup: () => set((state) => ({
        settings: { ...state.settings, setupComplete: true },
        activeView: 'overview'
      })),
      
      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      isSearchOpen: false,
      setIsSearchOpen: (open) => set({ isSearchOpen: open }),
      searchResults: [],
      performSearch: (query) => {
        if (!query.trim()) {
          set({ searchResults: [] });
          return;
        }
        
        const state = get();
        const results: SearchResult[] = [];
        const lowerQuery = query.toLowerCase();
        
        // Search projects
        state.projects.forEach(p => {
          if (p.name.toLowerCase().includes(lowerQuery) || p.path.toLowerCase().includes(lowerQuery)) {
            results.push({
              type: 'project',
              id: p.id,
              title: p.name,
              subtitle: p.path,
            });
          }
        });
        
        // Search builds
        state.buildJobs.forEach(j => {
          if (j.projectName.toLowerCase().includes(lowerQuery) || j.goals.toLowerCase().includes(lowerQuery)) {
            results.push({
              type: 'build',
              id: j.id,
              title: j.projectName,
              subtitle: `${j.goals} - ${j.status}`,
            });
          }
        });
        
        // Search pipelines
        state.pipelines.forEach(p => {
          if (p.name.toLowerCase().includes(lowerQuery)) {
            results.push({
              type: 'pipeline',
              id: p.id,
              title: p.name,
              subtitle: `${p.steps.length} Schritte`,
            });
          }
        });
        
        // Search JDKs
        state.jdks.forEach(j => {
          if (j.version.toLowerCase().includes(lowerQuery) || j.vendor.toLowerCase().includes(lowerQuery)) {
            results.push({
              type: 'jdk',
              id: j.id,
              title: `JDK ${j.version}`,
              subtitle: j.vendor,
            });
          }
        });
        
        set({ searchResults: results.slice(0, 10) });
      },
      
      // Keyboard Shortcuts Help
      isShortcutsHelpOpen: false,
      setIsShortcutsHelpOpen: (open) => set({ isShortcutsHelpOpen: open }),
      
      // UI State
      isLoading: false,
      notifications: [],
      addNotification: (type, message) => {
        const id = Date.now().toString();
        set((state) => ({
          notifications: [...state.notifications, { id, type, message }]
        }));
        // Auto-remove after 5 seconds
        setTimeout(() => {
          set((state) => ({
            notifications: state.notifications.filter(n => n.id !== id)
          }));
        }, 5000);
      },
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      })),
    }),
    {
      name: 'gfos-build-storage',
      partialize: (state) => ({
        theme: state.theme,
        settings: state.settings,
      }),
    }
  )
);

// ============================================
// Computed Selectors
// ============================================

export const useStats = () => {
  const { projects, buildJobs, jdks, pipelines } = useAppStore();
  
  return {
    totalProjects: projects.length,
    mavenProjects: projects.length,
    activeBuilds: buildJobs.filter(j => j.status === 'running').length,
    queuedBuilds: buildJobs.filter(j => j.status === 'pending').length,
    successfulBuilds: buildJobs.filter(j => j.status === 'success').length,
    failedBuilds: buildJobs.filter(j => j.status === 'failed').length,
    jdkCount: jdks.length,
    pipelineCount: pipelines.length,
    runningPipelines: pipelines.filter(p => p.isRunning).length,
  };
};

export const useFilteredProjects = () => {
  const { projects, searchQuery } = useAppStore();
  
  if (!searchQuery.trim()) return projects;
  
  const lower = searchQuery.toLowerCase();
  return projects.filter(p => 
    p.name.toLowerCase().includes(lower) || 
    p.path.toLowerCase().includes(lower) ||
    p.branch.toLowerCase().includes(lower)
  );
};

export const useFilteredBuilds = () => {
  const { buildJobs, searchQuery } = useAppStore();
  
  if (!searchQuery.trim()) return buildJobs;
  
  const lower = searchQuery.toLowerCase();
  return buildJobs.filter(j => 
    j.projectName.toLowerCase().includes(lower) || 
    j.goals.toLowerCase().includes(lower)
  );
};
