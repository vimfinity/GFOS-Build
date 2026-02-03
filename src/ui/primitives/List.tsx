/**
 * List Component
 * 
 * Professional list component with virtual scrolling,
 * keyboard navigation, and multiple selection modes.
 */

import React, { useMemo, useCallback } from 'react';
import { Box, Text } from 'ink';
import { theme, icons } from '../theme/index.js';
import { useListNavigation, useVirtualScroll } from '../hooks/index.js';

// ============================================================================
// Types
// ============================================================================

export interface ListItem<T = string> {
  id: T;
  label: string;
  description?: string;
  icon?: string;
  badge?: string;
  badgeVariant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  disabled?: boolean;
  data?: unknown;
}

export interface ListProps<T = string> {
  items: ListItem<T>[];
  /** Currently selected item ID(s) */
  selectedId?: T | T[];
  /** Max visible items before scrolling */
  maxVisible?: number;
  /** Whether the list is focused */
  focused?: boolean;
  /** Callback when item is selected */
  onSelect?: (item: ListItem<T>) => void;
  /** Callback when focus changes */
  onFocusChange?: (index: number, item: ListItem<T>) => void;
  /** Enable multi-select mode */
  multiSelect?: boolean;
  /** Show index numbers */
  showNumbers?: boolean;
  /** Initial focus index */
  initialIndex?: number;
  /** External focus index (disables internal navigation when set) */
  focusedIndex?: number;
  /** Empty state message */
  emptyMessage?: string;
  /** Enable vim-style navigation */
  vimNavigation?: boolean;
  /** Width of the list */
  width?: number;
}

// ============================================================================
// Badge Variants
// ============================================================================

const badgeColors: Record<NonNullable<ListItem['badgeVariant']>, string> = {
  default: theme.text.muted,
  primary: theme.accent.primary,
  success: theme.status.success,
  warning: theme.status.warning,
  error: theme.status.error,
  info: theme.status.info,
};

// ============================================================================
// List Item Component
// ============================================================================

interface ListItemRowProps<T> {
  item: ListItem<T>;
  index: number;
  isFocused: boolean;
  isSelected: boolean;
  showNumber: boolean;
  width?: number;
}

