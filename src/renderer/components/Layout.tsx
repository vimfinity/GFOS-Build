/**
 * Main Application Layout
 * Shared header with navigation and page wrapper
 */

import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, FolderGit2, Play, Settings, Workflow,
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
    <div className="gfos-page">
      {/* Liquid Glass Background */}
      <div className="gfos-bg">
        <div className="gfos-bg-base" />
        <div className="gfos-liquid gfos-liquid-1" />
        <div className="gfos-liquid gfos-liquid-2" />
        <div className="gfos-liquid gfos-liquid-3" />
        <div className="gfos-glass-noise" />
      </div>

      <div className="gfos-container">
        {/* Glass Header */}
        <motion.header 
          className="gfos-header"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="gfos-logo">
            <img src="./GFOS_Logo.svg" alt="GFOS" className="gfos-logo-icon" />
            <div className="gfos-logo-text">
              <span className="gfos-logo-primary">GFOS</span>
              <span className="gfos-logo-secondary">Build</span>
            </div>
          </div>

          <nav className="gfos-nav">
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
              icon={<Workflow size={18} />} 
              label="Pipelines"
              badge={stats.pipelineCount > 0 ? stats.pipelineCount : undefined}
              active={activeView === 'pipelines' || activeView === 'pipeline-editor'}
              onClick={() => setActiveView('pipelines')}
            />
          </nav>

          <div className="gfos-header-actions">
            {/* Search Button */}
            <button 
              className="gfos-search"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search size={18} />
              <span>Suchen...</span>
              <kbd className="gfos-search-kbd">
                <Command size={12} />K
              </kbd>
            </button>
            
            {/* Theme Toggle */}
            <button 
              className="gfos-icon-btn"
              onClick={cycleTheme}
              title={`Theme: ${getThemeLabel(theme)}`}
            >
              {getThemeIconComponent()}
            </button>
            
            {/* Settings */}
            <button 
              className={`gfos-icon-btn ${activeView === 'settings' ? 'gfos-icon-btn-active' : ''}`}
              onClick={() => setActiveView('settings')}
            >
              <Settings size={20} />
            </button>
          </div>
        </motion.header>

        {/* Main Content */}
        <main className="gfos-main">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              className="gfos-view-wrapper"
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
      className={`gfos-nav-tab ${active ? 'gfos-nav-active' : ''}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && <span className="gfos-nav-badge">{badge}</span>}
    </button>
  );
}
