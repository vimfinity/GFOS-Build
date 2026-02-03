/**
 * Progress and Status Components
 * 
 * Progress bars, spinners, and status indicators.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { theme, icons, animation, spinners } from '../theme/index.js';
import { useSpinner, useInterval } from '../hooks/index.js';

// ============================================================================
// Types
// ============================================================================

export type StatusType = 'idle' | 'pending' | 'running' | 'success' | 'warning' | 'error';

export type SpinnerType = 
  | 'dots' 
  | 'line' 
  | 'arc' 
  | 'bounce' 
  | 'sparkle' 
  | 'pulse' 
  | 'breathe' 
  | 'stars'
  | 'braille'
  | 'circle'
  | 'blocks'
  | 'grow';

export interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Width of the progress bar */
  width?: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Label position */
  labelPosition?: 'left' | 'right' | 'inside';
  /** Progress bar variant */
  variant?: 'default' | 'success' | 'warning' | 'error';
  /** Use gradient colors based on progress */
  gradient?: boolean;
  /** Indeterminate mode (animated) */
  indeterminate?: boolean;
}

export interface SpinnerProps {
  /** Spinner type / animation style */
  type?: SpinnerType;
  /** Optional label */
  label?: string;
  /** Color */
  color?: string;
  /** Custom animation speed in ms */
  speed?: number;
}

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showIcon?: boolean;
  compact?: boolean;
}

// ============================================================================
// Progress Bar
// ============================================================================

const progressVariantColors: Record<NonNullable<ProgressBarProps['variant']>, string> = {
  default: theme.accent.primary,
  success: theme.status.success,
  warning: theme.status.warning,
  error: theme.status.error,
};

