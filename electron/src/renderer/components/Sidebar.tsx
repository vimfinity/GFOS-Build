/**
 * Sidebar Component
 * 
 * Terminal-style navigation with neon accents and polished interactions.
 */

import React, { useState } from 'react';
import { useAppStore, type AppScreen } from '../store/useAppStore';
import { 
  Terminal, 
  FolderGit2, 
  Activity, 
  Sliders,
  ChevronRight,
  Cpu,
  Zap,
  Workflow
} from 'lucide-react';

interface NavItem {
  id: AppScreen;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  description: string;
}

const navItems: NavItem[] = [
  { id: 'HOME', label: 'Terminal', shortcut: '01', icon: <Terminal size={18} strokeWidth={1.5} />, description: 'Dashboard' },
  { id: 'PROJECTS', label: 'Projekte', shortcut: '02', icon: <FolderGit2 size={18} strokeWidth={1.5} />, description: 'Maven Repos' },
  { id: 'PIPELINES', label: 'Pipelines', shortcut: '03', icon: <Workflow size={18} strokeWidth={1.5} />, description: 'Build Chains' },
  { id: 'JOBS', label: 'Prozesse', shortcut: '04', icon: <Activity size={18} strokeWidth={1.5} />, description: 'Build Queue' },
  { id: 'SETTINGS', label: 'System', shortcut: '05', icon: <Sliders size={18} strokeWidth={1.5} />, description: 'Konfiguration' },
];

