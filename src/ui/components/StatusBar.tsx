/**
 * StatusBar Component
 * 
 * Fixed footer displaying global shortcuts and running job information.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors, icons, keyLabels } from '../theme.js';
import { useTerminalSize } from './ScreenContainer.js';

/**
 * Keyboard shortcut definition.
 */
export interface Shortcut {
  /** Key or key combination */
  key: string;
  /** Description of the action */
  label: string;
  /** Whether shortcut is currently active/available */
  active?: boolean;
}

export interface StatusBarProps {
  /** Keyboard shortcuts to display */
  shortcuts?: Shortcut[];
  /** Number of pending jobs */
  pendingJobs?: number;
  /** Number of running jobs */
  runningJobs?: number;
  /** Number of completed jobs in history */
  completedJobs?: number;
  /** Current app mode/screen indicator */
  mode?: string;
  /** Custom status message */
  message?: string;
  /** Message type for coloring */
  messageType?: 'info' | 'success' | 'warning' | 'error';
  /** Whether to show the full-width bar background */
  showBackground?: boolean;
}

/**
 * Shortcut display component.
 */
function ShortcutDisplay({ shortcut }: { shortcut: Shortcut }): React.ReactElement {
  return (
    <Box marginRight={2}>
      <Text 
        backgroundColor="blackBright" 
        color="white"
        bold
      >
        {' '}{shortcut.key}{' '}
      </Text>
      <Text color={shortcut.active === false ? colors.textDim : colors.text}>
        {' '}{shortcut.label}
      </Text>
    </Box>
  );
}

/**
 * Job counter display component.
 */
function JobCounter({ 
  icon, 
  count, 
  label, 
  color 
}: { 
  icon: string; 
  count: number; 
  label: string; 
  color: string;
}): React.ReactElement | null {
  if (count === 0) return null;
  
  return (
    <Box marginLeft={2}>
      <Text color={color}>
        {icon} {count} {label}
      </Text>
    </Box>
  );
}

/**
 * StatusBar - Footer component with shortcuts and job status.
 */
export function StatusBar({
  shortcuts = [],
  pendingJobs = 0,
  runningJobs = 0,
  completedJobs = 0,
  mode,
  message,
  messageType = 'info',
  showBackground = true,
}: StatusBarProps): React.ReactElement {
  const { width } = useTerminalSize();
  
  const messageColors: Record<string, string> = {
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  };

  // Default shortcuts if none provided
  const defaultShortcuts: Shortcut[] = [
    { key: 'Q', label: 'Quit' },
    { key: 'B', label: 'Back' },
    { key: '?', label: 'Help' },
  ];

  const displayShortcuts = shortcuts.length > 0 ? shortcuts : defaultShortcuts;

  return (
    <Box 
      flexDirection="column"
      width={width}
    >
      {/* Separator line */}
      <Text color={colors.border}>
        {'─'.repeat(width)}
      </Text>
      
      {/* Status bar content */}
      <Box 
        flexDirection="row" 
        justifyContent="space-between"
        paddingX={1}
        backgroundColor={showBackground ? 'blackBright' : undefined}
      >
        {/* Left side: Shortcuts */}
        <Box flexDirection="row" flexWrap="wrap">
          {displayShortcuts.map((shortcut, index) => (
            <ShortcutDisplay key={index} shortcut={shortcut} />
          ))}
        </Box>

        {/* Right side: Job counters and mode */}
        <Box flexDirection="row" alignItems="center">
          {/* Status message */}
          {message && (
            <Box marginRight={2}>
              <Text color={messageColors[messageType]}>
                {messageType === 'success' && icons.success}
                {messageType === 'warning' && icons.warning}
                {messageType === 'error' && icons.error}
                {messageType === 'info' && icons.info}
                {' '}{message}
              </Text>
            </Box>
          )}
          
          {/* Job counters */}
          <JobCounter 
            icon={icons.pending} 
            count={pendingJobs} 
            label="pending" 
            color={colors.textDim} 
          />
          <JobCounter 
            icon={icons.running} 
            count={runningJobs} 
            label="running" 
            color={colors.primary} 
          />
          <JobCounter 
            icon={icons.success} 
            count={completedJobs} 
            label="done" 
            color={colors.success} 
          />
          
          {/* Mode indicator */}
          {mode && (
            <Box marginLeft={2}>
              <Text color={colors.textDim}>
                [{mode}]
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Pre-configured status bar variants for common screens.
 */
export function HomeStatusBar(props: Partial<StatusBarProps>): React.ReactElement {
  const shortcuts: Shortcut[] = [
    { key: 'Enter', label: 'Select' },
    { key: 'R', label: 'Refresh' },
    { key: 'S', label: 'Settings' },
    { key: 'Q', label: 'Quit' },
  ];
  return <StatusBar shortcuts={shortcuts} {...props} />;
}

export function ListStatusBar(props: Partial<StatusBarProps>): React.ReactElement {
  const shortcuts: Shortcut[] = [
    { key: '↑↓', label: 'Navigate' },
    { key: 'Enter', label: 'Select' },
    { key: 'B', label: 'Back' },
    { key: 'Q', label: 'Quit' },
  ];
  return <StatusBar shortcuts={shortcuts} {...props} />;
}

export function BuildStatusBar(props: Partial<StatusBarProps>): React.ReactElement {
  const shortcuts: Shortcut[] = [
    { key: 'Enter', label: 'Start Build' },
    { key: 'J', label: 'Select JDK' },
    { key: 'G', label: 'Goals' },
    { key: 'B', label: 'Back' },
  ];
  return <StatusBar shortcuts={shortcuts} {...props} />;
}

export function QueueStatusBar(props: Partial<StatusBarProps>): React.ReactElement {
  const shortcuts: Shortcut[] = [
    { key: 'Enter', label: 'View Details' },
    { key: 'X', label: 'Cancel' },
    { key: 'C', label: 'Clear Done' },
    { key: 'B', label: 'Back' },
  ];
  return <StatusBar shortcuts={shortcuts} {...props} />;
}

export default StatusBar;
