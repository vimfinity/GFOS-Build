/**
 * Repository List View
 * 
 * Searchable list of discovered Maven repositories.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { matchSorter } from 'match-sorter';

import { theme, icons, palette } from '../theme/index.js';
import { 
  Spinner, 
  Divider, 
  EmptyState,
} from '../primitives/index.js';
import { 
  useNavigator, 
} from '../hooks/index.js';
import {
  useAppStore,
  useProjects,
  useIsScanning,
  useSettings,
} from '../../core/store/useAppStore.js';
import { WorkspaceScanner } from '../../core/services/WorkspaceScanner.js';
import { getFileSystem } from '../../infrastructure/ServiceLocator.js';
import type { DiscoveredProject } from '../../core/services/WorkspaceScanner.js';
import { useNotifications } from '../system/notifications.js';

// ============================================================================
// Props
// ============================================================================

export interface RepoListViewProps {
  initialSearch?: string;
}

// ============================================================================
// Repo Row Component
// ============================================================================

interface RepoRowProps {
  project: DiscoveredProject;
  isSelected: boolean;
}

function RepoRow({ project, isSelected }: RepoRowProps): React.ReactElement {
  const pathParts = project.path.split(/[/\\]/);
  const versionFolder = pathParts[pathParts.length - 2] || '';
  
  // Determine badge based on version folder
  let badge = '';
  let badgeColor: string = theme.text.muted;
  
  if (versionFolder === '2025') {
    badge = 'Java 21';
    badgeColor = 'green';
  } else if (versionFolder === '4.8plus') {
    badge = 'Java 17';
    badgeColor = 'blue';
  } else if (versionFolder === '4.8') {
    badge = 'Java 11';
    badgeColor = 'yellow';
  } else if (project.hasMaven) {
    badge = 'Maven';
  }

  return (
    <Box paddingX={1}>
      <Text color={isSelected ? theme.accent.primary : theme.text.muted}>
        {isSelected ? icons.pointer : ' '}{' '}
      </Text>
      <Text>{project.hasMaven ? icons.maven : icons.folder} </Text>
      <Text color={theme.text.primary} bold={isSelected}>
        {project.name}
      </Text>
      {badge && (
        <Text color={badgeColor}> [{badge}]</Text>
      )}
    </Box>
  );
}

// ============================================================================
// Component
// ============================================================================

export function RepoListView({ 
  initialSearch = '' 
}: RepoListViewProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  // Terminal dimensions for virtual scrolling
  const { stdout } = useStdout();
  const terminalRows = stdout?.rows ?? 24;
  
  // Calculate available height for list (reserve space for header, search, dividers, footer)
  const reservedRows = 10;
  const listHeight = Math.max(5, terminalRows - reservedRows);
  
  // Navigation
  const { toRepoDetail, goBack } = useNavigator();
  
  // Store
  const projects = useProjects();
  const isScanning = useIsScanning();
  const settings = useSettings();
  const { success, error } = useNotifications();

  // Get stable action references
  const loadProjects = useCallback(
    (p: typeof projects) => useAppStore.getState().loadProjects(p),
    []
  );
  const loadJdks = useCallback(
    (j: any[]) => useAppStore.getState().loadJdks(j),
    []
  );
  const setScanning = useCallback(
    (scanning: boolean) => useAppStore.getState().setScanning(scanning),
    []
  );

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    
    return matchSorter(projects, searchQuery, {
      keys: ['name', 'path'],
      threshold: matchSorter.rankings.CONTAINS,
    });
  }, [projects, searchQuery]);

  // Virtual scrolling - calculate visible window
  const scrollOffset = useMemo(() => {
    const halfVisible = Math.floor(listHeight / 2);
    let offset = Math.max(0, focusedIndex - halfVisible);
    const maxOffset = Math.max(0, filteredProjects.length - listHeight);
    return Math.min(offset, maxOffset);
  }, [focusedIndex, listHeight, filteredProjects.length]);
  
  const visibleProjects = useMemo(() => 
    filteredProjects.slice(scrollOffset, scrollOffset + listHeight),
    [filteredProjects, scrollOffset, listHeight]
  );
  
  // Scroll indicators
  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + listHeight < filteredProjects.length;

  // Refresh function
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setScanning(true);
    
    try {
      const fs = getFileSystem();
      const scanner = new WorkspaceScanner(fs);
      const newProjects = await scanner.findRepositories(settings.scanRootPath);
      loadProjects(newProjects);
      
      // Also scan JDKs
      const jdkPaths = settings.jdkScanPaths.split(';').filter((p) => p.trim());
      const allJdks: Awaited<ReturnType<typeof scanner.scanJdks>> = [];
      for (const path of jdkPaths) {
        try {
          const jdks = await scanner.scanJdks(path.trim());
          allJdks.push(...jdks);
        } catch {}
      }
      const uniqueJdks = allJdks.filter(
        (jdk, idx, self) => idx === self.findIndex((j) => j.jdkHome === jdk.jdkHome)
      );
      loadJdks(uniqueJdks);
      
      success(`Found ${newProjects.length} repositories`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      error(`Scan failed: ${msg}`);
    } finally {
      setScanning(false);
      setIsRefreshing(false);
    }
  }, [settings.scanRootPath, settings.jdkScanPaths, loadProjects, loadJdks, setScanning, success, error]);

  // Use refs to avoid stale closures in useInput
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  
  const filteredProjectsRef = useRef(filteredProjects);
  filteredProjectsRef.current = filteredProjects;
  
  const focusedIndexRef = useRef(focusedIndex);
  focusedIndexRef.current = focusedIndex;

  // Reset focus when filter changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [filteredProjects.length]);

  // Direct keyboard handling using Ink's useInput (bypasses the layer system)
  useInput(useCallback((input: string, key: { 
    escape?: boolean; 
    ctrl?: boolean; 
    meta?: boolean; 
    backspace?: boolean;
    delete?: boolean;
    return?: boolean;
    upArrow?: boolean;
    downArrow?: boolean;
  }) => {
    // Escape: clear search or go back
    if (key.escape) {
      if (searchQueryRef.current) {
        setSearchQuery('');
      } else {
        goBack();
      }
      return;
    }
    
    // Ctrl+U: clear search
    if (key.ctrl && input === 'u') {
      setSearchQuery('');
      return;
    }
    
    // Ctrl+R: refresh
    if (key.ctrl && input === 'r') {
      handleRefresh();
      return;
    }
    
    // Backspace or Delete: handle text deletion
    if (key.backspace || key.delete) {
      if (searchQueryRef.current.length > 0) {
        setSearchQuery(searchQueryRef.current.slice(0, -1));
      }
      return;
    }
    
    // Enter key - directly handle selection
    if (key.return) {
      const projects = filteredProjectsRef.current;
      const idx = focusedIndexRef.current;
      const item = projects[idx];
      if (item) {
        toRepoDetail(item.path);
      }
      return;
    }
    
    // Navigation keys
    if (key.upArrow || input === 'k') {
      setFocusedIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      const maxIdx = filteredProjectsRef.current.length - 1;
      setFocusedIndex((i) => Math.min(Math.max(0, maxIdx), i + 1));
      return;
    }
    
    // Page navigation
    if (key.ctrl && input === 'd') {
      const maxIdx = filteredProjectsRef.current.length - 1;
      setFocusedIndex((i) => Math.min(maxIdx, i + 10));
      return;
    }
    if (key.ctrl && input === 'u') {
      if (!searchQueryRef.current) {
        setFocusedIndex((i) => Math.max(0, i - 10));
      }
      return;
    }
    
    // Printable characters: add to search
    if (input && input.length === 1 && input.charCodeAt(0) >= 32 && !key.ctrl && !key.meta) {
      setSearchQuery(searchQueryRef.current + input);
      return;
    }
  }, [goBack, handleRefresh, toRepoDetail]));

  // Loading state
  if (isScanning && projects.length === 0) {
    return (
      <Box flexDirection="column" padding={1} alignItems="center" justifyContent="center" flexGrow={1}>
        <Spinner label="Scanning for repositories..." />
      </Box>
    );
  }

  // Empty state
  if (projects.length === 0) {
    return (
      <Box flexDirection="column" padding={1} flexGrow={1}>
        <EmptyState
          icon={icons.folder}
          title="No Repositories Found"
          description={`No Maven projects found in ${settings.scanRootPath}`}
          action="Press Ctrl+R to scan again"
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      {/* Search bar */}
      <Box marginBottom={1}>
        <Text color={theme.accent.primary}>{icons.search} </Text>
        {searchQuery ? (
          <Text color={theme.text.primary}>{searchQuery}</Text>
        ) : (
          <Text color={theme.text.muted}>Type to filter repositories...</Text>
        )}
        <Text color={theme.text.muted}>_</Text>
        {searchQuery && (
          <Text color={theme.text.muted}> ({filteredProjects.length}/{projects.length})</Text>
        )}
      </Box>

      {/* Refresh indicator */}
      {isRefreshing && (
        <Box marginBottom={1}>
          <Spinner label="Refreshing..." />
        </Box>
      )}

      <Divider />

      {/* Scroll up indicator */}
      {showScrollUp && (
        <Box paddingX={1}>
          <Text color={theme.text.muted}>{icons.arrowUp} {scrollOffset} more above</Text>
        </Box>
      )}

      {/* Results */}
      <Box marginTop={1} flexGrow={1} flexDirection="column">
        {filteredProjects.length === 0 ? (
          <EmptyState
            title="No matches"
            description={`No repositories match "${searchQuery}"`}
            action="Try a different search term"
          />
        ) : (
          visibleProjects.map((project, idx) => {
            const actualIndex = scrollOffset + idx;
            return (
              <RepoRow
                key={project.path}
                project={project}
                isSelected={actualIndex === focusedIndex}
              />
            );
          })
        )}
      </Box>

      {/* Scroll down indicator */}
      {showScrollDown && (
        <Box paddingX={1}>
          <Text color={theme.text.muted}>
            {icons.arrowDown} {filteredProjects.length - scrollOffset - listHeight} more below
          </Text>
        </Box>
      )}

      <Divider />

      {/* Footer hints */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color={theme.text.muted}>
          <Text color={theme.accent.primary}>↑↓</Text> Navigate{' '}
          <Text color={theme.accent.primary}>⏎</Text> Select
        </Text>
        <Text color={theme.text.muted}>
          <Text color={theme.accent.secondary}>Ctrl+R</Text> Refresh{' '}
          <Text color={theme.accent.secondary}>Esc</Text> Back
        </Text>
      </Box>
    </Box>
  );
}

export default RepoListView;
