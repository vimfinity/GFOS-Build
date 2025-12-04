/**
 * Badge Component
 * 
 * Renders colored text with background/inverse styling for status indicators.
 * Examples: [JAVA 17], [SUCCESS], [RUNNING]
 */

import React from 'react';
import { Text } from 'ink';
import { colors } from '../theme.js';

/**
 * Predefined badge variants with matching colors.
 */
export type BadgeVariant = 
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'java8'
  | 'java11'
  | 'java17'
  | 'java21'
  | 'pending'
  | 'running'
  | 'maven';

/**
 * Color configuration for each badge variant.
 * Note: Use normal color names (without 'bg' prefix) for Ink's backgroundColor prop.
 */
const variantColors: Record<BadgeVariant, { bg: string; fg: string }> = {
  default: { bg: 'blackBright', fg: 'white' },
  primary: { bg: '#818CF8', fg: 'black' },
  secondary: { bg: 'magenta', fg: 'white' },
  success: { bg: 'green', fg: 'black' },
  warning: { bg: 'yellow', fg: 'black' },
  error: { bg: 'red', fg: 'white' },
  info: { bg: 'blue', fg: 'white' },
  java8: { bg: 'red', fg: 'white' },
  java11: { bg: 'yellow', fg: 'black' },
  java17: { bg: 'blue', fg: 'white' },
  java21: { bg: 'green', fg: 'black' },
  pending: { bg: 'blackBright', fg: 'white' },
  running: { bg: '#818CF8', fg: 'black' },
  maven: { bg: 'magenta', fg: 'white' },
};

export interface BadgeProps {
  /** Badge text content */
  children: React.ReactNode;
  /** Predefined color variant */
  variant?: BadgeVariant;
  /** Custom background color (overrides variant) */
  backgroundColor?: string;
  /** Custom text color (overrides variant) */
  color?: string;
  /** Whether to show brackets around the text */
  brackets?: boolean;
  /** Bold text */
  bold?: boolean;
  /** Dim/muted appearance */
  dim?: boolean;
  /** Uppercase text */
  uppercase?: boolean;
}

/**
 * Badge - Colored label component for status and tags.
 */
export function Badge({
  children,
  variant = 'default',
  backgroundColor,
  color,
  brackets = true,
  bold = true,
  dim = false,
  uppercase = false,
}: BadgeProps): React.ReactElement {
  const variantConfig = variantColors[variant];
  const bgColor = backgroundColor || variantConfig.bg;
  const fgColor = color || variantConfig.fg;
  
  let content = children;
  if (uppercase && typeof content === 'string') {
    content = content.toUpperCase();
  }

  // For bracketed badges, we style the brackets differently
  if (brackets) {
    return (
      <Text dimColor={dim}>
        <Text color={colors.textDim}>[</Text>
        <Text backgroundColor={bgColor} color={fgColor} bold={bold}>
          {content}
        </Text>
        <Text color={colors.textDim}>]</Text>
      </Text>
    );
  }

  // Non-bracketed inverse style
  return (
    <Text backgroundColor={bgColor} color={fgColor} bold={bold} dimColor={dim}>
      {' '}{content}{' '}
    </Text>
  );
}

/**
 * Helper function to get Java version badge variant.
 */
export function getJavaBadgeVariant(majorVersion: number): BadgeVariant {
  switch (majorVersion) {
    case 8:
      return 'java8';
    case 11:
      return 'java11';
    case 17:
      return 'java17';
    case 21:
      return 'java21';
    default:
      return majorVersion >= 17 ? 'java17' : 'java11';
  }
}

/**
 * Helper function to get build status badge variant.
 */
export function getStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'error';
    case 'running':
      return 'running';
    case 'pending':
      return 'pending';
    case 'cancelled':
      return 'warning';
    default:
      return 'default';
  }
}

/**
 * Pre-built Java version badge.
 */
export function JavaBadge({ version }: { version: number | string }): React.ReactElement {
  const majorVersion = typeof version === 'string' 
    ? parseInt(version.split('.')[0] || '0', 10) 
    : version;
  
  return (
    <Badge variant={getJavaBadgeVariant(majorVersion)}>
      JAVA {majorVersion}
    </Badge>
  );
}

/**
 * Pre-built status badge.
 */
export function StatusBadge({ status }: { status: string }): React.ReactElement {
  return (
    <Badge variant={getStatusBadgeVariant(status)} uppercase>
      {status}
    </Badge>
  );
}

/**
 * Pre-built Maven badge.
 */
export function MavenBadge(): React.ReactElement {
  return (
    <Badge variant="maven">
      MAVEN
    </Badge>
  );
}

export default Badge;
