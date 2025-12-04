/**
 * KeyValue Component
 * 
 * Displays a label-value pair with consistent styling.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

export interface KeyValueProps {
  /** Label/key text */
  label: string;
  /** Value to display */
  value: React.ReactNode;
  /** Width for the label column */
  labelWidth?: number;
  /** Separator between label and value */
  separator?: string;
  /** Color for the label */
  labelColor?: string;
  /** Color for the value */
  valueColor?: string;
  /** Whether to dim the label */
  dimLabel?: boolean;
}

/**
 * KeyValue - Label-value pair display component.
 */
export function KeyValue({
  label,
  value,
  labelWidth = 16,
  separator = ':',
  labelColor = colors.textDim,
  valueColor = colors.text,
  dimLabel = true,
}: KeyValueProps): React.ReactElement {
  return (
    <Box>
      <Box width={labelWidth}>
        <Text color={labelColor} dimColor={dimLabel}>
          {label}
        </Text>
      </Box>
      <Text color={colors.textDim}>{separator} </Text>
      {typeof value === 'string' ? (
        <Text color={valueColor}>{value}</Text>
      ) : (
        value
      )}
    </Box>
  );
}

/**
 * KeyValueList - Multiple key-value pairs in a vertical list.
 */
export interface KeyValueListProps {
  /** Array of key-value items */
  items: Array<{ label: string; value: React.ReactNode }>;
  /** Width for the label column */
  labelWidth?: number;
}

export function KeyValueList({ items, labelWidth = 16 }: KeyValueListProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {items.map((item, index) => (
        <KeyValue key={index} label={item.label} value={item.value} labelWidth={labelWidth} />
      ))}
    </Box>
  );
}

export default KeyValue;
