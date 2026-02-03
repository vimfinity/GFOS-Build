/**
 * Layout Components
 * 
 * Screen layout, panels, and structural components.
 */

import React, { useCallback, useEffect } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';
import { theme, icons, keys, layout as layoutConfig } from '../theme/index.js';
import { useTerminalSize, useKeyboard, type KeyEvent } from '../hooks/index.js';

// ============================================================================
// Types
// ============================================================================

export interface ScreenProps {
  children: React.ReactNode;
  /** Screen title */
  title?: string;
  /** Subtitle */
  subtitle?: string;
  /** Footer shortcuts */
  shortcuts?: Array<{ key: string; label: string }>;
  /** Enable alternate screen buffer */
  fullscreen?: boolean;
  /** Show header */
  showHeader?: boolean;
  /** Show footer/status bar */
  showFooter?: boolean;
  /** Header extra content */
  headerExtra?: React.ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string;
}

export interface PanelProps {
  children: React.ReactNode;
  title?: string;
  width?: number | string;
  height?: number | string;
  focused?: boolean;
  border?: boolean;
  padding?: number;
}

export interface SplitLayoutProps {
  children: [React.ReactNode, React.ReactNode];
  /** Split direction */
  direction?: 'horizontal' | 'vertical';
  /** Size of first pane (percentage or fixed) */
  splitAt?: number | string;
  /** Whether first pane has focus */
  firstFocused?: boolean;
}

// ============================================================================
// Screen Component (Full App Container)
// ============================================================================

export function Screen({
  children,
  title,
  subtitle,
  shortcuts = [],
  fullscreen = true,
  showHeader = true,
  showFooter = true,
  headerExtra,
  loading = false,
  error,
}: ScreenProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { stdout } = useStdout();
  const { exit } = useApp();

  // Enter alternate screen on mount (if fullscreen)
  useEffect(() => {
    if (!fullscreen || !stdout) return;
    
    // Enter alternate screen
    stdout.write('\x1B[?1049h');
    // Hide cursor
    stdout.write('\x1B[?25l');
    // Clear screen
    stdout.write('\x1B[2J\x1B[H');

    return () => {
      // Show cursor
      stdout.write('\x1B[?25h');
      // Exit alternate screen
      stdout.write('\x1B[?1049l');
    };
  }, [fullscreen, stdout]);

  // Global exit handler
  useKeyboard(
    useCallback((event: KeyEvent) => {
      if (event.isCtrlC || event.isCtrlQ) {
        exit();
        return true;
      }
      return false;
    }, [exit]),
    { priority: 1000, id: 'global-exit' }
  );

  // Calculate content height
  const headerHeight = showHeader ? layoutConfig.headerHeight : 0;
  const footerHeight = showFooter ? layoutConfig.statusBarHeight : 0;
  const contentHeight = height - headerHeight - footerHeight;

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      overflow="hidden"
    >
      {/* Header */}
      {showHeader && (
        <Header 
          title={title} 
          subtitle={subtitle} 
          extra={headerExtra}
          width={width}
        />
      )}

      {/* Main Content */}
      <Box 
        flexDirection="column" 
        flexGrow={1} 
        height={contentHeight}
        overflow="hidden"
      >
        {loading ? (
          <Box alignItems="center" justifyContent="center" flexGrow={1}>
            <Text color={theme.accent.primary}>Loading...</Text>
          </Box>
        ) : error ? (
          <Box padding={1}>
            <Text color={theme.status.error}>{icons.error} {error}</Text>
          </Box>
        ) : (
          children
        )}
      </Box>

      {/* Footer/Status Bar */}
      {showFooter && (
        <StatusBar shortcuts={shortcuts} width={width} />
      )}
    </Box>
  );
}

// ============================================================================
// Header Component
// ============================================================================

interface HeaderProps {
  title?: string;
  subtitle?: string;
  extra?: React.ReactNode;
  width?: number;
}

export function Header({ 
  title, 
  subtitle,
  extra,
  width,
}: HeaderProps): React.ReactElement {
  return (
    <Box 
      flexDirection="column" 
      width={width}
      paddingX={1}
      borderStyle="single"
      borderColor={theme.border.default}
      borderTop={false}
      borderLeft={false}
      borderRight={false}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" alignItems="center">
          {/* App Icon/Name */}
          <Text color={theme.accent.primary} bold>
            {icons.maven} GFOS-Build
          </Text>
          
          {/* Title */}
          {title && (
            <>
              <Text color={theme.text.muted}> {icons.chevronRight} </Text>
              <Text color={theme.text.primary} bold>{title}</Text>
            </>
          )}
          
          {/* Subtitle */}
          {subtitle && (
            <Text color={theme.text.muted}> · {subtitle}</Text>
          )}
        </Box>

        {/* Extra content (right side) */}
        {extra && (
          <Box>{extra}</Box>
        )}
      </Box>
    </Box>
  );
}

