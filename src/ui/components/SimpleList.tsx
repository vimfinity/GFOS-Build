/**
 * SimpleList Component
 * 
 * A simple list component with keyboard navigation that does NOT
 * have letter-based navigation (unlike ink-select-input).
 * This allows parent components to use letters for search.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, icons } from '../theme.js';

/**
 * List item with optional metadata.
 */
export interface SimpleListItem<V = string> {
  /** Unique value/key for the item */
  value: V;
  /** Display label */
  label: string;
  /** Optional description shown below label */
  description?: string;
  /** Optional icon/emoji to show before label */
  icon?: string;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Optional badge to show after label */
  badge?: string;
  /** Badge color */
  badgeColor?: string;
}

export interface SimpleListProps<V = string> {
  /** List of items */
  items: SimpleListItem<V>[];
  /** Callback when item is selected (Enter pressed) */
  onSelect?: (item: SimpleListItem<V>) => void;
  /** Callback when highlighted item changes */
  onHighlight?: (item: SimpleListItem<V>, index: number) => void;
  /** Initially highlighted item index */
  initialIndex?: number;
  /** Custom pointer indicator */
  indicator?: string;
  /** Show item index numbers */
  showIndex?: boolean;
  /** Limit visible items (enables scrolling) */
  limit?: number;
  /** Whether the list is focused/interactive */
  isFocused?: boolean;
}

/**
 * SimpleList - A keyboard-navigable list without letter navigation.
 */
export function SimpleList<V = string>({
  items,
  onSelect,
  onHighlight,
  initialIndex = 0,
  indicator = icons.pointer,
  showIndex = false,
  limit = 10,
  isFocused = true,
}: SimpleListProps<V>): React.ReactElement {
  const [highlightedIndex, setHighlightedIndex] = useState(initialIndex);
  const [scrollOffset, setScrollOffset] = useState(0);
  
  // Clamp highlighted index when items change
  useEffect(() => {
    if (highlightedIndex >= items.length) {
      setHighlightedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, highlightedIndex]);
  
  // Reset highlighted index when items change significantly
  useEffect(() => {
    setHighlightedIndex(0);
    setScrollOffset(0);
  }, [items.length]);
  
  // Keyboard navigation
  useInput((input, key) => {
    if (!isFocused || items.length === 0) return;
    
    // Navigate up
    if (key.upArrow) {
      setHighlightedIndex(prev => {
        const newIndex = Math.max(0, prev - 1);
        // Adjust scroll if needed
        if (newIndex < scrollOffset) {
          setScrollOffset(newIndex);
        }
        // Notify parent
        const item = items[newIndex];
        if (item && onHighlight) {
          onHighlight(item, newIndex);
        }
        return newIndex;
      });
      return;
    }
    
    // Navigate down
    if (key.downArrow) {
      setHighlightedIndex(prev => {
        const newIndex = Math.min(items.length - 1, prev + 1);
        // Adjust scroll if needed
        if (newIndex >= scrollOffset + limit) {
          setScrollOffset(newIndex - limit + 1);
        }
        // Notify parent
        const item = items[newIndex];
        if (item && onHighlight) {
          onHighlight(item, newIndex);
        }
        return newIndex;
      });
      return;
    }
    
    // Select with Enter
    if (key.return) {
      const item = items[highlightedIndex];
      if (item && !item.disabled && onSelect) {
        onSelect(item);
      }
      return;
    }
    
    // Page up (move by limit)
    if (key.pageUp) {
      setHighlightedIndex(prev => {
        const newIndex = Math.max(0, prev - limit);
        setScrollOffset(Math.max(0, newIndex - Math.floor(limit / 2)));
        return newIndex;
      });
      return;
    }
    
    // Page down (move by limit)
    if (key.pageDown) {
      setHighlightedIndex(prev => {
        const newIndex = Math.min(items.length - 1, prev + limit);
        setScrollOffset(Math.max(0, newIndex - Math.floor(limit / 2)));
        return newIndex;
      });
      return;
    }
  }, { isActive: isFocused });
  
  if (items.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={colors.textDim} italic>
          No items available
        </Text>
      </Box>
    );
  }
  
  // Calculate visible items
  const visibleItems = items.slice(scrollOffset, scrollOffset + limit);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + limit < items.length;
  
  return (
    <Box flexDirection="column">
      {/* Scroll indicator - top */}
      {hasMoreAbove && (
        <Box marginBottom={0}>
          <Text color={colors.textDim}>  ↑ {scrollOffset} more above</Text>
        </Box>
      )}
      
      {/* Items */}
      {visibleItems.map((item, visibleIndex) => {
        const actualIndex = scrollOffset + visibleIndex;
        const isHighlighted = actualIndex === highlightedIndex;
        const isDisabled = item.disabled;
        
        return (
          <Box key={String(item.value)} flexDirection="column">
            <Box>
              {/* Pointer indicator */}
              <Box width={2}>
                <Text color={isHighlighted ? colors.primary : undefined}>
                  {isHighlighted ? indicator : ' '}
                </Text>
              </Box>
              
              {/* Index number */}
              {showIndex && (
                <Text color={colors.textDim} dimColor>
                  {String(actualIndex + 1).padStart(2, ' ')}
                  {'. '}
                </Text>
              )}
              
              {/* Icon */}
              {item.icon && (
                <Text>{item.icon} </Text>
              )}
              
              {/* Label */}
              <Text
                color={isDisabled ? colors.textDim : isHighlighted ? colors.primaryBright : colors.text}
                bold={isHighlighted && !isDisabled}
                dimColor={isDisabled}
                strikethrough={isDisabled}
              >
                {item.label}
              </Text>
              
              {/* Badge */}
              {item.badge && (
                <Text color={item.badgeColor || colors.accent}>
                  {' '}[{item.badge}]
                </Text>
              )}
            </Box>
            
            {/* Description - only shown for highlighted item */}
            {item.description && isHighlighted && (
              <Box marginLeft={showIndex ? 6 : 4}>
                <Text color={colors.textDim} italic>
                  {item.description}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
      
      {/* Scroll indicator - bottom */}
      {hasMoreBelow && (
        <Box marginTop={0}>
          <Text color={colors.textDim}>  ↓ {items.length - scrollOffset - limit} more below</Text>
        </Box>
      )}
    </Box>
  );
}

export default SimpleList;
