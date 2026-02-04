/**
 * Header Component - Premium Edition
 * 
 * Terminal-style header with path breadcrumb, animations, and system actions.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { api } from '../api';
import { ChevronLeft, RotateCw, ExternalLink, Clock, Activity } from 'lucide-react';

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

  const runningJobs = jobs.filter(j => j.status === 'running').length;
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
    <motion.header 
      className="h-12 bg-terminal-dark border-b border-terminal-border flex items-center px-4 gap-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Back Button */}
      <AnimatePresence>
        {canGoBack && (
          <motion.button
            onClick={goBack}
            className="p-1.5 text-zinc-600 hover:text-neon-green transition-colors"
            title="Zurück"
            initial={{ opacity: 0, x: -10, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.8 }}
            whileHover={{ scale: 1.1, x: -2 }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft size={18} strokeWidth={1.5} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Path Breadcrumb - Terminal Style */}
      <div className="flex items-center gap-1 flex-1 font-mono text-xs">
        <motion.span 
          className="text-neon-green"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          ›
        </motion.span>
        {path.map((segment, i) => (
          <React.Fragment key={i}>
            <motion.span 
              className={i === path.length - 1 ? 'text-zinc-300' : 'text-zinc-600'}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {segment.toLowerCase()}
            </motion.span>
            {i < path.length - 1 && <span className="text-zinc-700">/</span>}
          </React.Fragment>
        ))}
        {!isScanning && (
          <motion.span 
            className="text-neon-green ml-0.5"
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            _
          </motion.span>
        )}
      </div>

      {/* Running Jobs Indicator */}
      <AnimatePresence>
        {runningJobs > 0 && (
          <motion.div 
            className="flex items-center gap-2 px-2 py-1 border border-neon-orange/30 bg-neon-orange/5"
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Activity size={12} className="text-neon-orange" />
            </motion.div>
            <span className="text-[10px] text-neon-orange uppercase tracking-wider font-mono">
              {runningJobs} active
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scan Status */}
      <AnimatePresence>
        {(isScanning || scanStatus) && (
          <motion.div 
            className="flex items-center gap-2 px-3 py-1 border border-neon-green/30 bg-neon-green/5"
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <RotateCw size={12} className="text-neon-green" />
            </motion.div>
            <span className="text-[10px] text-neon-green uppercase tracking-wider font-mono">
              {scanStatus || 'Scanning'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time */}
      <motion.div 
        className="flex items-center gap-2 text-zinc-600"
        whileHover={{ color: "#00ff88" }}
      >
        <Clock size={12} strokeWidth={1.5} />
        <motion.span 
          className="text-[10px] font-mono tracking-wider"
          key={currentTime}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {currentTime}
        </motion.span>
      </motion.div>

      {/* Separator */}
      <div className="w-px h-4 bg-terminal-border" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <motion.button
          onClick={handleOpenFolder}
          className="p-1.5 text-zinc-600 hover:text-neon-cyan transition-colors"
          title="Projektordner öffnen"
          whileHover={{ scale: 1.15, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
        >
          <ExternalLink size={14} strokeWidth={1.5} />
        </motion.button>
        <motion.button
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
          whileHover={!isScanning ? { scale: 1.15 } : {}}
          whileTap={!isScanning ? { scale: 0.9 } : {}}
        >
          <motion.div
            animate={isScanning ? { rotate: 360 } : {}}
            transition={isScanning ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
          >
            <RotateCw size={14} strokeWidth={1.5} />
          </motion.div>
        </motion.button>
      </div>
    </motion.header>
  );
}
