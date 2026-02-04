/**
 * Projects View
 * 
 * Terminal-style project listing with search and filters.
 */

import React, { useState, useMemo } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import { 
  FolderCode, 
  Search, 
  GitBranch,
  ChevronRight,
  ExternalLink,
  Database,
  Filter
} from 'lucide-react';

export function ProjectsView() {
  const projects = useAppStore((state) => state.projects);
  const setScreen = useAppStore((state) => state.setScreen);
  const selectProject = useAppStore((state) => state.selectProject);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'maven' | 'git'>('all');

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
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database size={14} className="text-neon-green" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-display">Repository Index</span>
          </div>
          <h1 className="font-display text-xl font-bold text-zinc-100 uppercase tracking-wide">
            Projekte
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Total</p>
          <p className="text-lg text-neon-green font-mono">{projects.length}</p>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="search://projekt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
        
        <div className="flex items-center border border-terminal-border">
          <div className="px-3 py-2 border-r border-terminal-border">
            <Filter size={12} className="text-zinc-600" />
          </div>
          <FilterButton 
            active={filter === 'all'} 
            onClick={() => setFilter('all')}
          >
            ALL [{projects.length}]
          </FilterButton>
          <FilterButton 
            active={filter === 'maven'} 
            onClick={() => setFilter('maven')}
          >
            MVN [{projects.filter(p => p.hasPom).length}]
          </FilterButton>
          <FilterButton 
            active={filter === 'git'} 
            onClick={() => setFilter('git')}
          >
            GIT [{projects.filter(p => p.isGitRepo).length}]
          </FilterButton>
        </div>
      </div>

      {/* Project List */}
      <div className="card">
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center">
            <FolderCode size={32} className="mx-auto text-zinc-700 mb-4" />
            <p className="text-zinc-500 text-sm">
              {searchQuery ? '> Keine Ergebnisse für Query' : '> Keine Projekte indiziert'}
            </p>
            <p className="text-[10px] text-zinc-600 mt-2 font-mono">
              Überprüfe scan_root_path in /config
            </p>
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-terminal-border bg-terminal-mid text-[9px] text-zinc-600 uppercase tracking-[0.15em] font-display">
              <span className="w-8">#</span>
              <span className="flex-1">Projekt</span>
              <span className="w-16 text-center">Type</span>
              <span className="w-20 text-right">Actions</span>
            </div>
            
            {/* Table Body */}
            <div>
              {filteredProjects.map((project, i) => (
                <button
                  key={project.path}
                  onClick={() => handleProjectClick(project.path)}
                  className={`
                    w-full flex items-center gap-4 px-4 py-3
                    hover:bg-terminal-mid transition-colors text-left group
                    border-b border-terminal-border/50 last:border-b-0
                    animate-slide-up stagger-${Math.min(i + 1, 6)}
                  `}
                >
                  {/* Index */}
                  <span className="w-8 text-[10px] text-zinc-700 font-mono">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  
                  {/* Project Info */}
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <FolderCode 
                      size={18} 
                      className="text-zinc-600 group-hover:text-neon-green transition-colors flex-shrink-0" 
                    />
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
                  <div className="w-16 flex items-center justify-center gap-1">
                    {project.hasPom && (
                      <span className="tag tag-orange text-[8px] px-1.5 py-0.5">
                        MVN
                      </span>
                    )}
                    {project.isGitRepo && (
                      <span className="tag tag-cyan text-[8px] px-1.5 py-0.5">
                        GIT
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="w-20 flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => handleOpenFolder(e, project.path)}
                      className="p-1.5 text-zinc-600 hover:text-neon-cyan transition-colors"
                      title="Im Explorer öffnen"
                    >
                      <ExternalLink size={14} />
                    </button>
                    <ChevronRight 
                      size={14} 
                      className="text-zinc-700 group-hover:text-neon-green transition-colors" 
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterButton({ active, onClick, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors
        ${active 
          ? 'bg-neon-green text-terminal-black' 
          : 'text-zinc-500 hover:text-neon-green hover:bg-terminal-mid'
        }
      `}
    >
      {children}
    </button>
  );
}