export function ProgressBar({
  value,
  width = 20,
  showLabel = true,
  labelPosition = 'right',
  variant = 'default',
  gradient = false,
  indeterminate = false,
}: ProgressBarProps): React.ReactElement {
  const [indeterminatePos, setIndeterminatePos] = React.useState(0);
  
  // Animate indeterminate progress
  useInterval(() => {
    setIndeterminatePos((p) => (p + 1) % (width - 2));
  }, indeterminate ? animation.spinnerInterval : null);

  const clampedValue = Math.min(100, Math.max(0, value));
  const filledWidth = Math.round((clampedValue / 100) * (width - 2));
  const emptyWidth = width - 2 - filledWidth;

  // Determine color
  let barColor = progressVariantColors[variant];
  if (gradient && !indeterminate) {
    if (clampedValue >= 100) barColor = theme.status.success;
    else if (clampedValue >= 75) barColor = theme.status.info;
    else if (clampedValue >= 50) barColor = theme.status.warning;
    else barColor = theme.accent.primary;
  }

  // Build bar string
  let barContent: React.ReactNode;
  if (indeterminate) {
    const before = icons.progressEmpty.repeat(indeterminatePos);
    const marker = icons.progressFilled.repeat(3);
    const after = icons.progressEmpty.repeat(Math.max(0, width - 2 - indeterminatePos - 3));
    barContent = (
      <>
        <Text color={theme.text.muted}>{before}</Text>
        <Text color={barColor}>{marker}</Text>
        <Text color={theme.text.muted}>{after}</Text>
      </>
    );
  } else {
    barContent = (
      <>
        <Text color={barColor}>{icons.progressFilled.repeat(filledWidth)}</Text>
        <Text color={theme.text.muted}>{icons.progressEmpty.repeat(emptyWidth)}</Text>
      </>
    );
  }

  const percentLabel = `${Math.round(clampedValue)}%`;

  return (
    <Box flexDirection="row" alignItems="center">
      {showLabel && labelPosition === 'left' && (
        <Box width={5}>
          <Text color={theme.text.secondary}>{percentLabel}</Text>
        </Box>
      )}
      
      <Text color={theme.text.muted}>[</Text>
      {barContent}
      <Text color={theme.text.muted}>]</Text>
      
      {showLabel && labelPosition === 'right' && (
        <Box marginLeft={1}>
          <Text color={theme.text.secondary}>{percentLabel}</Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Spinner
// ============================================================================

/**
 * Map spinner types to their frame arrays
 */
const getSpinnerFrames = (type: SpinnerType): readonly string[] => {
  switch (type) {
    case 'dots': return spinners.dots;
    case 'line': return spinners.line;
    case 'arc': return spinners.arc;
    case 'bounce': return spinners.bounce;
    case 'sparkle': return spinners.sparkle;
    case 'pulse': return spinners.pulse;
    case 'breathe': return spinners.breathe;
    case 'stars': return spinners.stars;
    case 'braille': return spinners.braille;
    case 'circle': return spinners.circle;
    case 'blocks': return spinners.blocks;
    case 'grow': return spinners.grow;
    default: return spinners.dots;
  }
};

/**
 * Get appropriate animation speed for spinner type
 */
const getSpinnerSpeed = (type: SpinnerType): number => {
  switch (type) {
    case 'sparkle':
    case 'stars':
      return animation.sparkleInterval;
    case 'pulse':
    case 'breathe':
    case 'grow':
      return animation.pulseInterval;
    default:
      return animation.spinnerInterval;
  }
};

export function Spinner({
  type = 'dots',
  label,
  color = theme.accent.primary,
  speed,
}: SpinnerProps): React.ReactElement {
  const frames = [...getSpinnerFrames(type)];
  const intervalMs = speed ?? getSpinnerSpeed(type);
  const frame = useSpinner(frames, intervalMs);

  return (
    <Box flexDirection="row">
      <Text color={color}>{frame}</Text>
      {label && (
        <Box marginLeft={1}>
          <Text color={theme.text.secondary}>{label}</Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Status Badge
// ============================================================================

const statusConfig: Record<StatusType, { icon: string; color: string; label: string }> = {
  idle: { icon: icons.bullet, color: theme.text.muted, label: 'Idle' },
  pending: { icon: icons.pending, color: theme.status.pending, label: 'Pending' },
  running: { icon: icons.running, color: theme.status.running, label: 'Running' },
  success: { icon: icons.success, color: theme.status.success, label: 'Success' },
  warning: { icon: icons.warning, color: theme.status.warning, label: 'Warning' },
  error: { icon: icons.error, color: theme.status.error, label: 'Error' },
};

export function StatusBadge({
  status,
  label,
  showIcon = true,
  compact = false,
}: StatusBadgeProps): React.ReactElement {
  const config = statusConfig[status];
  const displayLabel = label ?? config.label;

  // For running status, use spinner
  const spinnerFramesCopy = [...icons.spinner];
  const icon = status === 'running' 
    ? useSpinner(spinnerFramesCopy) 
    : config.icon;

  if (compact) {
    return (
      <Text color={config.color}>
        {showIcon ? icon : displayLabel}
      </Text>
    );
  }

  return (
    <Box flexDirection="row">
      {showIcon && (
        <Text color={config.color}>{icon} </Text>
      )}
      <Text color={config.color}>{displayLabel}</Text>
    </Box>
  );
}

// ============================================================================
// Status Line (inline status with optional progress)
// ============================================================================

export interface StatusLineProps {
  status: StatusType;
  message: string;
  progress?: number;
  timestamp?: Date;
}

export function StatusLine({
  status,
  message,
  progress,
  timestamp,
}: StatusLineProps): React.ReactElement {
  const config = statusConfig[status];
  const spinnerFramesLine = [...icons.spinner];
  const icon = status === 'running' 
    ? useSpinner(spinnerFramesLine) 
    : config.icon;

  return (
    <Box flexDirection="row" alignItems="center">
      <Text color={config.color}>{icon} </Text>
      <Text color={theme.text.primary}>{message}</Text>
      
      {progress !== undefined && status === 'running' && (
        <Box marginLeft={1}>
          <Text color={theme.text.muted}>({Math.round(progress)}%)</Text>
        </Box>
      )}
      
      {timestamp && (
        <Box marginLeft={1}>
          <Text color={theme.text.muted}>
            {timestamp.toLocaleTimeString('de-DE', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Badge (generic label badge)
// ============================================================================

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  inverse?: boolean;
}

const badgeColors: Record<BadgeVariant, string> = {
  default: theme.text.muted,
  primary: theme.accent.primary,
  success: theme.status.success,
  warning: theme.status.warning,
  error: theme.status.error,
  info: theme.status.info,
};

export function Badge({
  children,
  variant = 'default',
  inverse = false,
}: BadgeProps): React.ReactElement {
  return (
    <Text 
      color={inverse ? 'black' : badgeColors[variant]}
      backgroundColor={inverse ? badgeColors[variant] : undefined}
    >
      {' '}{children}{' '}
    </Text>
  );
}

export default {
  ProgressBar,
  Spinner,
  StatusBadge,
  StatusLine,
  Badge,
};
