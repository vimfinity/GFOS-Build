/**
 * Projects View - Premium Edition
 * 
 * Terminal-style project listing with advanced animations and search.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup, Variants } from 'framer-motion';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import { 
  FolderGit2, 
  Search, 
  ChevronRight,
  ExternalLink,
  Database,
  Filter,
  X,
  Sparkles
} from 'lucide-react';

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -20, scale: 0.98 },
  visible: { 
    opacity: 1, 
    x: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

export function ProjectsView() {
  const projects = useAppStore((state) => state.projects);
  const setScreen = useAppStore((state) => state.setScreen);
  const selectProject = useAppStore((state) => state.selectProject);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'maven' | 'git'>('all');
  const [searchFocused, setSearchFocused] = useState(false);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!project.name.toLowerCase().includes(query) && 
            !project.path.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      if (filter === 'maven' && !project.hasPom) return false;
      if (filter === 'git' && !project.isGitRepo) return false;
      
      return true;
    });
  }, [projects, searchQuery, filter]);

  const handleProjectClick = (projectPath: string) => {
    selectProject(projectPath);
    setScreen('PROJECT_DETAIL');
  };

  const handleOpenFolder = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    api.openPath(path);
  };

  return (
    <motion.div 
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            >
              <Database size={14} className="text-neon-green" />
            </motion.div>
            <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-display">Repository Index</span>
          </div>
          <h1 className="font-display text-xl font-bold text-zinc-100 uppercase tracking-wide">
            Projekte
          </h1>
        </div>
        <motion.div 
          className="text-right"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Total</p>
          <motion.p 
            className="text-lg text-neon-green font-mono"
            key={projects.length}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {projects.length}
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Search and Filter Bar */}
      <motion.div 
        className="flex items-center gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <motion.div 
          className="flex-1 relative"
          animate={{ scale: searchFocused ? 1.01 : 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <motion.div
            animate={{ x: searchFocused ? 2 : 0, color: searchFocused ? "#00ff88" : "#52525b" }}
          >
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" />
          </motion.div>
          <input
            type="text"
            placeholder="search://projekt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={`input pl-9 pr-9 text-sm transition-all duration-200 ${
              searchFocused ? 'border-neon-green/50 shadow-[0_0_15px_rgba(0,255,136,0.15)]' : ''
            }`}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-neon-red transition-colors"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.8 }}
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
        
        <motion.div 
          className="flex items-center border border-terminal-border overflow-hidden"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="px-3 py-2 border-r border-terminal-border bg-terminal-mid/50">
            <Filter size={12} className="text-zinc-600" />
          </div>
          <LayoutGroup>
            <FilterButton 
              active={filter === 'all'} 
              onClick={() => setFilter('all')}
              layoutId="filter-indicator"
            >
              ALL [{projects.length}]
            </FilterButton>
            <FilterButton 
              active={filter === 'maven'} 
              onClick={() => setFilter('maven')}
              layoutId="filter-indicator"
            >
              MVN [{projects.filter(p => p.hasPom).length}]
            </FilterButton>
            <FilterButton 
              active={filter === 'git'} 
              onClick={() => setFilter('git')}
              layoutId="filter-indicator"
            >
              GIT [{projects.filter(p => p.isGitRepo).length}]
            </FilterButton>
          </LayoutGroup>
        </motion.div>
      </motion.div>

      {/* Project List */}
      <motion.div 
        className="card overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <AnimatePresence mode="wait">
          {filteredProjects.length === 0 ? (
            <motion.div 
              className="p-12 text-center"
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <FolderGit2 size={32} className="mx-auto text-zinc-700 mb-4" />
              </motion.div>
              <p className="text-zinc-500 text-sm">
                {searchQuery ? '> Keine Ergebnisse für Query' : '> Keine Projekte indiziert'}
              </p>
              <p className="text-[10px] text-zinc-600 mt-2 font-mono">
                Überprüfe scan_root_path in /config
              </p>
            </motion.div>
          ) : (
            <motion.div key="list">
              {/* Table Header */}
              <motion.div 
                className="flex items-center gap-4 px-4 py-2 border-b border-terminal-border bg-terminal-mid/80 text-[9px] text-zinc-600 uppercase tracking-[0.15em] font-display"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                <span className="w-8">#</span>
                <span className="flex-1">Projekt</span>
                <span className="w-16 text-center">Type</span>
                <span className="w-20 text-right">Actions</span>
              </motion.div>
              
              {/* Table Body */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <AnimatePresence>
                  {filteredProjects.map((project, i) => (
                    <motion.button
                      key={project.path}
                      variants={rowVariants}
                      layout
                      onClick={() => handleProjectClick(project.path)}
                      className="w-full flex items-center gap-4 px-4 py-3
                               hover:bg-terminal-mid/80 transition-colors text-left group
                               border-b border-terminal-border/50 last:border-b-0
                               relative overflow-hidden"
                      whileHover={{ 
                        x: 4, 
                        backgroundColor: "rgba(0, 255, 136, 0.03)" 
                      }}
                      whileTap={{ scale: 0.995 }}
                    >
                      {/* Hover glow effect */}
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-r from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none"
                        transition={{ duration: 0.2 }}
                      />
                      
                      {/* Index */}
                      <span className="w-8 text-[10px] text-zinc-700 font-mono relative z-10">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      
                      {/* Project Info */}
                      <div className="flex-1 min-w-0 flex items-center gap-3 relative z-10">
                        <motion.div
                          whileHover={{ rotate: 15, scale: 1.1 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <FolderGit2 
                            size={18} 
                            className="text-zinc-600 group-hover:text-neon-green transition-colors flex-shrink-0" 
                          />
                        </motion.div>
                        <div className="min-w-0">
                          <h3 className="text-sm text-zinc-300 group-hover:text-neon-green truncate transition-colors">
                            {project.name}
                          </h3>
                          <p className="text-[10px] text-zinc-600 truncate font-mono">
                            {project.path}
                          </p>
                        </div>
                      </div>

                      {/* Type Tags */}
                      <div className="w-16 flex items-center justify-center gap-1 relative z-10">
                        {project.hasPom && (
                          <motion.span 
                            className="tag tag-orange text-[8px] px-1.5 py-0.5"
                            whileHover={{ scale: 1.1 }}
                          >
                            MVN
                          </motion.span>
                        )}
                        {project.isGitRepo && (
                          <motion.span 
                            className="tag tag-cyan text-[8px] px-1.5 py-0.5"
                            whileHover={{ scale: 1.1 }}
                          >
                            GIT
                          </motion.span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="w-20 flex items-center justify-end gap-1 relative z-10">
                        <motion.button
                          onClick={(e) => handleOpenFolder(e, project.path)}
                          className="p-1.5 text-zinc-600 hover:text-neon-cyan transition-colors"
                          title="Im Explorer öffnen"
                          whileHover={{ scale: 1.2, rotate: 5 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <ExternalLink size={14} />
                        </motion.button>
                        <motion.div
                          initial={{ x: -5, opacity: 0 }}
                          animate={{ x: 0, opacity: 0.3 }}
                          whileHover={{ x: 0, opacity: 1 }}
                        >
                          <ChevronRight 
                            size={14} 
                            className="text-neon-green" 
                          />
                        </motion.div>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {/* Filter Results Info */}
      <AnimatePresence>
        {(searchQuery || filter !== 'all') && (
          <motion.div
            className="flex items-center justify-center gap-2 text-[10px] text-zinc-600"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Sparkles size={10} className="text-neon-green/50" />
            <span>
              {filteredProjects.length} von {projects.length} Projekten
              {searchQuery && ` für "${searchQuery}"`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  layoutId: string;
}

function FilterButton({ active, onClick, children, layoutId }: FilterButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className={`
        px-3 py-2 text-[10px] font-mono uppercase tracking-wider transition-all relative
        ${active 
          ? 'text-terminal-black font-semibold' 
          : 'text-zinc-500 hover:text-zinc-300'
        }
      `}
      whileHover={!active ? { backgroundColor: "rgba(255,255,255,0.05)" } : {}}
      whileTap={{ scale: 0.95 }}
    >
      {active && (
        <motion.div
          layoutId={layoutId}
          className="absolute inset-0 bg-neon-green"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
