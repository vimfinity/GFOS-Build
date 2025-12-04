/**
 * JobsView Component
 * 
 * Displays build job queue with active and completed jobs.
 * Features:
 * - Live updates as BuildRunner processes
 * - Status indicators (spinner, checkmark, X)
 * - Drill-down into job details with full log output
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

import {
  ScreenContainer,
  ActionList,
  Spinner,
  Badge,
  ProgressBar,
  Header,
  StatusBar,
} from '../components/index.js';
import { colors, icons } from '../theme.js';
import {
  useAppStore,
  useActiveJobs,
  useJobHistory,
  usePendingJobsCount,
  useRunningJobsCount,
  type BuildJob,
} from '../../core/store/useAppStore.js';
import { getBuildRunner } from '../../core/services/BuildRunner.js';
import type { ActionItem, Shortcut } from '../components/index.js';
import type { BadgeVariant } from '../components/Badge.js';

// ============================================================================
// Job List View
// ============================================================================

/**
 * Get badge variant for job status.
 */
function getStatusVariant(status: BuildJob['status']): BadgeVariant {
  switch (status) {
    case 'pending': return 'pending';
    case 'running': return 'running';
    case 'success': return 'success';
    case 'failed': return 'error';
    case 'cancelled': return 'warning';
    default: return 'default';
  }
}

/**
 * Get status icon for job.
 */
function getStatusIcon(status: BuildJob['status']): string {
  switch (status) {
    case 'pending': return icons.pending;
    case 'running': return icons.running;
    case 'success': return icons.success;
    case 'failed': return icons.error;
    case 'cancelled': return icons.cross;
    default: return icons.bullet;
  }
}

/**
 * Format duration in human readable form.
 */
