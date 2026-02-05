/**
 * PipelinesView - Pipeline Management
 * List all pipelines with run/edit/delete actions
 */

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Workflow, Play, Edit, Trash2, Plus, Clock, 
  ChevronRight, StopCircle, Loader2
} from 'lucide-react';
import { useAppStore, useStats } from '../store/useAppStore';
import { GlassPanel } from '../components/shared';

export default function PipelinesView() {
  const { 
    pipelines, 
    projects,
    setActiveView,
    setSelectedPipelineId,
    removePipeline,
    runPipeline,
    stopPipeline,
    addNotification
  } = useAppStore();
  const stats = useStats();

  const handleCreate = () => {
    setSelectedPipelineId(null);
    setActiveView('pipeline-editor');
  };

  const handleEdit = (id: string) => {
    setSelectedPipelineId(id);
    setActiveView('pipeline-editor');
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Pipeline "${name}" wirklich löschen?`)) {
      removePipeline(id);
      addNotification('info', `Pipeline "${name}" gelöscht`);
    }
  };

  const handleRun = (id: string) => {
    runPipeline(id);
  };

  const handleStop = (id: string) => {
    stopPipeline(id);
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unbekanntes Projekt';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          <Workflow size={28} />
          <div>
            <h1>Pipelines</h1>
            <p>
              {stats.pipelineCount} Pipelines, {stats.runningPipelines} aktiv
            </p>
          </div>
        </div>
        <div className="gfos-page-actions">
          <button className="gfos-primary-btn" onClick={handleCreate}>
            <Plus size={18} />
            <span>Neue Pipeline</span>
          </button>
        </div>
      </motion.div>

      {/* Stats Summary */}
      <motion.div 
        className="gfos-builds-stats"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="gfos-build-stat-card">
          <span className="gfos-stat-number">{pipelines.length}</span>
          <span className="gfos-stat-label">Gesamt</span>
        </div>
        <div className="gfos-build-stat-card gfos-stat-running">
          <span className="gfos-stat-number">{stats.runningPipelines}</span>
          <span className="gfos-stat-label">Aktiv</span>
        </div>
        <div className="gfos-build-stat-card gfos-stat-success">
          <span className="gfos-stat-number">
            {pipelines.filter(p => p.lastRun).length}
          </span>
          <span className="gfos-stat-label">Ausgeführt</span>
        </div>
      </motion.div>

      {/* Pipelines List */}
      <GlassPanel className="gfos-builds-panel-full">
        <div className="gfos-builds-list-full">
          <AnimatePresence>
            {pipelines.length === 0 ? (
              <motion.div 
                className="gfos-empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Workflow size={48} />
                <h3>Keine Pipelines</h3>
                <p>
                  Erstelle deine erste Pipeline um mehrere Build-Schritte zu automatisieren.
                </p>
                <button className="gfos-primary-btn" onClick={handleCreate}>
                  <Plus size={18} />
                  <span>Erste Pipeline erstellen</span>
                </button>
              </motion.div>
            ) : (
              pipelines.map((pipeline, i) => (
                <motion.div
                  key={pipeline.id}
                  className="gfos-pipeline-row"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                >
                  {/* Pipeline Icon */}
                  <div className={`gfos-pipeline-icon ${pipeline.isRunning ? 'gfos-pipeline-running' : ''}`}>
                    {pipeline.isRunning ? (
                      <Loader2 size={20} className="gfos-spin" />
                    ) : (
                      <Workflow size={20} />
                    )}
                  </div>
                  
                  {/* Pipeline Info */}
                  <div className="gfos-pipeline-info">
                    <h4>{pipeline.name}</h4>
                    <span className="gfos-pipeline-project">
                      {getProjectName(pipeline.projectId)}
                    </span>
                  </div>

                  {/* Steps Count */}
                  <div className="gfos-pipeline-steps">
                    <span className="gfos-badge">
                      {pipeline.steps.length} {pipeline.steps.length === 1 ? 'Schritt' : 'Schritte'}
                    </span>
                  </div>

                  {/* Progress indicator for running pipelines */}
                  {pipeline.isRunning && pipeline.currentStep !== undefined && (
                    <div className="gfos-pipeline-progress">
                      <span className="gfos-pipeline-step-indicator">
                        Schritt {pipeline.currentStep + 1}/{pipeline.steps.length}
                      </span>
                    </div>
                  )}

                  {/* Last Run */}
                  <div className="gfos-pipeline-last-run">
                    <Clock size={14} />
                    <span>{formatDate(pipeline.lastRun)}</span>
                  </div>

                  {/* Actions */}
                  <div className="gfos-pipeline-actions">
                    {pipeline.isRunning ? (
                      <button 
                        className="gfos-icon-btn-sm gfos-btn-danger-subtle"
                        onClick={() => handleStop(pipeline.id)}
                        title="Stoppen"
                      >
                        <StopCircle size={18} />
                      </button>
                    ) : (
                      <button 
                        className="gfos-icon-btn-sm gfos-btn-primary-subtle"
                        onClick={() => handleRun(pipeline.id)}
                        title="Ausführen"
                      >
                        <Play size={18} />
                      </button>
                    )}
                    <button 
                      className="gfos-icon-btn-sm"
                      onClick={() => handleEdit(pipeline.id)}
                      title="Bearbeiten"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      className="gfos-icon-btn-sm gfos-btn-danger-subtle"
                      onClick={() => handleDelete(pipeline.id, pipeline.name)}
                      title="Löschen"
                      disabled={pipeline.isRunning}
                    >
                      <Trash2 size={18} />
                    </button>
                    <ChevronRight size={18} className="gfos-chevron" />
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </GlassPanel>
    </>
  );
}
