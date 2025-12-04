/**
 * ScrollableSection Component
 * 
 * A section with a sticky header and scrollable content.
 * Shows scroll indicators when content overflows.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, icons } from '../theme.js';

export interface ScrollableSectionProps {
  /** Section title */
  title: string;
  /** Whether this section is active/focused */
  isActive?: boolean;
  /** Hint text shown next to title */
  hint?: string;
  /** Maximum visible items */
  maxVisible?: number;
  /** Total item count (for scroll indicators) */
  totalItems: number;
  /** Current focused index within this section */
  focusIndex: number;
  /** Children to render */
  children: React.ReactNode;
}

/**
 * ScrollableSection - Section with sticky header and scrollable content.
 */
export function ScrollableSection({
  title,
  isActive = false,
  hint,
  maxVisible = 5,
  totalItems,
  focusIndex,
  children,
}: ScrollableSectionProps): React.ReactElement {
  // Calculate scroll offset based on focus
  const scrollOffset = Math.max(0, Math.min(focusIndex - Math.floor(maxVisible / 2), totalItems - maxVisible));
  const showTopIndicator = scrollOffset > 0;
  const showBottomIndicator = scrollOffset + maxVisible < totalItems;

  return (
    <Box flexDirection="column" width="100%">
      {/* Sticky Header */}
      <Box marginBottom={0}>
        <Text bold color={isActive ? colors.primary : colors.textDim}>
          {isActive ? icons.pointer : ' '} {title}
        </Text>
        {hint && <Text color={colors.textDim}> {hint}</Text>}
        {totalItems > maxVisible && (
          <Text color={colors.textDim}> ({focusIndex + 1}/{totalItems})</Text>
        )}
      </Box>
      
      {/* Top scroll indicator */}
      {showTopIndicator && (
        <Box paddingLeft={3}>
          <Text color={colors.textDim}>↑ {scrollOffset} more above</Text>
        </Box>
      )}
      
      {/* Content - children should handle their own slicing based on scrollOffset */}
      <Box flexDirection="column" paddingLeft={2} width="100%">
        {children}
      </Box>
      
      {/* Bottom scroll indicator */}
      {showBottomIndicator && (
        <Box paddingLeft={3}>
          <Text color={colors.textDim}>↓ {totalItems - scrollOffset - maxVisible} more below</Text>
        </Box>
      )}
    </Box>
  );
}

export default ScrollableSection;
