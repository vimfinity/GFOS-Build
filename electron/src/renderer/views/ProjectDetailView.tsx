/**
 * Project Detail View - Premium Terminal Edition
 * 
 * Repository inspection with module discovery and premium animations.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import type { MavenModule } from '../types';
import { FolderOpen, Play, RefreshCw, Package, GitBranch, Layers } from 'lucide-react';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

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
      <motion.div 
        className="flex items-center justify-center h-64 terminal-window"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-center">
          <motion.div 
            className="text-4xl text-zinc-700 mb-2 font-mono"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            404
          </motion.div>
          <p className="text-zinc-500 font-mono text-sm">PROJECT_NOT_FOUND</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Project Header */}
      <motion.div className="terminal-window overflow-hidden" variants={itemVariants}>
        <div className="terminal-header">
          <motion.span 
            className="text-neon-green"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ▸
          </motion.span>
          <span>{project.name}</span>
          <span className="text-zinc-700">//</span>
          <span className="text-zinc-500">REPO_INFO</span>
        </div>
        
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <motion.div 
                className="w-16 h-16 border-2 border-neon-green flex items-center justify-center bg-terminal-black/50 relative overflow-hidden"
                whileHover={{ scale: 1.05, borderColor: "#00ff88" }}
              >
                <motion.span 
                  className="text-neon-green text-2xl"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  {project.isGitRepo ? <GitBranch size={28} /> : <Package size={28} />}
                </motion.span>
                {/* Corner decoration */}
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-neon-green/50" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-neon-green/50" />
              </motion.div>
              
              <div>
                <h2 className="text-xl font-mono text-zinc-100">{project.name}</h2>
                <p className="text-zinc-600 font-mono text-sm mt-1 truncate max-w-md">
                  {project.path}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {project.hasPom && (
                    <motion.span 
                      className="tag-mvn"
                      whileHover={{ scale: 1.05 }}
                    >
                      MVN
                    </motion.span>
                  )}
                  {project.isGitRepo && (
                    <motion.span 
                      className="tag-git"
                      whileHover={{ scale: 1.05 }}
                    >
                      GIT
                    </motion.span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleOpenFolder}
                className="btn-ghost text-xs flex items-center gap-2"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <FolderOpen size={12} />
                OPEN
              </motion.button>
              {project.hasPom && (
                <motion.button
                  onClick={handleBuildProject}
                  className="btn-neon text-xs flex items-center gap-2"
                  whileHover={{ scale: 1.02, y: -1, boxShadow: "0 0 20px rgba(0,255,136,0.3)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Play size={12} />
                  <span>BUILD_ALL</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Project Info */}
      <motion.div 
        className="grid grid-cols-3 gap-2"
        variants={itemVariants}
      >
        <InfoCard label="TYPE" value={project.hasPom ? 'MAVEN_PROJECT' : 'REPOSITORY'} icon={<Package size={14} />} />
        <InfoCard label="MODULES" value={String(modules.length)} icon={<Layers size={14} />} />
        <InfoCard label="STATUS" value="READY" accent icon={<Play size={14} />} />
      </motion.div>

      {/* Modules Section */}
      {project.hasPom && (
        <motion.div className="terminal-window overflow-hidden" variants={itemVariants}>
          <div className="terminal-header justify-between">
            <div className="flex items-center gap-2">
              <motion.span 
                className="text-neon-cyan"
                animate={{ rotate: loading ? 360 : 0 }}
                transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
              >
                <Layers size={14} />
              </motion.span>
              <span>MODULES</span>
              <span className="text-zinc-600">[{modules.length}]</span>
            </div>
            <motion.button
              onClick={loadModules}
              disabled={loading}
              className="text-zinc-500 hover:text-neon-cyan transition-colors font-mono text-xs flex items-center gap-1"
              title="Reload modules"
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >
              <motion.div
                animate={loading ? { rotate: 360 } : {}}
                transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
              >
                <RefreshCw size={12} />
              </motion.div>
              {loading ? 'SCANNING...' : 'REFRESH'}
            </motion.button>
          </div>
          
          {/* Table Header */}
          <div className="grid grid-cols-[auto_1fr_120px_100px_80px] gap-4 px-4 py-2 
                          border-b border-terminal-border text-xs text-zinc-600 font-mono uppercase bg-terminal-mid/30">
            <div className="w-8">#</div>
            <div>Artifact</div>
            <div>Group</div>
            <div>Packaging</div>
            <div className="text-right">Action</div>
          </div>
          
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                className="p-8 text-center"
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div 
                  className="text-neon-cyan font-mono text-xl mb-2"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  ◐
                </motion.div>
                <p className="text-zinc-500 text-sm font-mono">SCANNING_MODULES...</p>
              </motion.div>
            ) : modules.length === 0 ? (
              <motion.div 
                className="p-8 text-center"
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div 
                  className="text-4xl text-zinc-800 mb-4 font-mono"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  [ ]
                </motion.div>
                <p className="text-zinc-500 font-mono text-sm">NO_MODULES_FOUND</p>
                <p className="text-zinc-600 text-xs mt-2 font-mono">
                  This may be a single-module project
                </p>
              </motion.div>
            ) : (
              <motion.div 
                className="divide-y divide-terminal-border/50"
                key="list"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {modules.map((module, index) => (
                  <motion.div
                    key={module.pomPath}
                    variants={rowVariants}
                    className="grid grid-cols-[auto_1fr_120px_100px_80px] gap-4 px-4 py-3
                               hover:bg-terminal-mid/50 transition-colors group relative overflow-hidden"
                    whileHover={{ x: 4, backgroundColor: "rgba(0, 255, 136, 0.02)" }}
                  >
                    {/* Hover glow */}
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none"
                    />
                    
                    {/* Index */}
                    <div className="w-8 text-zinc-600 font-mono text-sm relative z-10">
                      {String(index + 1).padStart(2, '0')}
                    </div>

                    {/* Artifact Info */}
                    <div className="min-w-0 relative z-10">
                      <div className="flex items-center gap-2">
                        <motion.span 
                          className="text-neon-orange"
                          whileHover={{ rotate: 180 }}
                          transition={{ type: "spring" as const, stiffness: 300 }}
                        >
                          <Package size={14} />
                        </motion.span>
                        <span className="text-zinc-200 font-mono text-sm truncate group-hover:text-neon-green transition-colors">
                          {module.artifactId}
                        </span>
                      </div>
                      {module.relativePath && module.relativePath !== '.' && (
                        <p className="text-zinc-600 text-xs font-mono mt-0.5 truncate">
                          ./{module.relativePath}
                        </p>
                      )}
                    </div>

                    {/* Group ID */}
                    <div className="flex items-center relative z-10">
                      <span className="text-zinc-500 text-xs font-mono truncate">
                        {module.groupId.split('.').pop()}
                      </span>
                    </div>

                    {/* Packaging */}
                    <div className="flex items-center relative z-10">
                      <motion.span 
                        className={`px-1.5 py-0.5 text-[10px] font-mono border ${
                          module.packaging === 'jar' 
                            ? 'border-neon-green/30 text-neon-green bg-neon-green/10'
                            : module.packaging === 'war'
                            ? 'border-neon-cyan/30 text-neon-cyan bg-neon-cyan/10'
                            : 'border-zinc-600 text-zinc-400 bg-zinc-800'
                        }`}
                        whileHover={{ scale: 1.05 }}
                      >
                        {module.packaging.toUpperCase()}
                      </motion.span>
                    </div>

                    {/* Build Action */}
                    <div className="flex items-center justify-end relative z-10">
                      <motion.button
                        onClick={() => handleBuildModule(module)}
                        className="text-zinc-500 hover:text-neon-green transition-colors font-mono text-xs flex items-center gap-1"
                        whileHover={{ scale: 1.05, x: -2 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Play size={10} />
                        BUILD
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Footer */}
          <motion.div 
            className="px-4 py-2 border-t border-terminal-border text-xs font-mono text-zinc-600 bg-terminal-mid/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {modules.length > 0 ? (
              <span>Total: {modules.length} modules • Click BUILD to start individual module builds</span>
            ) : (
              <span>Use REFRESH to rescan project structure</span>
            )}
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}

interface InfoCardProps {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}

function InfoCard({ label, value, accent, icon }: InfoCardProps) {
  return (
    <motion.div 
      className="terminal-window p-3 group"
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="text-zinc-600 text-[10px] font-mono uppercase mb-1 flex items-center gap-1">
        {icon && <span className="opacity-60 group-hover:opacity-100 transition-opacity">{icon}</span>}
        {label}
      </div>
      <p className={`font-mono text-sm ${accent ? 'text-neon-green' : 'text-zinc-200'}`}>
        {value}
      </p>
    </motion.div>
  );
}