function formatDuration(startedAt?: Date, completedAt?: Date): string {
  if (!startedAt) return '-';
  
  const end = completedAt || new Date();
  const durationMs = end.getTime() - startedAt.getTime();
  
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
  
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format timestamp for display.
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Convert BuildJob to ActionItem.
 */
function jobToActionItem(job: BuildJob): ActionItem<string> {
  const duration = formatDuration(job.startedAt, job.completedAt);
  const time = formatTime(job.createdAt);
  
  const badgeColorMap: Record<BuildJob['status'], string> = {
    pending: colors.warning,
    waiting: colors.textDim,
    running: colors.info,
    success: colors.success,
    failed: colors.error,
    cancelled: colors.textDim,
  };
  
  return {
    value: job.id,
    label: job.name,
    description: `${job.mavenGoals.join(' ')} • ${duration} • ${time}`,
    badge: job.status.toUpperCase(),
    badgeColor: badgeColorMap[job.status],
  };
}

interface JobListViewProps {
  onSelectJob: (jobId: string) => void;
  onBack: () => void;
}

/**
 * JobListView - Shows list of all jobs.
 */
function JobListView({ onSelectJob, onBack }: JobListViewProps): React.ReactElement {
  const activeJobs = useActiveJobs();
  const jobHistory = useJobHistory();
  const clearCompletedJobs = useAppStore((state) => state.clearCompletedJobs);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  
  // Combine active and history jobs
  const allJobs = useMemo(() => {
    return [...activeJobs, ...jobHistory];
  }, [activeJobs, jobHistory]);
  
  // Keep highlighted index in bounds
  React.useEffect(() => {
    if (highlightedIndex >= allJobs.length && allJobs.length > 0) {
      setHighlightedIndex(allJobs.length - 1);
    }
  }, [allJobs.length, highlightedIndex]);
  
  // Stats
  const runningCount = activeJobs.filter(j => j.status === 'running').length;
  const pendingCount = activeJobs.filter(j => j.status === 'pending').length;
  const successCount = jobHistory.filter(j => j.status === 'success').length;
  const failedCount = jobHistory.filter(j => j.status === 'failed').length;
  
  // Handle keyboard
  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    
    // Navigate up
    if (key.upArrow) {
      setHighlightedIndex(prev => Math.max(0, prev - 1));
      return;
    }
    
    // Navigate down
    if (key.downArrow) {
      setHighlightedIndex(prev => Math.min(allJobs.length - 1, prev + 1));
      return;
    }
    
    // Select with Enter
    if (key.return && allJobs.length > 0) {
      const selectedJob = allJobs[highlightedIndex];
      if (selectedJob) {
        onSelectJob(selectedJob.id);
      }
      return;
    }
    
    // Clear completed with 'c'
    if (input === 'c' || input === 'C') {
      clearCompletedJobs();
      return;
    }
  });
  
  // Shortcuts
  const shortcuts: Shortcut[] = [
    { key: 'ESC', label: 'Back' },
    { key: '↑/↓', label: 'Navigate' },
    { key: 'Enter', label: 'View Log' },
    { key: 'C', label: 'Clear History' },
  ];
  
  // Subtitle with stats
  const subtitle = [
    runningCount > 0 ? `${runningCount} running` : null,
    pendingCount > 0 ? `${pendingCount} pending` : null,
    successCount > 0 ? `${successCount} success` : null,
    failedCount > 0 ? `${failedCount} failed` : null,
  ].filter(Boolean).join(' • ') || 'No jobs';
  
  return (
    <Box flexDirection="column" height="100%">
      <Header title="GFOS-Build" version="1.0.0" />
      
      <ScreenContainer
        title="Build Jobs"
        subtitle={subtitle}
        fillHeight
      >
        <Box flexDirection="column" paddingX={1}>
          {/* Stats Bar */}
          <Box marginBottom={1} gap={2}>
            <Text color={runningCount > 0 ? colors.info : colors.textDim}>
              {icons.running} Running: {runningCount}
            </Text>
            <Text color={pendingCount > 0 ? colors.warning : colors.textDim}>
              {icons.pending} Pending: {pendingCount}
            </Text>
            <Text color={successCount > 0 ? colors.success : colors.textDim}>
              {icons.success} Success: {successCount}
            </Text>
            <Text color={failedCount > 0 ? colors.error : colors.textDim}>
              {icons.error} Failed: {failedCount}
            </Text>
          </Box>
          
          {/* Job List */}
          {allJobs.length === 0 ? (
            <Box flexDirection="column" paddingY={2}>
              <Text color={colors.textDim} italic>
                No build jobs yet.
              </Text>
              <Text color={colors.textDim}>
                Start a build from the repository view to see jobs here.
              </Text>
            </Box>
          ) : (
            <Box flexDirection="column">
              {/* Custom job rendering for live updates */}
              {allJobs.map((job, index) => (
                <JobListItem 
                  key={job.id} 
                  job={job} 
                  isHighlighted={index === highlightedIndex}
                  onSelect={() => onSelectJob(job.id)}
                />
              ))}
            </Box>
          )}
        </Box>
      </ScreenContainer>
      
      <StatusBar
        shortcuts={shortcuts}
        pendingJobs={pendingCount}
        runningJobs={runningCount}
        mode={process.env['MOCK_MODE'] === 'true' ? 'MOCK' : undefined}
      />
    </Box>
  );
}

interface JobListItemProps {
  job: BuildJob;
  isHighlighted: boolean;
  onSelect: () => void;
}

/**
 * Single job item with live status updates.
 */
function JobListItem({ job, isHighlighted }: JobListItemProps): React.ReactElement {
  const duration = formatDuration(job.startedAt, job.completedAt);
  const isRunning = job.status === 'running';
  
  return (
    <Box>
      {/* Pointer */}
      <Box width={2}>
        <Text color={isHighlighted ? colors.primary : undefined}>
          {isHighlighted ? icons.pointer : ' '}
        </Text>
      </Box>
      
      {/* Status indicator */}
      <Box width={2}>
        {isRunning ? (
          <Spinner hideMessage />
        ) : (
          <Text color={
            job.status === 'success' ? colors.success :
            job.status === 'failed' ? colors.error :
            job.status === 'cancelled' ? colors.warning :
            colors.textDim
          }>
            {getStatusIcon(job.status)}
          </Text>
        )}
      </Box>
      
      {/* Job name */}
      <Box width={25}>
        <Text color={isHighlighted ? colors.primaryBright : colors.text} bold={isHighlighted}>
          {job.name}
        </Text>
      </Box>
      
      {/* Goals */}
      <Box width={20}>
        <Text color={colors.textDim}>
          {job.mavenGoals.join(' ')}
        </Text>
      </Box>
      
      {/* Progress or duration */}
      <Box width={15}>
        {isRunning ? (
          <Text color={colors.info}>
            {job.progress}%
          </Text>
        ) : (
          <Text color={colors.textDim}>
            {duration}
          </Text>
        )}
      </Box>
      
      {/* Status badge */}
      <Badge variant={getStatusVariant(job.status)}>
        {job.status.toUpperCase()}
      </Badge>
    </Box>
  );
}