// ============================================================================
// Status Bar Component
// ============================================================================

interface StatusBarProps {
  shortcuts?: Array<{ key: string; label: string }>;
  message?: string;
  width?: number;
}

export function StatusBar({ 
  shortcuts = [],
  message,
  width,
}: StatusBarProps): React.ReactElement {
  const defaultShortcuts = [
    { key: 'esc', label: 'Back' },
    { key: 'q', label: 'Quit' },
  ];

  const allShortcuts = shortcuts.length > 0 ? shortcuts : defaultShortcuts;

  return (
    <Box 
      width={width}
      paddingX={1}
      borderStyle="single"
      borderColor={theme.border.default}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      justifyContent="space-between"
    >
      {/* Shortcuts */}
      <Box flexDirection="row" gap={2}>
        {allShortcuts.map((shortcut, index) => (
          <Box key={index} flexDirection="row">
            <Text color={theme.accent.primary} bold>{shortcut.key}</Text>
            <Text color={theme.text.muted}> {shortcut.label}</Text>
            {index < allShortcuts.length - 1 && (
              <Text color={theme.text.muted}> │</Text>
            )}
          </Box>
        ))}
      </Box>

      {/* Status message */}
      {message && (
        <Text color={theme.text.muted}>{message}</Text>
      )}
    </Box>
  );
}

// ============================================================================
// Panel Component
// ============================================================================

export function Panel({
  children,
  title,
  width,
  height,
  focused = false,
  border = true,
  padding = 1,
}: PanelProps): React.ReactElement {
  const borderColor = focused ? theme.border.focus : theme.border.default;

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle={border ? 'single' : undefined}
      borderColor={borderColor}
      padding={padding}
    >
      {title && (
        <Box marginBottom={1}>
          <Text color={focused ? theme.accent.primary : theme.text.secondary} bold>
            {title}
          </Text>
        </Box>
      )}
      {children}
    </Box>
  );
}

// ============================================================================
// Split Layout
// ============================================================================

export function SplitLayout({
  children,
  direction = 'horizontal',
  splitAt = '50%',
  firstFocused = true,
}: SplitLayoutProps): React.ReactElement {
  const [first, second] = children;
  const isHorizontal = direction === 'horizontal';

  // Parse split value
  let firstSize: number | string;
  if (typeof splitAt === 'string' && splitAt.endsWith('%')) {
    firstSize = splitAt;
  } else {
    firstSize = splitAt;
  }

  return (
    <Box 
      flexDirection={isHorizontal ? 'row' : 'column'}
      flexGrow={1}
    >
      <Box
        width={isHorizontal ? firstSize : '100%'}
        height={isHorizontal ? '100%' : firstSize}
        borderStyle="single"
        borderColor={firstFocused ? theme.border.focus : theme.border.muted}
        borderRight={isHorizontal}
        borderBottom={!isHorizontal}
      >
        {first}
      </Box>
      <Box
        flexGrow={1}
        borderStyle="single"
        borderColor={!firstFocused ? theme.border.focus : theme.border.muted}
        borderLeft={false}
        borderTop={false}
      >
        {second}
      </Box>
    </Box>
  );
}

// ============================================================================
// Divider
// ============================================================================

export interface DividerProps {
  label?: string;
  width?: number;
}

export function Divider({ label, width }: DividerProps): React.ReactElement {
  const lineChar = icons.box.horizontal;
  
  if (!label) {
    return (
      <Box width={width}>
        <Text color={theme.border.default}>
          {lineChar.repeat(width || 40)}
        </Text>
      </Box>
    );
  }

  const labelWithPadding = ` ${label} `;
  const remaining = (width || 40) - labelWithPadding.length;
  const left = Math.floor(remaining / 2);
  const right = remaining - left;

  return (
    <Box width={width}>
      <Text color={theme.border.default}>{lineChar.repeat(left)}</Text>
      <Text color={theme.text.muted}>{labelWithPadding}</Text>
      <Text color={theme.border.default}>{lineChar.repeat(right)}</Text>
    </Box>
  );
}

// ============================================================================
// Empty State
// ============================================================================

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps): React.ReactElement {
  return (
    <Box 
      flexDirection="column" 
      alignItems="center" 
      justifyContent="center"
      paddingY={2}
    >
      {icon && (
        <Text color={theme.text.muted}>{icon}</Text>
      )}
      <Text color={theme.text.secondary} bold>{title}</Text>
      {description && (
        <Text color={theme.text.muted}>{description}</Text>
      )}
      {action && (
        <Box marginTop={1}>
          <Text color={theme.accent.primary}>{action}</Text>
        </Box>
      )}
    </Box>
  );
}

export default {
  Screen,
  Header,
  StatusBar,
  Panel,
  SplitLayout,
  Divider,
  EmptyState,
};
