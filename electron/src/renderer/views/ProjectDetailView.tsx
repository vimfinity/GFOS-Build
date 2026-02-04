/**
 * Project Detail View - Terminal-Neon Design
 * 
 * Repository inspection with module discovery.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import type { MavenModule } from '../types';

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
      <div className="flex items-center justify-center h-64 terminal-window">
        <div className="text-center">
          <div className="text-4xl text-terminal-700 mb-2 font-mono">404</div>
          <p className="text-terminal-500 font-mono text-sm">PROJECT_NOT_FOUND</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Project Header */}
      <div className="terminal-window">
        <div className="terminal-header">
          <span className="text-neon-green">▸</span>
          <span>{project.name}</span>
          <span className="text-terminal-500">//</span>
          <span className="text-terminal-400">REPO_INFO</span>
        </div>
        
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="w-16 h-16 border-2 border-neon-green flex items-center justify-center bg-terminal-900">
                <span className="text-neon-green text-2xl font-mono">
                  {project.isGitRepo ? '⎇' : '◆'}
                </span>
              </div>
              
              <div>
                <h2 className="text-xl font-mono text-terminal-100">{project.name}</h2>
                <p className="text-terminal-500 font-mono text-sm mt-1 truncate max-w-md">
                  {project.path}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {project.hasPom && (
                    <span className="tag-mvn">MVN</span>
                  )}
                  {project.isGitRepo && (
                    <span className="tag-git">GIT</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenFolder}
                className="btn-ghost text-xs"
              >
                [OPEN]
              </button>
              {project.hasPom && (
                <button
                  onClick={handleBuildProject}
                  className="btn-neon text-xs"
                >
                  [BUILD_ALL]
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
        <div className="terminal-window">
          <div className="terminal-header justify-between">
            <div className="flex items-center gap-2">
              <span className="text-neon-cyan">⬡</span>
              <span>MODULES</span>
              <span className="text-terminal-600">[{modules.length}]</span>
            </div>
            <button
              onClick={loadModules}
              disabled={loading}
              className="text-terminal-500 hover:text-neon-cyan transition-colors font-mono text-xs"
              title="Reload modules"
            >
              {loading ? '[...SCANNING]' : '[REFRESH]'}
            </button>
          </div>
          
          {/* Table Header */}
          <div className="grid grid-cols-[auto_1fr_120px_100px_80px] gap-4 px-4 py-2 
                          border-b border-terminal-700 text-xs text-terminal-500 font-mono uppercase">
            <div className="w-8">#</div>
            <div>Artifact</div>
            <div>Group</div>
            <div>Packaging</div>
            <div className="text-right">Action</div>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="text-neon-cyan animate-pulse font-mono text-xl mb-2">◐</div>
              <p className="text-terminal-500 text-sm font-mono">SCANNING_MODULES...</p>
            </div>
          ) : modules.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl text-terminal-700 mb-4 font-mono">[ ]</div>
              <p className="text-terminal-500 font-mono text-sm">NO_MODULES_FOUND</p>
              <p className="text-terminal-600 text-xs mt-2 font-mono">
                This may be a single-module project
              </p>
            </div>
          ) : (
            <div className="divide-y divide-terminal-800">
              {modules.map((module, index) => (
                <div
                  key={module.pomPath}
                  className="grid grid-cols-[auto_1fr_120px_100px_80px] gap-4 px-4 py-3
                             hover:bg-terminal-800/50 transition-colors group animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Index */}
                  <div className="w-8 text-terminal-600 font-mono text-sm">
                    {String(index + 1).padStart(2, '0')}
                  </div>

                  {/* Artifact Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-neon-orange">⬡</span>
                      <span className="text-terminal-200 font-mono text-sm truncate group-hover:text-neon-green transition-colors">
                        {module.artifactId}
                      </span>
                    </div>
                    {module.relativePath && module.relativePath !== '.' && (
                      <p className="text-terminal-600 text-xs font-mono mt-0.5 truncate">
                        ./{module.relativePath}
                      </p>
                    )}
                  </div>

                  {/* Group ID */}
                  <div className="flex items-center">
                    <span className="text-terminal-500 text-xs font-mono truncate">
                      {module.groupId.split('.').pop()}
                    </span>
                  </div>

                  {/* Packaging */}
                  <div className="flex items-center">
                    <span className={`px-1.5 py-0.5 text-[10px] font-mono border ${
                      module.packaging === 'jar' 
                        ? 'border-neon-green/30 text-neon-green bg-neon-green/10'
                        : module.packaging === 'war'
                        ? 'border-neon-cyan/30 text-neon-cyan bg-neon-cyan/10'
                        : 'border-terminal-600 text-terminal-400 bg-terminal-800'
                    }`}>
                      {module.packaging.toUpperCase()}
                    </span>
                  </div>

                  {/* Build Action */}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => handleBuildModule(module)}
                      className="text-terminal-500 hover:text-neon-green transition-colors font-mono text-xs"
                    >
                      [BUILD]
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Footer */}
          <div className="px-4 py-2 border-t border-terminal-700 text-xs font-mono text-terminal-600">
            {modules.length > 0 ? (
              <span>Total: {modules.length} modules • Click BUILD to start individual module builds</span>
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
    <div className="terminal-window p-3">
      <div className="text-terminal-600 text-[10px] font-mono uppercase mb-1">
        {label}
      </div>
      <p className={`font-mono text-sm ${accent ? 'text-neon-green' : 'text-terminal-200'}`}>
        {value}
      </p>
    </div>
  );
}
