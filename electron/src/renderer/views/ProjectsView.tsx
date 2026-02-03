/**
 * Projects View
 * 
 * Lists all discovered projects with filtering.
 */

import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  FolderGit2, 
  Search, 
  FileCode2,
  GitBranch,
  ArrowRight,
  FolderOpen
} from 'lucide-react';

export function ProjectsView() {
  const projects = useAppStore((state) => state.projects);
  const setScreen = useAppStore((state) => state.setScreen);
  const selectProject = useAppStore((state) => state.selectProject);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'maven' | 'git'>('all');

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!project.name.toLowerCase().includes(query) && 
            !project.path.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // Type filter
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
    window.electronAPI.openPath(path);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Projekt suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:border-gfos-500 focus:ring-1 focus:ring-gfos-500 transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
          <FilterButton 
            active={filter === 'all'} 
            onClick={() => setFilter('all')}
          >
            Alle ({projects.length})
          </FilterButton>
          <FilterButton 
            active={filter === 'maven'} 
            onClick={() => setFilter('maven')}
          >
            Maven ({projects.filter(p => p.hasPom).length})
          </FilterButton>
          <FilterButton 
            active={filter === 'git'} 
            onClick={() => setFilter('git')}
          >
            Git ({projects.filter(p => p.isGitRepo).length})
          </FilterButton>
        </div>
      </div>

      {/* Project List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center">
            <FolderGit2 size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">
              {searchQuery ? 'Keine Projekte gefunden' : 'Keine Projekte vorhanden'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Überprüfe den Scan-Pfad in den Einstellungen
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredProjects.map((project) => (
              <button
                key={project.path}
                onClick={() => handleProjectClick(project.path)}
                className="w-full flex items-center gap-4 p-4 hover:bg-slate-700/50 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center group-hover:bg-gfos-600 transition-colors">
                  <FolderGit2 size={24} className="text-slate-400 group-hover:text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium text-white truncate">
                      {project.name}
                    </h3>
                    {project.hasPom && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-orange-500/20 text-orange-400 rounded">
                        Maven
                      </span>
                    )}
                    {project.isGitRepo && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded">
                        Git
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 truncate mt-0.5">{project.path}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleOpenFolder(e, project.path)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
                    title="Im Explorer öffnen"
                  >
                    <FolderOpen size={18} />
                  </button>
                  <ArrowRight size={20} className="text-slate-500 group-hover:text-gfos-400 transition-colors" />
                </div>
              </button>
            ))}
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
        px-3 py-1.5 text-sm font-medium rounded-md transition-colors
        ${active 
          ? 'bg-gfos-600 text-white' 
          : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }
      `}
    >
      {children}
    </button>
  );
}
