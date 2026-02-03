/**
 * Help View
 * 
 * Displays keyboard shortcuts and help information.
 */

import React, { useCallback } from 'react';
import { Box, Text } from 'ink';

import { theme, icons, palette } from '../theme/index.js';
import { Divider } from '../primitives/index.js';
import { useNavigator, useKeyboard, type KeyEvent } from '../hooks/index.js';

// ============================================================================
// Types
// ============================================================================

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string; description: string }>;
}

// ============================================================================
// Data
// ============================================================================

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: '↑ / k', description: 'Move up' },
      { keys: '↓ / j', description: 'Move down' },
      { keys: '← / h', description: 'Previous tab / Back' },
      { keys: '→ / l', description: 'Next tab / Forward' },
      { keys: 'Enter', description: 'Select / Confirm' },
      { keys: 'Esc', description: 'Go back / Cancel' },
    ],
  },
  {
    title: 'Global',
    shortcuts: [
      { keys: 'Ctrl+P', description: 'Command palette' },
      { keys: '?', description: 'Show this help' },
      { keys: 'q', description: 'Quit application' },
    ],
  },
  {
    title: 'Repository View',
    shortcuts: [
      { keys: 'Space', description: 'Toggle module selection' },
      { keys: 'a', description: 'Select all modules' },
      { keys: 'n', description: 'Deselect all modules' },
      { keys: 'j', description: 'Cycle JDK version' },
      { keys: 'p', description: 'Save as pipeline' },
      { keys: 'b / Enter', description: 'Start build' },
    ],
  },
  {
    title: 'Jobs View',
    shortcuts: [
      { keys: '← / →', description: 'Filter by status' },
      { keys: 'c', description: 'Cancel selected job' },
      { keys: 'x', description: 'Clear completed jobs' },
      { keys: 'Enter', description: 'View job details' },
    ],
  },
  {
    title: 'Pipelines View',
    shortcuts: [
      { keys: '↑ / ↓', description: 'Navigate pipelines' },
      { keys: 'Enter / r', description: 'Run pipeline' },
      { keys: 'd', description: 'Delete pipeline (confirm)' },
    ],
  },
  {
    title: 'Job Detail View',
    shortcuts: [
      { keys: '↑↓ / jk', description: 'Scroll logs' },
      { keys: 'g', description: 'Go to top' },
      { keys: 'G', description: 'Go to bottom' },
      { keys: 'a', description: 'Toggle auto-scroll' },
      { keys: 'c', description: 'Cancel job' },
    ],
  },
  {
    title: 'Settings View',
    shortcuts: [
      { keys: '↑ / ↓', description: 'Navigate settings' },
      { keys: 'Enter', description: 'Edit setting' },
      { keys: '+', description: 'Add new path' },
      { keys: 'd', description: 'Remove selected' },
    ],
  },
];

// ============================================================================
// Components
// ============================================================================

interface ShortcutRowProps {
  keys: string;
  description: string;
}

function ShortcutRow({ keys, description }: ShortcutRowProps): React.ReactElement {
  return (
    <Box paddingX={2}>
      <Box width={16}>
        <Text color={theme.accent.primary}>{keys}</Text>
      </Box>
      <Text color={theme.text.secondary}>{description}</Text>
    </Box>
  );
}

interface ShortcutSectionProps {
  group: ShortcutGroup;
}

function ShortcutSection({ group }: ShortcutSectionProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box paddingX={1} marginBottom={0}>
        <Text color={theme.accent.secondary} bold>{icons.folder} {group.title}</Text>
      </Box>
      {group.shortcuts.map((shortcut, idx) => (
        <ShortcutRow 
          key={idx} 
          keys={shortcut.keys} 
          description={shortcut.description} 
        />
      ))}
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HelpView(): React.ReactElement {
  const { goBack } = useNavigator();

  useKeyboard(
    useCallback((e: KeyEvent) => {
      if (e.isEscape || e.key === '?') {
        goBack();
        return true;
      }
      return false;
    }, [goBack]),
    { priority: 5 }
  );

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={theme.accent.primary}>{icons.help}</Text>
        <Text bold color={theme.text.primary}> Keyboard Shortcuts</Text>
      </Box>

      <Divider />

      {/* Shortcuts grid - two columns */}
      <Box marginTop={1} flexGrow={1}>
        <Box flexDirection="column" width="50%">
          {SHORTCUT_GROUPS.slice(0, 3).map((group, idx) => (
            <ShortcutSection key={idx} group={group} />
          ))}
        </Box>
        <Box flexDirection="column" width="50%">
          {SHORTCUT_GROUPS.slice(3).map((group, idx) => (
            <ShortcutSection key={idx} group={group} />
          ))}
        </Box>
      </Box>

      <Divider />

      {/* Footer */}
      <Box marginTop={1}>
        <Text color={theme.text.muted}>
          Press <Text color={theme.accent.primary}>Esc</Text> or <Text color={theme.accent.primary}>?</Text> to close
        </Text>
      </Box>

      {/* Version info */}
      <Box marginTop={1}>
        <Text color={theme.text.muted}>GFOS-Build v2.0.0</Text>
        <Text color={theme.text.muted}> • </Text>
        <Text color={theme.text.muted}>Built with Bun + Ink</Text>
      </Box>
    </Box>
  );
}

export default HelpView;
