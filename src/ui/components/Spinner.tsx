/**
 * Spinner Component
 * 
 * Loading indicator with customizable text.
 */

import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { colors } from '../theme.js';

export interface SpinnerProps {
  /** Loading message to display */
  message?: string;
  /** Spinner type/style */
  type?: 'dots' | 'line' | 'arc' | 'circle' | 'arrow';
  /** Spinner color */
  color?: string;
  /** Hide the message */
  hideMessage?: boolean;
}

/**
 * Spinner - Animated loading indicator.
 */
export function Spinner({
  message = 'Loading...',
  type = 'dots',
  color = colors.primary,
  hideMessage = false,
}: SpinnerProps): React.ReactElement {
  return (
    <Box>
      <Text color={color}>
        <InkSpinner type={type} />
      </Text>
      {!hideMessage && <Text color={colors.textDim}> {message}</Text>}
    </Box>
  );
}

export default Spinner;
