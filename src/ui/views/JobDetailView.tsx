/**
 * Job Detail View - Performance Optimized
 * 
 * Shows detailed information and live logs for a specific build job.
 * 
 * CRITICAL: Logs are read directly from disk files, NOT from React state.
 * This prevents memory issues and re-render loops with large builds (20k+ lines).
 */

import React, { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import { Box, Text } from 'ink';

import { theme, icons, palette } from '../theme/index.js';
import { Divider } from '../primitives/index.js';
import { useNavigator, useKeyboard, useSpinner, useTerminalSize, type KeyEvent } from '../hooks/index.js';
import { useAppStore, useActiveJobs, useJobHistory } from '../../core/store/useAppStore.js';
import { getJobLogService } from '../../core/services/JobLogService.js';
import type { BuildJob, BuildStatus } from '../../core/types/index.js';

// ============================================================================
// Constants
// ============================================================================

const MAX_DISPLAY_LINES = 500; // Only keep last N lines in memory for display
const LOG_POLL_INTERVAL_ACTIVE = 500; // Poll every 500ms while running
const LOG_POLL_INTERVAL_IDLE = 2000; // Poll every 2s when idle

// ============================================================================
// File-based Log Hook (reads from disk, not state!)
// ============================================================================

interface LogState {
  lines: string[];
  totalLines: number;
}

function useFileBasedLogs(jobId: string, isActive: boolean): LogState {
  const [logState, setLogState] = useState<LogState>({ lines: [], totalLines: 0 });
  const lastTotalRef = useRef<number>(0);
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    const logService = getJobLogService();
    
    const readLogs = async () => {
      if (!mountedRef.current || !jobId) return;
      
      try {
        const allLines = await logService.read(jobId);
        const totalLines = allLines.length;
        
        // Only update state if line count changed
        if (totalLines !== lastTotalRef.current) {
          lastTotalRef.current = totalLines;
          // Keep only last N lines for display to prevent memory issues
          const displayLines = totalLines > MAX_DISPLAY_LINES 
            ? allLines.slice(-MAX_DISPLAY_LINES) 
            : allLines;
          
          if (mountedRef.current) {
            setLogState({ lines: displayLines, totalLines });
          }
        }
      } catch {
        // Ignore read errors silently
      }
    };
    
    // Initial read
    readLogs();
    
    // Set up polling interval
    const pollInterval = isActive ? LOG_POLL_INTERVAL_ACTIVE : LOG_POLL_INTERVAL_IDLE;
    const intervalId = setInterval(readLogs, pollInterval);
    
    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [jobId, isActive]);
  
  return logState;
}

// ============================================================================
// Types
// ============================================================================

