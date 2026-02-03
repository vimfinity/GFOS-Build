/**
 * Project Detail View
 * 
 * Shows project details with modules and build actions.
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { MavenModule } from '../types';
import { 
  FolderGit2, 
  Package, 
  Play,
  FolderOpen,
  RefreshCw,
  ChevronRight,
  Layers
} from 'lucide-react';

export function ProjectDetailView() {
  const selectedProjectPath = useAppStore((state) => state.selectedProjectPath);
  const projects = useAppStore((state) => state.projects);
  const modulesByProject = useAppStore((state) => state.modulesByProject);
  const setModules = useAppStore((state) => state.setModules);
  const setScreen = useAppStore((state) => state.setScreen);
  
  const [loading, setLoading] = useState(false);

  const project = projects.find((p) => p.path === selectedProjectPath);
  const modules = selectedProjectPath ? modulesByProject[selectedProjectPath] || [] : [];

  useEffect(() => {
    if (project?.pomPath && !modulesByProject[project.path]) {
      loadModules();
    }
  }, [project]);

  const loadModules = async () => {
    if (!project?.pomPath) return;
    
    setLoading(true);
    try {
      const modules = await window.electronAPI.scanModules(project.pomPath);
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
      window.electronAPI.openPath(project.path);
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Projekt nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Project Header */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gfos-500 to-gfos-700 flex items-center justify-center">
              <FolderGit2 size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{project.name}</h2>
              <p className="text-slate-400 mt-1">{project.path}</p>
              <div className="flex items-center gap-2 mt-2">
                {project.hasPom && (
                  <span className="px-2 py-1 text-xs font-medium bg-orange-500/20 text-orange-400 rounded">
                    Maven
                  </span>
                )}
                {project.isGitRepo && (
                  <span className="px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-400 rounded">
                    Git Repository
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenFolder}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors flex items-center gap-2"
            >
              <FolderOpen size={18} />
              Öffnen
            </button>
            {project.hasPom && (
              <button
                onClick={handleBuildProject}
                className="px-4 py-2 rounded-lg bg-gfos-600 text-white hover:bg-gfos-500 transition-colors flex items-center gap-2"
              >
                <Play size={18} />
                Build starten
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modules Section */}
      {project.hasPom && (
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={20} className="text-gfos-400" />
              <h3 className="text-lg font-semibold text-white">Module</h3>
              <span className="text-sm text-slate-400">({modules.length})</span>
            </div>
            <button
              onClick={loadModules}
              disabled={loading}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Module neu laden"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw size={24} className="animate-spin mx-auto text-gfos-400" />
              <p className="text-slate-400 mt-2">Lade Module...</p>
            </div>
          ) : modules.length === 0 ? (
            <div className="p-8 text-center">
              <Package size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">Keine Module gefunden</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {modules.map((module) => (
                <div
                  key={module.pomPath}
                  className="p-4 flex items-center gap-4 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                    <Package size={20} className="text-orange-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white">
                      {module.artifactId}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {module.groupId} • {module.packaging}
                    </p>
                    {module.relativePath && module.relativePath !== '.' && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {module.relativePath}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleBuildModule(module)}
                    className="px-3 py-1.5 rounded-lg bg-gfos-600/20 text-gfos-400 hover:bg-gfos-600 hover:text-white transition-colors flex items-center gap-1 text-sm"
                  >
                    <Play size={14} />
                    Build
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
