/**
 * Header Component
 * 
 * Top navigation bar with breadcrumb and actions.
 */

import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../api';
import { ChevronLeft, RefreshCw, FolderOpen } from 'lucide-react';

export function Header() {
  const navigation = useAppStore((state) => state.navigation);
  const goBack = useAppStore((state) => state.goBack);
  const settings = useAppStore((state) => state.settings);
  const setProjects = useAppStore((state) => state.setProjects);
  const setJdks = useAppStore((state) => state.setJdks);
  const isScanning = useAppStore((state) => state.isScanning);
  const setScanning = useAppStore((state) => state.setScanning);
  const scanStatus = useAppStore((state) => state.scanStatus);
  const selectedProjectPath = useAppStore((state) => state.selectedProjectPath);
  const projects = useAppStore((state) => state.projects);

  const canGoBack = navigation.history.length > 0;
  
  const getTitle = (): string => {
    switch (navigation.currentScreen) {
      case 'HOME': return 'Dashboard';
      case 'PROJECTS': return 'Projekte';
      case 'PROJECT_DETAIL': {
        const project = projects.find(p => p.path === selectedProjectPath);
        return project?.name || 'Projekt Details';
      }
      case 'BUILD_CONFIG': return 'Build konfigurieren';
      case 'JOBS': return 'Build Jobs';
      case 'JOB_DETAIL': return 'Job Details';
      case 'SETTINGS': return 'Einstellungen';
      default: return 'GFOS Build';
    }
  };

  const handleRefresh = async () => {
    setScanning(true);
    try {
      const projects = await api.scanProjects(settings.scanRootPath);
      setProjects(projects);
      
      const jdks = await api.scanJDKs(settings.jdkScanPaths);
      setJdks(jdks);
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setScanning(false);
    }
  };

  const handleOpenFolder = () => {
    api.openPath(settings.scanRootPath);
  };

  return (
    <header className="h-14 bg-slate-800/50 border-b border-slate-700 flex items-center px-4 gap-4">
      {/* Back Button */}
      {canGoBack && (
        <button
          onClick={goBack}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Zurück"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {/* Title */}
      <h2 className="text-lg font-semibold text-white flex-1">{getTitle()}</h2>

      {/* Scan Status */}
      {(isScanning || scanStatus) && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <RefreshCw size={14} className="animate-spin" />
          <span>{scanStatus || 'Scanne...'}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleOpenFolder}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Projektordner öffnen"
        >
          <FolderOpen size={18} />
        </button>
        <button
          onClick={handleRefresh}
          disabled={isScanning}
          className={`
            p-2 rounded-lg transition-colors
            ${isScanning 
              ? 'text-slate-500 cursor-not-allowed' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }
          `}
          title="Neu scannen"
        >
          <RefreshCw size={18} className={isScanning ? 'animate-spin' : ''} />
        </button>
      </div>
    </header>
  );
}
