/**
 * JobLogView - Live Build Log Viewer
 * Shows build output with ANSI color parsing and auto-scroll
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Terminal, Search, 
  ArrowDown, ArrowUp, Pause, Play, X,
  RefreshCw, CheckCircle2, XCircle, Clock,
  Copy
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { 
  getStyleCSS, 
  createLogEntry, 
  SAMPLE_MAVEN_OUTPUT,
  formatLogTimestamp
} from '../utils/ansiParser';
import type { LogEntry } from '../types';
import { GlassPanel } from '../components/shared';

export default function JobLogView() {
  const { 
    buildJobs,
    selectedJobId,
    goBack,
    cancelBuildJob,
    startBuild,
    addNotification
  } = useAppStore();

  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  const job = buildJobs.find(j => j.id === selectedJobId);

  // Generate log entries from job logs
  const logEntries: LogEntry[] = useMemo(() => {
    if (!job?.logs) {
      // Use sample output for demo
      return SAMPLE_MAVEN_OUTPUT.map((line, i) => createLogEntry(line, `log-${i}`));
    }
    return job.logs.map((line, i) => createLogEntry(line, `log-${i}`));
  }, [job?.logs]);

  // Filter logs by search
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logEntries;
    const lower = searchQuery.toLowerCase();
    return logEntries.filter(entry => 
      entry.rawText.toLowerCase().includes(lower)
    );
  }, [logEntries, searchQuery]);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logEntries, autoScroll]);

  // Handle scroll to detect manual scrolling
  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  const scrollToTop = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
      setAutoScroll(false);
    }
  };

  const handleCopyLogs = () => {
    const text = logEntries.map(e => e.rawText).join('\n');
    navigator.clipboard.writeText(text);
    addNotification('success', 'Logs in Zwischenablage kopiert');
  };

  const handleRerun = () => {
    if (job) {
      startBuild(job.projectId, job.goals);
      addNotification('info', `Build "${job.projectName}" neu gestartet`);
    }
  };

  const handleCancel = () => {
    if (job) {
      cancelBuildJob(job.id);
      addNotification('warning', `Build "${job.projectName}" abgebrochen`);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'running':
        return { icon: RefreshCw, label: 'Läuft', class: 'bg-info-100 dark:bg-info-900/30 text-info-600 dark:text-info-400' };
      case 'pending':
        return { icon: Clock, label: 'Wartend', class: 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400' };
      case 'success':
        return { icon: CheckCircle2, label: 'Erfolgreich', class: 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400' };
      case 'failed':
        return { icon: XCircle, label: 'Fehlgeschlagen', class: 'bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400' };
      case 'cancelled':
        return { icon: X, label: 'Abgebrochen', class: 'bg-light-200 dark:bg-dark-700 text-dark-400 dark:text-light-400' };
      default:
        return { icon: Clock, label: status, class: 'bg-light-200 dark:bg-dark-700 text-dark-400 dark:text-light-400' };
    }
  };

  const getLevelClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'bg-error-50/50 dark:bg-error-900/10 border-l-2 border-error-500';
      case 'warn': return 'bg-warning-50/50 dark:bg-warning-900/10 border-l-2 border-warning-500';
      case 'success': return 'bg-success-50/50 dark:bg-success-900/10 border-l-2 border-success-500';
      case 'debug': return 'text-dark-300 dark:text-light-500';
      default: return '';
    }
  };

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-dark-300">
        <Terminal size={48} className="mb-4 text-dark-200" />
        <h3 className="text-lg font-semibold text-dark-400 dark:text-light-200 mb-2">Kein Build ausgewählt</h3>
        <p className="text-dark-300 dark:text-light-400 mb-6">Wähle einen Build aus, um die Logs anzuzeigen.</p>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors" onClick={goBack}>
          <ArrowLeft size={18} />
          <span>Zurück</span>
        </button>
      </div>
    );
  }

  const status = getStatusConfig(job.status);
  const StatusIcon = status.icon;

  return (
    <>
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <button className="flex items-center justify-center w-10 h-10 rounded-xl bg-light-200 dark:bg-dark-700 text-dark-400 hover:bg-light-300 dark:hover:bg-dark-600 transition-colors" onClick={goBack}>
            <ArrowLeft size={20} />
          </button>
          <Terminal size={28} className="text-dark-400" />
          <div>
            <h1 className="text-2xl font-bold text-dark-500 dark:text-light-100">{job.projectName}</h1>
            <p className="text-sm text-dark-300 dark:text-light-400">
              <code className="px-2 py-0.5 bg-light-200 dark:bg-dark-700 rounded text-xs">{job.goals}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${status.class}`}>
            <StatusIcon size={16} className={job.status === 'running' ? 'animate-spin' : ''} />
            <span className="text-sm font-medium">{status.label}</span>
            {job.status === 'running' && (
              <span className="text-sm">{job.progress}%</span>
            )}
          </div>
          {job.status === 'running' || job.status === 'pending' ? (
            <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-error-500 text-white font-medium rounded-xl hover:bg-error-600 transition-colors" onClick={handleCancel}>
              <X size={18} />
              <span>Abbrechen</span>
            </button>
          ) : (
            <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors" onClick={handleRerun}>
              <RefreshCw size={18} />
              <span>Neu starten</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Log Controls */}
      <motion.div 
        className="flex items-center justify-between mt-4 p-3 bg-light-100 dark:bg-dark-700/50 rounded-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-petrol-100 dark:bg-petrol-900/30 text-petrol-600 dark:text-petrol-400 rounded-lg font-medium">{job.jdk}</span>
          <span className="flex items-center gap-1.5 text-dark-300 dark:text-light-400">
            <Clock size={14} />
            {job.startTime}
            {job.duration && ` (${job.duration})`}
          </span>
          <span className="text-dark-300 dark:text-light-400">
            {logEntries.length} Zeilen
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Search Toggle */}
          <button 
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${searchOpen ? 'bg-petrol-100 dark:bg-petrol-900/30 text-petrol-500' : 'text-dark-300 hover:bg-light-200 dark:hover:bg-dark-600'}`}
            onClick={() => setSearchOpen(!searchOpen)}
            title="Suchen"
          >
            <Search size={18} />
          </button>
          
          {/* Scroll Controls */}
          <button 
            className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:bg-light-200 dark:hover:bg-dark-700 transition-colors"
            onClick={scrollToTop}
            title="Nach oben"
          >
            <ArrowUp size={18} />
          </button>
          <button 
            className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:bg-light-200 dark:hover:bg-dark-700 transition-colors"
            onClick={scrollToBottom}
            title="Nach unten"
          >
            <ArrowDown size={18} />
          </button>
          
          {/* Auto-scroll Toggle */}
          <button 
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${autoScroll ? 'bg-petrol-100 dark:bg-petrol-900/30 text-petrol-500' : 'text-dark-300 hover:bg-light-200 dark:hover:bg-dark-600'}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Auto-Scroll pausieren' : 'Auto-Scroll aktivieren'}
          >
            {autoScroll ? <Pause size={18} /> : <Play size={18} />}
          </button>
          
          {/* Copy */}
          <button 
            className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:bg-light-200 dark:hover:bg-dark-700 transition-colors"
            onClick={handleCopyLogs}
            title="Logs kopieren"
          >
            <Copy size={18} />
          </button>
        </div>
      </motion.div>

      {/* Search Bar */}
      {searchOpen && (
        <motion.div 
          className="flex items-center gap-3 mt-3 p-3 bg-white dark:bg-dark-800 rounded-xl border border-light-300 dark:border-dark-600"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Search size={18} className="text-dark-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="In Logs suchen..."
            autoFocus
            className="flex-1 bg-transparent text-dark-500 dark:text-light-100 placeholder-dark-300 focus:outline-none"
          />
          {searchQuery && (
            <span className="text-sm text-dark-300 dark:text-light-400">
              {filteredLogs.length} Treffer
            </span>
          )}
          <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} className="text-dark-300 hover:text-dark-500 transition-colors">
            <X size={18} />
          </button>
        </motion.div>
      )}

      {/* Log Container */}
      <GlassPanel className="mt-4 flex-1 overflow-hidden">
        <div 
          ref={logContainerRef}
          className="h-[calc(100vh-320px)] overflow-auto font-mono text-sm"
          onScroll={handleScroll}
        >
          {filteredLogs.map((entry, index) => (
            <div 
              key={entry.id}
              className={`flex items-start gap-3 px-4 py-1 hover:bg-light-100/50 dark:hover:bg-dark-700/30 cursor-pointer ${getLevelClass(entry.level)} ${
                highlightedLine === index ? 'bg-petrol-50 dark:bg-petrol-900/20' : ''
              }`}
              onClick={() => setHighlightedLine(index === highlightedLine ? null : index)}
            >
              <span className="w-12 text-right text-dark-300 dark:text-light-500 select-none shrink-0">{index + 1}</span>
              <span className="w-20 text-dark-300 dark:text-light-500 shrink-0">
                {formatLogTimestamp(entry.timestamp)}
              </span>
              <span className="flex-1 whitespace-pre-wrap break-all">
                {entry.segments.map((segment, segIndex) => (
                  <span 
                    key={segIndex} 
                    style={getStyleCSS(segment.style)}
                  >
                    {segment.text}
                  </span>
                ))}
              </span>
            </div>
          ))}
          
          {job.status === 'running' && (
            <div className="px-4 py-2">
              <span className="inline-block w-2 h-4 bg-petrol-500 animate-pulse">▌</span>
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Auto-scroll indicator */}
      {!autoScroll && job.status === 'running' && (
        <motion.button
          className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-petrol-500 text-white rounded-xl shadow-lg hover:bg-petrol-600 transition-colors"
          onClick={scrollToBottom}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ArrowDown size={16} />
          <span>Neue Logs verfügbar</span>
        </motion.button>
      )}
    </>
  );
}