export function Sidebar() {
  const currentScreen = useAppStore((state) => state.navigation.currentScreen);
  const setScreen = useAppStore((state) => state.setScreen);
  const jobs = useAppStore((state) => state.jobs);
  const [hoveredItem, setHoveredItem] = useState<AppScreen | null>(null);
  
  const runningJobs = jobs.filter((j) => j.status === 'running').length;
  const pendingJobs = jobs.filter((j) => j.status === 'pending').length;

  return (
    <aside className="w-60 bg-[#0a0a0c] border-r border-[#1a1a1f] flex flex-col relative overflow-hidden">
      {/* Decorative corners with glow */}
      <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-[#22ffaa] opacity-60" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-[#22ffaa] opacity-60" />
      
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#22ffaa]/[0.02] to-transparent pointer-events-none" />
      
      {/* Logo Section */}
      <div className="p-5 border-b border-[#1a1a1f] relative">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 border border-[#22ffaa]/60 flex items-center justify-center relative group">
            <Cpu size={20} className="text-[#22ffaa] transition-transform group-hover:scale-110" />
            {/* Corner accents */}
            <div className="absolute -top-px -left-px w-2 h-2 bg-[#22ffaa]" />
            <div className="absolute -bottom-px -right-px w-2 h-2 bg-[#22ffaa]" />
            {/* Glow effect */}
            <div className="absolute inset-0 bg-[#22ffaa]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h1 className="font-display text-sm font-bold text-[#22ffaa] tracking-wider uppercase flex items-center gap-2">
              GFOS
              <Zap size={12} className="text-[#22ffaa]/60" />
            </h1>
            <p className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase">
              Build System
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3">
        <div className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] px-3 mb-4 font-display flex items-center gap-2">
          <span className="w-1 h-1 bg-[#22ffaa]/40" />
          Navigation
        </div>
        <div className="space-y-1">
          {navItems.map((item, index) => {
            const isActive = currentScreen === item.id || 
              (item.id === 'PROJECTS' && currentScreen === 'PROJECT_DETAIL') ||
              (item.id === 'PROJECTS' && currentScreen === 'BUILD_CONFIG') ||
              (item.id === 'JOBS' && currentScreen === 'JOB_DETAIL') ||
              (item.id === 'PIPELINES' && currentScreen === 'PIPELINE_EDITOR');
            const isHovered = hoveredItem === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 
                  transition-all duration-200 group relative
                  animate-slide-right
                  ${isActive 
                    ? 'bg-[#22ffaa]/10 text-[#22ffaa]' 
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-[#151518]'
                  }
                `}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Active indicator line with glow */}
                <div 
                  className={`
                    absolute left-0 top-1/2 -translate-y-1/2 w-[3px] bg-[#22ffaa] 
                    transition-all duration-200
                    ${isActive ? 'h-6 shadow-[0_0_10px_#22ffaa]' : isHovered ? 'h-4 opacity-50' : 'h-0'}
                  `} 
                />
                
                {/* Shortcut number */}
                <span className={`
                  text-[10px] font-mono w-5 transition-colors
                  ${isActive ? 'text-[#22ffaa]/60' : isHovered ? 'text-zinc-500' : 'text-zinc-700'}
                `}>
                  {item.shortcut}
                </span>
                
                {/* Icon with transition */}
                <span className={`
                  transition-all duration-200
                  ${isActive ? 'text-[#22ffaa]' : 'text-zinc-600 group-hover:text-[#22ffaa]'}
                `}>
                  {item.icon}
                </span>
                
                {/* Label and description */}
                <div className="flex-1 text-left">
                  <span className={`
                    block text-xs font-medium tracking-wide uppercase transition-colors
                    ${isActive ? 'text-[#22ffaa]' : 'text-zinc-400 group-hover:text-zinc-200'}
                  `}>
                    {item.label}
                  </span>
                  <span className={`
                    block text-[9px] transition-all duration-200 overflow-hidden
                    ${isHovered || isActive ? 'max-h-4 opacity-100 mt-0.5' : 'max-h-0 opacity-0'}
                    ${isActive ? 'text-[#22ffaa]/50' : 'text-zinc-600'}
                  `}>
                    {item.description}
                  </span>
                </div>
                
                {/* Job counter for Prozesse */}
                {item.id === 'JOBS' && runningJobs > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-[#22ffaa] text-[#0a0a0c] animate-pulse-neon">
                    {runningJobs}
                  </span>
                )}
                
                {/* Chevron indicator */}
                <ChevronRight 
                  size={12} 
                  className={`
                    transition-all duration-200
                    ${isActive ? 'text-[#22ffaa]/60 translate-x-0' : isHovered ? 'text-zinc-500 translate-x-0' : '-translate-x-2 opacity-0'}
                  `} 
                />
              </button>
            );
          })}
        </div>
      </nav>

      {/* Status Footer */}
      <div className="p-4 border-t border-[#1a1a1f] bg-[#08080a]/50">
        <div className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] mb-3 font-display flex items-center gap-2">
          <span className="w-1 h-1 bg-zinc-600" />
          System Status
        </div>
        
        <div className="space-y-3">
          {/* Active indicator */}
          <div className="flex items-center justify-between group cursor-default">
            <div className="flex items-center gap-2">
              <div className={`
                w-2 h-2 rounded-sm transition-all
                ${runningJobs > 0 
                  ? 'bg-[#22ffaa] shadow-[0_0_8px_#22ffaa] animate-pulse' 
                  : 'bg-zinc-700'
                }
              `} />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider group-hover:text-zinc-400 transition-colors">
                Aktive Builds
              </span>
            </div>
            <span className={`
              text-xs font-mono tabular-nums transition-colors
              ${runningJobs > 0 ? 'text-[#22ffaa]' : 'text-zinc-700'}
            `}>
              {runningJobs}
            </span>
          </div>
          
          {/* Queue indicator */}
          <div className="flex items-center justify-between group cursor-default">
            <div className="flex items-center gap-2">
              <div className={`
                w-2 h-2 rounded-sm transition-all
                ${pendingJobs > 0 
                  ? 'bg-[#ffaa00] shadow-[0_0_8px_rgba(255,170,0,0.5)]' 
                  : 'bg-zinc-700'
                }
              `} />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider group-hover:text-zinc-400 transition-colors">
                In Warteschlange
              </span>
            </div>
            <span className={`
              text-xs font-mono tabular-nums transition-colors
              ${pendingJobs > 0 ? 'text-[#ffaa00]' : 'text-zinc-700'}
            `}>
              {pendingJobs}
            </span>
          </div>
        </div>
        
        {/* Version info with subtle hover */}
        <div className="mt-4 pt-3 border-t border-[#1a1a1f]/50 group cursor-default">
          <p className="text-[9px] text-zinc-700 font-mono group-hover:text-zinc-600 transition-colors">
            v1.0.0 // BUILD_2026
          </p>
        </div>
      </div>
    </aside>
  );
}
