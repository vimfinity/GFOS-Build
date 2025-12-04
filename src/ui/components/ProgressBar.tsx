/**
 * ProgressBar Component
 * 
 * Visual progress indicator with percentage display.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

export interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Width of the progress bar */
  width?: number;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Character for filled portion */
  filledChar?: string;
  /** Character for empty portion */
  emptyChar?: string;
  /** Color for filled portion */
  filledColor?: string;
  /** Color for empty portion */
  emptyColor?: string;
  /** Optional label before the bar */
  label?: string;
}

/**
 * ProgressBar - Visual progress indicator.
 */
export function ProgressBar({
  value,
  width = 30,
  showPercentage = true,
  filledChar = '█',
  emptyChar = '░',
  filledColor = colors.primary,
  emptyColor = colors.textDim,
  label,
}: ProgressBarProps): React.ReactElement {
  const clampedValue = Math.min(100, Math.max(0, value));
  const filledWidth = Math.round((clampedValue / 100) * width);
  const emptyWidth = width - filledWidth;

  // Determine color based on progress
  const getProgressColor = (): string => {
    if (clampedValue >= 100) return colors.success;
    if (clampedValue >= 75) return colors.primary;
    if (clampedValue >= 50) return colors.info;
    if (clampedValue >= 25) return colors.warning;
    return filledColor;
  };

  return (
    <Box>
      {label && (
        <Text color={colors.textDim}>{label} </Text>
      )}
      <Text color={getProgressColor()}>
        {filledChar.repeat(filledWidth)}
      </Text>
      <Text color={emptyColor}>
        {emptyChar.repeat(emptyWidth)}
      </Text>
      {showPercentage && (
        <Text color={colors.textDim}>
          {' '}{clampedValue.toFixed(0).padStart(3, ' ')}%
        </Text>
      )}
    </Box>
  );
}

/**
 * Compact progress indicator for lists.
 */
export function ProgressIndicator({ 
  value, 
  size = 10 
}: { 
  value: number; 
  size?: number;
}): React.ReactElement {
  const clampedValue = Math.min(100, Math.max(0, value));
  const filled = Math.round((clampedValue / 100) * size);
  
  return (
    <Text>
      <Text color={colors.success}>{'●'.repeat(filled)}</Text>
      <Text color={colors.textDim}>{'○'.repeat(size - filled)}</Text>
    </Text>
  );
}

export default ProgressBar;
