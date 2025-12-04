/**
 * MainMenuView Component
 * 
 * Main menu / home screen with navigation to all major sections.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

import {
  ScreenContainer,
  Header,
  StatusBar,
} from '../components/index.js';
import { colors, icons } from '../theme.js';
import {
  useAppStore,
  usePendingJobsCount,
  useRunningJobsCount,
  useProjects,
} from '../../core/store/useAppStore.js';
import type { Shortcut } from '../components/index.js';

// ============================================================================
// Menu Items
// ============================================================================

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

// ============================================================================
// Props
// ============================================================================

export interface MainMenuViewProps {
  /** Callback when navigating to repositories */
  onNavigateToRepos?: () => void;
  /** Callback when navigating to jobs */
  onNavigateToJobs?: () => void;
  /** Callback when navigating to settings */
  onNavigateToSettings?: () => void;
  /** Callback when exiting */
  onExit?: () => void;
}

/**
 * MainMenuView - Home screen with main navigation.
 */
export function MainMenuView({
  onNavigateToRepos,
  onNavigateToJobs,
  onNavigateToSettings,
  onExit,
}: MainMenuViewProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Store data for badges
  const projects = useProjects();
  const pendingJobs = usePendingJobsCount();
  const runningJobs = useRunningJobsCount();
  
  // Store actions
  const setScreen = useAppStore((state) => state.setScreen);
  
  // Menu items with dynamic badges
  const menuItems: MenuItem[] = [
    {
      id: 'repos',
      icon: '›',
      label: 'Repositories',
      description: 'Browse and build Maven projects',
      badge: projects.length > 0 ? `${projects.length}` : undefined,
      badgeColor: colors.info,
    },
    {
      id: 'jobs',
      icon: '›',
      label: 'Build Jobs',
      description: 'View running and completed builds',
      badge: runningJobs > 0 ? `${runningJobs} running` : pendingJobs > 0 ? `${pendingJobs} pending` : undefined,
      badgeColor: runningJobs > 0 ? colors.warning : colors.info,
    },
    {
      id: 'settings',
      icon: '›',
      label: 'Settings',
      description: 'Configure paths, JDKs, and preferences',
    },
    {
      id: 'exit',
      icon: '›',
      label: 'Exit',
      description: 'Quit GFOS-Build',
    },
  ];
  
  // Handle selection
  const handleSelect = useCallback(() => {
    const item = menuItems[selectedIndex];
    if (!item) return;
    
    switch (item.id) {
      case 'repos':
        onNavigateToRepos?.() || setScreen('REPO_LIST');
        break;
      case 'jobs':
        onNavigateToJobs?.() || setScreen('BUILD_QUEUE');
        break;
      case 'settings':
        onNavigateToSettings?.() || setScreen('SETTINGS');
        break;
      case 'exit':
        onExit?.();
        break;
    }
  }, [selectedIndex, menuItems, onNavigateToRepos, onNavigateToJobs, onNavigateToSettings, onExit, setScreen]);
  
  // Keyboard navigation
  useInput((input, key) => {
    // Navigate up
    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
      return;
    }
    
    // Navigate down
    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(menuItems.length - 1, prev + 1));
      return;
    }
    
    // Select with Enter
    if (key.return) {
      handleSelect();
      return;
    }
    
    // Quick navigation with numbers
    if (input >= '1' && input <= '4') {
      const index = parseInt(input, 10) - 1;
      if (index < menuItems.length) {
        setSelectedIndex(index);
        // Auto-select after short delay feel
        handleSelect();
      }
      return;
    }
    
    // Quick keys
    if (input === 'r' || input === 'R') {
      setSelectedIndex(0);
      onNavigateToRepos?.() || setScreen('REPO_LIST');
      return;
    }
    if (input === 'j' || input === 'J') {
      setSelectedIndex(1);
      onNavigateToJobs?.() || setScreen('BUILD_QUEUE');
      return;
    }
    if (input === 's' || input === 'S') {
      setSelectedIndex(2);
      onNavigateToSettings?.() || setScreen('SETTINGS');
      return;
    }
    if (input === 'q' || input === 'Q') {
      onExit?.();
      return;
    }
  });
  
  // Status bar shortcuts
  const shortcuts = [
    { key: '↑↓', label: 'Navigate' },
    { key: '⏎', label: 'Select' },
    { key: '1-4', label: 'Jump' },
    { key: 'q', label: 'Quit' },
  ];
  
  return (
    <Box flexDirection="column" height="100%">
      <Header title="GFOS-Build" version="1.0.0" isMockMode={process.env['MOCK_MODE'] === 'true'} />
      
      <ScreenContainer title="Main Menu" padding={1} fillHeight>
        {/* Welcome message */}
        <Box marginBottom={2} flexDirection="column">
          <Text color={colors.primaryBright} bold>
            Welcome to GFOS-Build
          </Text>
          <Text color={colors.textDim}>
            High-performance Maven build management
          </Text>
        </Box>
        
        {/* Menu items */}
        <Box flexDirection="column">
          {menuItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            
            return (
              <Box key={item.id} marginY={0}>
                {/* Selection indicator */}
                <Box width={3}>
                  <Text color={isSelected ? colors.primary : undefined}>
                    {isSelected ? icons.pointer : ' '}
                  </Text>
                </Box>
                
                {/* Number shortcut */}
                <Box width={3}>
                  <Text color={colors.textDim}>{index + 1}.</Text>
                </Box>
                
                {/* Label with fixed width for stability */}
                <Box width={16}>
                  <Text
                    color={isSelected ? colors.primaryBright : colors.text}
                    bold={isSelected}
                  >
                    {item.label}
                  </Text>
                </Box>
                
                {/* Badge with fixed width to prevent layout shift */}
                <Box width={14}>
                  {item.badge && (
                    <Text color={item.badgeColor || colors.accent}>
                      [{item.badge}]
                    </Text>
                  )}
                </Box>
                
                {/* Description - only for selected item */}
                {isSelected && (
                  <Text color={colors.textDim} italic>
                    {item.description}
                  </Text>
                )}
              </Box>
            );
          })}
        </Box>
        
        {/* Quick stats */}
        <Box marginTop={2} borderStyle="single" borderColor={colors.border} paddingX={1}>
          <Text color={colors.textDim}>
            {projects.length} repos
            {'  •  '}
            {runningJobs} running
            {'  •  '}
            {pendingJobs} pending
          </Text>
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

export default MainMenuView;
