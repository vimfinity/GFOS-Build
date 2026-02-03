/**
 * Box Component
 * 
 * Styled container with professional border options.
 */

import React from 'react';
import { Box as InkBox, Text } from 'ink';
import { theme } from '../theme/index.js';

// ============================================================================
// Types
// ============================================================================

export type BorderStyle = 'none' | 'single' | 'double' | 'rounded' | 'heavy' | 'dashed';
export type BoxVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

/** Box drawing characters */
interface BoxChars {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
  cross: string;
  teeRight: string;
  teeLeft: string;
  teeDown: string;
  teeUp: string;
}

export interface StyledBoxProps {
  children: React.ReactNode;
  /** Border style */
  border?: BorderStyle;
  /** Box variant for color */
  variant?: BoxVariant;
  /** Custom title for the box */
  title?: string;
  /** Title alignment */
  titleAlign?: 'left' | 'center' | 'right';
  /** Padding inside the box */
  padding?: number;
  /** Horizontal padding */
  paddingX?: number;
  /** Vertical padding */
  paddingY?: number;
  /** Width (auto if not specified) */
  width?: number | string;
  /** Height */
  height?: number;
  /** Is this box focused? */
  focused?: boolean;
  /** Flex direction */
  flexDirection?: 'row' | 'column';
  /** Additional className for debugging */
  className?: string;
}

// ============================================================================
// Border Characters
// ============================================================================

const borderChars: Record<BorderStyle, BoxChars | null> = {
  none: null,
  single: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    cross: '┼',
    teeRight: '├',
    teeLeft: '┤',
    teeDown: '┬',
    teeUp: '┴',
  },
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    cross: '╬',
    teeRight: '╠',
    teeLeft: '╣',
    teeDown: '╦',
    teeUp: '╩',
  },
  rounded: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    cross: '┼',
    teeRight: '├',
    teeLeft: '┤',
    teeDown: '┬',
    teeUp: '┴',
  },
  heavy: {
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
    horizontal: '━',
    vertical: '┃',
    cross: '╋',
    teeRight: '┣',
    teeLeft: '┫',
    teeDown: '┳',
    teeUp: '┻',
  },
  dashed: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '┄',
    vertical: '┆',
    cross: '┼',
    teeRight: '├',
    teeLeft: '┤',
    teeDown: '┬',
    teeUp: '┴',
  },
};

const variantColors: Record<BoxVariant, string> = {
  default: theme.border.default,
  primary: theme.accent.primary,
  success: theme.status.success,
  warning: theme.status.warning,
  error: theme.status.error,
  info: theme.status.info,
};

// ============================================================================
// Component
// ============================================================================

export function StyledBox({
  children,
  border = 'none',
  variant = 'default',
  title,
  titleAlign = 'left',
  padding = 0,
  paddingX,
  paddingY,
  width,
  height,
  focused = false,
  flexDirection = 'column',
}: StyledBoxProps): React.ReactElement {
  const chars = borderChars[border];
  const color = focused ? theme.border.focus : variantColors[variant];
  
  const px = paddingX ?? padding;
  const py = paddingY ?? padding;

  // If no border, just return a basic box
  if (!chars) {
    return (
      <InkBox 
        flexDirection={flexDirection}
        paddingLeft={px}
        paddingRight={px}
        paddingTop={py}
        paddingBottom={py}
        width={width}
        height={height}
      >
        {children}
      </InkBox>
    );
  }

  // Calculate content width for borders
  const contentWidth = typeof width === 'number' ? width - 2 : undefined;

  // Build title line if provided
  const renderTitle = () => {
    if (!title || !contentWidth) return chars.horizontal.repeat(contentWidth || 10);
    
    const titleText = ` ${title} `;
    const remaining = (contentWidth || 10) - titleText.length;
    
    if (remaining < 2) return titleText;
    
    switch (titleAlign) {
      case 'center': {
        const left = Math.floor(remaining / 2);
        const right = remaining - left;
        return chars.horizontal.repeat(left) + titleText + chars.horizontal.repeat(right);
      }
      case 'right':
        return chars.horizontal.repeat(remaining - 1) + titleText + chars.horizontal;
      default:
        return chars.horizontal + titleText + chars.horizontal.repeat(remaining - 1);
    }
  };

  return (
    <InkBox flexDirection="column" width={width} height={height}>
      {/* Top border */}
      <InkBox>
        <Text color={color}>
          {chars.topLeft}
          {renderTitle()}
          {chars.topRight}
        </Text>
      </InkBox>

      {/* Content with side borders */}
      <InkBox flexDirection="row">
        <Text color={color}>{chars.vertical}</Text>
        <InkBox 
          flexDirection={flexDirection}
          flexGrow={1}
          paddingLeft={px}
          paddingRight={px}
          paddingTop={py}
          paddingBottom={py}
        >
          {children}
        </InkBox>
        <Text color={color}>{chars.vertical}</Text>
      </InkBox>

      {/* Bottom border */}
      <InkBox>
        <Text color={color}>
          {chars.bottomLeft}
          {chars.horizontal.repeat(contentWidth || 10)}
          {chars.bottomRight}
        </Text>
      </InkBox>
    </InkBox>
  );
}

export default StyledBox;
