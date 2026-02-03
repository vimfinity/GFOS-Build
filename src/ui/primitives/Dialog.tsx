/**
 * Dialog and Modal Components
 * 
 * Overlay dialogs, modals, and confirmation prompts.
 */

import React, { useCallback } from 'react';
import { Box, Text } from 'ink';
import { theme, icons } from '../theme/index.js';
import { useTerminalSize, useKeyboard, useModal, type KeyEvent } from '../hooks/index.js';

// ============================================================================
// Types
// ============================================================================

export interface DialogProps {
  children: React.ReactNode;
  /** Dialog title */
  title?: string;
  /** Dialog width (percentage or fixed) */
  width?: number | string;
  /** Dialog height */
  height?: number | string;
  /** Is dialog open */
  open?: boolean;
  /** Called when dialog should close */
  onClose?: () => void;
  /** Footer actions */
  footer?: React.ReactNode;
  /** Show close button */
  showClose?: boolean;
  /** Dialog variant */
  variant?: 'default' | 'danger' | 'success';
}

export interface ConfirmDialogProps {
  /** Dialog title */
  title: string;
  /** Confirmation message */
  message: string;
  /** Confirm button label */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Is dialog open */
  open?: boolean;
  /** Called when confirmed */
  onConfirm?: () => void;
  /** Called when cancelled */
  onCancel?: () => void;
  /** Danger mode (red confirm button) */
  danger?: boolean;
}

export interface ToastProps {
  /** Toast message */
  message: string;
  /** Toast type */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Duration in ms (0 = permanent) */
  duration?: number;
  /** Called when toast should dismiss */
  onDismiss?: () => void;
}

// ============================================================================
// Dialog Component
// ============================================================================

const variantColors: Record<NonNullable<DialogProps['variant']>, string> = {
  default: theme.border.default,
  danger: theme.status.error,
  success: theme.status.success,
};

export function Dialog({
  children,
  title,
  width = 60,
  height,
  open = true,
  onClose,
  footer,
  showClose = true,
  variant = 'default',
}: DialogProps): React.ReactElement | null {
  const { width: termWidth, height: termHeight } = useTerminalSize();
  
  // Handle escape to close
  useKeyboard(
    useCallback((event: KeyEvent) => {
      if (event.isEscape && open) {
        onClose?.();
        return true;
      }
      return false;
    }, [open, onClose]),
    { active: open, priority: 100 }
  );

  if (!open) return null;

  // Calculate dialog dimensions
  const dialogWidth = typeof width === 'number' 
    ? Math.min(width, termWidth - 4)
    : Math.floor(termWidth * (parseInt(width) / 100));
  
  const dialogHeight = height 
    ? typeof height === 'number' 
      ? Math.min(height as number, termHeight - 4)
      : Math.floor(termHeight * (parseInt(height as string) / 100))
    : undefined;

  // Calculate position for centering
  const left = Math.floor((termWidth - dialogWidth) / 2);
  const top = Math.floor((termHeight - (dialogHeight || 10)) / 3);

  const borderColor = variantColors[variant];

  return (
    <Box
      position="absolute"
      width={termWidth}
      height={termHeight}
      flexDirection="column"
      alignItems="center"
      paddingTop={top}
    >
      {/* Backdrop simulation - just show the dialog box */}
      <Box
        flexDirection="column"
        width={dialogWidth}
        height={dialogHeight}
        borderStyle="single"
        borderColor={borderColor}
      >
        {/* Header */}
        {(title || showClose) && (
          <Box 
            justifyContent="space-between" 
            paddingX={1}
            borderStyle="single"
            borderTop={false}
            borderLeft={false}
            borderRight={false}
            borderColor={theme.border.muted}
          >
            <Text bold color={borderColor}>
              {title || ''}
            </Text>
            {showClose && (
              <Text color={theme.text.muted}>[esc] close</Text>
            )}
          </Box>
        )}

        {/* Content */}
        <Box 
          flexDirection="column" 
          flexGrow={1} 
          padding={1}
          overflow="hidden"
        >
          {children}
        </Box>

        {/* Footer */}
        {footer && (
          <Box 
            paddingX={1}
            borderStyle="single"
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            borderColor={theme.border.muted}
          >
            {footer}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ============================================================================
// Confirm Dialog
// ============================================================================

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  open = true,
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps): React.ReactElement | null {
  const [selected, setSelected] = React.useState<'confirm' | 'cancel'>('cancel');

  // Handle keyboard
  useKeyboard(
    useCallback((event: KeyEvent) => {
      if (!open) return false;
      
      if (event.isLeft || event.isRight || event.isTab) {
        setSelected((s) => s === 'confirm' ? 'cancel' : 'confirm');
        return true;
      }
      if (event.isEnter) {
        if (selected === 'confirm') {
          onConfirm?.();
        } else {
          onCancel?.();
        }
        return true;
      }
      if (event.isEscape) {
        onCancel?.();
        return true;
      }
      if (event.key === 'y' || event.key === 'Y') {
        onConfirm?.();
        return true;
      }
      if (event.key === 'n' || event.key === 'N') {
        onCancel?.();
        return true;
      }
      return false;
    }, [open, selected, onConfirm, onCancel]),
    { active: open, priority: 110 }
  );

  const footer = (
    <Box justifyContent="flex-end" gap={2}>
      <Box>
        <Text 
          color={selected === 'cancel' ? theme.accent.primary : theme.text.muted}
          inverse={selected === 'cancel'}
        >
          {' '}{cancelLabel}{' '}
        </Text>
      </Box>
      <Box>
        <Text 
          color={selected === 'confirm' 
            ? (danger ? theme.status.error : theme.accent.primary) 
            : theme.text.muted}
          inverse={selected === 'confirm'}
        >
          {' '}{confirmLabel}{' '}
        </Text>
      </Box>
    </Box>
  );

  return (
    <Dialog
      open={open}
      title={title}
      width={50}
      onClose={onCancel}
      footer={footer}
      variant={danger ? 'danger' : 'default'}
    >
      <Text>{message}</Text>
      <Box marginTop={1}>
        <Text color={theme.text.muted}>
          Press Y to confirm, N to cancel
        </Text>
      </Box>
    </Dialog>
  );
}

// ============================================================================
// Toast Component
// ============================================================================

const toastConfig: Record<NonNullable<ToastProps['type']>, { icon: string; color: string }> = {
  info: { icon: icons.info, color: theme.status.info },
  success: { icon: icons.success, color: theme.status.success },
  warning: { icon: icons.warning, color: theme.status.warning },
  error: { icon: icons.error, color: theme.status.error },
};

export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
}: ToastProps): React.ReactElement {
  const { width } = useTerminalSize();
  const config = toastConfig[type];

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  return (
    <Box
      position="absolute"
      width={width}
      justifyContent="center"
      marginTop={1}
    >
      <Box
        borderStyle="single"
        borderColor={config.color}
        paddingX={2}
        paddingY={0}
      >
        <Text color={config.color}>{config.icon}</Text>
        <Text color={theme.text.primary}> {message}</Text>
      </Box>
    </Box>
  );
}

// ============================================================================
// Command Palette
// ============================================================================

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
}

