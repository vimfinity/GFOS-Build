/**
 * Text Primitives
 * 
 * Typography components with consistent styling.
 */

import React from 'react';
import { Text as InkText } from 'ink';
import { theme, typography } from '../theme/index.js';

// ============================================================================
// Types
// ============================================================================

export type TextVariant = 
  | 'default' 
  | 'muted' 
  | 'dim' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info'
  | 'accent'
  | 'link';

export interface TextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  inverse?: boolean;
  wrap?: 'wrap' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';
  color?: string;
}

export interface HeadingProps {
  children: React.ReactNode;
  level?: 1 | 2 | 3;
}

export interface CodeProps {
  children: React.ReactNode;
  inline?: boolean;
}

export interface LabelProps {
  children: React.ReactNode;
  active?: boolean;
}

// ============================================================================
// Variant Colors
// ============================================================================

const variantColors: Record<TextVariant, string> = {
  default: theme.text.primary,
  muted: theme.text.secondary,
  dim: theme.text.muted,
  success: theme.status.success,
  warning: theme.status.warning,
  error: theme.status.error,
  info: theme.status.info,
  accent: theme.text.accent,
  link: theme.text.link,
};

// ============================================================================
// Components
// ============================================================================

/**
 * Styled text component
 */
export function StyledText({
  children,
  variant = 'default',
  bold = false,
  italic = false,
  underline = false,
  strikethrough = false,
  inverse = false,
  wrap,
  color,
}: TextProps): React.ReactElement {
  return (
    <InkText
      color={color ?? variantColors[variant]}
      bold={bold}
      italic={italic}
      underline={underline}
      strikethrough={strikethrough}
      inverse={inverse}
      wrap={wrap}
    >
      {children}
    </InkText>
  );
}

/**
 * Heading component with levels
 */
export function Heading({ children, level = 1 }: HeadingProps): React.ReactElement {
  const styles = {
    1: typography.h1,
    2: typography.h2,
    3: typography.h3,
  }[level];

  return (
    <InkText bold={styles.bold} color={styles.color}>
      {children}
    </InkText>
  );
}

/**
 * Code/monospace text
 */
export function Code({ children, inline = true }: CodeProps): React.ReactElement {
  if (inline) {
    return (
      <InkText color={typography.code.color}>
        {children}
      </InkText>
    );
  }
  
  return (
    <InkText color={typography.code.color}>
      {children}
    </InkText>
  );
}

/**
 * Label component
 */
export function Label({ children, active = false }: LabelProps): React.ReactElement {
  const styles = active ? typography.labelActive : typography.label;
  
  return (
    <InkText color={styles.color}>
      {children}
    </InkText>
  );
}

/**
 * Key hint display (e.g., "⏎ Enter")
 */
export function KeyHint({ 
  keyName, 
  label,
  separator = ' ',
}: { 
  keyName: string; 
  label?: string;
  separator?: string;
}): React.ReactElement {
  return (
    <InkText>
      <InkText color={theme.accent.primary} bold>
        {keyName}
      </InkText>
      {label && (
        <>
          <InkText color={theme.text.muted}>{separator}</InkText>
          <InkText color={theme.text.secondary}>{label}</InkText>
        </>
      )}
    </InkText>
  );
}

/**
 * Truncate text with ellipsis
 */
export function Truncate({ 
  children, 
  maxWidth,
  position = 'end',
}: { 
  children: string; 
  maxWidth: number;
  position?: 'start' | 'middle' | 'end';
}): React.ReactElement {
  const text = String(children);
  
  if (text.length <= maxWidth) {
    return <InkText>{text}</InkText>;
  }

  const ellipsis = '…';
  const availableWidth = maxWidth - 1;

  let truncated: string;
  switch (position) {
    case 'start':
      truncated = ellipsis + text.slice(-availableWidth);
      break;
    case 'middle': {
      const half = Math.floor(availableWidth / 2);
      truncated = text.slice(0, half) + ellipsis + text.slice(-(availableWidth - half));
      break;
    }
    default:
      truncated = text.slice(0, availableWidth) + ellipsis;
  }

  return <InkText>{truncated}</InkText>;
}

export default {
  StyledText,
  Heading,
  Code,
  Label,
  KeyHint,
  Truncate,
};
