/**
 * Home View - Main Menu
 * 
 * Professional home screen with navigation options and status overview.
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';

import { theme, icons } from '../theme/index.js';
import { List, type ListItem, Spinner, Divider, EmptyState } from '../primitives/index.js';
import { useNavigator, useKeyboard, type KeyEvent } from '../hooks/index.js';
import {
  useAppStore,
  useProjects,
  usePipelines,
  usePendingJobsCount,
  useRunningJobsCount,
  useIsScanning,
} from '../../core/store/useAppStore.js';
import { LOGO } from '../theme/index.js';

// ============================================================================
// Types
// ============================================================================

interface MenuItemData {
  route: 'repos' | 'jobs' | 'pipelines' | 'settings' | 'exit';
  count?: number;
}

// ============================================================================
// Component
// ============================================================================

export function HomeView(): React.ReactElement {
  const { toRepos, toJobs, toPipelines, toSettings, navigate } = useNavigator();
  
  // Data
  const projects = useProjects();
  const pipelines = usePipelines();
  const pendingJobs = usePendingJobsCount();
  const runningJobs = useRunningJobsCount();
  const isScanning = useIsScanning();
  const jdks = useAppStore((s) => s.scannedData.jdks);

  // Menu items
  const menuItems: ListItem<string>[] = useMemo(() => [
    {
      id: 'repos',
      label: 'Repositories',
      description: 'Browse and build Maven projects',
      icon: '/',
      badge: projects.length > 0 ? String(projects.length) : undefined,
      badgeVariant: 'info',
      data: { route: 'repos' } as MenuItemData,
    },
    {
      id: 'jobs',
      label: 'Build Jobs',
      description: 'View running and completed builds',
      icon: '>',
      badge: runningJobs > 0 
        ? `${runningJobs} running` 
        : pendingJobs > 0 
          ? `${pendingJobs} pending` 
          : undefined,
      badgeVariant: runningJobs > 0 ? 'warning' : 'info',
      data: { route: 'jobs' } as MenuItemData,
    },
    {
      id: 'pipelines',
      label: 'Pipelines',
      description: 'Saved build presets and workflows',
      icon: '#',
      badge: pipelines.length > 0 ? String(pipelines.length) : undefined,
      badgeVariant: 'primary',
      data: { route: 'pipelines' } as MenuItemData,
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Configure paths, JDKs, and preferences',
      icon: '*',
      data: { route: 'settings' } as MenuItemData,
    },
  ], [projects.length, pendingJobs, runningJobs, pipelines.length]);

  // Handle selection
  const handleSelect = useCallback((item: ListItem<string>) => {
    const data = item.data as MenuItemData;
    switch (data.route) {
      case 'repos':
        toRepos();
        break;
      case 'jobs':
        toJobs();
        break;
      case 'pipelines':
        toPipelines();
        break;
      case 'settings':
        toSettings();
        break;
    }
  }, [toRepos, toJobs, toPipelines, toSettings]);

  // Quick keys - only shortcuts that don't conflict with navigation
  useKeyboard(
    useCallback((event: KeyEvent) => {
      switch (event.key.toLowerCase()) {
        case 'r':
          toRepos();
          return true;
        case 'p':
          toPipelines();
          return true;
        case 's':
          if (!event.ctrl) {
            toSettings();
            return true;
          }
          break;
      }
      return false;
    }, [toRepos, toPipelines, toSettings]),
    { priority: 10 }
  );

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      {/* Logo */}
      <Box flexDirection="column" marginBottom={1}>
        {LOGO.map((line, i) => (
          <Text key={i} color={theme.accent.primary}>
            {line}
          </Text>
        ))}
      </Box>

      {/* Status line */}
      <Box marginBottom={1}>
        <Text color={theme.text.muted}>
          {projects.length} Repositories • {jdks.length} JDKs verfügbar
          {isScanning && (
            <Text color={theme.accent.primary}> • Scanning...</Text>
          )}
        </Text>
      </Box>

      <Divider />

      {/* Menu */}
      <Box marginTop={1} flexGrow={1}>
        <List
          items={menuItems}
          onSelect={handleSelect}
          focused={true}
          maxVisible={10}
          emptyMessage="No options available"
        />
      </Box>

      {/* Footer - simplified without Quick Keys section */}
      <Divider />

      {/* Status */}
      {(runningJobs > 0 || pendingJobs > 0) && (
        <Box marginTop={1} borderStyle="single" borderColor={theme.border.muted} padding={1}>
          <Box flexDirection="row" gap={2}>
            {runningJobs > 0 && (
              <Box>
                <Spinner type="dots" />
                <Text color={theme.status.running}>
                  {' '}{runningJobs} build{runningJobs > 1 ? 's' : ''} running
                </Text>
              </Box>
            )}
            {pendingJobs > 0 && (
              <Text color={theme.status.pending}>
                {icons.pending} {pendingJobs} pending
              </Text>
            )}
          </Box>
        </Box>
      )}

      {/* Hint */}
      <Box marginTop={1} justifyContent="center">
        <Text color={theme.text.muted}>
          <Text color={theme.accent.primary}>↑↓</Text> Navigate  
          <Text color={theme.accent.primary}> ⏎</Text> Select  
          <Text color={theme.accent.primary}> r</Text> Repos  
          <Text color={theme.accent.primary}> p</Text> Pipelines  
          <Text color={theme.accent.primary}> s</Text> Settings
        </Text>
      </Box>
    </Box>
  );
}

export default HomeView;
