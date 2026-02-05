/**
 * Builds View - Build Queue & History with Log Preview - Tailwind v4
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Clock, CheckCircle2, XCircle, AlertCircle,
  StopCircle, Trash2, RefreshCw, ChevronRight, Terminal,
  Maximize2, X
} from 'lucide-react';
import { useAppStore, useStats } from '../store/useAppStore';
import type { BuildJob } from '../store/useAppStore';
import { StatusIndicator, ProgressRing, GlassPanel } from '../components/shared';

type FilterType = 'all' | 'running' | 'pending' | 'success' | 'failed';

export default function BuildsView() {
  const { 
    buildJobs, 
    jobLogs,
    cancelBuildJob, 
    clearCompletedJobs,
    startBuild,
    setActiveView,
    setSelectedJobId
  } = useAppStore();
  const stats = useStats();
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedJob, setSelectedJob] = useState<BuildJob | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Filter jobs
  const filteredJobs = buildJobs.filter(job => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  // Group jobs by status
  const runningJobs = buildJobs.filter(j => j.status === 'running');
  const pendingJobs = buildJobs.filter(j => j.status === 'pending');
  const completedJobs = buildJobs.filter(j => 
    j.status === 'success' || j.status === 'failed' || j.status === 'cancelled'
  );

  // Auto-scroll log container
  useEffect(() => {
    if (logContainerRef.current && selectedJob) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [selectedJob, jobLogs]);

  // Get logs for selected job
  const selectedJobLogs = selectedJob ? jobLogs[selectedJob.id] || [] : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 size={18} />;
      case 'failed': return <XCircle size={18} />;
      case 'running': return <RefreshCw size={18} className="animate-spin" />;
      case 'pending': return <Clock size={18} />;
      case 'cancelled': return <StopCircle size={18} />;
      default: return <AlertCircle size={18} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success': return 'Erfolgreich';
      case 'failed': return 'Fehlgeschlagen';
      case 'running': return 'Läuft';
      case 'pending': return 'Wartend';
      case 'cancelled': return 'Abgebrochen';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-success-500 bg-success-50 dark:bg-success-900/30';
      case 'failed': return 'text-error-500 bg-error-50 dark:bg-error-900/30';
      case 'running': return 'text-petrol-500 bg-petrol-50 dark:bg-petrol-900/30';
      case 'pending': return 'text-dark-400 bg-light-200 dark:bg-dark-600';
      case 'cancelled': return 'text-gray-500 bg-gray-100 dark:bg-gray-800/30';
      default: return 'text-dark-400 bg-light-200 dark:bg-dark-600';
    }
  };

  const openFullLog = (job: BuildJob) => {
    setSelectedJobId(job.id);
    setActiveView('job-log');
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {/* Page Header */}
        <motion.div 
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-petrol-50 dark:bg-petrol-900/30 text-petrol-500">
              <Play size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-dark-500 dark:text-light-100">Builds</h1>
              <p className="text-sm text-dark-300 dark:text-light-400">
                {stats.activeBuilds} aktiv, {stats.queuedBuilds} in Warteschlange
              </p>
            </div>
          </div>
          <button 
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={clearCompletedJobs}
            disabled={completedJobs.length === 0}
          >
            <Trash2 size={18} />
            <span>Verlauf leeren</span>
          </button>
        </motion.div>

        {/* Stats Summary */}
        <motion.div 
          className="flex gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {[
            { key: 'all', label: 'Gesamt', count: buildJobs.length },
            { key: 'running', label: 'Aktiv', count: runningJobs.length, color: 'text-petrol-500' },
            { key: 'pending', label: 'Wartend', count: pendingJobs.length },
            { key: 'success', label: 'Erfolgreich', count: stats.successfulBuilds, color: 'text-success-500' },
            { key: 'failed', label: 'Fehlgeschlagen', count: stats.failedBuilds, color: 'text-error-500' },
          ].map((stat) => (
            <button
              key={stat.key}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                filter === stat.key 
                  ? 'bg-petrol-500 text-white shadow-sm' 
                  : 'bg-white/60 dark:bg-dark-700/60 text-dark-500 dark:text-light-100 hover:bg-white dark:hover:bg-dark-600'
              }`}
              onClick={() => setFilter(stat.key as FilterType)}
            >
              <span className={`text-lg font-bold ${filter !== stat.key && stat.color ? stat.color : ''}`}>
                {stat.count}
              </span>
              <span>{stat.label}</span>
            </button>
          ))}
        </motion.div>

        {/* Builds List */}
        <GlassPanel className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence>
              {filteredJobs.length === 0 ? (
                <motion.div 
                  className="flex flex-col items-center justify-center py-16 text-dark-300"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Play size={48} className="mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold text-dark-500 dark:text-light-100 mb-1">Keine Builds</h3>
                  <p className="text-sm">
                    {filter === 'all' 
                      ? 'Starte einen Build um loszulegen.'
                      : `Keine Builds mit Status "${getStatusLabel(filter)}".`}
                  </p>
                </motion.div>
              ) : (
                filteredJobs.map((job, i) => (
                  <motion.div
                    key={job.id}
                    className={`flex items-center gap-4 px-5 py-4 border-b border-light-200 dark:border-dark-600 cursor-pointer transition-all ${
                      selectedJob?.id === job.id 
                        ? 'bg-petrol-50/50 dark:bg-petrol-900/20' 
                        : 'hover:bg-light-100 dark:hover:bg-dark-700'
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${getStatusColor(job.status)}`}>
                      {getStatusIcon(job.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-dark-500 dark:text-light-100 truncate">{job.projectName}</h4>
                      <span className="text-sm text-dark-300 dark:text-light-400 font-mono">{job.goals}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-xs font-medium bg-light-200 dark:bg-dark-600 text-dark-400 rounded-lg">
                        {job.jdk}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-dark-300">
                      <Clock size={14} />
                      <span>{job.startTime}</span>
                      {job.duration && (
                        <span className="text-dark-400">({job.duration})</span>
                      )}
                    </div>

                    {job.status === 'running' && (
                      <ProgressRing progress={job.progress} />
                    )}

                    <div className="flex items-center gap-1">
                      {(job.status === 'running' || job.status === 'pending') && (
                        <button 
                          className="flex items-center justify-center w-8 h-8 rounded-lg text-error-500 hover:bg-error-50 dark:hover:bg-error-900/30 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelBuildJob(job.id);
                          }}
                          title="Abbrechen"
                        >
                          <StopCircle size={16} />
                        </button>
                      )}
                      {job.status === 'failed' && (
                        <button 
                          className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-400 hover:bg-light-200 dark:hover:bg-dark-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            startBuild(job.projectId, job.goals);
                          }}
                          title="Erneut versuchen"
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                      <ChevronRight size={18} className={`text-dark-300 transition-transform ${selectedJob?.id === job.id ? 'rotate-90' : ''}`} />
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </GlassPanel>
      </div>

      {/* Log Preview Sidebar */}
      <AnimatePresence>
        {selectedJob && (
          <motion.div 
            className="w-[480px] flex-shrink-0 flex flex-col bg-white/70 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-white/10 shadow-sm overflow-hidden"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
          >
            {/* Details Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-light-300 dark:border-dark-600">
              <h3 className="font-semibold text-dark-500 dark:text-light-100">Build Details</h3>
              <div className="flex items-center gap-1">
                <button 
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:bg-light-200 dark:hover:bg-dark-700 transition-colors"
                  onClick={() => openFullLog(selectedJob)}
                  title="Vollständigen Log öffnen"
                >
                  <Maximize2 size={16} />
                </button>
                <button 
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:bg-light-200 dark:hover:bg-dark-700 transition-colors"
                  onClick={() => setSelectedJob(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            {/* Build Info */}
            <div className="px-5 py-4 border-b border-light-300 dark:border-dark-600 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-300">Status</span>
                <div className="flex items-center gap-2">
                  <StatusIndicator status={selectedJob.status} size="small" />
                  <span className="text-sm font-medium text-dark-500 dark:text-light-100">
                    {getStatusLabel(selectedJob.status)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-300">Goals</span>
                <code className="text-sm bg-light-200 dark:bg-dark-600 px-2 py-0.5 rounded font-mono">
                  {selectedJob.goals}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-300">JDK</span>
                <span className="text-sm font-medium text-dark-500 dark:text-light-100">{selectedJob.jdk}</span>
              </div>
              {selectedJob.status === 'running' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-dark-300">Fortschritt</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-light-300 dark:bg-dark-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-petrol-500 rounded-full transition-all duration-300"
                        style={{ width: `${selectedJob.progress}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-dark-500 dark:text-light-100">{selectedJob.progress}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Log Preview */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-light-300 dark:border-dark-600">
                <Terminal size={16} className="text-dark-300" />
                <span className="text-sm font-medium text-dark-500 dark:text-light-100">Log Output</span>
                <span className="text-xs text-dark-300">({selectedJobLogs.length} Zeilen)</span>
              </div>
              <div 
                ref={logContainerRef}
                className="flex-1 overflow-auto bg-dark-900 p-4 font-mono text-xs leading-relaxed"
              >
                {selectedJobLogs.length === 0 ? (
                  <div className="text-dark-400 text-center py-8">
                    {selectedJob.status === 'pending' ? 'Build wartet...' : 'Keine Log-Ausgabe verfügbar'}
                  </div>
                ) : (
                  selectedJobLogs.map((entry, i) => (
                    <div 
                      key={i} 
                      className={`py-0.5 whitespace-pre-wrap break-all ${
                        entry.level === 'error' ? 'text-error-400' : 
                        entry.level === 'warn' ? 'text-warning-400' :
                        entry.level === 'success' ? 'text-success-400' :
                        'text-light-300'
                      }`}
                    >
                      {entry.rawText}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-5 py-4 border-t border-light-300 dark:border-dark-600">
              {(selectedJob.status === 'running' || selectedJob.status === 'pending') && (
                <button 
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-error-500 text-white font-medium rounded-xl hover:bg-error-600 transition-colors"
                  onClick={() => {
                    cancelBuildJob(selectedJob.id);
                    setSelectedJob(null);
                  }}
                >
                  <StopCircle size={18} />
                  <span>Abbrechen</span>
                </button>
              )}
              {selectedJob.status === 'failed' && (
                <button 
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors"
                  onClick={() => {
                    startBuild(selectedJob.projectId, selectedJob.goals);
                    setSelectedJob(null);
                  }}
                >
                  <RefreshCw size={18} />
                  <span>Erneut starten</span>
                </button>
              )}
              <button 
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-light-200 dark:bg-dark-600 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-500 transition-colors"
                onClick={() => openFullLog(selectedJob)}
              >
                <Maximize2 size={18} />
                <span>Vollständig</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
