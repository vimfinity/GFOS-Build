/**
 * Header Component
 * 
 * Terminal-style header with path breadcrumb and system actions.
 */

import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../api';
import { ChevronLeft, RotateCw, ExternalLink, Clock } from 'lucide-react';

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
  
  const getPath = (): string[] => {
    const base = ['GFOS'];
    switch (navigation.currentScreen) {
      case 'HOME': return [...base, 'terminal'];
      case 'PROJECTS': return [...base, 'projekte'];
      case 'PROJECT_DETAIL': {
        const project = projects.find(p => p.path === selectedProjectPath);
        return [...base, 'projekte', project?.name || 'detail'];
      }
      case 'BUILD_CONFIG': return [...base, 'projekte', 'build-config'];
      case 'JOBS': return [...base, 'prozesse'];
      case 'JOB_DETAIL': return [...base, 'prozesse', 'detail'];
      case 'SETTINGS': return [...base, 'system'];
      default: return base;
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

  const path = getPath();
  const currentTime = new Date().toLocaleTimeString('de-DE', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <header className="h-12 bg-terminal-dark border-b border-terminal-border flex items-center px-4 gap-4">
      {/* Back Button */}
      {canGoBack && (
        <button
          onClick={goBack}
          className="p-1.5 text-zinc-600 hover:text-neon-green transition-colors"
          title="Zurück"
        >
          <ChevronLeft size={18} strokeWidth={1.5} />
        </button>
      )}

      {/* Path Breadcrumb - Terminal Style */}
      <div className="flex items-center gap-1 flex-1 font-mono text-xs">
        <span className="text-neon-green">›</span>
        {path.map((segment, i) => (
          <React.Fragment key={i}>
            <span className={i === path.length - 1 ? 'text-zinc-300' : 'text-zinc-600'}>
              {segment.toLowerCase()}
            </span>
            {i < path.length - 1 && <span className="text-zinc-700">/</span>}
          </React.Fragment>
        ))}
        {!isScanning && <span className="text-neon-green animate-blink ml-0.5">_</span>}
      </div>

      {/* Scan Status */}
      {(isScanning || scanStatus) && (
        <div className="flex items-center gap-2 px-3 py-1 border border-neon-green/30 bg-neon-green/5">
          <RotateCw size={12} className="text-neon-green animate-spin" />
          <span className="text-[10px] text-neon-green uppercase tracking-wider font-mono">
            {scanStatus || 'Scanning'}
          </span>
        </div>
      )}

      {/* Time */}
      <div className="flex items-center gap-2 text-zinc-600">
        <Clock size={12} strokeWidth={1.5} />
        <span className="text-[10px] font-mono tracking-wider">{currentTime}</span>
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-terminal-border" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleOpenFolder}
          className="p-1.5 text-zinc-600 hover:text-neon-green transition-colors"
          title="Projektordner öffnen"
        >
          <ExternalLink size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={handleRefresh}
          disabled={isScanning}
          className={`
            p-1.5 transition-colors
            ${isScanning 
              ? 'text-zinc-700 cursor-not-allowed' 
              : 'text-zinc-600 hover:text-neon-green'
            }
          `}
          title="Neu scannen"
        >
          <RotateCw size={14} strokeWidth={1.5} className={isScanning ? 'animate-spin' : ''} />
        </button>
      </div>
    </header>
  );
}