function ListItemRow<T>({ 
  item, 
  index, 
  isFocused, 
  isSelected,
  showNumber,
  width,
}: ListItemRowProps<T>): React.ReactElement {
  const pointer = isFocused ? icons.pointer : ' ';
  const check = isSelected ? icons.check : ' ';
  
  // Colors based on state
  const labelColor = item.disabled 
    ? theme.text.muted 
    : isFocused 
      ? theme.interactive.focus 
      : theme.text.primary;
  
  const descColor = theme.text.muted;
  const badgeColor = item.badgeVariant ? badgeColors[item.badgeVariant] : theme.text.muted;

  return (
    <Box flexDirection="row" width={width}>
      {/* Pointer indicator */}
      <Box width={2}>
        <Text color={isFocused ? theme.accent.primary : undefined}>
          {pointer}
        </Text>
      </Box>

      {/* Number (optional) */}
      {showNumber && (
        <Box width={3}>
          <Text color={theme.text.muted}>
            {(index + 1).toString().padStart(2)}{' '}
          </Text>
        </Box>
      )}

      {/* Check mark for selection */}
      {isSelected && (
        <Box width={2}>
          <Text color={theme.accent.primary}>{check}</Text>
        </Box>
      )}

      {/* Icon (optional) */}
      {item.icon && (
        <Box width={3}>
          <Text>{item.icon} </Text>
        </Box>
      )}

      {/* Label */}
      <Box flexGrow={1} flexShrink={1}>
        <Text 
          color={labelColor} 
          bold={isFocused}
          wrap="truncate"
        >
          {item.label}
        </Text>
      </Box>

      {/* Badge (optional) */}
      {item.badge && (
        <Box marginLeft={1}>
          <Text color={badgeColor}>[{item.badge}]</Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Description Row
// ============================================================================

function DescriptionRow({ 
  description, 
  showNumber 
}: { 
  description: string;
  showNumber: boolean;
}): React.ReactElement {
  return (
    <Box paddingLeft={showNumber ? 7 : 4}>
      <Text color={theme.text.muted} wrap="truncate">
        {description}
      </Text>
    </Box>
  );
}

// ============================================================================
// Main List Component
// ============================================================================

export function List<T = string>({
  items,
  selectedId,
  maxVisible = 10,
  focused = true,
  onSelect,
  onFocusChange,
  multiSelect = false,
  showNumbers = false,
  initialIndex = 0,
  focusedIndex: externalFocusIndex,
  emptyMessage = 'No items',
  vimNavigation = true,
  width,
}: ListProps<T>): React.ReactElement {
  // Use external focus index if provided, otherwise use internal navigation
  const useExternalFocus = externalFocusIndex !== undefined;
  
  // Navigation state (only active when not using external focus)
  const { index: internalFocusIndex, setIndex } = useListNavigation({
    itemCount: items.length,
    initialIndex,
    wrap: true,
    onSelect: (idx) => {
      const item = items[idx];
      if (item && !item.disabled) {
        onSelect?.(item);
      }
    },
    onChange: (idx) => {
      const item = items[idx];
      if (item) {
        onFocusChange?.(idx, item);
      }
    },
    isActive: !useExternalFocus && focused && items.length > 0,
  });
  
  // Use external or internal focus index
  const focusIndex = useExternalFocus ? externalFocusIndex : internalFocusIndex;

  // Virtual scrolling
  const { startIndex, endIndex, canScrollUp, canScrollDown } = useVirtualScroll({
    totalItems: items.length,
    visibleHeight: maxVisible,
    focusIndex,
    overscan: 1,
  });

  // Selected IDs as set for fast lookup
  const selectedIds = useMemo(() => {
    if (!selectedId) return new Set<T>();
    return new Set(Array.isArray(selectedId) ? selectedId : [selectedId]);
  }, [selectedId]);

  // Visible items slice
  const visibleItems = useMemo(() => 
    items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

  // Empty state
  if (items.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={theme.text.muted}>{emptyMessage}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width}>
      {/* Scroll up indicator */}
      {canScrollUp && (
        <Box paddingLeft={2}>
          <Text color={theme.text.muted}>
            {icons.arrowUp} {startIndex} more above
          </Text>
        </Box>
      )}

      {/* List items */}
      {visibleItems.map((item, idx) => {
        const actualIndex = startIndex + idx;
        const isFocused = actualIndex === focusIndex;
        const isSelected = selectedIds.has(item.id);

        return (
          <Box key={String(item.id)} flexDirection="column">
            <ListItemRow
              item={item}
              index={actualIndex}
              isFocused={isFocused}
              isSelected={isSelected}
              showNumber={showNumbers}
              width={width}
            />
            {/* Show description only for focused item */}
            {isFocused && item.description && (
              <Box paddingLeft={showNumbers ? 7 : 5}>
                <Text 
                  color={theme.text.muted}
                  wrap="truncate"
                >
                  {item.description}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Scroll down indicator */}
      {canScrollDown && (
        <Box paddingLeft={2}>
          <Text color={theme.text.muted}>
            {icons.arrowDown} {items.length - endIndex} more below
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Compact List (single line items)
// ============================================================================

export interface CompactListProps<T = string> {
  items: Array<{ id: T; label: string; badge?: string }>;
  focusIndex: number;
  maxVisible?: number;
  width?: number;
}

export function CompactList<T = string>({
  items,
  focusIndex,
  maxVisible = 5,
  width,
}: CompactListProps<T>): React.ReactElement {
  const { startIndex, endIndex, canScrollUp, canScrollDown } = useVirtualScroll({
    totalItems: items.length,
    visibleHeight: maxVisible,
    focusIndex,
  });

  const visible = items.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column" width={width}>
      {canScrollUp && (
        <Text color={theme.text.muted}>{icons.arrowUp}</Text>
      )}
      {visible.map((item, idx) => {
        const actualIndex = startIndex + idx;
        const isFocused = actualIndex === focusIndex;
        
        return (
          <Box key={String(item.id)}>
            <Text color={isFocused ? theme.accent.primary : undefined}>
              {isFocused ? icons.pointer : ' '} {item.label}
            </Text>
            {item.badge && (
              <Text color={theme.text.muted}> [{item.badge}]</Text>
            )}
          </Box>
        );
      })}
      {canScrollDown && (
        <Text color={theme.text.muted}>{icons.arrowDown}</Text>
      )}
    </Box>
  );
}

export default List;
