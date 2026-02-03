/**
 * Main App Component
 * 
 * Root component handling navigation and layout.
 */

import React, { useEffect, useState } from 'react';
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

// Initialize app
const initApp = async () => {
  const { setSettings, setProjects, setJdks, setScanStatus } = useAppStore.getState();
  
  // Load saved settings
  const settings = await api.loadConfig();
  setSettings(settings);
  
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
    });

    const unsubError = api.onBuildError((jobId, error) => {
      updateJob(jobId as string, {
        status: 'failed',
        completedAt: new Date(),
      });
      appendJobLog(jobId as string, `[ERROR] ${error}`);
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
      default:
        return <HomeView />;
    }
  };

  if (initError) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center p-8 bg-slate-800 rounded-xl border border-red-500/30 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Fehler beim Starten</h2>
          <p className="text-sm text-slate-400">{initError}</p>
        </div>
      </div>
    );
  }

  if (!settingsLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-gfos-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            <div className="absolute inset-3 rounded-full bg-gradient-to-br from-gfos-500 to-gfos-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">GFOS Build</h1>
          <p className="text-slate-400">Lade Anwendung...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}
