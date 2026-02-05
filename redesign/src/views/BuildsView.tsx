/**
 * Builds View - Build Queue & History
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Clock, CheckCircle2, XCircle, AlertCircle,
  StopCircle, Trash2, RefreshCw, ChevronRight
} from 'lucide-react';
import { useAppStore, useStats } from '../store/useAppStore';
import type { BuildJob } from '../store/useAppStore';
import { StatusIndicator, ProgressRing, GlassPanel } from '../components/shared';

type FilterType = 'all' | 'running' | 'pending' | 'success' | 'failed';

export default function BuildsView() {
  const { 
    buildJobs, 
    cancelBuildJob, 
    clearCompletedJobs,
    startBuild
  } = useAppStore();
  const stats = useStats();
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedJob, setSelectedJob] = useState<BuildJob | null>(null);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 size={18} />;
      case 'failed': return <XCircle size={18} />;
      case 'running': return <RefreshCw size={18} className="gfos-spin" />;
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

  return (
    <>
      {/* Page Header */}
      <motion.div 
        className="gfos-page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="gfos-page-title">
          <Play size={28} />
          <div>
            <h1>Builds</h1>
            <p>
              {stats.activeBuilds} aktiv, {stats.queuedBuilds} in Warteschlange
            </p>
          </div>
        </div>
        <div className="gfos-page-actions">
          <button 
            className="gfos-secondary-btn"
            onClick={clearCompletedJobs}
            disabled={completedJobs.length === 0}
          >
            <Trash2 size={18} />
            <span>Verlauf leeren</span>
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
        <div 
          className={`gfos-build-stat-card ${filter === 'all' ? 'gfos-stat-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <span className="gfos-stat-number">{buildJobs.length}</span>
          <span className="gfos-stat-label">Gesamt</span>
        </div>
        <div 
          className={`gfos-build-stat-card gfos-stat-running ${filter === 'running' ? 'gfos-stat-active' : ''}`}
          onClick={() => setFilter('running')}
        >
          <span className="gfos-stat-number">{runningJobs.length}</span>
          <span className="gfos-stat-label">Aktiv</span>
        </div>
        <div 
          className={`gfos-build-stat-card gfos-stat-pending ${filter === 'pending' ? 'gfos-stat-active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          <span className="gfos-stat-number">{pendingJobs.length}</span>
          <span className="gfos-stat-label">Wartend</span>
        </div>
        <div 
          className={`gfos-build-stat-card gfos-stat-success ${filter === 'success' ? 'gfos-stat-active' : ''}`}
          onClick={() => setFilter('success')}
        >
          <span className="gfos-stat-number">{stats.successfulBuilds}</span>
          <span className="gfos-stat-label">Erfolgreich</span>
        </div>
        <div 
          className={`gfos-build-stat-card gfos-stat-failed ${filter === 'failed' ? 'gfos-stat-active' : ''}`}
          onClick={() => setFilter('failed')}
        >
          <span className="gfos-stat-number">{stats.failedBuilds}</span>
          <span className="gfos-stat-label">Fehlgeschlagen</span>
        </div>
      </motion.div>

      {/* Builds List */}
      <GlassPanel className="gfos-builds-panel-full">
        <div className="gfos-builds-list-full">
          <AnimatePresence>
            {filteredJobs.length === 0 ? (
              <motion.div 
                className="gfos-empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Play size={48} />
                <h3>Keine Builds</h3>
                <p>
                  {filter === 'all' 
                    ? 'Starte einen Build um loszulegen.'
                    : `Keine Builds mit Status "${getStatusLabel(filter)}".`}
                </p>
              </motion.div>
            ) : (
              filteredJobs.map((job, i) => (
                <motion.div
                  key={job.id}
                  className={`gfos-build-row ${selectedJob?.id === job.id ? 'gfos-build-selected' : ''}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                  onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                >
                  <div className={`gfos-build-status-icon gfos-status-${job.status}`}>
                    {getStatusIcon(job.status)}
                  </div>
                  
                  <div className="gfos-build-main-info">
                    <h4>{job.projectName}</h4>
                    <span className="gfos-build-goals">{job.goals}</span>
                  </div>

                  <div className="gfos-build-meta">
                    <span className="gfos-build-jdk">{job.jdk}</span>
                  </div>

                  <div className="gfos-build-time-info">
                    <Clock size={14} />
                    <span>{job.startTime}</span>
                    {job.duration && (
                      <span className="gfos-build-duration">({job.duration})</span>
                    )}
                  </div>

                  {job.status === 'running' && (
                    <ProgressRing progress={job.progress} />
                  )}

                  <div className="gfos-build-actions">
                    {(job.status === 'running' || job.status === 'pending') && (
                      <button 
                        className="gfos-icon-btn-sm gfos-btn-danger-subtle"
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
                        className="gfos-icon-btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          startBuild(job.projectId, job.goals);
                        }}
                        title="Erneut versuchen"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                    <ChevronRight size={18} className="gfos-chevron" />
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </GlassPanel>

      {/* Build Details Sidebar */}
      <AnimatePresence>
        {selectedJob && (
          <motion.div 
            className="gfos-build-details-panel"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
          >
            <div className="gfos-details-header">
              <h3>Build Details</h3>
              <button 
                className="gfos-icon-btn-sm"
                onClick={() => setSelectedJob(null)}
              >
                <XCircle size={18} />
              </button>
            </div>
            
            <div className="gfos-details-content">
              <div className="gfos-detail-row">
                <label>Projekt</label>
                <span>{selectedJob.projectName}</span>
              </div>
              <div className="gfos-detail-row">
                <label>Status</label>
                <div className="gfos-detail-status">
                  <StatusIndicator status={selectedJob.status} size="small" />
                  <span>{getStatusLabel(selectedJob.status)}</span>
                </div>
              </div>
              <div className="gfos-detail-row">
                <label>Goals</label>
                <code>{selectedJob.goals}</code>
              </div>
              <div className="gfos-detail-row">
                <label>JDK</label>
                <span>{selectedJob.jdk}</span>
              </div>
              <div className="gfos-detail-row">
                <label>Gestartet</label>
                <span>{selectedJob.startTime}</span>
              </div>
              {selectedJob.duration && (
                <div className="gfos-detail-row">
                  <label>Dauer</label>
                  <span>{selectedJob.duration}</span>
                </div>
              )}
              {selectedJob.status === 'running' && (
                <div className="gfos-detail-row">
                  <label>Fortschritt</label>
                  <div className="gfos-progress-bar-full">
                    <div 
                      className="gfos-progress-fill"
                      style={{ width: `${selectedJob.progress}%` }}
                    />
                    <span>{selectedJob.progress}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="gfos-details-actions">
              {(selectedJob.status === 'running' || selectedJob.status === 'pending') && (
                <button 
                  className="gfos-danger-btn"
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
                  className="gfos-primary-btn"
                  onClick={() => {
                    startBuild(selectedJob.projectId, selectedJob.goals);
                    setSelectedJob(null);
                  }}
                >
                  <RefreshCw size={18} />
                  <span>Erneut starten</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
