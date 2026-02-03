/**
 * Jobs View
 * 
 * Lists all build jobs with their status and progress.
 */

import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { Box, Text } from 'ink';

import { theme, icons, palette } from '../theme/index.js';
import { Divider, EmptyState } from '../primitives/index.js';
import { useNavigator, useKeyboard, useSpinner, type KeyEvent } from '../hooks/index.js';
import { useAppStore, useActiveJobs, useJobHistory } from '../../core/store/useAppStore.js';
import { useNotifications } from '../system/notifications.js';
import type { BuildJob, BuildStatus } from '../../core/types/index.js';

// ============================================================================
// Types & Constants
// ============================================================================

export interface JobsViewProps {
  initialFilter?: BuildStatus | 'all';
}

const FILTERS: Array<{ label: string; value: BuildStatus | 'all'; icon: string }> = [
  { label: 'All', value: 'all', icon: icons.bullet },
  { label: 'Running', value: 'running', icon: icons.running },
  { label: 'Pending', value: 'pending', icon: icons.pending },
  { label: 'Success', value: 'success', icon: icons.success },
  { label: 'Failed', value: 'failed', icon: icons.error },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusIcon(status: BuildStatus | 'all'): string {
  if (status === 'all') return icons.bullet;
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

// ============================================================================
// Memoized Sub-Components
// ============================================================================

interface JobRowProps {
  job: BuildJob;
  isSelected: boolean;
  spinnerFrame: string;
}

const JobRow = memo(function JobRow({ job, isSelected, spinnerFrame }: JobRowProps): React.ReactElement {
  const duration = formatDuration(job.startedAt, job.completedAt);
  const statusColor = getStatusColor(job.status);

  const progressBar = useMemo(() => {
    if (job.status !== 'running') return null;
    const width = 20;
    const filled = Math.round((job.progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${job.progress}%`;
  }, [job.status, job.progress]);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Box flexGrow={1}>
          <Text color={isSelected ? theme.accent.primary : theme.text.muted}>
            {isSelected ? icons.pointer : ' '} 
          </Text>
          <Text color={statusColor}>
            {job.status === 'running' ? spinnerFrame : getStatusIcon(job.status)} 
          </Text>
          <Text color={theme.text.primary} bold={isSelected}> {job.name}</Text>
        </Box>
        <Box>
          <Text color={statusColor}>[{job.status}]</Text>
          <Text color={theme.text.muted}> {duration}</Text>
        </Box>
      </Box>
      {progressBar && (
        <Box marginLeft={4}>
          <Text color={palette.blue}>{progressBar}</Text>
        </Box>
      )}
      {job.status === 'failed' && job.error && (
        <Box marginLeft={4}>
          <Text color={palette.red}>{icons.error} {job.error}</Text>
        </Box>
      )}
    </Box>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export function JobsView({ initialFilter = 'all' }: JobsViewProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState<BuildStatus | 'all'>(initialFilter);
  
  const spinnerFrames = useMemo(() => [...icons.spinner], []);
  const spinnerFrame = useSpinner(spinnerFrames);
  
  const { toJobDetail, goBack } = useNavigator();
  const activeJobs = useActiveJobs();
  const jobHistory = useJobHistory();
  const { success, info } = useNotifications();

  // Combine active jobs and history (active first, then completed by date)
  const jobs = useMemo(() => {
    const combined = [...activeJobs, ...jobHistory];
    // Remove duplicates (job might be in both briefly during transition)
    const uniqueJobs = combined.filter((job, index, self) => 
      index === self.findIndex(j => j.id === job.id)
    );
    // Sort: running first, then pending, then by completion date desc
    return uniqueJobs.sort((a, b) => {
      const priority: Record<BuildStatus, number> = { running: 0, pending: 1, waiting: 2, success: 3, failed: 3, cancelled: 3 };
      const pDiff = (priority[a.status] ?? 4) - (priority[b.status] ?? 4);
      if (pDiff !== 0) return pDiff;
      // For completed jobs, sort by completion date desc
      if (a.completedAt && b.completedAt) {
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activeJobs, jobHistory]);

  // Get stable action references
  const removeJob = useCallback(
    (id: string) => useAppStore.getState().removeJob(id),
    []
  );
  const clearCompletedJobs = useCallback(
    () => useAppStore.getState().clearCompletedJobs(),
    []
  );

  // Filtered jobs with stable reference
  const filteredJobs = useMemo(() => {
    if (filter === 'all') return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  // Keep selection in bounds
  useEffect(() => {
    if (selectedIndex >= filteredJobs.length) {
      setSelectedIndex(Math.max(0, filteredJobs.length - 1));
    }
  }, [filteredJobs.length, selectedIndex]);

  const currentJob = filteredJobs[selectedIndex];

  const cycleFilter = useCallback((dir: 1 | -1) => {
    setFilter((curr) => {
      const idx = FILTERS.findIndex((f) => f.value === curr);
      const nextFilter = FILTERS[(idx + dir + FILTERS.length) % FILTERS.length];
      return nextFilter?.value ?? 'all';
    });
    setSelectedIndex(0);
  }, []);

  const handleCancel = useCallback(() => {
    if (currentJob && ['running', 'pending'].includes(currentJob.status)) {
      removeJob(currentJob.id);
      success(`Removed: ${currentJob.name}`);
    }
  }, [currentJob, removeJob, success]);

  const handleClear = useCallback(() => {
    clearCompletedJobs();
    info('Cleared completed jobs');
  }, [clearCompletedJobs, info]);

  useKeyboard(
    useCallback((e: KeyEvent) => {
      if (e.isEscape) { goBack(); return true; }
      if (e.isUp) { setSelectedIndex((i) => Math.max(0, i - 1)); return true; }
      if (e.isDown) { setSelectedIndex((i) => Math.min(filteredJobs.length - 1, i + 1)); return true; }
      if (e.isLeft) { cycleFilter(-1); return true; }
      if (e.isRight) { cycleFilter(1); return true; }
      if (e.isEnter && currentJob) { toJobDetail(currentJob.id); return true; }
      if (e.key === 'c' && !e.ctrl && currentJob) { handleCancel(); return true; }
      if (e.key === 'x' && !e.ctrl) { handleClear(); return true; }
      return false;
    }, [goBack, filteredJobs.length, cycleFilter, currentJob, toJobDetail, handleCancel, handleClear]),
    { priority: 5 }
  );

  // Stats
  const stats = useMemo(() => ({
    running: jobs.filter((j) => j.status === 'running').length,
    pending: jobs.filter((j) => j.status === 'pending').length,
    success: jobs.filter((j) => j.status === 'success').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  }), [jobs]);

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text color={theme.accent.primary}>{icons.clock}</Text>
          <Text bold color={theme.text.primary}> Build Jobs</Text>
          <Text color={theme.text.muted}> ({filteredJobs.length})</Text>
        </Box>
        <Box>
          {stats.running > 0 && <Text color={palette.blue}>{spinnerFrame} {stats.running}  </Text>}
          {stats.pending > 0 && <Text color={theme.text.muted}>{icons.pending} {stats.pending}  </Text>}
          {stats.success > 0 && <Text color={palette.green}>{icons.success} {stats.success}  </Text>}
          {stats.failed > 0 && <Text color={palette.red}>{icons.error} {stats.failed}</Text>}
        </Box>
      </Box>

      {/* Filter tabs */}
      <Box marginBottom={1}>
        {FILTERS.map((f) => (
          <Box key={f.value} marginRight={2}>
            <Text 
              color={f.value === filter ? theme.accent.primary : theme.text.muted}
              bold={f.value === filter}
              underline={f.value === filter}
            >
              {f.icon} {f.label}
            </Text>
          </Box>
        ))}
      </Box>

      <Divider />

      {/* Job list */}
      <Box marginTop={1} flexDirection="column" flexGrow={1}>
        {filteredJobs.length === 0 ? (
          <EmptyState
            icon={filter === 'all' ? icons.clock : getStatusIcon(filter)}
            title={filter === 'all' ? 'No Jobs' : `No ${filter} jobs`}
            description="Start a build from a repository"
          />
        ) : (
          filteredJobs.slice(0, 12).map((job, idx) => (
            <JobRow key={job.id} job={job} isSelected={idx === selectedIndex} spinnerFrame={spinnerFrame} />
          ))
        )}
        {filteredJobs.length > 12 && (
          <Text color={theme.text.muted}>... and {filteredJobs.length - 12} more</Text>
        )}
      </Box>

      <Divider />

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color={theme.text.muted}>
          <Text color={theme.accent.primary}>←→</Text> Filter  
          <Text color={theme.accent.primary}> ↑↓</Text> Nav  
          <Text color={theme.accent.primary}> ⏎</Text> Details
        </Text>
        <Text color={theme.text.muted}>
          <Text color={theme.accent.secondary}>c</Text> Cancel  
          <Text color={theme.accent.secondary}> x</Text> Clear  
          <Text color={theme.accent.secondary}> Esc</Text> Back
        </Text>
      </Box>
    </Box>
  );
}

export default JobsView;
