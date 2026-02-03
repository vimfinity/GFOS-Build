/**
 * Main App Component
 * 
 * Root component handling navigation and layout.
 */

import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
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
  
  try {
    // Load saved settings
    const settings = await window.electronAPI.loadConfig();
    setSettings(settings);
    
    // Setup event listeners
    window.electronAPI.onScanStatus((status) => {
      setScanStatus(status);
    });
    
    // Initial scan
    const projects = await window.electronAPI.scanProjects(settings.scanRootPath);
    setProjects(projects);
    
    const jdks = await window.electronAPI.scanJDKs(settings.jdkScanPaths);
    setJdks(jdks);
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
};

export default function App() {
  const currentScreen = useAppStore((state) => state.navigation.currentScreen);
  const settingsLoaded = useAppStore((state) => state.settingsLoaded);

  useEffect(() => {
    initApp();
  }, []);

  // Setup build event listeners
  useEffect(() => {
    const { updateJob, appendJobLog } = useAppStore.getState();

    const unsubLog = window.electronAPI.onBuildLog((jobId, line) => {
      appendJobLog(jobId, line);
    });

    const unsubProgress = window.electronAPI.onBuildProgress((jobId, progress) => {
      updateJob(jobId, { progress });
    });

    const unsubComplete = window.electronAPI.onBuildComplete((jobId, status, exitCode) => {
      updateJob(jobId, {
        status: status as any,
        progress: 100,
        completedAt: new Date(),
        exitCode,
      });
    });

    const unsubError = window.electronAPI.onBuildError((jobId, error) => {
      updateJob(jobId, {
        status: 'failed',
        completedAt: new Date(),
      });
      appendJobLog(jobId, `[ERROR] ${error}`);
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

  if (!settingsLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gfos-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Lade Einstellungen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}
