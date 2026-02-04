/**
 * Job Detail View - Terminal-Neon Design
 * 
 * Process monitor with live log streaming.
 */

import React, { useEffect, useRef } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';

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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'running':
        return { symbol: '▶', text: 'RUNNING', class: 'text-neon-orange animate-pulse', border: 'border-neon-orange' };
      case 'pending':
        return { symbol: '◷', text: 'QUEUED', class: 'text-terminal-400', border: 'border-terminal-600' };
      case 'success':
        return { symbol: '✓', text: 'SUCCESS', class: 'text-neon-green', border: 'border-neon-green' };
      case 'failed':
        return { symbol: '✗', text: 'FAILED', class: 'text-neon-red', border: 'border-neon-red' };
      case 'cancelled':
        return { symbol: '○', text: 'CANCELLED', class: 'text-terminal-500', border: 'border-terminal-600' };
      default:
        return { symbol: '?', text: status.toUpperCase(), class: 'text-terminal-400', border: 'border-terminal-600' };
    }
  };

  const getLogLineClass = (line: string): string => {
    if (line.includes('[ERROR]') || line.includes('FAILURE') || line.includes('Exception')) {
      return 'text-neon-red';
    }
    if (line.includes('[WARNING]')) {
      return 'text-neon-orange';
    }
    if (line.includes('SUCCESS') || line.includes('BUILD SUCCESS')) {
      return 'text-neon-green font-bold';
    }
    if (line.includes('[INFO]')) {
      return 'text-terminal-400';
    }
    if (line.startsWith('---') || line.startsWith('===')) {
      return 'text-neon-cyan';
    }
    return 'text-terminal-300';
  };

  const formatDate = (date?: Date) => {
    if (!date) return '--:--:--';
    return new Date(date).toLocaleString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (start?: Date, end?: Date) => {
    if (!start) return '--:--';
    const endTime = end || new Date();
    const duration = Math.floor((endTime.getTime() - new Date(start).getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64 terminal-window">
        <div className="text-center">
          <div className="text-4xl text-terminal-700 mb-2 font-mono">404</div>
          <p className="text-terminal-500 font-mono text-sm">PROCESS_NOT_FOUND</p>
        </div>
      </div>
    );
  }

  const status = getStatusConfig(job.status);

  return (
    <div className="space-y-4 animate-fade-in h-full flex flex-col">
      {/* Process Header */}
      <div className="terminal-window">
        <div className="terminal-header">
          <span className={status.class}>{status.symbol}</span>
          <span>{job.name}</span>
          <span className="text-terminal-500">//</span>
          <span className="text-terminal-400">PID #{job.id.slice(-6)}</span>
        </div>
        
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Status Symbol */}
              <div className={`w-16 h-16 border-2 ${status.border} flex items-center justify-center bg-terminal-900`}>
                <span className={`text-3xl font-mono ${status.class}`}>
                  {status.symbol}
                </span>
              </div>
              
              <div>
                <h2 className="text-lg font-mono text-terminal-100">{job.name}</h2>
                <p className="text-terminal-500 font-mono text-sm mt-1">
                  $ mvn {job.mavenGoals.join(' ')}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-2 py-0.5 text-xs font-mono border ${status.border} ${status.class}`}>
                    {status.text}
                  </span>
                  {job.status === 'running' && (
                    <span className="text-sm text-neon-orange font-mono tabular-nums">
                      {job.progress}%
                    </span>
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
                [OPEN_DIR]
              </button>
              
              {job.status === 'running' ? (
                <button
                  onClick={handleCancel}
                  className="btn-danger text-xs"
                >
                  [KILL]
                </button>
              ) : (
                <button
                  onClick={handleRerun}
                  className="btn-neon text-xs"
                >
                  [RERUN]
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {job.status === 'running' && (
            <div className="mt-4 h-1 bg-terminal-800 overflow-hidden">
              <div
                className="h-full bg-neon-orange transition-all duration-300 relative"
                style={{ width: `${job.progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-data-stream" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-4 gap-2">
        <DetailCard 
          label="JDK" 
          value={job.jdkPath.split(/[/\\]/).pop() || '-'} 
        />
        <DetailCard 
          label="START" 
          value={formatDate(job.startedAt)} 
        />
        <DetailCard 
          label="END" 
          value={formatDate(job.completedAt)} 
        />
        <DetailCard 
          label="DURATION" 
          value={formatDuration(job.startedAt, job.completedAt)}
          highlight={job.status === 'running'}
        />
      </div>

      {/* Options/Flags */}
      {(job.skipTests || job.offline || job.enableThreads || (job.profiles && job.profiles.length > 0)) && (
        <div className="flex flex-wrap gap-2 px-1">
          {job.skipTests && (
            <span className="px-2 py-0.5 text-xs font-mono bg-terminal-800 text-terminal-400 border border-terminal-700">
              -DskipTests
            </span>
          )}
          {job.offline && (
            <span className="px-2 py-0.5 text-xs font-mono bg-terminal-800 text-terminal-400 border border-terminal-700">
              --offline
            </span>
          )}
          {job.enableThreads && (
            <span className="px-2 py-0.5 text-xs font-mono bg-terminal-800 text-terminal-400 border border-terminal-700">
              -T{job.threads}
            </span>
          )}
          {job.profiles?.map((profile) => (
            <span 
              key={profile} 
              className="px-2 py-0.5 text-xs font-mono bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30"
            >
              -P{profile}
            </span>
          ))}
        </div>
      )}

      {/* Log Output */}
      <div className="flex-1 terminal-window flex flex-col min-h-0 overflow-hidden">
        <div className="terminal-header justify-between">
          <div className="flex items-center gap-2">
            <span className="text-neon-green">▸</span>
            <span>STDOUT</span>
            <span className="text-terminal-600">|</span>
            <span className="text-terminal-400">{logs.length} lines</span>
          </div>
          {job.status === 'running' && (
            <span className="text-neon-green text-xs animate-pulse">● LIVE</span>
          )}
        </div>
        
        <div
          ref={logContainerRef}
          className="flex-1 overflow-auto p-4 font-mono text-xs bg-terminal-950 leading-relaxed"
        >
          {logs.length === 0 ? (
            <div className="text-terminal-600">
              <span className="animate-pulse">█</span> Waiting for output...
            </div>
          ) : (
            logs.map((line, index) => (
              <div 
                key={index} 
                className={`${getLogLineClass(line)} whitespace-pre-wrap break-all`}
              >
                <span className="text-terminal-700 select-none mr-3">
                  {String(index + 1).padStart(4, '0')}
                </span>
                {line}
              </div>
            ))
          )}
        </div>
        
        {/* Log Footer */}
        <div className="px-4 py-2 border-t border-terminal-700 flex items-center justify-between text-xs font-mono">
          <span className="text-terminal-600">
            {job.projectPath}
          </span>
          {job.status === 'running' && (
            <span className="text-terminal-500">
              Press Ctrl+C to cancel
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface DetailCardProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function DetailCard({ label, value, highlight }: DetailCardProps) {
  return (
    <div className="terminal-window p-3">
      <div className="text-terminal-600 text-[10px] font-mono uppercase mb-1">
        {label}
      </div>
      <p className={`font-mono text-sm truncate ${highlight ? 'text-neon-orange' : 'text-terminal-200'}`} title={value}>
        {value}
      </p>
    </div>
  );
}
