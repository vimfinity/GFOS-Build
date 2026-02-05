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
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <Workflow size={28} />
          <div>
            <h1 className="text-2xl font-bold text-dark-500 dark:text-light-100">Pipelines</h1>
            <p className="text-sm text-dark-300 dark:text-light-400">
              {stats.pipelineCount} Pipelines, {stats.runningPipelines} aktiv
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors" onClick={handleCreate}>
            <Plus size={18} />
            <span>Neue Pipeline</span>
          </button>
        </div>
      </motion.div>

      {/* Stats Summary */}
      <motion.div 
        className="flex items-center gap-4 mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex-1 p-4 bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-xl border border-gray-200/50 dark:border-white/10">
          <span className="block text-2xl font-bold text-dark-500 dark:text-light-100">{pipelines.length}</span>
          <span className="text-sm text-dark-300 dark:text-light-400">Gesamt</span>
        </div>
        <div className="flex-1 p-4 bg-info-50 dark:bg-info-900/20 rounded-xl border border-info-200 dark:border-info-800">
          <span className="block text-2xl font-bold text-info-600 dark:text-info-400">{stats.runningPipelines}</span>
          <span className="text-sm text-info-500 dark:text-info-400">Aktiv</span>
        </div>
        <div className="flex-1 p-4 bg-success-50 dark:bg-success-900/20 rounded-xl border border-success-200 dark:border-success-800">
          <span className="block text-2xl font-bold text-success-600 dark:text-success-400">
            {pipelines.filter(p => p.lastRun).length}
          </span>
          <span className="text-sm text-success-500 dark:text-success-400">Ausgeführt</span>
        </div>
      </motion.div>

      {/* Pipelines List */}
      <GlassPanel className="mt-6">
        <div className="divide-y divide-light-200 dark:divide-dark-700">
          <AnimatePresence>
            {pipelines.length === 0 ? (
              <motion.div 
                className="flex flex-col items-center justify-center py-16 text-center text-dark-300"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Workflow size={48} className="mb-4 text-dark-200" />
                <h3 className="text-lg font-semibold text-dark-400 dark:text-light-200 mb-2">Keine Pipelines</h3>
                <p className="text-dark-300 dark:text-light-400 mb-6">
                  Erstelle deine erste Pipeline um mehrere Build-Schritte zu automatisieren.
                </p>
                <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors" onClick={handleCreate}>
                  <Plus size={18} />
                  <span>Erste Pipeline erstellen</span>
                </button>
              </motion.div>
            ) : (
              pipelines.map((pipeline, i) => (
                <motion.div
                  key={pipeline.id}
                  className="flex items-center gap-4 p-4 hover:bg-light-50 dark:hover:bg-dark-700/50 transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                >
                  {/* Pipeline Icon */}
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${pipeline.isRunning ? 'bg-info-100 dark:bg-info-900/30 text-info-500' : 'bg-light-200 dark:bg-dark-700 text-dark-400'}`}>
                    {pipeline.isRunning ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Workflow size={20} />
                    )}
                  </div>
                  
                  {/* Pipeline Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-dark-500 dark:text-light-100">{pipeline.name}</h4>
                    <span className="text-sm text-dark-300 dark:text-light-400">
                      {getProjectName(pipeline.projectId)}
                    </span>
                  </div>

                  {/* Steps Count */}
                  <div className="hidden sm:block">
                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-light-200 dark:bg-dark-600 text-dark-400 dark:text-light-300">
                      {pipeline.steps.length} {pipeline.steps.length === 1 ? 'Schritt' : 'Schritte'}
                    </span>
                  </div>

                  {/* Progress indicator for running pipelines */}
                  {pipeline.isRunning && pipeline.currentStep !== undefined && (
                    <div className="hidden md:block">
                      <span className="text-xs font-medium text-info-500">
                        Schritt {pipeline.currentStep + 1}/{pipeline.steps.length}
                      </span>
                    </div>
                  )}

                  {/* Last Run */}
                  <div className="hidden lg:flex items-center gap-1.5 text-sm text-dark-300 dark:text-light-400">
                    <Clock size={14} />
                    <span>{formatDate(pipeline.lastRun)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {pipeline.isRunning ? (
                      <button 
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-error-500 hover:bg-error-100 dark:hover:bg-error-900/30 transition-colors"
                        onClick={() => handleStop(pipeline.id)}
                        title="Stoppen"
                      >
                        <StopCircle size={18} />
                      </button>
                    ) : (
                      <button 
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-petrol-500 hover:bg-petrol-100 dark:hover:bg-petrol-900/30 transition-colors"
                        onClick={() => handleRun(pipeline.id)}
                        title="Ausführen"
                      >
                        <Play size={18} />
                      </button>
                    )}
                    <button 
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:bg-light-200 dark:hover:bg-dark-700 transition-colors"
                      onClick={() => handleEdit(pipeline.id)}
                      title="Bearbeiten"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:bg-error-100 dark:hover:bg-error-900/30 hover:text-error-500 transition-colors disabled:opacity-50"
                      onClick={() => handleDelete(pipeline.id, pipeline.name)}
                      title="Löschen"
                      disabled={pipeline.isRunning}
                    >
                      <Trash2 size={18} />
                    </button>
                    <ChevronRight size={18} className="text-dark-200" />
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
