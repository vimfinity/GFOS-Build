/**
 * Project Detail View - Terminal-Neon Design
 * 
 * Repository inspection with module discovery and fuzzy search.
 */

import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import { Search, X, Package, RefreshCw, ExternalLink, Play, Loader2 } from 'lucide-react';
import type { MavenModule } from '../types';

export function ProjectDetailView() {
  const selectedProjectPath = useAppStore((state) => state.selectedProjectPath);
  const projects = useAppStore((state) => state.projects);
  const modulesByProject = useAppStore((state) => state.modulesByProject);
  const setModules = useAppStore((state) => state.setModules);
  const setScreen = useAppStore((state) => state.setScreen);
  
  const [loading, setLoading] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');

  const project = projects.find((p) => p.path === selectedProjectPath);
  const modules = selectedProjectPath ? modulesByProject[selectedProjectPath] || [] : [];

  // Fuzzy search for modules - search by artifactId, displayName, relativePath, and directory names
  const filteredModules = useMemo(() => {
    if (!moduleSearch.trim()) return modules;
    const search = moduleSearch.toLowerCase();
    return modules.filter(mod => {
      // Search in artifactId
      if (mod.artifactId.toLowerCase().includes(search)) return true;
      // Search in displayName
      if (mod.displayName.toLowerCase().includes(search)) return true;
      // Search in full relativePath
      if (mod.relativePath.toLowerCase().includes(search)) return true;
      // Search in individual directory names
      const pathParts = mod.relativePath.split('/');
      if (pathParts.some(part => part.toLowerCase().includes(search))) return true;
      // Search in groupId
      if (mod.groupId.toLowerCase().includes(search)) return true;
      return false;
    });
  }, [modules, moduleSearch]);

  useEffect(() => {
    if (project?.pomPath && !modulesByProject[project.path]) {
      loadModules();
    }
  }, [project]);

  const loadModules = async () => {
    if (!project?.pomPath) return;
    
    setLoading(true);
    try {
      const modules = await api.scanModules(project.pomPath);
      setModules(project.path, modules);
    } catch (error) {
      console.error('Failed to load modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildProject = () => {
    setScreen('BUILD_CONFIG', { projectPath: project?.path, module: null });
  };

  const handleBuildModule = (module: MavenModule) => {
    setScreen('BUILD_CONFIG', { projectPath: project?.path, module: module.relativePath });
  };

  const handleOpenFolder = () => {
    if (project) {
      api.openPath(project.path);
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64 bg-[#0c0c0e] border border-[#1a1a1f]">
        <div className="text-center">
          <div className="text-4xl text-zinc-700 mb-2 font-mono">404</div>
          <p className="text-zinc-500 font-mono text-sm">PROJECT_NOT_FOUND</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Project Header */}
      <div className="bg-[#0c0c0e] border border-[#1a1a1f]">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1a1a1f] text-xs font-mono">
          <span className="text-[#22ffaa]">▸</span>
          <span className="text-zinc-400">{project.name}</span>
          <span className="text-zinc-600">//</span>
          <span className="text-zinc-500">REPO_INFO</span>
        </div>
        
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="w-16 h-16 border-2 border-[#22ffaa] flex items-center justify-center bg-[#080808]">
                <span className="text-[#22ffaa] text-2xl font-mono">
                  {project.isGitRepo ? '⎇' : '◆'}
                </span>
              </div>
              
              <div>
                <h2 className="text-xl font-mono text-zinc-100">{project.name}</h2>
                <p className="text-zinc-500 font-mono text-sm mt-1 truncate max-w-lg">
                  {project.path}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {project.hasPom && (
                    <span className="px-2 py-0.5 text-[9px] font-mono uppercase border border-[#ffaa00]/50 text-[#ffaa00] bg-[#ffaa00]/10">
                      MVN
                    </span>
                  )}
                  {project.isGitRepo && (
                    <span className="px-2 py-0.5 text-[9px] font-mono uppercase border border-[#00d4ff]/50 text-[#00d4ff] bg-[#00d4ff]/10">
                      GIT
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenFolder}
                className="flex items-center gap-2 px-3 py-2 border border-[#1a1a1f] text-zinc-400 text-xs font-mono
                           hover:border-[#27272b] hover:text-zinc-300 transition-all"
              >
                <ExternalLink size={12} />
                <span>OPEN</span>
              </button>
              {project.hasPom && (
                <button
                  onClick={handleBuildProject}
                  className="flex items-center gap-2 px-3 py-2 border border-[#22ffaa] text-[#22ffaa] text-xs font-mono
                             hover:bg-[#22ffaa]/10 transition-all"
                >
                  <Play size={12} />
                  <span>BUILD_ALL</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Project Info */}
      <div className="grid grid-cols-3 gap-2">
        <InfoCard label="TYPE" value={project.hasPom ? 'MAVEN_PROJECT' : 'REPOSITORY'} />
        <InfoCard label="MODULES" value={String(modules.length)} />
        <InfoCard label="STATUS" value="READY" accent />
      </div>

      {/* Modules Section */}
      {project.hasPom && (
        <div className="bg-[#0c0c0e] border border-[#1a1a1f]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1f]">
            <div className="flex items-center gap-2 text-xs font-mono">
              <Package size={14} className="text-[#00d4ff]" />
              <span className="text-zinc-400">MODULES</span>
              <span className="text-zinc-600">[{modules.length}]</span>
              {filteredModules.length !== modules.length && (
                <span className="text-[#22ffaa]">→ {filteredModules.length} gefiltert</span>
              )}
            </div>
            <button
              onClick={loadModules}
              disabled={loading}
              className="flex items-center gap-1 text-zinc-500 hover:text-[#00d4ff] transition-colors font-mono text-xs disabled:opacity-50"
              title="Reload modules"
            >
              {loading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              <span>{loading ? 'SCANNING...' : 'REFRESH'}</span>
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="px-4 py-3 border-b border-[#1a1a1f]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-[#080808] border border-[#1a1a1f] text-zinc-200 text-sm font-mono
                           placeholder:text-zinc-600 focus:border-[#00d4ff] focus:outline-none
                           focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)] transition-all"
                placeholder={`${modules.length} Module durchsuchen... (Name, Pfad, Verzeichnis)`}
              />
              {moduleSearch && (
                <button
                  onClick={() => setModuleSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          
          {/* Table Header */}
          <div className="grid grid-cols-[auto_1fr_120px_100px_80px] gap-4 px-4 py-2 
                          border-b border-[#1a1a1f] text-xs text-zinc-600 font-mono uppercase">
            <div className="w-8">#</div>
            <div>Artifact</div>
            <div>Group</div>
            <div>Packaging</div>
            <div className="text-right">Action</div>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="text-[#00d4ff] animate-pulse font-mono text-xl mb-2">◐</div>
              <p className="text-zinc-500 text-sm font-mono">SCANNING_MODULES...</p>
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl text-zinc-700 mb-4 font-mono">[ ]</div>
              <p className="text-zinc-500 font-mono text-sm">
                {moduleSearch ? 'KEINE_TREFFER' : 'NO_MODULES_FOUND'}
              </p>
              <p className="text-zinc-600 text-xs mt-2 font-mono">
                {moduleSearch 
                  ? `Keine Module für "${moduleSearch}" gefunden` 
                  : 'This may be a single-module project'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a1a1f]/50 max-h-[500px] overflow-auto">
              {filteredModules.map((module, index) => (
                <div
                  key={module.pomPath}
                  className="grid grid-cols-[auto_1fr_120px_100px_80px] gap-4 px-4 py-3
                             hover:bg-[#151518] transition-colors group"
                >
                  {/* Index */}
                  <div className="w-8 text-zinc-600 font-mono text-sm">
                    {String(index + 1).padStart(2, '0')}
                  </div>

                  {/* Artifact Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-[#ffaa00] flex-shrink-0" />
                      <span className="text-zinc-200 font-mono text-sm truncate group-hover:text-[#22ffaa] transition-colors">
                        {module.artifactId}
                      </span>
                    </div>
                    {module.relativePath && module.relativePath !== '.' && (
                      <p className="text-zinc-600 text-xs font-mono mt-0.5 truncate pl-6">
                        ./{module.relativePath}
                      </p>
                    )}
                  </div>

                  {/* Group ID */}
                  <div className="flex items-center">
                    <span className="text-zinc-500 text-xs font-mono truncate">
                      {module.groupId.split('.').pop()}
                    </span>
                  </div>

                  {/* Packaging */}
                  <div className="flex items-center">
                    <span className={`px-1.5 py-0.5 text-[10px] font-mono border ${
                      module.packaging === 'jar' 
                        ? 'border-[#22ffaa]/30 text-[#22ffaa] bg-[#22ffaa]/10'
                        : module.packaging === 'war'
                        ? 'border-[#00d4ff]/30 text-[#00d4ff] bg-[#00d4ff]/10'
                        : module.packaging === 'ear'
                        ? 'border-[#b066ff]/30 text-[#b066ff] bg-[#b066ff]/10'
                        : 'border-zinc-700 text-zinc-400 bg-zinc-800/50'
                    }`}>
                      {module.packaging.toUpperCase()}
                    </span>
                  </div>

                  {/* Build Action */}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => handleBuildModule(module)}
                      className="text-zinc-500 hover:text-[#22ffaa] transition-colors font-mono text-xs"
                    >
                      [BUILD]
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Footer */}
          <div className="px-4 py-2 border-t border-[#1a1a1f] text-xs font-mono text-zinc-600">
            {modules.length > 0 ? (
              <span>
                {filteredModules.length === modules.length 
                  ? `Total: ${modules.length} modules` 
                  : `Zeige ${filteredModules.length} von ${modules.length} modules`
                }
                {' '} • Click BUILD to start individual module builds
              </span>
            ) : (
              <span>Use [REFRESH] to rescan project structure</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface InfoCardProps {
  label: string;
  value: string;
  accent?: boolean;
}

function InfoCard({ label, value, accent }: InfoCardProps) {
  return (
    <div className="bg-[#0c0c0e] border border-[#1a1a1f] p-3">
      <div className="text-zinc-600 text-[10px] font-mono uppercase mb-1">
        {label}
      </div>
      <p className={`font-mono text-sm ${accent ? 'text-[#22ffaa]' : 'text-zinc-200'}`}>
        {value}
      </p>
    </div>
  );
}
