/**
 * FullscreenContainer Component
 * 
 * Wraps the entire app to ensure it never exceeds terminal dimensions.
 * This prevents content from being rendered outside the visible area
 * and eliminates the ability to scroll to old content.
 */

import React, { useEffect } from 'react';
import { Box, useStdout } from 'ink';
import { useTerminalSize } from './ScreenContainer.js';

export interface FullscreenContainerProps {
  children: React.ReactNode;
}

/**
 * FullscreenContainer - Constrains app to terminal size.
 * 
 * Features:
 * - Fixed height matching terminal rows
 * - Fixed width matching terminal columns
 * - Overflow hidden to prevent content spillover
 * - Clears screen on mount to prevent old content visibility
 */
export function FullscreenContainer({ 
  children 
}: FullscreenContainerProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { stdout } = useStdout();
  
  // Clear screen on mount and when terminal resizes
  useEffect(() => {
    if (stdout) {
      // Move cursor to top-left and clear screen
      stdout.write('\x1B[H\x1B[2J');
    }
  }, [stdout, width, height]);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      overflow="hidden"
    >
      {children}
    </Box>
  );
}

export default FullscreenContainer;
