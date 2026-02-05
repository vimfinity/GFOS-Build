/**
 * Main Application Layout - Tailwind v4
 * Shared header with navigation and page wrapper
 */

import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, FolderGit2, Play, Settings, Workflow, Coffee,
  Search, Sun, Moon, Monitor, Command
} from 'lucide-react';
import { useAppStore, useStats } from '../store/useAppStore';
import { useTheme, getThemeIcon, getThemeLabel } from '../hooks/useTheme';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { 
    activeView, 
    setActiveView, 
    setIsSearchOpen,
  } = useAppStore();
  const stats = useStats();
  const { theme, cycleTheme } = useTheme();

  const getThemeIconComponent = () => {
    const iconType = getThemeIcon(theme);
    switch (iconType) {
      case 'sun': return <Sun size={20} />;
      case 'moon': return <Moon size={20} />;
      case 'monitor': return <Monitor size={20} />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-petrol-50/30 via-light-100 to-petrol-100/20 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900 relative overflow-x-hidden font-sans">
      {/* Liquid Glass Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_0%_0%,rgba(0,125,143,0.08),transparent_50%),radial-gradient(ellipse_80%_80%_at_100%_100%,rgba(0,163,184,0.06),transparent_40%)]" />
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[100px] bg-[radial-gradient(circle,rgba(0,125,143,0.18),transparent_60%)] -top-[200px] -left-[100px] animate-flow" />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-[100px] bg-[radial-gradient(circle,rgba(0,163,184,0.15),transparent_60%)] -bottom-[150px] -right-[50px] animate-flow [animation-delay:-8s]" />
        <div className="absolute w-[400px] h-[400px] rounded-full blur-[100px] bg-[radial-gradient(circle,rgba(0,140,158,0.12),transparent_60%)] top-[40%] right-[30%] animate-flow [animation-delay:-16s]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Glass Header */}
        <motion.header 
          className="flex items-center justify-between px-6 lg:px-12 py-4 bg-white/50 dark:bg-dark-800/50 backdrop-blur-xl border-b border-white/60 dark:border-white/10 sticky top-0 z-50"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3.5">
            <img src="./GFOS_Logo.svg" alt="GFOS" className="h-10 w-auto" />
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-petrol-500">GFOS</span>
              <span className="text-2xl font-light text-dark-700 dark:text-light-200">Build</span>
            </div>
          </div>

          <nav className="flex gap-1 p-1.5 bg-white/50 dark:bg-dark-700/50 rounded-2xl border border-white/80 dark:border-dark-600">
            <NavTab 
              icon={<LayoutGrid size={18} />} 
              label="Overview" 
              active={activeView === 'overview'}
              onClick={() => setActiveView('overview')}
            />
            <NavTab 
              icon={<FolderGit2 size={18} />} 
              label="Projects"
              badge={stats.mavenProjects}
              active={activeView === 'projects'}
              onClick={() => setActiveView('projects')}
            />
            <NavTab 
              icon={<Play size={18} />} 
              label="Builds"
              badge={stats.activeBuilds > 0 ? stats.activeBuilds : undefined}
              active={activeView === 'builds' || activeView === 'job-log'}
              onClick={() => setActiveView('builds')}
            />
            <NavTab 
              icon={<Coffee size={18} />} 
              label="JDKs"
              badge={stats.jdkCount}
              active={activeView === 'jdks'}
              onClick={() => setActiveView('jdks')}
            />
            <NavTab 
              icon={<Workflow size={18} />} 
              label="Pipelines"
              badge={stats.pipelineCount > 0 ? stats.pipelineCount : undefined}
              active={activeView === 'pipelines' || activeView === 'pipeline-editor'}
              onClick={() => setActiveView('pipelines')}
            />
          </nav>

          <div className="flex items-center gap-3">
            {/* Search Button */}
            <button 
              className="flex items-center gap-2.5 px-4 py-2.5 bg-white/60 dark:bg-dark-700 border border-white/80 dark:border-dark-600 rounded-xl w-56 text-left transition-all hover:bg-white dark:hover:bg-dark-600 hover:shadow-[0_4px_20px_rgba(0,125,143,0.1)]"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search size={18} className="text-dark-300" />
              <span className="flex-1 text-sm text-dark-300">Suchen...</span>
              <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-light-200 dark:bg-dark-600 text-dark-400 rounded border border-light-400 dark:border-dark-500">
                <Command size={10} />K
              </kbd>
            </button>
            
            {/* Theme Toggle */}
            <button 
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/60 dark:bg-dark-700 border border-white/80 dark:border-dark-600 text-dark-300 hover:bg-white dark:hover:bg-dark-600 hover:text-petrol-500 transition-all"
              onClick={cycleTheme}
              title={`Theme: ${getThemeLabel(theme)}`}
            >
              {getThemeIconComponent()}
            </button>
            
            {/* Settings */}
            <button 
              className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
                activeView === 'settings' 
                  ? 'bg-petrol-500 text-white border-petrol-500' 
                  : 'bg-white/60 dark:bg-dark-700 border-white/80 dark:border-dark-600 text-dark-300 hover:bg-white dark:hover:bg-dark-600 hover:text-petrol-500'
              }`}
              onClick={() => setActiveView('settings')}
            >
              <Settings size={20} />
            </button>
          </div>
        </motion.header>

        {/* Main Content */}
        <main className="flex-1 px-6 lg:px-12 py-8 flex flex-col gap-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              className="flex flex-col gap-7 flex-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

/* Navigation Tab Component */
function NavTab({ 
  icon, 
  label, 
  badge, 
  active, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  badge?: number; 
  active?: boolean; 
  onClick: () => void;
}) {
  return (
    <button 
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
        active 
          ? 'bg-white dark:bg-dark-600 text-petrol-500 shadow-[0_4px_16px_rgba(0,125,143,0.15)]' 
          : 'text-dark-400 dark:text-light-400 hover:text-petrol-500 hover:bg-petrol-50/50 dark:hover:bg-petrol-900/20'
      }`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
          active 
            ? 'bg-petrol-100 dark:bg-petrol-800/50 text-petrol-600' 
            : 'bg-petrol-50 dark:bg-petrol-900/30 text-petrol-500'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}
