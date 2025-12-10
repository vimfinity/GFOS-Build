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
  useJobLogs,
  usePendingJobsCount,
  useRunningJobsCount,
} from '../../core/store/useAppStore.js';
import type { BuildJob } from '../../core/types/index.js';
import { getBuildRunner } from '../../core/services/BuildRunner.js';
import { getJobHistoryService } from '../../core/services/JobHistoryService.js';
import { getJobLogService } from '../../core/services/JobLogService.js';

const jobHistoryService = getJobHistoryService();
const jobLogService = getJobLogService();
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
    case 'failed': return icons.cross;
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
 * Extract JDK version number from path.
 * Examples: "C:\jdk21" -> "21", "/opt/jdk-17" -> "17", "jdk8" -> "8"
 */
function extractJdkVersion(jdkPath: string): string {
  // Get the last segment of the path
  const segments = jdkPath.split(/[/\\]/);
  const lastSegment = segments[segments.length - 1] || jdkPath;
  
  // Try to extract version number
  const versionMatch = lastSegment.match(/(\d+)/);
  return versionMatch?.[1] ?? lastSegment;
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
 * Represents a group of jobs - either a single job or a sequence.
 */
interface JobGroup {
  id: string;
  type: 'single' | 'sequence';
  jobs: BuildJob[];
  status: BuildJob['status'];
  name: string;
  createdAt: Date;
}

/**
 * Get the overall status of a sequence.
 */
function getSequenceStatus(jobs: BuildJob[]): BuildJob['status'] {
  const hasRunning = jobs.some(j => j.status === 'running');
  const hasFailed = jobs.some(j => j.status === 'failed');
  const hasCancelled = jobs.some(j => j.status === 'cancelled');
  const allSuccess = jobs.every(j => j.status === 'success');
  const hasPending = jobs.some(j => j.status === 'pending' || j.status === 'waiting');
  
  if (hasRunning) return 'running';
  if (hasFailed) return 'failed';
  if (hasCancelled && !hasPending) return 'cancelled';
  if (allSuccess) return 'success';
  if (hasPending) return 'pending';
  return 'pending';
}

/**
 * Group jobs by sequence and standalone.
 */
function groupJobs(jobs: BuildJob[]): JobGroup[] {
  const groups: JobGroup[] = [];
  const sequenceMap = new Map<string, BuildJob[]>();
  
  for (const job of jobs) {
    if (job.sequenceId) {
      const existing = sequenceMap.get(job.sequenceId) || [];
      existing.push(job);
      sequenceMap.set(job.sequenceId, existing);
    } else {
      // Standalone job
      groups.push({
        id: job.id,
        type: 'single',
        jobs: [job],
        status: job.status,
        name: job.name,
        createdAt: job.createdAt,
      });
    }
  }
  
  // Add sequences - sort jobs within sequence by sequenceIndex
  for (const [sequenceId, seqJobs] of sequenceMap) {
    const sortedJobs = seqJobs.sort((a, b) => (a.sequenceIndex || 0) - (b.sequenceIndex || 0));
    const firstJob = sortedJobs[0];
    // Extract project name (before the colon)
    const projectName = firstJob?.name.split(':')[0] || 'Sequence';
    
    groups.push({
      id: sequenceId,
      type: 'sequence',
      jobs: sortedJobs,
      status: getSequenceStatus(sortedJobs),
      name: `${projectName} (${sortedJobs.length} builds)`,
      createdAt: firstJob?.createdAt || new Date(),
    });
  }
  
  // Sort groups by creation date (oldest first for sequences, but newest first overall for visibility)
  return groups.sort((a, b) => {
    // Running/pending first
    const statusOrder: Record<string, number> = {
      'running': 0,
      'pending': 1,
      'waiting': 2,
      'failed': 3,
      'cancelled': 4,
      'success': 5,
    };
    const statusA = statusOrder[a.status] ?? 5;
    const statusB = statusOrder[b.status] ?? 5;
    const statusDiff = statusA - statusB;
    if (statusDiff !== 0) return statusDiff;
    // Then by date (newest first)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * JobListView - Shows list of all jobs grouped by sequences.
 */
function JobListView({ onSelectJob, onBack }: JobListViewProps): React.ReactElement {
  const activeJobs = useActiveJobs();
  const jobHistory = useJobHistory();
  const clearCompletedJobs = useAppStore((state) => state.clearCompletedJobs);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [expandedSequences, setExpandedSequences] = useState<Set<string>>(new Set());
  
  // Combine active and history jobs
  const allJobs = useMemo(() => {
    return [...activeJobs, ...jobHistory];
  }, [activeJobs, jobHistory]);
  
  // Group jobs by sequence
  const jobGroups = useMemo(() => groupJobs(allJobs), [allJobs]);
  
  // Build flat list of visible items for navigation
  const visibleItems = useMemo(() => {
    const items: { type: 'group' | 'job'; group: JobGroup; job?: BuildJob; indent: boolean }[] = [];
    
    for (const group of jobGroups) {
      items.push({ type: 'group', group, indent: false });
      
      if (group.type === 'sequence' && expandedSequences.has(group.id)) {
        for (const job of group.jobs) {
          items.push({ type: 'job', group, job, indent: true });
        }
      }
    }
    
    return items;
  }, [jobGroups, expandedSequences]);
  
  // Keep highlighted index in bounds
  React.useEffect(() => {
    if (highlightedIndex >= visibleItems.length && visibleItems.length > 0) {
      setHighlightedIndex(visibleItems.length - 1);
    }
  }, [visibleItems.length, highlightedIndex]);
  
  // Stats - include 'waiting' in pending count
  const runningCount = activeJobs.filter(j => j.status === 'running').length;
  const pendingCount = activeJobs.filter(j => j.status === 'pending' || j.status === 'waiting').length;
  const successCount = jobHistory.filter(j => j.status === 'success').length;
  const failedCount = jobHistory.filter(j => j.status === 'failed').length;
  
  // Toggle sequence expansion
  const toggleSequence = useCallback((sequenceId: string) => {
    setExpandedSequences(prev => {
      const next = new Set(prev);
      if (next.has(sequenceId)) {
        next.delete(sequenceId);
      } else {
        next.add(sequenceId);
      }
      return next;
    });
  }, []);
  
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
      setHighlightedIndex(prev => Math.min(visibleItems.length - 1, prev + 1));
      return;
    }
    
    // Select with Enter
    if (key.return && visibleItems.length > 0) {
      const selected = visibleItems[highlightedIndex];
      if (selected) {
        if (selected.type === 'job' && selected.job) {
          onSelectJob(selected.job.id);
        } else if (selected.type === 'group') {
          if (selected.group.type === 'sequence') {
            toggleSequence(selected.group.id);
          } else {
            // Single job - go to detail
            onSelectJob(selected.group.jobs[0]?.id || '');
          }
        }
      }
      return;
    }
    
    // Toggle expand with Space for sequences
    if (input === ' ' && visibleItems.length > 0) {
      const selected = visibleItems[highlightedIndex];
      if (selected?.type === 'group' && selected.group.type === 'sequence') {
        toggleSequence(selected.group.id);
      }
      return;
    }
    
    // Clear completed with 'c'
    if (input === 'c' || input === 'C') {
      void jobHistoryService.clear();
      clearCompletedJobs();
      return;
    }
  });
  
  // Shortcuts
  const shortcuts: Shortcut[] = [
    { key: 'ESC', label: 'Back' },
    { key: '↑/↓', label: 'Navigate' },
    { key: '⏎', label: 'Select/Expand' },
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
              Running: {runningCount}
            </Text>
            <Text color={pendingCount > 0 ? colors.warning : colors.textDim}>
              Pending: {pendingCount}
            </Text>
            <Text color={successCount > 0 ? colors.success : colors.textDim}>
              Success: {successCount}
            </Text>
            <Text color={failedCount > 0 ? colors.error : colors.textDim}>
              Failed: {failedCount}
            </Text>
          </Box>
          
          {/* Job List */}
          {visibleItems.length === 0 ? (
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
              {visibleItems.map((item, index) => {
                const isHighlighted = index === highlightedIndex;
                
                if (item.type === 'group') {
                  const group = item.group;
                  const isExpanded = expandedSequences.has(group.id);
                  
                  if (group.type === 'sequence') {
                    return (
                      <SequenceHeader
                        key={group.id}
                        group={group}
                        isExpanded={isExpanded}
                        isHighlighted={isHighlighted}
                        onToggle={() => toggleSequence(group.id)}
                      />
                    );
                  } else {
                    // Single job rendered as group
                    const job = group.jobs[0];
                    if (!job) return null;
                    return (
                      <JobListItem
                        key={job.id}
                        job={job}
                        isHighlighted={isHighlighted}
                        onSelect={() => onSelectJob(job.id)}
                        indent={false}
                      />
                    );
                  }
                } else if (item.type === 'job' && item.job) {
                  return (
                    <JobListItem
                      key={item.job.id}
                      job={item.job}
                      isHighlighted={isHighlighted}
                      onSelect={() => onSelectJob(item.job!.id)}
                      indent={true}
                    />
                  );
                }
                return null;
              })}
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

interface SequenceHeaderProps {
  group: JobGroup;
  isExpanded: boolean;
  isHighlighted: boolean;
  onToggle: () => void;
}

/**
 * Sequence header row with expand/collapse.
 */
function SequenceHeader({ group, isExpanded, isHighlighted }: SequenceHeaderProps): React.ReactElement {
  const completedCount = group.jobs.filter(j => j.status === 'success').length;
  const failedCount = group.jobs.filter(j => j.status === 'failed').length;
  const totalCount = group.jobs.length;
  
  // Calculate total duration for completed sequences
  const firstStart = group.jobs.find(j => j.startedAt)?.startedAt;
  const lastEnd = group.jobs.filter(j => j.completedAt).sort((a, b) => 
    (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
  )[0]?.completedAt;
  const duration = formatDuration(firstStart, lastEnd);
  
  return (
    <Box>
      {/* Pointer */}
      <Box width={2}>
        <Text color={isHighlighted ? colors.primary : undefined}>
          {isHighlighted ? icons.pointer : ' '}
        </Text>
      </Box>
      
      {/* Expand/collapse indicator */}
      <Box width={2}>
        <Text color={colors.textDim}>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </Box>
      
      {/* Sequence icon */}
      <Box width={2}>
        <Text color={
          group.status === 'success' ? colors.success :
          group.status === 'failed' ? colors.error :
          group.status === 'running' ? colors.info :
          colors.textDim
        }>
          {group.status === 'running' ? icons.running :
           group.status === 'success' ? icons.success :
           group.status === 'failed' ? icons.cross :
           icons.pending}
        </Text>
      </Box>
      
      {/* Sequence name */}
      <Box width={30}>
        <Text color={isHighlighted ? colors.primaryBright : colors.text} bold={isHighlighted}>
          {group.name}
        </Text>
      </Box>
      
      {/* Progress info */}
      <Box width={18}>
        <Text color={colors.textDim}>
          {completedCount + failedCount}/{totalCount} done
          {failedCount > 0 && <Text color={colors.error}> ({failedCount} failed)</Text>}
        </Text>
      </Box>
      
      {/* Duration */}
      <Box width={12}>
        <Text color={colors.textDim}>{duration}</Text>
      </Box>
      
      {/* Status badge */}
      <Badge variant={getStatusVariant(group.status)}>
        {group.status.toUpperCase()}
      </Badge>
    </Box>
  );
}

interface JobListItemProps {
  job: BuildJob;
  isHighlighted: boolean;
  onSelect: () => void;
  indent: boolean;
}

/**
 * Single job item with live status updates.
 */
function JobListItem({ job, isHighlighted, indent }: JobListItemProps): React.ReactElement {
  const duration = formatDuration(job.startedAt, job.completedAt);
  const isRunning = job.status === 'running';
  const isWaiting = job.status === 'waiting' || job.status === 'pending';
  
  // For sequence jobs, show position
  const positionInfo = job.sequenceIndex !== undefined 
    ? `[${(job.sequenceIndex || 0) + 1}/${job.sequenceTotal || '?'}]`
    : '';
  
  return (
    <Box>
      {/* Pointer */}
      <Box width={2}>
        <Text color={isHighlighted ? colors.primary : undefined}>
          {isHighlighted ? icons.pointer : ' '}
        </Text>
      </Box>
      
      {/* Indent for sequence children */}
      {indent && (
        <Box width={2}>
          <Text color={colors.textDim}>└</Text>
        </Box>
      )}
      
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
      
      {/* Job name (shorter for indented items) */}
      <Box width={indent ? 26 : 30}>
        <Text color={isHighlighted ? colors.primaryBright : colors.text} bold={isHighlighted}>
          {indent ? job.name.split(':')[1] || job.name : job.name}
        </Text>
      </Box>
      
      {/* Goals */}
      <Box width={16}>
        <Text color={colors.textDim}>
          {job.mavenGoals.join(' ')}
        </Text>
      </Box>
      
      {/* Progress/duration */}
      <Box width={16}>
        <Text color={isWaiting ? colors.warning : isRunning ? colors.info : colors.textDim}>
          {isRunning ? `${job.progress}% • ${duration}` : isWaiting ? (job.startedAt ? duration : 'waiting') : duration}
        </Text>
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
  const memoryLogs = useJobLogs(jobId);
  const [persistedLogs, setPersistedLogs] = useState<string[]>([]);
  const logSource = job && (job.status === 'running' || memoryLogs.length > 0)
    ? memoryLogs
    : persistedLogs;

  React.useEffect(() => {
    if (!job?.logFilePath || job.status === 'running') {
      setPersistedLogs([]);
      return;
    }

    let isActive = true;
    jobLogService.read(job.id).then(lines => {
      if (isActive) {
        setPersistedLogs(lines);
      }
    });

    return () => {
      isActive = false;
    };
  }, [job?.id, job?.logFilePath, job?.status]);
  
  // Calculate visible lines (approx 20 lines visible)
  const visibleLines = 20;
  const totalLines = logSource.length;
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
  const visibleLogs = logSource.slice(scrollOffset, scrollOffset + visibleLines);
  
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
              <Text color={colors.textDim}>Command: </Text>
              <Text>{job.command || `mvn ${job.mavenGoals.join(' ')}`}</Text>
            </Box>
            <Box>
              <Text color={colors.textDim}>JDK: </Text>
              <Text>{extractJdkVersion(job.jdkPath)}</Text>
            </Box>
            <Box>
              <Text color={colors.textDim}>Duration: </Text>
              <Text>{duration}</Text>
            </Box>
            <Box>
              <Text color={colors.textDim}>Started: </Text>
              <Text>{job.startedAt ? formatTime(job.startedAt) : '—'}</Text>
            </Box>
            <Box>
              <Text color={colors.textDim}>Finished: </Text>
              <Text>{job.completedAt ? formatTime(job.completedAt) : (isRunning ? 'running' : '—')}</Text>
            </Box>
            <Box>
              <Text color={colors.textDim}>Log file: </Text>
              <Text color={colors.info}>{job.logFilePath || 'Not available'}</Text>
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
