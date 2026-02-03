/**
 * Job Detail View
 * 
 * Shows detailed job information with live logs.
 */

import React, { useEffect, useRef } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import { 
  CheckCircle2, 
  XCircle, 
  Clock,
  Play,
  StopCircle,
  Coffee,
  Terminal,
  FolderOpen,
  RotateCcw
} from 'lucide-react';

export function JobDetailView() {
  const selectedJobId = useAppStore((state) => state.selectedJobId);
  const jobs = useAppStore((state) => state.jobs);
  const jobLogs = useAppStore((state) => state.jobLogs);
  const addJob = useAppStore((state) => state.addJob);
  const updateJob = useAppStore((state) => state.updateJob);
  
  const logContainerRef = useRef<HTMLDivElement>(null);

  const job = jobs.find((j) => j.id === selectedJobId);
  const logs = selectedJobId ? jobLogs[selectedJobId] || [] : [];

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCancel = async () => {
    if (!job) return;
    try {
      await api.cancelBuild(job.id);
    } catch (error) {
      console.error('Failed to cancel:', error);
    }
  };

  const handleRerun = async () => {
    if (!job) return;
    
    const newJobId = addJob({
      projectPath: job.projectPath,
      modulePath: job.modulePath,
      name: job.name,
      jdkPath: job.jdkPath,
      mavenGoals: job.mavenGoals,
      skipTests: job.skipTests,
      offline: job.offline,
      enableThreads: job.enableThreads,
      threads: job.threads,
      profiles: job.profiles,
    });

    updateJob(newJobId, { status: 'running', startedAt: new Date() });

    try {
      await api.startBuild({
        ...job,
        id: newJobId,
        status: 'running',
        progress: 0,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to start build:', error);
      updateJob(newJobId, { status: 'failed' });
    }
  };

  const handleOpenFolder = () => {
    if (job) {
      api.openPath(job.projectPath);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play size={20} className="text-yellow-400 animate-pulse" />;
      case 'pending':
        return <Clock size={20} className="text-slate-400" />;
      case 'success':
        return <CheckCircle2 size={20} className="text-green-400" />;
      case 'failed':
        return <XCircle size={20} className="text-red-400" />;
      case 'cancelled':
        return <StopCircle size={20} className="text-slate-400" />;
      default:
        return <Clock size={20} className="text-slate-400" />;
    }
  };

  const getLogLineClass = (line: string): string => {
    if (line.includes('[ERROR]') || line.includes('FAILURE')) return 'log-line error';
    if (line.includes('[WARNING]')) return 'log-line warning';
    if (line.includes('SUCCESS') || line.includes('BUILD SUCCESS')) return 'log-line success';
    return 'log-line info';
  };

  const formatDate = (date?: Date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('de-DE');
  };

  const formatDuration = (start?: Date, end?: Date) => {
    if (!start) return '-';
    const endTime = end || new Date();
    const duration = Math.floor((endTime.getTime() - new Date(start).getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds}s`;
  };

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Job nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      {/* Job Header */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
              job.status === 'running' ? 'bg-yellow-500/20' :
              job.status === 'success' ? 'bg-green-500/20' :
              job.status === 'failed' ? 'bg-red-500/20' :
              'bg-slate-700'
            }`}>
              {getStatusIcon(job.status)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{job.name}</h2>
              <p className="text-slate-400 mt-1">{job.mavenGoals.join(' ')}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  job.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                  job.status === 'success' ? 'bg-green-500/20 text-green-400' :
                  job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-600 text-slate-300'
                }`}>
                  {job.status === 'running' ? 'Läuft' :
                   job.status === 'success' ? 'Erfolgreich' :
                   job.status === 'failed' ? 'Fehlgeschlagen' :
                   job.status === 'cancelled' ? 'Abgebrochen' : 'Wartend'}
                </span>
                {job.status === 'running' && (
                  <span className="text-sm text-slate-400">{job.progress}%</span>
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
            
            {job.status === 'running' ? (
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors flex items-center gap-2"
              >
                <StopCircle size={18} />
                Abbrechen
              </button>
            ) : (
              <button
                onClick={handleRerun}
                className="px-4 py-2 rounded-lg bg-gfos-600 text-white hover:bg-gfos-500 transition-colors flex items-center gap-2"
              >
                <RotateCcw size={18} />
                Erneut starten
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {job.status === 'running' && (
          <div className="mt-4 w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gfos-500 to-gfos-400 transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-4 gap-4">
        <DetailCard label="JDK" value={job.jdkPath.split(/[/\\]/).pop() || '-'} icon={<Coffee size={16} />} />
        <DetailCard label="Gestartet" value={formatDate(job.startedAt)} />
        <DetailCard label="Beendet" value={formatDate(job.completedAt)} />
        <DetailCard label="Dauer" value={formatDuration(job.startedAt, job.completedAt)} />
      </div>

      {/* Options */}
      {(job.skipTests || job.offline || job.enableThreads || (job.profiles && job.profiles.length > 0)) && (
        <div className="flex flex-wrap gap-2">
          {job.skipTests && (
            <span className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded">-DskipTests</span>
          )}
          {job.offline && (
            <span className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded">Offline</span>
          )}
          {job.enableThreads && (
            <span className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded">-T {job.threads}</span>
          )}
          {job.profiles?.map((profile) => (
            <span key={profile} className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded">
              {profile}
            </span>
          ))}
        </div>
      )}

      {/* Log Output */}
      <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col min-h-0">
        <div className="p-3 border-b border-slate-700 flex items-center gap-2">
          <Terminal size={18} className="text-gfos-400" />
          <h3 className="text-sm font-medium text-white">Build Log</h3>
          <span className="text-xs text-slate-400">({logs.length} Zeilen)</span>
        </div>
        
        <div
          ref={logContainerRef}
          className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-900"
        >
          {logs.length === 0 ? (
            <p className="text-slate-500">Warte auf Log-Ausgabe...</p>
          ) : (
            logs.map((line, index) => (
              <div key={index} className={getLogLineClass(line)}>
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface DetailCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

function DetailCard({ label, value, icon }: DetailCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
        {icon}
        {label}
      </div>
      <p className="text-white text-sm font-medium truncate" title={value}>
        {value}
      </p>
    </div>
  );
}
