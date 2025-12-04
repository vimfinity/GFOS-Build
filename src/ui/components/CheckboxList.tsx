/**
 * CheckboxList Component
 * 
 * A selectable list with checkboxes for multi-selection.
 * Supports keyboard navigation and toggle.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, icons } from '../theme.js';

/**
 * Checkbox item with metadata.
 */
export interface CheckboxItem<V = string> {
  /** Unique value/key for the item */
  value: V;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Optional badge text */
  badge?: string;
  /** Badge color */
  badgeColor?: string;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Whether item is pre-selected */
  defaultSelected?: boolean;
}

export interface CheckboxListProps<V = string> {
  /** List of items */
  items: CheckboxItem<V>[];
  /** Currently selected values */
  selectedValues: V[];
  /** Callback when selection changes */
  onSelectionChange: (values: V[]) => void;
  /** Whether the list is focused */
  isFocused?: boolean;
  /** Maximum visible items (scroll if more) */
  limit?: number;
  /** Show "Select All" option */
  showSelectAll?: boolean;
}

/**
 * CheckboxList - Multi-select list with checkboxes.
 */
export function CheckboxList<V = string>({
  items,
  selectedValues,
  onSelectionChange,
  isFocused = true,
  limit,
  showSelectAll = true,
}: CheckboxListProps<V>): React.ReactElement {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Ensure highlighted index is valid
  useEffect(() => {
    const maxIndex = showSelectAll ? items.length : items.length - 1;
    if (highlightedIndex > maxIndex) {
      setHighlightedIndex(Math.max(0, maxIndex));
    }
  }, [items.length, highlightedIndex, showSelectAll]);

  // Handle keyboard input
  useInput((input, key) => {
    if (!isFocused) return;

    // Navigate up
    if (key.upArrow) {
      setHighlightedIndex(prev => {
        const newIndex = Math.max(0, prev - 1);
        // Adjust scroll offset if needed
        if (limit && newIndex < scrollOffset) {
          setScrollOffset(newIndex);
        }
        return newIndex;
      });
      return;
    }

    // Navigate down
    if (key.downArrow) {
      const maxIndex = showSelectAll ? items.length : items.length - 1;
      setHighlightedIndex(prev => {
        const newIndex = Math.min(maxIndex, prev + 1);
        // Adjust scroll offset if needed
        if (limit && newIndex >= scrollOffset + limit) {
          setScrollOffset(newIndex - limit + 1);
        }
        return newIndex;
      });
      return;
    }

    // Toggle selection with Space or Enter
    if (input === ' ' || key.return) {
      // Select All option
      if (showSelectAll && highlightedIndex === 0) {
        const enabledItems = items.filter(i => !i.disabled);
        const allSelected = enabledItems.every(i => selectedValues.includes(i.value));
        
        if (allSelected) {
          // Deselect all
          onSelectionChange([]);
        } else {
          // Select all enabled items
          onSelectionChange(enabledItems.map(i => i.value));
        }
        return;
      }

      // Regular item toggle
      const itemIndex = showSelectAll ? highlightedIndex - 1 : highlightedIndex;
      const item = items[itemIndex];
      if (item && !item.disabled) {
        const isSelected = selectedValues.includes(item.value);
        if (isSelected) {
          onSelectionChange(selectedValues.filter(v => v !== item.value));
        } else {
          onSelectionChange([...selectedValues, item.value]);
        }
      }
      return;
    }

    // Select all with Ctrl+A
    if (key.ctrl && (input === 'a' || input === 'A')) {
      const enabledItems = items.filter(i => !i.disabled);
      onSelectionChange(enabledItems.map(i => i.value));
      return;
    }

    // Deselect all with Ctrl+N
    if (key.ctrl && (input === 'n' || input === 'N')) {
      onSelectionChange([]);
      return;
    }
  }, { isActive: isFocused });

  // Calculate visible items
  const visibleStartIndex = limit ? scrollOffset : 0;
  const visibleEndIndex = limit ? Math.min(items.length, scrollOffset + limit) : items.length;
  
  // Check if all enabled items are selected
  const enabledItems = items.filter(i => !i.disabled);
  const allSelected = enabledItems.length > 0 && enabledItems.every(i => selectedValues.includes(i.value));
  const someSelected = enabledItems.some(i => selectedValues.includes(i.value));

  const renderCheckbox = (isSelected: boolean, isPartial = false): string => {
    if (isSelected) return icons.checkboxOn;
    if (isPartial) return icons.checkboxPartial;
    return icons.checkboxOff;
  };

  return (
    <Box flexDirection="column">
      {/* Select All option */}
      {showSelectAll && (
        <Box>
          <Text color={highlightedIndex === 0 ? colors.primary : colors.textDim}>
            {highlightedIndex === 0 ? icons.pointer : ' '}
          </Text>
          <Text color={allSelected ? colors.success : someSelected ? colors.warning : colors.textDim}>
            {' '}{renderCheckbox(allSelected, someSelected && !allSelected)}
          </Text>
          <Text color={highlightedIndex === 0 ? colors.primaryBright : colors.text} bold={highlightedIndex === 0}>
            {' '}Select All ({selectedValues.length}/{enabledItems.length})
          </Text>
        </Box>
      )}
      
      {/* Scroll indicator (top) */}
      {limit && scrollOffset > 0 && (
        <Text color={colors.textDim}>  ↑ {scrollOffset} more above</Text>
      )}

      {/* Items */}
      {items.slice(visibleStartIndex, visibleEndIndex).map((item, displayIndex) => {
        const actualIndex = visibleStartIndex + displayIndex;
        const listIndex = showSelectAll ? actualIndex + 1 : actualIndex;
        const isHighlighted = listIndex === highlightedIndex;
        const isSelected = selectedValues.includes(item.value);
        const isDisabled = item.disabled;

        return (
          <Box key={String(item.value)} width="100%">
            <Text color={isHighlighted ? colors.primary : colors.textDim}>
              {isHighlighted ? icons.pointer : ' '}
            </Text>
            <Text color={isDisabled ? colors.textDim : isSelected ? colors.success : colors.text}>
              {' '}{renderCheckbox(isSelected)}
            </Text>
            <Text
              color={isDisabled ? colors.textDim : isHighlighted ? colors.primaryBright : colors.text}
              bold={isHighlighted && !isDisabled}
              dimColor={isDisabled}
              strikethrough={isDisabled}
              wrap="truncate"
            >
              {' '}{item.label}{item.badge ? ` [${item.badge}]` : ''}
            </Text>
          </Box>
        );
      })}

      {/* Scroll indicator (bottom) */}
      {limit && visibleEndIndex < items.length && (
        <Text color={colors.textDim}>  ↓ {items.length - visibleEndIndex} more below</Text>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <Box paddingY={1}>
          <Text color={colors.textDim} italic>
            No items available
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default CheckboxList;