export interface JobDetailViewProps {
  jobId: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusIcon(status: BuildStatus): string {
  const map: Record<BuildStatus, string> = {
    pending: icons.pending,
    waiting: icons.pending,
    running: icons.running,
    success: icons.success,
    failed: icons.error,
    cancelled: icons.cancelled,
  };
  return map[status] || icons.info;
}

function getStatusColor(status: BuildStatus): string {
  const map: Record<BuildStatus, string> = {
    pending: theme.text.muted,
    waiting: theme.text.muted,
    running: palette.blue,
    success: palette.green,
    failed: palette.red,
    cancelled: palette.yellow,
  };
  return map[status] || theme.text.muted;
}

function formatTime(date?: Date): string {
  if (!date) return '-';
  return date.toLocaleTimeString();
}

function formatDuration(startedAt?: Date, completedAt?: Date): string {
  if (!startedAt) return '-';
  const end = completedAt || new Date();
  const ms = end.getTime() - startedAt.getTime();
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function getLogLineColor(line: string): string {
  if (line.includes('[ERROR]') || line.includes('ERROR')) return palette.red;
  if (line.includes('[WARN]') || line.includes('WARNING')) return palette.yellow;
  if (line.includes('[INFO]')) return theme.text.secondary;
  if (line.includes('BUILD SUCCESS')) return palette.green;
  if (line.includes('BUILD FAILURE')) return palette.red;
  if (line.includes('Downloading') || line.includes('Downloaded')) return palette.blue;
  return theme.text.muted;
}

// ============================================================================
// Log Line Component
// ============================================================================

interface LogLineProps {
  line: string;
  lineNumber: number;
}

const LogLine = memo(function LogLine({ line, lineNumber }: LogLineProps): React.ReactElement {
  const color = getLogLineColor(line);

  return (
    <Box>
      <Text color={theme.text.muted} dimColor>{String(lineNumber).padStart(4, ' ')} │ </Text>
      <Text color={color}>{line}</Text>
    </Box>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export function JobDetailView({ jobId }: JobDetailViewProps): React.ReactElement {
  const [autoScroll, setAutoScroll] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);
  
  const spinnerFrames = useMemo(() => [...icons.spinner], []);
  const spinnerFrame = useSpinner(spinnerFrames);
  const { rows } = useTerminalSize();
  
  const { goBack, toJobs } = useNavigator();
  const activeJobs = useActiveJobs();
  const jobHistory = useJobHistory();

  // Get stable action reference
  const removeJob = useCallback(
    (id: string) => useAppStore.getState().removeJob(id),
    []
  );

  // Find the job in active or history
  const job = useMemo(() => {
    return activeJobs.find((j) => j.id === jobId) || jobHistory.find((j) => j.id === jobId);
  }, [activeJobs, jobHistory, jobId]);

  // Is job currently running?
  const isActive = job?.status === 'running' || job?.status === 'pending';
  
  // Read logs from FILE (not from state!) - this is critical for performance
  const { lines: logs, totalLines } = useFileBasedLogs(jobId, isActive);

  const visibleLines = Math.max(5, rows - 16);

  // Use ref to track previous log length to prevent unnecessary updates
  const prevLogLengthRef = useRef(totalLines);

  // Auto-scroll when new logs come in - only when actually needed
  useEffect(() => {
    if (autoScroll && totalLines > prevLogLengthRef.current && logs.length > visibleLines) {
      setScrollOffset(Math.max(0, logs.length - visibleLines));
    }
    prevLogLengthRef.current = totalLines;
  }, [totalLines, autoScroll, visibleLines, logs.length]);

  const handleCancel = useCallback(() => {
    if (job && ['running', 'pending'].includes(job.status)) {
      removeJob(job.id);
      goBack();
    }
  }, [job, removeJob, goBack]);

  // Keyboard handler - must be called unconditionally (before any early return)
  useKeyboard(
    useCallback((e: KeyEvent) => {
      if (e.isEscape) { goBack(); return true; }
      if (e.key === 'q') { toJobs(); return true; }
      
      // Log scrolling
      if (e.isUp || e.key === 'k') {
        setScrollOffset((o) => Math.max(0, o - 1));
        setAutoScroll(false);
        return true;
      }
      if (e.isDown || e.key === 'j') {
        setScrollOffset((o) => Math.min(Math.max(0, logs.length - visibleLines), o + 1));
        setAutoScroll(false);
        return true;
      }
      if (e.key === 'g' && !e.ctrl) {
        setScrollOffset(0);
        setAutoScroll(false);
        return true;
      }
      if (e.key === 'G') {
        setScrollOffset(Math.max(0, logs.length - visibleLines));
        setAutoScroll(true);
        return true;
      }
      if (e.key === 'a') {
        setAutoScroll((a) => !a);
        return true;
      }
      // Cancel only works if job exists and is cancellable
      if (e.key === 'c' && !e.ctrl) {
        handleCancel();
        return true;
      }
      
      return false;
    }, [goBack, toJobs, logs.length, visibleLines, handleCancel]),
    { priority: 5 }
  );

  // Job not found - render after all hooks are called
  if (!job) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={palette.red}>{icons.error} Job not found: {jobId}</Text>
        <Text color={theme.text.muted}>Press Esc to go back</Text>
      </Box>
    );
  }

  const statusColor = getStatusColor(job.status);
  const visibleLogs = logs.slice(scrollOffset, scrollOffset + visibleLines);

  // Progress bar
  const progressBar = job.status === 'running' ? (() => {
    const width = 40;
    const filled = Math.round((job.progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${job.progress}%`;
  })() : null;

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      {/* Header */}
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text color={statusColor}>
            {job.status === 'running' ? spinnerFrame : getStatusIcon(job.status)}
          </Text>
          <Text bold color={theme.text.primary}> {job.name}</Text>
          <Text color={statusColor}> [{job.status}]</Text>
        </Box>
        {job.jdkPath && (
          <Box marginLeft={2}>
            <Text color={theme.text.muted}>{icons.java} JDK: {job.jdkPath}</Text>
          </Box>
        )}
      </Box>

      {/* Progress bar for running jobs */}
      {progressBar && (
        <Box marginBottom={1}>
          <Text color={palette.blue}>{progressBar}</Text>
        </Box>
      )}

      {/* Stats grid */}
      <Box marginBottom={1}>
        <Box marginRight={4}>
          <Text color={theme.text.muted}>Started: </Text>
          <Text color={theme.text.primary}>{formatTime(job.startedAt)}</Text>
        </Box>
        <Box marginRight={4}>
          <Text color={theme.text.muted}>Duration: </Text>
          <Text color={theme.text.primary}>{formatDuration(job.startedAt, job.completedAt)}</Text>
        </Box>
        <Box marginRight={4}>
          <Text color={theme.text.muted}>Status: </Text>
          <Text color={statusColor}>{job.status}</Text>
        </Box>
      </Box>

      {/* Error message */}
      {job.error && (
        <Box marginBottom={1}>
          <Text color={palette.red}>{icons.error} Error: {job.error}</Text>
        </Box>
      )}

      <Divider />

      {/* Log output */}
      <Box flexDirection="column" marginTop={1} flexGrow={1}>
        <Box marginBottom={1}>
          <Text color={theme.accent.secondary}>{icons.logs} Build Output</Text>
          <Text color={theme.text.muted}> ({logs.length} lines)</Text>
          {autoScroll && <Text color={palette.blue}> [auto-scroll]</Text>}
        </Box>
        
        <Box flexDirection="column" borderStyle="single" borderColor={theme.border.default} padding={1}>
          {visibleLogs.length === 0 ? (
            <Text color={theme.text.muted}>No output yet...</Text>
          ) : (
            visibleLogs.map((line, idx) => (
              <LogLine 
                key={scrollOffset + idx} 
                line={line} 
                lineNumber={scrollOffset + idx + 1} 
              />
            ))
          )}
        </Box>
        
        {logs.length > visibleLines && (
          <Box marginTop={1} justifyContent="center">
            <Text color={theme.text.muted}>
              Lines {scrollOffset + 1}-{Math.min(scrollOffset + visibleLines, logs.length)} of {logs.length}
            </Text>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color={theme.text.muted}>
          <Text color={theme.accent.primary}>↑↓/jk</Text> Scroll  
          <Text color={theme.accent.primary}> g/G</Text> Top/Bottom  
          <Text color={theme.accent.primary}> a</Text> Auto-scroll
        </Text>
        <Text color={theme.text.muted}>
          {['running', 'pending'].includes(job.status) && (
            <><Text color={theme.accent.secondary}>c</Text> Cancel  </>
          )}
          <Text color={theme.accent.secondary}>q</Text> Jobs  
          <Text color={theme.accent.secondary}> Esc</Text> Back
        </Text>
      </Box>
    </Box>
  );
}

export default JobDetailView;
