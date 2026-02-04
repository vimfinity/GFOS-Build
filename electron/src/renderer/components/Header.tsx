/**
 * Header Component
 * 
 * Terminal-style header with path breadcrumb and system actions.
 */

import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../api';
import { ChevronLeft, RotateCw, ExternalLink, Clock, Circle } from 'lucide-react';

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
  const jobs = useAppStore((state) => state.jobs);
  
  const [refreshHovered, setRefreshHovered] = useState(false);
  const [openHovered, setOpenHovered] = useState(false);

  const canGoBack = navigation.history.length > 0;
  const runningJobs = jobs.filter(j => j.status === 'running').length;
  
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
    <header className="h-14 bg-[#0a0a0c] border-b border-[#1a1a1f] flex items-center px-5 gap-4">
      {/* Back Button */}
      {canGoBack && (
        <button
          onClick={goBack}
          className="p-2 text-zinc-600 hover:text-[#22ffaa] hover:bg-[#22ffaa]/10 transition-all rounded group"
          title="Zurück"
        >
          <ChevronLeft size={18} strokeWidth={1.5} className="group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Path Breadcrumb - Terminal Style */}
      <div className="flex items-center gap-1.5 flex-1 font-mono text-xs">
        <span className="text-[#22ffaa] text-sm">›</span>
        {path.map((segment, i) => (
          <React.Fragment key={i}>
            <span 
              className={`
                transition-colors
                ${i === path.length - 1 
                  ? 'text-zinc-200 hover:text-[#22ffaa]' 
                  : 'text-zinc-600 hover:text-zinc-400'
                }
              `}
            >
              {segment.toLowerCase()}
            </span>
            {i < path.length - 1 && <span className="text-zinc-700">/</span>}
          </React.Fragment>
        ))}
        {!isScanning && <span className="text-[#22ffaa] animate-blink ml-0.5">_</span>}
      </div>

      {/* Scan Status */}
      {(isScanning || scanStatus) && (
        <div className="flex items-center gap-2 px-4 py-1.5 border border-[#22ffaa]/30 bg-[#22ffaa]/5 animate-fade-in">
          <RotateCw size={12} className="text-[#22ffaa] animate-spin" />
          <span className="text-[10px] text-[#22ffaa] uppercase tracking-wider font-mono">
            {scanStatus || 'Scanning...'}
          </span>
        </div>
      )}

      {/* Running Jobs Indicator */}
      {runningJobs > 0 && !isScanning && (
        <div className="flex items-center gap-2 px-3 py-1.5 border border-[#ffaa00]/30 bg-[#ffaa00]/5 animate-fade-in">
          <Circle size={8} className="text-[#ffaa00] fill-[#ffaa00] animate-pulse" />
          <span className="text-[10px] text-[#ffaa00] uppercase tracking-wider font-mono">
            {runningJobs} Running
          </span>
        </div>
      )}

      {/* Time */}
      <div className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors cursor-default">
        <Clock size={12} strokeWidth={1.5} />
        <span className="text-[10px] font-mono tracking-wider tabular-nums">{currentTime}</span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-[#1a1a1f]" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleOpenFolder}
          onMouseEnter={() => setOpenHovered(true)}
          onMouseLeave={() => setOpenHovered(false)}
          className={`
            p-2 transition-all rounded relative
            ${openHovered 
              ? 'text-[#00d4ff] bg-[#00d4ff]/10' 
              : 'text-zinc-600 hover:text-[#00d4ff]'
            }
          `}
          title="Projektordner öffnen"
        >
          <ExternalLink size={14} strokeWidth={1.5} className={openHovered ? 'translate-x-0.5 -translate-y-0.5' : ''} style={{ transition: 'transform 0.15s ease' }} />
        </button>
        <button
          onClick={handleRefresh}
          onMouseEnter={() => setRefreshHovered(true)}
          onMouseLeave={() => setRefreshHovered(false)}
          disabled={isScanning}
          className={`
            p-2 transition-all rounded relative
            ${isScanning 
              ? 'text-zinc-700 cursor-not-allowed' 
              : refreshHovered 
                ? 'text-[#22ffaa] bg-[#22ffaa]/10' 
                : 'text-zinc-600 hover:text-[#22ffaa]'
            }
          `}
          title="Neu scannen"
        >
          <RotateCw 
            size={14} 
            strokeWidth={1.5} 
            className={isScanning ? 'animate-spin' : refreshHovered ? 'rotate-45' : ''}
            style={{ transition: 'transform 0.2s ease' }}
          />
        </button>
      </div>
    </header>
  );
}
