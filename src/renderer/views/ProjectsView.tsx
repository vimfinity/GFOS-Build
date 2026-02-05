/**
 * Projects View - Project Management with Fuzzy Search
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { 
  FolderGit2, Coffee, Play, GitBranch, Clock, 
  ChevronDown, Search, Trash2, Edit2, FolderOpen, X
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { StatusIndicator, ConfirmDialog } from '../components/shared';
import { api } from '../api';
import { BuildConfigModal, type BuildConfig } from '../components/BuildConfigModal';
import type { Project } from '../store/useAppStore';

export default function ProjectsView() {
  const { 
    projects, 
    startBuild, 
    removeProject,
    setProjects
  } = useAppStore();
  const [isScanning, setIsScanning] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  
  // Fuse.js configuration for fuzzy search
  const fuse = useMemo(() => new Fuse(projects, {
    keys: ['name', 'path', 'branch', 'jdk'],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
  }), [projects]);
  
  // Convert DiscoveredProject to Project format
  const convertToProject = (discovered: { path: string; name: string }): Project => ({
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: discovered.name,
    path: discovered.path,
    branch: 'main',
    jdk: '',
  });

  const handleScanFolder = async () => {
    const folder = await api.selectFolder();
    if (folder) {
      setIsScanning(true);
      try {
        const scanned = await api.scanProjects(folder);
        if (scanned.length > 0) {
          const newProjects = scanned.map(convertToProject);
          setProjects([...projects, ...newProjects]);
        }
      } finally {
        setIsScanning(false);
      }
    }
  };
  
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; projectId: string | null }>({
    isOpen: false,
    projectId: null
  });
  const [buildConfigModal, setBuildConfigModal] = useState<{ isOpen: boolean; project: Project | null }>({
    isOpen: false,
    project: null
  });

  // Fuzzy search filtering
  const filteredProjects = useMemo(() => {
    if (!localSearchQuery.trim()) {
      return projects;
    }
    const results = fuse.search(localSearchQuery);
    return results.map(r => r.item);
  }, [projects, localSearchQuery, fuse]);

  const handleDelete = () => {
    if (deleteDialog.projectId) {
      removeProject(deleteDialog.projectId);
      setDeleteDialog({ isOpen: false, projectId: null });
    }
  };

  const openBuildConfig = (project: Project) => {
    setBuildConfigModal({ isOpen: true, project });
  };

  const handleStartBuild = (config: BuildConfig) => {
    startBuild(config.projectId, config.goals);
    // TODO: Pass full config to startBuild when backend supports it
  };

  return (
    <>
      {/* Page Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <FolderGit2 size={28} />
          <div>
            <h1 className="text-2xl font-bold text-dark-500 dark:text-light-100">Projekte</h1>
            <p className="text-sm text-dark-300 dark:text-light-400">{filteredProjects.length} von {projects.length} Projekten</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-300 dark:text-light-500" />
            <input
              type="text"
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              placeholder="Projekte durchsuchen..."
              className="w-64 pl-10 pr-10 py-2.5 bg-white/60 dark:bg-dark-700 border border-gray-200/50 dark:border-dark-600 rounded-xl text-dark-500 dark:text-light-100 placeholder-dark-300 dark:placeholder-light-500 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500 transition-all"
            />
            {localSearchQuery && (
              <button
                onClick={() => setLocalSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-300 dark:text-light-500 hover:text-dark-500 dark:hover:text-light-100"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button 
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors disabled:opacity-50" 
            disabled={isScanning}
            onClick={handleScanFolder}
          >
            <FolderOpen size={18} />
            <span>{isScanning ? 'Scannt...' : 'Ordner scannen'}</span>
          </button>
        </div>
      </motion.div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 gap-4 mt-6">
        <AnimatePresence>
          {filteredProjects.map((project, i) => (
            <motion.div
              key={project.id}
              className={`bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-sm overflow-hidden ${expandedProject === project.id ? 'ring-2 ring-petrol-500/30' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              layout
            >
              {/* Main Content */}
              <div 
                className="flex items-center gap-4 p-5 cursor-pointer hover:bg-light-100/50 dark:hover:bg-dark-700/50 transition-colors"
                onClick={() => setExpandedProject(
                  expandedProject === project.id ? null : project.id
                )}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-petrol-100 dark:bg-petrol-900/30 text-petrol-500">
                  <FolderGit2 size={24} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-dark-500 dark:text-light-100 truncate">{project.name}</h3>
                    {project.lastBuild && (
                      <StatusIndicator status={project.lastBuild.status} />
                    )}
                  </div>
                  <p className="text-sm text-dark-300 dark:text-light-400 truncate mt-0.5">{project.path}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-light-200 dark:bg-dark-600 text-dark-400 dark:text-light-300">
                      <GitBranch size={12} />
                      {project.branch}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-light-200 dark:bg-dark-600 text-dark-400 dark:text-light-300">
                      <Coffee size={12} />
                      {project.jdk}
                    </span>
                    {project.lastBuild && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-light-100 dark:bg-dark-700 text-dark-300 dark:text-light-400">
                        <Clock size={12} />
                        {project.lastBuild.timestamp}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <motion.button 
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-petrol-500 text-white hover:bg-petrol-600 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openBuildConfig(project);
                    }}
                  >
                    <Play size={18} />
                  </motion.button>
                  <ChevronDown 
                    size={20} 
                    className={`text-dark-300 transition-transform duration-300 ${expandedProject === project.id ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expandedProject === project.id && (
                  <motion.div
                    className="border-t border-light-300 dark:border-dark-600"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-light-50/50 dark:bg-dark-900/30">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-dark-300 dark:text-light-400 uppercase tracking-wide">Maven Goals</label>
                        <code className="block text-sm text-dark-500 dark:text-light-100">{project.mavenGoals || 'clean install'}</code>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-dark-300 dark:text-light-400 uppercase tracking-wide">JDK Version</label>
                        <span className="block text-sm text-dark-500 dark:text-light-100">{project.jdk}</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-dark-300 dark:text-light-400 uppercase tracking-wide">Branch</label>
                        <span className="block text-sm text-dark-500 dark:text-light-100">{project.branch}</span>
                      </div>
                      {project.lastBuild && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-dark-300 dark:text-light-400 uppercase tracking-wide">Letzter Build</label>
                          <div className="flex items-center gap-2 text-sm">
                            <StatusIndicator status={project.lastBuild.status} size="small" />
                            <span className="text-dark-500 dark:text-light-100">{project.lastBuild.duration}</span>
                            <span className="text-dark-300 dark:text-light-400">({project.lastBuild.timestamp})</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-5 bg-light-100/30 dark:bg-dark-800/50">
                      <div className="flex items-center gap-2">
                        <button 
                          className="inline-flex items-center gap-2 px-4 py-2 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 text-sm font-medium rounded-lg hover:bg-light-300 dark:hover:bg-dark-600 transition-colors"
                          onClick={() => openBuildConfig(project)}
                        >
                          <Edit2 size={16} />
                          <span>Bearbeiten</span>
                        </button>
                        <button 
                          className="inline-flex items-center gap-2 px-4 py-2 bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 text-sm font-medium rounded-lg hover:bg-error-200 dark:hover:bg-error-900/50 transition-colors"
                          onClick={() => setDeleteDialog({ isOpen: true, projectId: project.id })}
                        >
                          <Trash2 size={16} />
                          <span>Entfernen</span>
                        </button>
                      </div>
                      <button 
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors"
                        onClick={() => openBuildConfig(project)}
                      >
                        <Play size={18} />
                        <span>Build starten</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredProjects.length === 0 && (
          <motion.div 
            className="flex flex-col items-center justify-center py-16 text-center text-dark-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Search size={48} className="mb-4 text-dark-200" />
            <h3 className="text-lg font-semibold text-dark-400 dark:text-light-200 mb-2">Keine Projekte gefunden</h3>
            <p className="text-dark-300 dark:text-light-400 mb-6">
              {localSearchQuery 
                ? `Keine Projekte für "${localSearchQuery}" gefunden.`
                : 'Scanne einen Ordner, um Maven-Projekte zu finden.'}
            </p>
            <button 
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors"
              disabled={isScanning}
              onClick={handleScanFolder}
            >
              <FolderOpen size={18} />
              <span>{isScanning ? 'Scannt...' : 'Ordner scannen'}</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Projekt entfernen"
        message="Möchtest du dieses Projekt wirklich aus der Liste entfernen? Die Dateien werden nicht gelöscht."
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, projectId: null })}
      />

      {/* Build Configuration Modal */}
      <BuildConfigModal
        isOpen={buildConfigModal.isOpen}
        project={buildConfigModal.project}
        onClose={() => setBuildConfigModal({ isOpen: false, project: null })}
        onStartBuild={handleStartBuild}
      />
    </>
  );
}
