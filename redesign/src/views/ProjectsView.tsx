/**
 * Projects View - Project Management
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderGit2, Coffee, Play, GitBranch, Clock, 
  ChevronDown, Search, Plus, Trash2, Edit2, FolderOpen
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { StatusIndicator, ConfirmDialog } from '../components/shared';

export default function ProjectsView() {
  const { 
    projects, 
    searchQuery, 
    startBuild, 
    removeProject
  } = useAppStore();
  
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; projectId: string | null }>({
    isOpen: false,
    projectId: null
  });

  // Filter projects based on search
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.branch.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = () => {
    if (deleteDialog.projectId) {
      removeProject(deleteDialog.projectId);
      setDeleteDialog({ isOpen: false, projectId: null });
    }
  };

  return (
    <>
      {/* Page Header */}
      <motion.div 
        className="gfos-page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="gfos-page-title">
          <FolderGit2 size={28} />
          <div>
            <h1>Projekte</h1>
            <p>{filteredProjects.length} Maven-Projekte gefunden</p>
          </div>
        </div>
        <div className="gfos-page-actions">
          <button className="gfos-secondary-btn">
            <FolderOpen size={18} />
            <span>Ordner scannen</span>
          </button>
          <button className="gfos-primary-btn">
            <Plus size={18} />
            <span>Projekt hinzufügen</span>
          </button>
        </div>
      </motion.div>

      {/* Projects Grid */}
      <div className="gfos-projects-grid-full">
        <AnimatePresence>
          {filteredProjects.map((project, i) => (
            <motion.div
              key={project.id}
              className={`gfos-project-card-full ${expandedProject === project.id ? 'gfos-project-expanded' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              layout
            >
              {/* Main Content */}
              <div 
                className="gfos-project-main"
                onClick={() => setExpandedProject(
                  expandedProject === project.id ? null : project.id
                )}
              >
                <div className="gfos-project-icon-lg">
                  <FolderGit2 size={24} />
                </div>
                
                <div className="gfos-project-details">
                  <div className="gfos-project-name-row">
                    <h3>{project.name}</h3>
                    {project.lastBuild && (
                      <StatusIndicator status={project.lastBuild.status} />
                    )}
                  </div>
                  <p className="gfos-project-path">{project.path}</p>
                  <div className="gfos-project-tags">
                    <span className="gfos-tag">
                      <GitBranch size={12} />
                      {project.branch}
                    </span>
                    <span className="gfos-tag">
                      <Coffee size={12} />
                      {project.jdk}
                    </span>
                    {project.lastBuild && (
                      <span className="gfos-tag gfos-tag-muted">
                        <Clock size={12} />
                        {project.lastBuild.timestamp}
                      </span>
                    )}
                  </div>
                </div>

                <div className="gfos-project-actions-row">
                  <motion.button 
                    className="gfos-action-btn"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      startBuild(project.id);
                    }}
                  >
                    <Play size={18} />
                  </motion.button>
                  <ChevronDown 
                    size={20} 
                    className={`gfos-expand-icon ${expandedProject === project.id ? 'gfos-rotated' : ''}`}
                  />
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expandedProject === project.id && (
                  <motion.div
                    className="gfos-project-expanded-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="gfos-project-info-grid">
                      <div className="gfos-info-item">
                        <label>Maven Goals</label>
                        <code>{project.mavenGoals || 'clean install'}</code>
                      </div>
                      <div className="gfos-info-item">
                        <label>JDK Version</label>
                        <span>{project.jdk}</span>
                      </div>
                      <div className="gfos-info-item">
                        <label>Branch</label>
                        <span>{project.branch}</span>
                      </div>
                      {project.lastBuild && (
                        <div className="gfos-info-item">
                          <label>Letzter Build</label>
                          <div className="gfos-last-build-info">
                            <StatusIndicator status={project.lastBuild.status} size="small" />
                            <span>{project.lastBuild.duration}</span>
                            <span className="gfos-muted">({project.lastBuild.timestamp})</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="gfos-project-expanded-actions">
                      <button className="gfos-secondary-btn gfos-btn-sm">
                        <Edit2 size={16} />
                        <span>Bearbeiten</span>
                      </button>
                      <button 
                        className="gfos-danger-btn gfos-btn-sm"
                        onClick={() => setDeleteDialog({ isOpen: true, projectId: project.id })}
                      >
                        <Trash2 size={16} />
                        <span>Entfernen</span>
                      </button>
                      <div className="gfos-flex-spacer" />
                      <button 
                        className="gfos-primary-btn"
                        onClick={() => startBuild(project.id)}
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
            className="gfos-empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Search size={48} />
            <h3>Keine Projekte gefunden</h3>
            <p>
              {searchQuery 
                ? `Keine Projekte für "${searchQuery}" gefunden.`
                : 'Füge dein erstes Maven-Projekt hinzu.'}
            </p>
            <button className="gfos-primary-btn">
              <Plus size={18} />
              <span>Projekt hinzufügen</span>
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
    </>
  );
}
