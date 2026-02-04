/**
 * Jobs View - Premium Terminal Edition
 * 
 * Process queue with real-time status monitoring and advanced animations.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import { Activity, Zap, CheckCircle2, XCircle, Clock, Trash2, Eye, Square } from 'lucide-react';

type JobFilter = 'all' | 'running' | 'completed' | 'failed';

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
  exit: { opacity: 0, x: 30, transition: { duration: 0.2 } },
};

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
          icon: <Activity size={14} />,
          text: 'RUNNING', 
          class: 'text-neon-orange',
          bg: 'bg-neon-orange/10 border-neon-orange/30',
          glow: 'shadow-[0_0_10px_rgba(255,149,0,0.3)]',
          pulse: true
        };
      case 'pending':
        return { 
          symbol: '◷', 
          icon: <Clock size={14} />,
          text: 'QUEUED', 
          class: 'text-zinc-400',
          bg: 'bg-zinc-800 border-zinc-600',
          glow: '',
          pulse: true
        };
      case 'success':
        return { 
          symbol: '✓', 
          icon: <CheckCircle2 size={14} />,
          text: 'SUCCESS', 
          class: 'text-neon-green',
          bg: 'bg-neon-green/10 border-neon-green/30',
          glow: '',
          pulse: false
        };
      case 'failed':
        return { 
          symbol: '✗', 
          icon: <XCircle size={14} />,
          text: 'FAILED', 
          class: 'text-neon-red',
          bg: 'bg-neon-red/10 border-neon-red/30',
          glow: '',
          pulse: false
        };
      case 'cancelled':
        return { 
          symbol: '○', 
          icon: <Square size={14} />,
          text: 'CANCELLED', 
          class: 'text-zinc-500',
          bg: 'bg-zinc-800 border-zinc-600',
          glow: '',
          pulse: false
        };
      default:
        return { 
          symbol: '?', 
          icon: null,
          text: status.toUpperCase(), 
          class: 'text-zinc-400',
          bg: 'bg-zinc-800 border-zinc-600',
          glow: '',
          pulse: false
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
    <motion.div 
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Terminal Header */}
      <motion.div 
        className="terminal-window overflow-hidden"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="terminal-header flex items-center gap-2">
          <motion.span 
            className="text-neon-green"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ▸
          </motion.span>
          <span>PROCESS_QUEUE</span>
          <span className="text-zinc-700">//</span>
          <span className="text-zinc-500">{jobs.length} total</span>
          {counts.running > 0 && (
            <motion.span 
              className="ml-2 text-neon-orange"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              ● {counts.running} active
            </motion.span>
          )}
        </div>
        
        {/* Filter Tabs */}
        <div className="flex border-b border-terminal-border">
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
      </motion.div>

      {/* Jobs Table */}
      <motion.div 
        className="terminal-window overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Table Header */}
        <motion.div 
          className="grid grid-cols-[auto_1fr_120px_100px_80px_100px] gap-4 px-4 py-2 
                      border-b border-terminal-border text-xs text-zinc-600 font-mono uppercase bg-terminal-mid/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-8">ST</div>
          <div>Process</div>
          <div>Goals</div>
          <div className="text-right">Duration</div>
          <div className="text-right">PID</div>
          <div className="text-right">Actions</div>
        </motion.div>

        {/* Jobs List */}
        <AnimatePresence mode="wait">
          {filteredJobs.length === 0 ? (
            <motion.div 
              className="p-12 text-center"
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <motion.div 
                className="text-4xl text-zinc-800 mb-4 font-mono"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                [ ]
              </motion.div>
              <p className="text-zinc-500 text-sm font-mono">
                {filter === 'all' ? 'NO_PROCESSES_IN_QUEUE' : `NO_${filter.toUpperCase()}_PROCESSES`}
              </p>
              <p className="text-zinc-600 text-xs mt-2 font-mono">
                Start a build from a project to see it here
              </p>
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              className="divide-y divide-terminal-border/50"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence>
                {filteredJobs.map((job) => {
                  const status = getStatusConfig(job.status);
                  return (
                    <motion.div
                      key={job.id}
                      variants={rowVariants}
                      exit="exit"
                      layout
                      className={`grid grid-cols-[auto_1fr_120px_100px_80px_100px] gap-4 px-4 py-3
                                 hover:bg-terminal-mid/50 transition-colors group cursor-pointer
                                 relative overflow-hidden`}
                      onClick={() => handleViewJob(job.id)}
                      whileHover={{ x: 4, backgroundColor: "rgba(0, 255, 136, 0.02)" }}
                      whileTap={{ scale: 0.995 }}
                    >
                      {/* Hover glow */}
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-r from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none"
                      />
                      
                      {/* Status Indicator */}
                      <div className="w-8 flex items-center justify-center relative z-10">
                        <motion.span 
                          className={`text-lg font-mono ${status.class} ${status.glow}`}
                          animate={status.pulse ? { 
                            scale: [1, 1.2, 1],
                            opacity: [1, 0.7, 1] 
                          } : {}}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          {status.symbol}
                        </motion.span>
                      </div>

                      {/* Job Name & Info */}
                      <div className="min-w-0 flex flex-col justify-center relative z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-200 font-mono text-sm truncate group-hover:text-neon-green transition-colors">
                            {job.name}
                          </span>
                          <motion.span 
                            className={`px-1.5 py-0.5 text-[10px] font-mono border ${status.bg}`}
                            whileHover={{ scale: 1.05 }}
                          >
                            {status.text}
                          </motion.span>
                        </div>
                        <span className="text-zinc-600 text-xs font-mono">
                          {new Date(job.createdAt).toLocaleString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        
                        {/* Progress Bar for Running Jobs */}
                        {job.status === 'running' && (
                          <div className="mt-2 h-1.5 bg-terminal-mid overflow-hidden relative">
                            <motion.div 
                              className="h-full bg-neon-orange"
                              initial={{ width: 0 }}
                              animate={{ width: `${job.progress}%` }}
                              transition={{ duration: 0.3 }}
                            />
                            {/* Shimmer effect */}
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                              animate={{ x: ["-100%", "200%"] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Maven Goals */}
                      <div className="flex items-center relative z-10">
                        <span className="text-zinc-500 text-xs font-mono truncate">
                          {job.mavenGoals.join(' ')}
                        </span>
                      </div>

                      {/* Duration */}
                      <div className="flex items-center justify-end relative z-10">
                        <motion.span 
                          className={`text-xs font-mono tabular-nums ${
                            job.status === 'running' ? 'text-neon-orange' : 'text-zinc-500'
                          }`}
                          key={formatDuration(job.startedAt, job.completedAt)}
                          initial={{ scale: job.status === 'running' ? 1.1 : 1 }}
                          animate={{ scale: 1 }}
                        >
                          {formatDuration(job.startedAt, job.completedAt)}
                        </motion.span>
                      </div>

                      {/* PID */}
                      <div className="flex items-center justify-end relative z-10">
                        <span className="text-zinc-600 text-xs font-mono">
                          #{job.id.slice(-6)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1 relative z-10" onClick={e => e.stopPropagation()}>
                        <motion.button
                          onClick={() => handleViewJob(job.id)}
                          className="p-1.5 text-zinc-600 hover:text-neon-cyan transition-colors"
                          title="View logs"
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Eye size={14} />
                        </motion.button>
                        
                        {job.status === 'running' && (
                          <motion.button
                            onClick={() => handleCancelJob(job.id)}
                            className="p-1.5 text-zinc-600 hover:text-neon-red transition-colors"
                            title="Cancel"
                            whileHover={{ scale: 1.15, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                          >
                            <Square size={14} />
                          </motion.button>
                        )}
                        
                        {(job.status === 'success' || job.status === 'failed' || job.status === 'cancelled') && (
                          <motion.button
                            onClick={() => handleDeleteJob(job.id)}
                            className="p-1.5 text-zinc-600 hover:text-neon-red transition-colors"
                            title="Remove"
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2 size={14} />
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Footer Stats */}
        <motion.div 
          className="px-4 py-2 border-t border-terminal-border flex items-center justify-between 
                      text-xs font-mono text-zinc-600 bg-terminal-mid/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span>
            Showing {filteredJobs.length} of {jobs.length} processes
          </span>
          <div className="flex items-center gap-4">
            {counts.running > 0 && (
              <motion.span 
                className="text-neon-orange flex items-center gap-1"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Zap size={12} /> {counts.running} active
              </motion.span>
            )}
            {counts.failed > 0 && (
              <span className="text-neon-red flex items-center gap-1">
                <XCircle size={12} /> {counts.failed} failed
              </span>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
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
    green: 'border-neon-green text-neon-green',
    red: 'border-neon-red text-neon-red',
    orange: 'border-neon-orange text-neon-orange'
  };
  
  return (
    <motion.button
      onClick={onClick}
      className={`
        px-4 py-2 text-xs font-mono transition-all relative
        ${active 
          ? `${accent ? accentColors[accent] : 'border-neon-green text-neon-green'} border-b-2` 
          : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
        }
      `}
      whileHover={!active ? { backgroundColor: "rgba(255,255,255,0.03)" } : {}}
      whileTap={{ scale: 0.95 }}
    >
      {children}
      <motion.span 
        className={`ml-2 ${active ? '' : 'text-zinc-600'}`}
        key={count}
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
      >
        [{count}]
      </motion.span>
      
      {active && (
        <motion.div
          layoutId="jobs-filter-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-current"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </motion.button>
  );
}
