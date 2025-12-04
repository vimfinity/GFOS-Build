/**
 * ScrollBox Component
 * 
 * A scrollable container that limits content height to terminal size.
 * Supports keyboard-based scrolling within the visible area.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTerminalSize } from './ScreenContainer.js';
import { colors, icons } from '../theme.js';

export interface ScrollBoxProps {
  /** The content to display (can be taller than visible area) */
  children: React.ReactNode;
  /** Maximum height of the scroll area (defaults to terminal height minus reserved space) */
  maxHeight?: number;
  /** Reserved lines for header/footer/statusbar (subtracted from terminal height) */
  reservedLines?: number;
  /** Whether scrolling is enabled (default: true) */
  scrollEnabled?: boolean;
  /** Whether this component should handle scroll input (default: true) */
  handleInput?: boolean;
  /** Current scroll position (controlled mode) */
  scrollOffset?: number;
  /** Callback when scroll position changes (controlled mode) */
  onScroll?: (offset: number) => void;
  /** Show scroll indicators */
  showIndicators?: boolean;
}

/**
 * ScrollBox - A height-constrained scrollable container.
 * 
 * Note: Ink doesn't have true scrolling, so this component:
 * 1. Constrains the visible height
 * 2. Shows scroll indicators when content overflows
 * 3. Can be controlled externally for scroll position
 */
export function ScrollBox({
  children,
  maxHeight,
  reservedLines = 6, // Default: header (3) + statusbar (2) + padding (1)
  scrollEnabled = true,
  handleInput = false,
  scrollOffset: controlledOffset,
  onScroll,
  showIndicators = true,
}: ScrollBoxProps): React.ReactElement {
  const { height: terminalHeight } = useTerminalSize();
  const [internalOffset, setInternalOffset] = useState(0);
  
  // Use controlled or internal offset
  const scrollOffset = controlledOffset ?? internalOffset;
  const setScrollOffset = onScroll ?? setInternalOffset;
  
  // Calculate max height
  const effectiveMaxHeight = maxHeight ?? Math.max(5, terminalHeight - reservedLines);
  
  // Handle scroll input
  useInput((input, key) => {
    if (!handleInput || !scrollEnabled) return;
    
    if (key.pageUp || (key.shift && key.upArrow)) {
      setScrollOffset(Math.max(0, scrollOffset - 5));
    } else if (key.pageDown || (key.shift && key.downArrow)) {
      setScrollOffset(scrollOffset + 5);
    }
  }, { isActive: handleInput });
  
  // Reset scroll when content changes significantly
  useEffect(() => {
    if (scrollOffset > 0) {
      // Could add logic to detect content changes and reset
    }
  }, [children, scrollOffset]);

  return (
    <Box 
      flexDirection="column" 
      height={effectiveMaxHeight}
      overflow="hidden"
    >
      {/* Scroll up indicator */}
      {showIndicators && scrollOffset > 0 && (
        <Box justifyContent="center">
          <Text color={colors.textDim}>↑ more above ↑</Text>
        </Box>
      )}
      
      {/* Content area */}
      <Box 
        flexDirection="column" 
        flexGrow={1}
        overflow="hidden"
      >
        {children}
      </Box>
      
      {/* Scroll down indicator - shown when content might overflow */}
      {showIndicators && (
        <Box justifyContent="center">
          <Text color={colors.textDim}>↓ scroll for more ↓</Text>
        </Box>
      )}
    </Box>
  );
}

export default ScrollBox;
