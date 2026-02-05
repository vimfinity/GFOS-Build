/**
 * Projects View
 * 
 * Terminal-style project listing with search and filters - Polished.
 */

import React, { useState, useMemo } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import { 
  FolderGit2,
  Search,
  ChevronRight,
  ExternalLink,
  Database,
  Filter,
  X
} from 'lucide-react';

export function ProjectsView() {
  const projects = useAppStore((state) => state.projects);
  const setScreen = useAppStore((state) => state.setScreen);
  const selectProject = useAppStore((state) => state.selectProject);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'maven' | 'git'>('all');
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        // Search in name
        if (project.name.toLowerCase().includes(query)) return true;
        // Search in full path
        if (project.path.toLowerCase().includes(query)) return true;
        // Search in relative path (for better disambiguation)
        if (project.relativePath?.toLowerCase().includes(query)) return true;
        // Search in individual path segments
        const pathParts = project.path.split(/[/\\]/);
        if (pathParts.some(part => part.toLowerCase().includes(query))) return true;
        return false;
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
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Database size={14} className="text-[#22ffaa]" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-display">Repository Index</span>
          </div>
          <h1 className="font-display text-xl font-bold text-zinc-100 uppercase tracking-wide">
            Projekte
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Indexed</p>
          <p className="text-lg text-[#22ffaa] font-mono tabular-nums">{projects.length}</p>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#22ffaa] transition-colors" />
          <input
            type="text"
            placeholder="search://projekt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="
              w-full py-2.5 px-10 bg-[#0a0a0c] border border-[#1a1a1f] text-sm text-zinc-200 font-mono
              placeholder:text-zinc-600
              focus:border-[#22ffaa] focus:bg-[#0c0c0e]
              focus:shadow-[0_0_0_3px_rgba(34,255,170,0.1),0_0_20px_rgba(34,255,170,0.1)]
              transition-all outline-none
            "
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        <div className="flex items-center border border-[#1a1a1f] bg-[#0a0a0c]">
          <div className="px-3 py-2.5 border-r border-[#1a1a1f]">
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
      <div className="bg-[#0c0c0e] border border-[#1a1a1f]">
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center">
            <FolderGit2 size={32} className="mx-auto text-zinc-700 mb-4" />
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
            <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[#1a1a1f] bg-[#0a0a0c] text-[9px] text-zinc-600 uppercase tracking-[0.15em] font-display">
              <span className="w-8">#</span>
              <span className="flex-1">Projekt</span>
              <span className="w-20 text-center">Type</span>
              <span className="w-20 text-right">Actions</span>
            </div>
            
            {/* Table Body */}
            <div>
              {filteredProjects.map((project, i) => {
                const isHovered = hoveredProject === project.path;
                
                return (
                  <button
                    key={project.path}
                    onClick={() => handleProjectClick(project.path)}
                    onMouseEnter={() => setHoveredProject(project.path)}
                    onMouseLeave={() => setHoveredProject(null)}
                    className={`
                      w-full flex items-center gap-4 px-5 py-3.5
                      transition-all duration-150 text-left
                      border-b border-[#1a1a1f]/50 last:border-b-0
                      ${isHovered ? 'bg-[#151518]' : ''}
                    `}
                    style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
                  >
                    {/* Line indicator */}
                    <div className={`
                      w-[2px] h-8 bg-[#22ffaa] absolute left-0 transition-all
                      ${isHovered ? 'opacity-100' : 'opacity-0'}
                    `} />
                    
                    {/* Index */}
                    <span className={`
                      w-8 text-[10px] font-mono tabular-nums transition-colors
                      ${isHovered ? 'text-zinc-500' : 'text-zinc-700'}
                    `}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    
                    {/* Project Info */}
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <FolderGit2 
                        size={18} 
                        className={`flex-shrink-0 transition-all ${isHovered ? 'text-[#22ffaa] scale-110' : 'text-zinc-600'}`}
                      />
                      <div className="min-w-0">
                        <h3 className={`text-sm truncate transition-colors ${isHovered ? 'text-[#22ffaa]' : 'text-zinc-300'}`}>
                          {project.name}
                        </h3>
                        <p className="text-[10px] text-zinc-600 truncate font-mono">
                          {project.path}
                        </p>
                      </div>
                    </div>

                    {/* Type Tags */}
                    <div className="w-20 flex items-center justify-center gap-1.5">
                      {project.hasPom && (
                        <span className={`
                          px-2 py-0.5 text-[8px] font-mono uppercase tracking-wider border
                          transition-all
                          ${isHovered 
                            ? 'text-[#ffaa00] border-[#ffaa00]/50 bg-[#ffaa00]/10' 
                            : 'text-[#ffaa00]/70 border-[#ffaa00]/30 bg-transparent'
                          }
                        `}>
                          MVN
                        </span>
                      )}
                      {project.isGitRepo && (
                        <span className={`
                          px-2 py-0.5 text-[8px] font-mono uppercase tracking-wider border
                          transition-all
                          ${isHovered 
                            ? 'text-[#00d4ff] border-[#00d4ff]/50 bg-[#00d4ff]/10' 
                            : 'text-[#00d4ff]/70 border-[#00d4ff]/30 bg-transparent'
                          }
                        `}>
                          GIT
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="w-20 flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => handleOpenFolder(e, project.path)}
                        className={`
                          p-1.5 transition-all rounded
                          ${isHovered 
                            ? 'text-[#22ffaa] hover:bg-[#22ffaa]/10' 
                            : 'text-zinc-700 hover:text-zinc-500'
                          }
                        `}
                        title="Im Explorer öffnen"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <ChevronRight 
                        size={14} 
                        className={`
                          transition-all
                          ${isHovered ? 'text-[#22ffaa] translate-x-0' : 'text-zinc-700 -translate-x-1 opacity-0'}
                        `}
                      />
                    </div>
                  </button>
                );
              })}
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
        px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider transition-all relative
        ${active 
          ? 'bg-[#22ffaa] text-[#0a0a0c] font-medium' 
          : 'text-zinc-500 hover:text-[#22ffaa] hover:bg-[#151518]'
        }
      `}
    >
      {children}
    </button>
  );
}
