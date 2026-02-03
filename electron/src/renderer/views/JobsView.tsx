/**
 * Jobs View
 * 
 * Shows all build jobs with status.
 */

import React, { useState } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Trash2,
  StopCircle,
  Eye,
  Filter
} from 'lucide-react';

type JobFilter = 'all' | 'running' | 'completed' | 'failed';

export function JobsView() {
  const jobs = useAppStore((state) => state.jobs);
  const removeJob = useAppStore((state) => state.removeJob);
  const selectJob = useAppStore((state) => state.selectJob);
  const setScreen = useAppStore((state) => state.setScreen);
  
  const [filter, setFilter] = useState<JobFilter>('all');

  const filteredJobs = jobs.filter((job) => {
    switch (filter) {
      case 'running':
        return job.status === 'running' || job.status === 'pending';
      case 'completed':
        return job.status === 'success';
      case 'failed':
        return job.status === 'failed' || job.status === 'cancelled';
      default:
        return true;
    }
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleViewJob = (jobId: string) => {
    selectJob(jobId);
    setScreen('JOB_DETAIL');
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await api.cancelBuild(jobId);
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  const handleDeleteJob = (jobId: string) => {
    removeJob(jobId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play size={18} className="text-yellow-400 animate-pulse" />;
      case 'pending':
        return <Clock size={18} className="text-slate-400" />;
      case 'success':
        return <CheckCircle2 size={18} className="text-green-400" />;
      case 'failed':
        return <XCircle size={18} className="text-red-400" />;
      case 'cancelled':
        return <StopCircle size={18} className="text-slate-400" />;
      default:
        return <Clock size={18} className="text-slate-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return 'Läuft';
      case 'pending': return 'Wartend';
      case 'success': return 'Erfolgreich';
      case 'failed': return 'Fehlgeschlagen';
      case 'cancelled': return 'Abgebrochen';
      default: return status;
    }
  };

  const formatDuration = (start?: Date, end?: Date) => {
    if (!start) return '-';
    const endTime = end || new Date();
    const duration = Math.floor((endTime.getTime() - new Date(start).getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            Alle ({jobs.length})
          </FilterButton>
          <FilterButton active={filter === 'running'} onClick={() => setFilter('running')}>
            Aktiv ({jobs.filter(j => j.status === 'running' || j.status === 'pending').length})
          </FilterButton>
          <FilterButton active={filter === 'completed'} onClick={() => setFilter('completed')}>
            Erfolgreich ({jobs.filter(j => j.status === 'success').length})
          </FilterButton>
          <FilterButton active={filter === 'failed'} onClick={() => setFilter('failed')}>
            Fehlgeschlagen ({jobs.filter(j => j.status === 'failed').length})
          </FilterButton>
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {filteredJobs.length === 0 ? (
          <div className="p-12 text-center">
            <Clock size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">
              {filter === 'all' ? 'Keine Jobs vorhanden' : 'Keine Jobs in dieser Kategorie'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 flex items-center gap-4 hover:bg-slate-700/50 transition-colors"
              >
                {/* Status Icon */}
                <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                  {getStatusIcon(job.status)}
                </div>

                {/* Job Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white truncate">{job.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">
                      {job.mavenGoals.join(' ')}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-500">
                      {new Date(job.createdAt).toLocaleTimeString('de-DE')}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  {job.status === 'running' && (
                    <div className="mt-2 w-full h-1.5 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gfos-500 transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Duration */}
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded ${
                    job.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                    job.status === 'success' ? 'bg-green-500/20 text-green-400' :
                    job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-600 text-slate-300'
                  }`}>
                    {getStatusText(job.status)}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatDuration(job.startedAt, job.completedAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleViewJob(job.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
                    title="Details anzeigen"
                  >
                    <Eye size={18} />
                  </button>
                  
                  {job.status === 'running' && (
                    <button
                      onClick={() => handleCancelJob(job.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-600 transition-colors"
                      title="Abbrechen"
                    >
                      <StopCircle size={18} />
                    </button>
                  )}
                  
                  {(job.status === 'success' || job.status === 'failed' || job.status === 'cancelled') && (
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-600 transition-colors"
                      title="Löschen"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterButton({ active, onClick, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 text-sm font-medium rounded-md transition-colors
        ${active 
          ? 'bg-gfos-600 text-white' 
          : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }
      `}
    >
      {children}
    </button>
  );
}