// ============================================================================
// Job Detail View (Log Output)
// ============================================================================

interface JobDetailViewProps {
  jobId: string;
  onBack: () => void;
}

/**
 * JobDetailView - Shows full log output for a job.
 */
function JobDetailView({ jobId, onBack }: JobDetailViewProps): React.ReactElement {
  const activeJobs = useActiveJobs();
  const jobHistory = useJobHistory();
  const [scrollOffset, setScrollOffset] = useState(0);
  const [followMode, setFollowMode] = useState(true);
  
  // Find the job
  const job = useMemo(() => {
    return activeJobs.find(j => j.id === jobId) 
      || jobHistory.find(j => j.id === jobId);
  }, [activeJobs, jobHistory, jobId]);
  
  // Calculate visible lines (approx 20 lines visible)
  const visibleLines = 20;
  const totalLines = job?.logs.length || 0;
  const maxOffset = Math.max(0, totalLines - visibleLines);
  
  // Auto-scroll in follow mode
  React.useEffect(() => {
    if (followMode && job?.status === 'running') {
      setScrollOffset(maxOffset);
    }
  }, [totalLines, followMode, job?.status, maxOffset]);
  
  // Handle keyboard
  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    
    // Scroll up
    if (key.upArrow) {
      setFollowMode(false);
      setScrollOffset(prev => Math.max(0, prev - 1));
      return;
    }
    
    // Scroll down
    if (key.downArrow) {
      setScrollOffset(prev => Math.min(maxOffset, prev + 1));
      if (scrollOffset >= maxOffset - 1) {
        setFollowMode(true);
      }
      return;
    }
    
    // Page up
    if (key.pageUp || (key.ctrl && input === 'u')) {
      setFollowMode(false);
      setScrollOffset(prev => Math.max(0, prev - visibleLines));
      return;
    }
    
    // Page down
    if (key.pageDown || (key.ctrl && input === 'd')) {
      setScrollOffset(prev => Math.min(maxOffset, prev + visibleLines));
      if (scrollOffset >= maxOffset - visibleLines) {
        setFollowMode(true);
      }
      return;
    }
    
    // Toggle follow mode with 'f'
    if (input === 'f' || input === 'F') {
      setFollowMode(prev => !prev);
      if (!followMode) {
        setScrollOffset(maxOffset);
      }
      return;
    }
    
    // Go to top with 'g'
    if (input === 'g') {
      setFollowMode(false);
      setScrollOffset(0);
      return;
    }
    
    // Go to bottom with 'G'
    if (input === 'G') {
      setFollowMode(true);
      setScrollOffset(maxOffset);
      return;
    }
    
    // Cancel running job with 'x'
    if ((input === 'x' || input === 'X') && job?.status === 'running') {
      const runner = getBuildRunner();
      runner.cancelBuild(jobId);
      return;
    }
  });
  
  if (!job) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Header title="GFOS-Build" version="1.0.0" />
        <ScreenContainer title="Job Not Found" subtitle="The job could not be found">
          <Box paddingX={1}>
            <Text color={colors.error}>Job with ID "{jobId}" not found.</Text>
          </Box>
        </ScreenContainer>
        <StatusBar
          shortcuts={[{ key: 'ESC', label: 'Back' }]}
          mode={process.env['MOCK_MODE'] === 'true' ? 'MOCK' : undefined}
        />
      </Box>
    );
  }
  
  const duration = formatDuration(job.startedAt, job.completedAt);
  const isRunning = job.status === 'running';
  
  // Get visible log lines
  const visibleLogs = job.logs.slice(scrollOffset, scrollOffset + visibleLines);
  
  // Shortcuts
  const shortcuts: Shortcut[] = [
    { key: 'ESC', label: 'Back' },
    { key: '↑/↓', label: 'Scroll' },
    { key: 'g/G', label: 'Top/Bottom' },
    { key: 'F', label: followMode ? 'Follow ON' : 'Follow OFF' },
    ...(isRunning ? [{ key: 'X', label: 'Cancel' }] : []),
  ];
  
  return (
    <Box flexDirection="column" height="100%">
      <Header title="GFOS-Build" version="1.0.0" />
      
      <ScreenContainer
        title={job.name}
        subtitle={`${job.status.toUpperCase()} • ${duration}`}
        fillHeight
      >
        <Box flexDirection="column" paddingX={1}>
          {/* Job Info Header */}
          <Box marginBottom={1} flexDirection="column">
            <Box>
              <Text color={colors.textDim}>Goals: </Text>
              <Text>{job.mavenGoals.join(' ')}</Text>
              <Text>  </Text>
              <Text color={colors.textDim}>JDK: </Text>
              <Text>{job.jdkPath.split('\\').pop()}</Text>
            </Box>
            
            {/* Progress bar for running jobs */}
            {isRunning && (
              <Box marginTop={1}>
                <ProgressBar value={job.progress} width={50} />
                <Text color={colors.info}> {job.progress}%</Text>
                {followMode && <Text color={colors.success}> [FOLLOW]</Text>}
              </Box>
            )}
            
            {/* Error message if failed */}
            {job.error && (
              <Box marginTop={1}>
                <Text color={colors.error}>{icons.error} {job.error}</Text>
              </Box>
            )}
          </Box>
          
          {/* Separator */}
          <Text color={colors.textDim}>{'─'.repeat(80)}</Text>
          
          {/* Scroll position indicator */}
          <Box justifyContent="space-between">
            <Text color={colors.textDim}>
              Lines {scrollOffset + 1}-{Math.min(scrollOffset + visibleLines, totalLines)} of {totalLines}
            </Text>
            {scrollOffset > 0 && <Text color={colors.textDim}>↑ more above</Text>}
          </Box>
          
          {/* Log Output */}
          <Box flexDirection="column" marginTop={1} width="100%" overflow="hidden">
            {visibleLogs.length === 0 ? (
              <Text color={colors.textDim} italic>
                {isRunning ? 'Waiting for output...' : 'No output recorded.'}
              </Text>
            ) : (
              visibleLogs.map((line, index) => {
                // Truncate line to prevent overflow (leave some margin for box borders)
                const maxLineWidth = Math.max(40, (process.stdout.columns || 120) - 8);
                const displayLine = line.length > maxLineWidth 
                  ? line.substring(0, maxLineWidth - 1) + '…' 
                  : line;
                
                return (
                  <Text
                    key={scrollOffset + index}
                    color={
                      line.includes('[ERROR]') ? colors.error :
                      line.includes('[WARNING]') || line.includes('[WARN]') ? colors.warning :
                      line.includes('BUILD SUCCESS') ? colors.success :
                      line.includes('BUILD FAILURE') ? colors.error :
                      line.includes('[GFOS-Build]') ? colors.primaryBright :
                      line.includes('[INFO]') ? colors.textDim :
                      colors.text
                    }
                    wrap="truncate"
                  >
                    {displayLine}
                  </Text>
                );
              })
            )}
          </Box>
          
          {/* Bottom scroll indicator */}
          {scrollOffset < maxOffset && (
            <Text color={colors.textDim}>↓ more below ({totalLines - scrollOffset - visibleLines} lines)</Text>
          )}
        </Box>
      </ScreenContainer>
      
      <StatusBar
        shortcuts={shortcuts}
        mode={process.env['MOCK_MODE'] === 'true' ? 'MOCK' : undefined}
      />
    </Box>
  );
}

// ============================================================================
// Main JobsView Component
// ============================================================================

export interface JobsViewProps {
  /** Callback when user wants to go back */
  onBack?: () => void;
  /** Initial job ID to show detail view */
  initialJobId?: string;
}

/**
 * JobsView - Main component managing list and detail views.
 */
export function JobsView({ onBack, initialJobId }: JobsViewProps): React.ReactElement {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId || null);
  const goBack = useAppStore((state) => state.goBack);
  
  const handleBack = useCallback(() => {
    if (selectedJobId) {
      // Go back to list
      setSelectedJobId(null);
    } else {
      // Go back to previous screen
      onBack?.() || goBack();
    }
  }, [selectedJobId, onBack, goBack]);
  
  const handleSelectJob = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
  }, []);
  
  if (selectedJobId) {
    return (
      <JobDetailView 
        jobId={selectedJobId} 
        onBack={() => setSelectedJobId(null)} 
      />
    );
  }
  
  return (
    <JobListView 
      onSelectJob={handleSelectJob} 
      onBack={handleBack} 
    />
  );
}

export default JobsView;
