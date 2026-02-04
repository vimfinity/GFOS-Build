/**
 * Sidebar Component
 * 
 * Terminal-style navigation with neon accents.
 */

import React from 'react';
import { useAppStore, type AppScreen } from '../store/useAppStore';
import { 
  Terminal, 
  FolderGit2, 
  Activity, 
  Sliders,
  ChevronRight,
  Cpu
} from 'lucide-react';

interface NavItem {
  id: AppScreen;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'HOME', label: 'Terminal', shortcut: '01', icon: <Terminal size={18} strokeWidth={1.5} /> },
  { id: 'PROJECTS', label: 'Projekte', shortcut: '02', icon: <FolderGit2 size={18} strokeWidth={1.5} /> },
  { id: 'JOBS', label: 'Prozesse', shortcut: '03', icon: <Activity size={18} strokeWidth={1.5} /> },
  { id: 'SETTINGS', label: 'System', shortcut: '04', icon: <Sliders size={18} strokeWidth={1.5} /> },
];

export function Sidebar() {
  const currentScreen = useAppStore((state) => state.navigation.currentScreen);
  const setScreen = useAppStore((state) => state.setScreen);
  const jobs = useAppStore((state) => state.jobs);
  
  const runningJobs = jobs.filter((j) => j.status === 'running').length;
  const pendingJobs = jobs.filter((j) => j.status === 'pending').length;

  return (
    <aside className="w-56 bg-terminal-dark border-r border-terminal-border flex flex-col relative">
      {/* Decorative corner */}
      <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-neon-green" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-neon-green" />
      
      {/* Logo */}
      <div className="p-5 border-b border-terminal-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-neon-green flex items-center justify-center relative">
            <Cpu size={20} className="text-neon-green" />
            <div className="absolute -top-px -left-px w-2 h-2 bg-neon-green" />
            <div className="absolute -bottom-px -right-px w-2 h-2 bg-neon-green" />
          </div>
          <div>
            <h1 className="font-display text-sm font-bold text-neon-green tracking-wider uppercase">
              GFOS
            </h1>
            <p className="text-[10px] text-zinc-500 tracking-widest uppercase">
              Build System
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        <div className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] px-3 mb-3 font-display">
          Navigation
        </div>
        <div className="space-y-1">
          {navItems.map((item, index) => {
            const isActive = currentScreen === item.id || 
              (item.id === 'PROJECTS' && currentScreen === 'PROJECT_DETAIL') ||
              (item.id === 'PROJECTS' && currentScreen === 'BUILD_CONFIG') ||
              (item.id === 'JOBS' && currentScreen === 'JOB_DETAIL');
            
            return (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 
                  transition-all duration-200 group relative
                  animate-slide-right stagger-${index + 1}
                  ${isActive 
                    ? 'bg-neon-green/10 text-neon-green' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-terminal-mid'
                  }
                `}
              >
                {/* Active indicator line */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-neon-green shadow-neon" />
                )}
                
                {/* Shortcut number */}
                <span className={`text-[10px] font-mono ${isActive ? 'text-neon-green/60' : 'text-zinc-700'}`}>
                  {item.shortcut}
                </span>
                
                <span className={isActive ? 'text-neon-green' : 'text-zinc-600 group-hover:text-zinc-400'}>
                  {item.icon}
                </span>
                
                <span className="flex-1 text-left text-xs font-medium tracking-wide uppercase">
                  {item.label}
                </span>
                
                {/* Job counter for Prozesse */}
                {item.id === 'JOBS' && runningJobs > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-neon-green text-terminal-black">
                    {runningJobs}
                  </span>
                )}
                
                {isActive && (
                  <ChevronRight size={12} className="text-neon-green/60" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Status Footer */}
      <div className="p-4 border-t border-terminal-border">
        <div className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] mb-3 font-display">
          System Status
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 ${runningJobs > 0 ? 'bg-neon-green animate-pulse-neon' : 'bg-zinc-600'}`} />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Aktiv</span>
            </div>
            <span className={`text-xs font-mono ${runningJobs > 0 ? 'text-neon-green' : 'text-zinc-600'}`}>
              {runningJobs}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 ${pendingJobs > 0 ? 'bg-neon-orange' : 'bg-zinc-600'}`} />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Queue</span>
            </div>
            <span className={`text-xs font-mono ${pendingJobs > 0 ? 'text-neon-orange' : 'text-zinc-600'}`}>
              {pendingJobs}
            </span>
          </div>
        </div>
        
        {/* Version info */}
        <div className="mt-4 pt-3 border-t border-terminal-border/50">
          <p className="text-[9px] text-zinc-700 font-mono">
            v1.0.0 // BUILD_2026
          </p>
        </div>
      </div>
    </aside>
  );
}
