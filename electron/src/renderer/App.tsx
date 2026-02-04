/**
 * Main App Component
 * 
 * Root component with terminal-inspired layout.
 */

import { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { api } from './api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HomeView } from './views/HomeView';
import { ProjectsView } from './views/ProjectsView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { BuildConfigView } from './views/BuildConfigView';
import { JobsView } from './views/JobsView';
import { JobDetailView } from './views/JobDetailView';
import { SettingsView } from './views/SettingsView';
import { PipelinesView } from './views/PipelinesView';
import { PipelineEditorView } from './views/PipelineEditorView';
import { SetupWizardView } from './views/SetupWizardView';
import { Cpu, AlertTriangle } from 'lucide-react';

// Initialize app
const initApp = async () => {
  const { setSettings, setProjects, setJdks, setScanStatus, setJobs, setPipelines, setScreen } = useAppStore.getState();
  
  // Load saved settings
  const settings = await api.loadConfig();
  setSettings(settings);
  
  // Check if setup is needed
  if (!settings.setupComplete) {
    setScreen('SETUP_WIZARD');
    return;
  }
  
  // Load saved jobs and pipelines
  try {
    const savedJobs = await api.loadJobs();
    if (savedJobs && savedJobs.length > 0) {
      // Convert date strings back to Date objects
      const jobs = savedJobs.map((job: any) => ({
        ...job,
        createdAt: new Date(job.createdAt),
        startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
        completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
      }));
      setJobs(jobs);
    }
  } catch (err) {
    console.warn('Could not load saved jobs:', err);
  }
  
  try {
    const savedPipelines = await api.loadPipelines();
    if (savedPipelines && savedPipelines.length > 0) {
      // Convert date strings back to Date objects
      const pipelines = savedPipelines.map((pipeline: any) => ({
        ...pipeline,
        createdAt: new Date(pipeline.createdAt),
        lastRun: pipeline.lastRun ? new Date(pipeline.lastRun) : undefined,
      }));
      setPipelines(pipelines);
    }
  } catch (err) {
    console.warn('Could not load saved pipelines:', err);
  }
  
  // Setup event listeners
  api.onScanStatus((status) => {
    setScanStatus(status as string | null);
  });
  
  // Initial scan
  const projects = await api.scanProjects(settings.scanRootPath);
  setProjects(projects);
  
  const jdks = await api.scanJDKs(settings.jdkScanPaths);
  setJdks(jdks);
};

// Debounced job save function
let saveJobsTimeout: ReturnType<typeof setTimeout> | null = null;
const saveJobsDebounced = () => {
  if (saveJobsTimeout) clearTimeout(saveJobsTimeout);
  saveJobsTimeout = setTimeout(() => {
    const jobs = useAppStore.getState().jobs;
    api.saveJobs(jobs).catch(console.error);
  }, 500);
};

// Debounced pipeline save function
let savePipelinesTimeout: ReturnType<typeof setTimeout> | null = null;
export const savePipelinesDebounced = () => {
  if (savePipelinesTimeout) clearTimeout(savePipelinesTimeout);
  savePipelinesTimeout = setTimeout(() => {
    const pipelines = useAppStore.getState().pipelines;
    api.savePipelines(pipelines).catch(console.error);
  }, 500);
};

export default function App() {
  const currentScreen = useAppStore((state) => state.navigation.currentScreen);
  const settingsLoaded = useAppStore((state) => state.settingsLoaded);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    initApp().catch((err) => {
      console.error('Failed to initialize app:', err);
      setInitError(err?.message || 'Unbekannter Fehler');
    });
  }, []);

  // Setup build event listeners
  useEffect(() => {
    const { updateJob, appendJobLog } = useAppStore.getState();

    const unsubLog = api.onBuildLog((jobId, line) => {
      appendJobLog(jobId as string, line as string);
    });

    const unsubProgress = api.onBuildProgress((jobId, progress) => {
      updateJob(jobId as string, { progress: progress as number });
    });

    const unsubComplete = api.onBuildComplete((jobId, status, exitCode) => {
      updateJob(jobId as string, {
        status: status as any,
        progress: 100,
        completedAt: new Date(),
        exitCode: exitCode as number | null,
      });
      // Save jobs after build completes
      saveJobsDebounced();
    });

    const unsubError = api.onBuildError((jobId, error) => {
      updateJob(jobId as string, {
        status: 'failed',
        completedAt: new Date(),
      });
      appendJobLog(jobId as string, `[ERROR] ${error}`);
      // Save jobs after error
      saveJobsDebounced();
    });

    return () => {
      unsubLog();
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'HOME':
        return <HomeView />;
      case 'PROJECTS':
        return <ProjectsView />;
      case 'PROJECT_DETAIL':
        return <ProjectDetailView />;
      case 'BUILD_CONFIG':
        return <BuildConfigView />;
      case 'JOBS':
        return <JobsView />;
      case 'JOB_DETAIL':
        return <JobDetailView />;
      case 'SETTINGS':
        return <SettingsView />;
      case 'PIPELINES':
        return <PipelinesView />;
      case 'PIPELINE_EDITOR':
        return <PipelineEditorView />;
      case 'SETUP_WIZARD':
        return <SetupWizardView />;
      default:
        return <HomeView />;
    }
  };

  // Error State - Terminal Style
  if (initError) {
    return (
      <div className="flex items-center justify-center h-screen bg-terminal-black data-grid-bg">
        <div className="text-center p-8 border border-neon-red bg-terminal-dark max-w-md relative">
          {/* Corner decorations */}
          <div className="absolute -top-px -left-px w-3 h-3 border-l border-t border-neon-red" />
          <div className="absolute -bottom-px -right-px w-3 h-3 border-r border-b border-neon-red" />
          
          <div className="w-14 h-14 mx-auto mb-5 border border-neon-red flex items-center justify-center">
            <AlertTriangle size={28} className="text-neon-red" />
          </div>
          
          <div className="text-[10px] text-neon-red uppercase tracking-[0.2em] mb-2 font-display">
            System Error
          </div>
          
          <h2 className="text-lg font-display font-bold text-zinc-200 mb-3 uppercase tracking-wider">
            Initialisierung fehlgeschlagen
          </h2>
          
          <div className="p-3 bg-terminal-black border border-terminal-border text-left mb-4">
            <p className="text-xs text-neon-red font-mono">&gt; {initError}</p>
          </div>
          
          <button 
            onClick={() => window.location.reload()} 
            className="btn-danger text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading State - Terminal Boot
  if (!settingsLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-terminal-black data-grid-bg relative overflow-hidden">
        {/* Scanline overlay */}
        <div className="scanline-overlay" />
        
        <div className="text-center animate-terminal-boot">
          {/* Logo */}
          <div className="w-16 h-16 mx-auto mb-6 border border-neon-green relative flex items-center justify-center">
            <Cpu size={32} className="text-neon-green" />
            <div className="absolute -top-px -left-px w-2 h-2 bg-neon-green" />
            <div className="absolute -bottom-px -right-px w-2 h-2 bg-neon-green" />
            {/* Rotating border effect */}
            <div className="absolute inset-0 border border-neon-green/30 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          
          <h1 className="font-display text-xl font-bold text-neon-green tracking-[0.3em] uppercase mb-2 neon-glow-subtle">
            GFOS BUILD
          </h1>
          
          <p className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase mb-6">
            Maven Build System v1.0
          </p>
          
          {/* Boot sequence text */}
          <div className="font-mono text-[10px] text-zinc-600 space-y-1">
            <p className="animate-fade-in stagger-1">&gt; Initializing system...</p>
            <p className="animate-fade-in stagger-2">&gt; Loading configuration...</p>
            <p className="animate-fade-in stagger-3">&gt; Scanning workspace<span className="animate-blink">_</span></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-terminal-black text-zinc-300 overflow-hidden relative">
      {/* Subtle scanline effect */}
      <div className="scanline-overlay" />
      
      {/* Grid background */}
      <div className="absolute inset-0 data-grid-bg pointer-events-none" />
      
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header />
        <main className="flex-1 overflow-auto p-5">
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}
