/**
 * RepoListView Component
 * 
 * Repository list screen with fuzzy search.
 * Features:
 * - Auto-scan on mount (if data is empty)
 * - Fuzzy search filtering
 * - Navigation to repository details
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { matchSorter } from 'match-sorter';

import {
  ScreenContainer,
  SimpleList,
  Spinner,
  Header,
  StatusBar,
} from '../components/index.js';
import type { SimpleListItem } from '../components/index.js';
import { colors, icons } from '../theme.js';
import {
  useAppStore,
  useProjects,
  useIsScanning,
  usePendingJobsCount,
  useRunningJobsCount,
  useSettings,
} from '../../core/store/useAppStore.js';
import { WorkspaceScanner } from '../../core/services/WorkspaceScanner.js';
import { getFileSystem } from '../../infrastructure/ServiceLocator.js';
import type { DiscoveredProject } from '../../core/services/WorkspaceScanner.js';
import type { Shortcut } from '../components/index.js';

/**
 * Hook to perform workspace scanning.
 */
function useWorkspaceScan() {
  const settings = useSettings();
  const loadProjects = useAppStore((state) => state.loadProjects);
  const loadJdks = useAppStore((state) => state.loadJdks);
  const setScanning = useAppStore((state) => state.setScanning);
  const addNotification = useAppStore((state) => state.addNotification);

  const scan = useCallback(async () => {
    setScanning(true);
    
    try {
      const fs = getFileSystem();
      const scanner = new WorkspaceScanner(fs);
      
      // Scan for repositories
      const projects = await scanner.findRepositories(settings.scanRootPath);
      loadProjects(projects);
      
      // Scan for JDKs in all configured paths
      const jdkPaths = settings.jdkScanPaths?.split(';').filter(p => p.trim()) || [];
      const allJdks: Awaited<ReturnType<typeof scanner.scanJdks>> = [];
      
      for (const jdkPath of jdkPaths) {
        try {
          const jdks = await scanner.scanJdks(jdkPath.trim());
          allJdks.push(...jdks);
        } catch {
          // Ignore errors for individual paths
        }
      }
      
      // Remove duplicates
      const uniqueJdks = allJdks.filter((jdk, index, self) => 
        index === self.findIndex(j => j.jdkHome === jdk.jdkHome)
      );
      
      loadJdks(uniqueJdks);
      
      addNotification('success', `Found ${projects.length} repos, ${uniqueJdks.length} JDKs`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown scan error';
      addNotification('error', `Scan failed: ${message}`);
    } finally {
      setScanning(false);
    }
  }, [settings.scanRootPath, settings.jdkScanPaths, loadProjects, loadJdks, setScanning, addNotification]);

  return { scan };
}

/**
 * Convert discovered project to list item.
 */
function projectToListItem(project: DiscoveredProject): SimpleListItem<string> {
  const pathParts = project.path.split('\\');
  const versionFolder = pathParts[pathParts.length - 2] || '';
  
  // Determine badge based on version folder
  let badge = '';
  let badgeColor: string = colors.textDim;
  
  if (versionFolder === '2025') {
    badge = 'JAVA 21';
    badgeColor = colors.success;
  } else if (versionFolder === '4.8plus') {
    badge = 'JAVA 17';
    badgeColor = colors.info;
  } else if (versionFolder === '4.8') {
    badge = 'JAVA 11';
    badgeColor = colors.warning;
  }
  
  return {
    value: project.path,
    label: project.name,
    badge: badge || (project.hasMaven ? 'Maven' : ''),
    badgeColor: badge ? badgeColor : colors.secondary,
  };
}

// ============================================================================
// Props
// ============================================================================

export interface RepoListViewProps {
  /** Callback when navigating to a repository */
  onNavigateToRepo?: (path: string) => void;
  /** Callback when going back to main menu */
  onBack?: () => void;
}

/**
 * RepoListView - Repository list with fuzzy search.
 */
export function RepoListView({
  onNavigateToRepo,
  onBack,
}: RepoListViewProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Store selectors
  const projects = useProjects();
  const isScanning = useIsScanning();
  const pendingJobs = usePendingJobsCount();
  const runningJobs = useRunningJobsCount();
  const lastScanTime = useAppStore((state) => state.scannedData.lastScanTime);
  
  // Store actions
  const setScreen = useAppStore((state) => state.setScreen);
  const goBack = useAppStore((state) => state.goBack);
  const selectProject = useAppStore((state) => state.selectProject);
  
  // Workspace scan hook
  const { scan } = useWorkspaceScan();

  // Auto-scan on mount if no data
  useEffect(() => {
    if (projects.length === 0 && !isScanning) {
      scan();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard input handling - typing adds to search, special keys for actions
  useInput((input, key) => {
    // ESC: clear search if searching, otherwise go back
    if (key.escape) {
      if (searchQuery) {
        setSearchQuery('');
      } else {
        onBack?.() || goBack();
      }
      return;
    }
    
    // Backspace removes from search
    if (key.backspace || key.delete) {
      if (searchQuery.length > 0) {
        setSearchQuery(prev => prev.slice(0, -1));
      }
      return;
    }
    
    // Skip navigation keys - let SimpleList handle them
    if (key.upArrow || key.downArrow || key.return || key.tab) {
      return;
    }
    
    // Ctrl+U clears search
    if (input === '\u0015') {
      setSearchQuery('');
      return;
    }
    
    // Printable characters add to search
    if (input && input.length === 1 && input.charCodeAt(0) >= 32) {
      setSearchQuery(prev => prev + input);
      return;
    }
  });

  // Filter projects using fuzzy search
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }
    
    return matchSorter(projects, searchQuery, {
      keys: ['name', 'path'],
      threshold: matchSorter.rankings.CONTAINS,
    });
  }, [projects, searchQuery]);

  // Convert to list items
  const listItems = useMemo(() => {
    return filteredProjects.map(projectToListItem);
  }, [filteredProjects]);

  // Handle repository selection
  const handleSelect = useCallback((item: SimpleListItem<string>) => {
    selectProject(item.value);
    if (onNavigateToRepo) {
      onNavigateToRepo(item.value);
    } else {
      setScreen('REPO_DETAIL', { projectPath: item.value });
    }
  }, [selectProject, setScreen, onNavigateToRepo]);

  // Status bar shortcuts
  const shortcuts: Shortcut[] = [
    { key: 'Type', label: 'Search' },
    { key: 'ESC', label: searchQuery ? 'Clear' : 'Back' },
    { key: '↑↓', label: 'Navigate' },
    { key: '⏎', label: 'Select' },
  ];

  // Format last scan time
  const formatScanTime = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <Box flexDirection="column" height="100%">
      <Header title="GFOS-Build" version="1.0.0" isMockMode={process.env['MOCK_MODE'] === 'true'} />
      
      <ScreenContainer
        title="Repositories"
        subtitle={`${filteredProjects.length} of ${projects.length} projects`}
        padding={1}
        fillHeight
      >
        {/* Search Bar */}
        <Box marginBottom={1}>
          <Box marginRight={1}>
            <Text color={colors.textDim}>{icons.search}</Text>
          </Box>
          <Text color={searchQuery ? colors.text : colors.textDim}>
            {searchQuery || 'Type to filter...'}
          </Text>
          {searchQuery && (
            <Text color={colors.textDim}> (ESC to clear)</Text>
          )}
        </Box>
        
        {/* Divider */}
        <Box marginBottom={1}>
          <Text color={colors.border}>{'─'.repeat(60)}</Text>
        </Box>
        
        {/* Content */}
        {isScanning ? (
          <Box flexDirection="column" alignItems="center" paddingY={2}>
            <Spinner message="Scanning workspace..." />
            <Box marginTop={1}>
              <Text color={colors.textDim}>Looking for Git repositories and Maven projects...</Text>
            </Box>
          </Box>
        ) : listItems.length === 0 ? (
          <Box flexDirection="column" alignItems="center" paddingY={2}>
            <Text color={colors.textDim}>
              {searchQuery ? 'No repositories match your search.' : 'No repositories found.'}
            </Text>
          </Box>
        ) : (
          <SimpleList
            items={listItems}
            onSelect={handleSelect}
            limit={15}
            isFocused={true}
          />
        )}
        
        {/* Stats Footer */}
        <Box marginTop={1} justifyContent="space-between">
          <Text color={colors.textDim}>
            Last scan: {formatScanTime(lastScanTime)}
          </Text>
          {projects.length > 0 && (
            <Text color={colors.textDim}>
              {projects.filter(p => p.hasMaven).length} Maven projects
            </Text>
          )}
        </Box>
      </ScreenContainer>

      <StatusBar
        shortcuts={shortcuts}
        pendingJobs={pendingJobs}
        runningJobs={runningJobs}
        mode={process.env['MOCK_MODE'] === 'true' ? 'MOCK' : undefined}
      />
    </Box>
  );
}

export default RepoListView;
