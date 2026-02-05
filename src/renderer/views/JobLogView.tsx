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
        return { icon: RefreshCw, label: 'Läuft', class: 'gfos-status-running' };
      case 'pending':
        return { icon: Clock, label: 'Wartend', class: 'gfos-status-pending' };
      case 'success':
        return { icon: CheckCircle2, label: 'Erfolgreich', class: 'gfos-status-success' };
      case 'failed':
        return { icon: XCircle, label: 'Fehlgeschlagen', class: 'gfos-status-failed' };
      case 'cancelled':
        return { icon: X, label: 'Abgebrochen', class: 'gfos-status-cancelled' };
      default:
        return { icon: Clock, label: status, class: '' };
    }
  };

  const getLevelClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'gfos-log-error';
      case 'warn': return 'gfos-log-warn';
      case 'success': return 'gfos-log-success';
      case 'debug': return 'gfos-log-debug';
      default: return '';
    }
  };

  if (!job) {
    return (
      <div className="gfos-empty-state">
        <Terminal size={48} />
        <h3>Kein Build ausgewählt</h3>
        <p>Wähle einen Build aus, um die Logs anzuzeigen.</p>
        <button className="gfos-secondary-btn" onClick={goBack}>
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
        className="gfos-page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="gfos-page-title">
          <button className="gfos-back-btn" onClick={goBack}>
            <ArrowLeft size={20} />
          </button>
          <Terminal size={28} />
          <div>
            <h1>{job.projectName}</h1>
            <p>
              <code>{job.goals}</code>
            </p>
          </div>
        </div>
        <div className="gfos-page-actions">
          <div className={`gfos-status-badge ${status.class}`}>
            <StatusIcon size={16} className={job.status === 'running' ? 'gfos-spin' : ''} />
            <span>{status.label}</span>
            {job.status === 'running' && (
              <span className="gfos-progress-text">{job.progress}%</span>
            )}
          </div>
          {job.status === 'running' || job.status === 'pending' ? (
            <button className="gfos-danger-btn" onClick={handleCancel}>
              <X size={18} />
              <span>Abbrechen</span>
            </button>
          ) : (
            <button className="gfos-primary-btn" onClick={handleRerun}>
              <RefreshCw size={18} />
              <span>Neu starten</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Log Controls */}
      <motion.div 
        className="gfos-log-controls"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="gfos-log-info">
          <span className="gfos-log-jdk">{job.jdk}</span>
          <span className="gfos-log-time">
            <Clock size={14} />
            {job.startTime}
            {job.duration && ` (${job.duration})`}
          </span>
          <span className="gfos-log-lines">
            {logEntries.length} Zeilen
          </span>
        </div>

        <div className="gfos-log-actions">
          {/* Search Toggle */}
          <button 
            className={`gfos-icon-btn-sm ${searchOpen ? 'gfos-icon-btn-active' : ''}`}
            onClick={() => setSearchOpen(!searchOpen)}
            title="Suchen"
          >
            <Search size={18} />
          </button>
          
          {/* Scroll Controls */}
          <button 
            className="gfos-icon-btn-sm"
            onClick={scrollToTop}
            title="Nach oben"
          >
            <ArrowUp size={18} />
          </button>
          <button 
            className="gfos-icon-btn-sm"
            onClick={scrollToBottom}
            title="Nach unten"
          >
            <ArrowDown size={18} />
          </button>
          
          {/* Auto-scroll Toggle */}
          <button 
            className={`gfos-icon-btn-sm ${autoScroll ? 'gfos-icon-btn-active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Auto-Scroll pausieren' : 'Auto-Scroll aktivieren'}
          >
            {autoScroll ? <Pause size={18} /> : <Play size={18} />}
          </button>
          
          {/* Copy */}
          <button 
            className="gfos-icon-btn-sm"
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
          className="gfos-log-search"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Search size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="In Logs suchen..."
            autoFocus
          />
          {searchQuery && (
            <span className="gfos-search-count">
              {filteredLogs.length} Treffer
            </span>
          )}
          <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }}>
            <X size={18} />
          </button>
        </motion.div>
      )}

      {/* Log Container */}
      <GlassPanel className="gfos-log-panel">
        <div 
          ref={logContainerRef}
          className="gfos-log-container"
          onScroll={handleScroll}
        >
          {filteredLogs.map((entry, index) => (
            <div 
              key={entry.id}
              className={`gfos-log-line ${getLevelClass(entry.level)} ${
                highlightedLine === index ? 'gfos-log-highlighted' : ''
              }`}
              onClick={() => setHighlightedLine(index === highlightedLine ? null : index)}
            >
              <span className="gfos-log-number">{index + 1}</span>
              <span className="gfos-log-timestamp">
                {formatLogTimestamp(entry.timestamp)}
              </span>
              <span className="gfos-log-content">
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
            <div className="gfos-log-cursor">
              <span className="gfos-cursor-blink">▌</span>
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Auto-scroll indicator */}
      {!autoScroll && job.status === 'running' && (
        <motion.button
          className="gfos-scroll-to-bottom"
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
