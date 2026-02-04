/**
 * Jobs View - Terminal-Neon Design
 * 
 * Process queue with real-time status monitoring.
 */

import React, { useState } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';

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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'running':
        return { 
          symbol: '▶', 
          text: 'RUNNING', 
          class: 'text-neon-orange animate-pulse',
          bg: 'bg-neon-orange/10 border-neon-orange/30'
        };
      case 'pending':
        return { 
          symbol: '◷', 
          text: 'QUEUED', 
          class: 'text-terminal-400',
          bg: 'bg-terminal-800 border-terminal-600'
        };
      case 'success':
        return { 
          symbol: '✓', 
          text: 'SUCCESS', 
          class: 'text-neon-green',
          bg: 'bg-neon-green/10 border-neon-green/30'
        };
      case 'failed':
        return { 
          symbol: '✗', 
          text: 'FAILED', 
          class: 'text-neon-red',
          bg: 'bg-neon-red/10 border-neon-red/30'
        };
      case 'cancelled':
        return { 
          symbol: '○', 
          text: 'CANCELLED', 
          class: 'text-terminal-500',
          bg: 'bg-terminal-800 border-terminal-600'
        };
      default:
        return { 
          symbol: '?', 
          text: status.toUpperCase(), 
          class: 'text-terminal-400',
          bg: 'bg-terminal-800 border-terminal-600'
        };
    }
  };

  const formatDuration = (start?: Date, end?: Date) => {
    if (!start) return '--:--';
    const endTime = end || new Date();
    const duration = Math.floor((endTime.getTime() - new Date(start).getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const counts = {
    all: jobs.length,
    running: jobs.filter(j => j.status === 'running' || j.status === 'pending').length,
    completed: jobs.filter(j => j.status === 'success').length,
    failed: jobs.filter(j => j.status === 'failed').length
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Terminal Header */}
      <div className="terminal-window">
        <div className="terminal-header">
          <span className="text-neon-green">▸</span>
          <span>PROCESS_QUEUE</span>
          <span className="text-terminal-500">//</span>
          <span className="text-terminal-400">{jobs.length} total</span>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex border-b border-terminal-700">
          <FilterTab 
            active={filter === 'all'} 
            onClick={() => setFilter('all')}
            count={counts.all}
          >
            ALL
          </FilterTab>
          <FilterTab 
            active={filter === 'running'} 
            onClick={() => setFilter('running')}
            count={counts.running}
            accent="orange"
          >
            ACTIVE
          </FilterTab>
          <FilterTab 
            active={filter === 'completed'} 
            onClick={() => setFilter('completed')}
            count={counts.completed}
            accent="green"
          >
            PASSED
          </FilterTab>
          <FilterTab 
            active={filter === 'failed'} 
            onClick={() => setFilter('failed')}
            count={counts.failed}
            accent="red"
          >
            FAILED
          </FilterTab>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="terminal-window">
        {/* Table Header */}
        <div className="grid grid-cols-[auto_1fr_120px_100px_80px_100px] gap-4 px-4 py-2 
                        border-b border-terminal-700 text-xs text-terminal-500 font-mono uppercase">
          <div className="w-8">ST</div>
          <div>Process</div>
          <div>Goals</div>
          <div className="text-right">Duration</div>
          <div className="text-right">PID</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl text-terminal-700 mb-4 font-mono">[ ]</div>
            <p className="text-terminal-500 text-sm font-mono">
              {filter === 'all' ? 'NO_PROCESSES_IN_QUEUE' : `NO_${filter.toUpperCase()}_PROCESSES`}
            </p>
            <p className="text-terminal-600 text-xs mt-2 font-mono">
              Start a build from a project to see it here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-terminal-800">
            {filteredJobs.map((job, index) => {
              const status = getStatusConfig(job.status);
              return (
                <div
                  key={job.id}
                  className="grid grid-cols-[auto_1fr_120px_100px_80px_100px] gap-4 px-4 py-3
                             hover:bg-terminal-800/50 transition-colors group cursor-pointer"
                  onClick={() => handleViewJob(job.id)}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Status Indicator */}
                  <div className="w-8 flex items-center justify-center">
                    <span className={`text-lg font-mono ${status.class}`}>
                      {status.symbol}
                    </span>
                  </div>

                  {/* Job Name & Info */}
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                      <span className="text-terminal-200 font-mono text-sm truncate group-hover:text-neon-green transition-colors">
                        {job.name}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-mono border ${status.bg}`}>
                        {status.text}
                      </span>
                    </div>
                    <span className="text-terminal-500 text-xs font-mono">
                      {new Date(job.createdAt).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    
                    {/* Progress Bar for Running Jobs */}
                    {job.status === 'running' && (
                      <div className="mt-2 h-1 bg-terminal-800 overflow-hidden">
                        <div 
                          className="h-full bg-neon-orange transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Maven Goals */}
                  <div className="flex items-center">
                    <span className="text-terminal-400 text-xs font-mono truncate">
                      {job.mavenGoals.join(' ')}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center justify-end">
                    <span className={`text-xs font-mono tabular-nums ${
                      job.status === 'running' ? 'text-neon-orange' : 'text-terminal-400'
                    }`}>
                      {formatDuration(job.startedAt, job.completedAt)}
                    </span>
                  </div>

                  {/* PID */}
                  <div className="flex items-center justify-end">
                    <span className="text-terminal-600 text-xs font-mono">
                      #{job.id.slice(-6)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleViewJob(job.id)}
                      className="p-1.5 text-terminal-500 hover:text-neon-cyan hover:bg-terminal-800 
                                 transition-colors font-mono text-xs"
                      title="View logs"
                    >
                      [LOG]
                    </button>
                    
                    {job.status === 'running' && (
                      <button
                        onClick={() => handleCancelJob(job.id)}
                        className="p-1.5 text-terminal-500 hover:text-neon-red hover:bg-terminal-800 
                                   transition-colors font-mono text-xs"
                        title="Cancel"
                      >
                        [×]
                      </button>
                    )}
                    
                    {(job.status === 'success' || job.status === 'failed' || job.status === 'cancelled') && (
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="p-1.5 text-terminal-500 hover:text-neon-red hover:bg-terminal-800 
                                   transition-colors font-mono text-xs"
                        title="Remove"
                      >
                        [DEL]
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Footer Stats */}
        <div className="px-4 py-2 border-t border-terminal-700 flex items-center justify-between 
                        text-xs font-mono text-terminal-500">
          <span>
            Showing {filteredJobs.length} of {jobs.length} processes
          </span>
          <span>
            {counts.running > 0 && (
              <span className="text-neon-orange mr-4">● {counts.running} active</span>
            )}
            {counts.failed > 0 && (
              <span className="text-neon-red">● {counts.failed} failed</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
  accent?: 'green' | 'red' | 'orange';
}

function FilterTab({ active, onClick, children, count, accent }: FilterTabProps) {
  const accentColors = {
    green: 'text-neon-green border-neon-green',
    red: 'text-neon-red border-neon-red',
    orange: 'text-neon-orange border-neon-orange'
  };
  
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 text-xs font-mono transition-all relative
        ${active 
          ? `${accent ? accentColors[accent] : 'text-neon-green border-neon-green'} border-b-2` 
          : 'text-terminal-500 hover:text-terminal-300 border-b-2 border-transparent'
        }
      `}
    >
      {children}
      <span className={`ml-2 ${active ? '' : 'text-terminal-600'}`}>
        [{count}]
      </span>
    </button>
  );
}