export interface CommandPaletteProps {
  commands: CommandItem[];
  open?: boolean;
  onClose?: () => void;
  placeholder?: string;
}

export function CommandPalette({
  commands,
  open = false,
  onClose,
  placeholder = 'Type a command...',
}: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Filter commands
  const filteredCommands = React.useMemo(() => {
    if (!query) return commands;
    const lower = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.description?.toLowerCase().includes(lower)
    );
  }, [commands, query]);

  // Reset selection when filter changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  // Handle keyboard
  useKeyboard(
    useCallback((event: KeyEvent) => {
      if (!open) return false;

      if (event.isEscape) {
        setQuery('');
        onClose?.();
        return true;
      }
      if (event.isUp) {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return true;
      }
      if (event.isDown) {
        setSelectedIndex((i) => Math.min(filteredCommands.length - 1, i + 1));
        return true;
      }
      if (event.isEnter) {
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          cmd.action();
          setQuery('');
          onClose?.();
        }
        return true;
      }
      if (event.isBackspace) {
        setQuery((q) => q.slice(0, -1));
        return true;
      }
      if (event.key.length === 1 && event.key.charCodeAt(0) >= 32 && !event.ctrl) {
        setQuery((q) => q + event.key);
        return true;
      }
      return false;
    }, [open, filteredCommands, selectedIndex, onClose]),
    { active: open, priority: 200 }
  );

  if (!open) return null;

  return (
    <Dialog
      open={open}
      title="Command Palette"
      width={60}
      height={20}
      onClose={onClose}
      showClose={false}
    >
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color={theme.accent.primary}>{icons.search} </Text>
        <Text color={query ? theme.text.primary : theme.text.muted}>
          {query || placeholder}
        </Text>
        <Text backgroundColor="white" color="black"> </Text>
      </Box>

      {/* Command list */}
      <Box flexDirection="column">
        {filteredCommands.slice(0, 10).map((cmd, index) => (
          <Box 
            key={cmd.id}
            flexDirection="row"
            justifyContent="space-between"
          >
            <Box>
              <Text 
                color={index === selectedIndex ? theme.accent.primary : theme.text.muted}
              >
                {index === selectedIndex ? icons.pointer : ' '}{' '}
              </Text>
              <Text 
                color={index === selectedIndex ? theme.text.primary : theme.text.secondary}
              >
                {cmd.label}
              </Text>
              {cmd.description && (
                <Text color={theme.text.muted}> - {cmd.description}</Text>
              )}
            </Box>
            {cmd.shortcut && (
              <Text color={theme.text.muted}>{cmd.shortcut}</Text>
            )}
          </Box>
        ))}
        {filteredCommands.length === 0 && (
          <Text color={theme.text.muted}>No commands found</Text>
        )}
      </Box>
    </Dialog>
  );
}

export default {
  Dialog,
  ConfirmDialog,
  Toast,
  CommandPalette,
};
