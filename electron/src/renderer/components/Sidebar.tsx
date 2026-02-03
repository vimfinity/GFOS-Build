/**
 * Sidebar Component
 * 
 * Main navigation sidebar with menu items.
 */

import React from 'react';
import { useAppStore, type AppScreen } from '../store/useAppStore';
import { 
  Home, 
  FolderGit2, 
  ListTodo, 
  Settings, 
  ChevronRight,
  Hammer
} from 'lucide-react';

interface NavItem {
  id: AppScreen;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'HOME', label: 'Dashboard', icon: <Home size={20} /> },
  { id: 'PROJECTS', label: 'Projekte', icon: <FolderGit2 size={20} /> },
  { id: 'JOBS', label: 'Build Jobs', icon: <ListTodo size={20} /> },
  { id: 'SETTINGS', label: 'Einstellungen', icon: <Settings size={20} /> },
];

export function Sidebar() {
  const currentScreen = useAppStore((state) => state.navigation.currentScreen);
  const setScreen = useAppStore((state) => state.setScreen);
  const jobs = useAppStore((state) => state.jobs);
  
  const runningJobs = jobs.filter((j) => j.status === 'running').length;
  const pendingJobs = jobs.filter((j) => j.status === 'pending').length;

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-gfos-500 to-gfos-700 rounded-lg flex items-center justify-center">
            <Hammer size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">GFOS Build</h1>
            <p className="text-xs text-slate-400">Maven Build Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = currentScreen === item.id || 
            (item.id === 'PROJECTS' && currentScreen === 'PROJECT_DETAIL') ||
            (item.id === 'PROJECTS' && currentScreen === 'BUILD_CONFIG') ||
            (item.id === 'JOBS' && currentScreen === 'JOB_DETAIL');
          
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-all duration-150 group
                ${isActive 
                  ? 'bg-gfos-600 text-white shadow-lg shadow-gfos-600/20' 
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }
              `}
            >
              <span className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}>
                {item.icon}
              </span>
              <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
              {item.id === 'JOBS' && (runningJobs > 0 || pendingJobs > 0) && (
                <span className={`
                  px-2 py-0.5 text-xs font-medium rounded-full
                  ${runningJobs > 0 ? 'bg-yellow-500 text-yellow-900' : 'bg-slate-600 text-slate-200'}
                `}>
                  {runningJobs > 0 ? runningJobs : pendingJobs}
                </span>
              )}
              {isActive && <ChevronRight size={16} className="text-gfos-200" />}
            </button>
          );
        })}
      </nav>

      {/* Status Footer */}
      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 space-y-1">
          <div className="flex justify-between">
            <span>Aktive Jobs:</span>
            <span className={runningJobs > 0 ? 'text-yellow-400' : 'text-slate-500'}>
              {runningJobs}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Wartend:</span>
            <span className="text-slate-500">{pendingJobs}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
