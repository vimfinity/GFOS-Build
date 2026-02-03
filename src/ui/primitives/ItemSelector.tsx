/**
 * ItemSelector Component
 * 
 * Unified selection component for repositories and modules.
 * Supports search, virtual scrolling, and proper terminal height handling.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { matchSorter } from 'match-sorter';

import { theme, icons, palette } from '../theme/index.js';

// ============================================================================
// Types
// ============================================================================

export interface SelectableItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  badge?: string;
  badgeColor?: string;
}

export interface ItemSelectorProps<T extends SelectableItem> {
  /** Items to display */
  items: T[];
  /** Called when an item is selected (Enter) */
  onSelect?: (item: T) => void;
  /** Multi-select mode with checkboxes */
  multiSelect?: boolean;
  /** Currently checked item IDs (for multiSelect) */
  checkedIds?: Set<string>;
  /** Called when item check state changes (for multiSelect) */
  onToggle?: (item: T) => void;
  /** Title to display above the list */
  title?: string;
  /** Placeholder for search input */
  searchPlaceholder?: string;
  /** Search keys for matchSorter */
  searchKeys?: string[];
  /** Whether selector is focused/active */
  focused?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state for search with no results */
  noResultsMessage?: string;
  /** Footer hint text (left side) */
  footerHint?: string;
  /** Max height in terminal rows (auto-calculated if not set) */
  maxHeight?: number;
  /** Header content above list */
  header?: React.ReactNode;
  /** Show select all/none buttons in multi-select */
  showSelectAllNone?: boolean;
  /** Called when select all is triggered */
  onSelectAll?: () => void;
  /** Called when select none is triggered */
  onSelectNone?: () => void;
}

// ============================================================================
// ItemRow Component
// ============================================================================

interface ItemRowProps<T extends SelectableItem> {
  item: T;
  isSelected: boolean;
  isChecked?: boolean;
  multiSelect: boolean;
}

function ItemRow<T extends SelectableItem>({ 
  item, 
  isSelected, 
  isChecked,
  multiSelect,
}: ItemRowProps<T>): React.ReactElement {
  return (
    <Box paddingX={1}>
      <Text color={isSelected ? theme.accent.primary : theme.text.muted}>
        {isSelected ? icons.pointer : ' '}{' '}
      </Text>
      {multiSelect && (
        <Text color={isChecked ? palette.green : theme.text.muted}>
          {isChecked ? icons.selected : icons.unselected}{' '}
        </Text>
      )}
      {item.icon && (
        <Text>{item.icon} </Text>
      )}
      <Text color={theme.text.primary} bold={isSelected}>
        {item.label}
      </Text>
      {item.badge && (
        <Text color={item.badgeColor || theme.text.muted}> [{item.badge}]</Text>
      )}
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ItemSelector<T extends SelectableItem>({
  items,
  onSelect,
  multiSelect = false,
  checkedIds,
  onToggle,
  title,
  searchPlaceholder = 'Type to search...',
  searchKeys = ['label'],
  focused = true,
  emptyMessage = 'No items',
  noResultsMessage = 'No matches found',
  footerHint,
  maxHeight,
  header,
  showSelectAllNone = false,
  onSelectAll,
  onSelectNone,
}: ItemSelectorProps<T>): React.ReactElement {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Terminal dimensions
  const { stdout } = useStdout();
  const terminalRows = stdout?.rows ?? 24;
  
  // Calculate available height for list
  // Reserve: header(2) + search(2) + scroll indicators(2) + footer(2) + padding(2)
  const reservedRows = 10;
  const listHeight = maxHeight ?? Math.max(5, terminalRows - reservedRows);
  
  // Refs for input handling
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  
  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    return matchSorter(items, searchQuery, {
      keys: searchKeys,
      threshold: matchSorter.rankings.CONTAINS,
    });
  }, [items, searchQuery, searchKeys]);
  
  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);
  
  // Virtual scrolling - calculate visible window
  const scrollOffset = useMemo(() => {
    const halfVisible = Math.floor(listHeight / 2);
    let offset = Math.max(0, selectedIndex - halfVisible);
    const maxOffset = Math.max(0, filteredItems.length - listHeight);
    return Math.min(offset, maxOffset);
  }, [selectedIndex, listHeight, filteredItems.length]);
  
  const visibleItems = useMemo(() => 
    filteredItems.slice(scrollOffset, scrollOffset + listHeight),
    [filteredItems, scrollOffset, listHeight]
  );
  
  // Scroll indicators
  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + listHeight < filteredItems.length;
  
  // Handle keyboard input
  useInput(useCallback((input: string, key: {
    escape?: boolean;
    return?: boolean;
    backspace?: boolean;
    delete?: boolean;
    upArrow?: boolean;
    downArrow?: boolean;
    ctrl?: boolean;
    meta?: boolean;
  }) => {
    if (!focused) return;
    
    const currentQuery = searchQueryRef.current;
    const currentIndex = selectedIndexRef.current;
    const maxIndex = filteredItems.length - 1;
    
    // Escape: clear search or do nothing (let parent handle)
    if (key.escape) {
      if (currentQuery) {
        setSearchQuery('');
      }
      return;
    }
    
    // Ctrl+U: clear search
    if (key.ctrl && input === 'u') {
      setSearchQuery('');
      return;
    }
    
    // Backspace: remove last character
    if (key.backspace || key.delete) {
      if (currentQuery.length > 0) {
        setSearchQuery(currentQuery.slice(0, -1));
      }
      return;
    }
    
    // Enter: select current item
    if (key.return) {
      const item = filteredItems[currentIndex];
      if (item) {
        if (multiSelect && onToggle) {
          onToggle(item);
        } else if (onSelect) {
          onSelect(item);
        }
      }
      return;
    }
    
    // Navigation: up/down arrows or j/k
    if (key.upArrow || input === 'k') {
      setSelectedIndex(Math.max(0, currentIndex - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex(Math.min(maxIndex, currentIndex + 1));
      return;
    }
    
    // Page navigation: Ctrl+u/d
    if (key.ctrl && input === 'd') {
      setSelectedIndex(Math.min(maxIndex, currentIndex + 10));
      return;
    }
    if (key.ctrl && (input === 'u' || input === 'U')) {
      if (!currentQuery) {
        setSelectedIndex(Math.max(0, currentIndex - 10));
      }
      return;
    }
    
    // Space in multi-select mode: toggle
    if (input === ' ' && multiSelect && onToggle) {
      const item = filteredItems[currentIndex];
      if (item) onToggle(item);
      return;
    }
    
    // Select all/none shortcuts (a/n)
    if (input === 'a' && !key.ctrl && multiSelect && onSelectAll) {
      onSelectAll();
      return;
    }
    if (input === 'n' && !key.ctrl && multiSelect && onSelectNone) {
      onSelectNone();
      return;
    }
    
    // Printable characters: add to search
    if (input && input.length === 1 && input.charCodeAt(0) >= 32 && !key.ctrl && !key.meta) {
      setSearchQuery(currentQuery + input);
      return;
    }
  }, [focused, filteredItems, multiSelect, onToggle, onSelect, onSelectAll, onSelectNone]));
  
  // Empty state
  if (items.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.text.muted}>{emptyMessage}</Text>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Title */}
      {title && (
        <Box marginBottom={1}>
          <Text color={theme.text.primary}>{title}</Text>
        </Box>
      )}
      
      {/* Custom header */}
      {header}
      
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color={theme.accent.primary}>{icons.search} </Text>
        {searchQuery ? (
          <Text color={theme.text.primary}>{searchQuery}</Text>
        ) : (
          <Text color={theme.text.muted}>{searchPlaceholder}</Text>
        )}
        {focused && <Text color={theme.text.muted}>_</Text>}
        {searchQuery && (
          <Text color={theme.text.muted}> ({filteredItems.length}/{items.length})</Text>
        )}
      </Box>
      
      {/* Scroll up indicator */}
      {showScrollUp && (
        <Box paddingX={1}>
          <Text color={theme.text.muted}>{icons.arrowUp} {scrollOffset} more above</Text>
        </Box>
      )}
      
      {/* Item list */}
      <Box flexDirection="column" flexGrow={1}>
        {filteredItems.length === 0 ? (
          <Box paddingX={1}>
            <Text color={palette.yellow}>{icons.warning} {noResultsMessage}</Text>
          </Box>
        ) : (
          visibleItems.map((item, idx) => {
            const actualIndex = scrollOffset + idx;
            const isSelected = actualIndex === selectedIndex;
            const isChecked = checkedIds?.has(item.id);
            
            return (
              <ItemRow
                key={item.id}
                item={item}
                isSelected={isSelected}
                isChecked={isChecked}
                multiSelect={multiSelect}
              />
            );
          })
        )}
      </Box>
      
      {/* Scroll down indicator */}
      {showScrollDown && (
        <Box paddingX={1}>
          <Text color={theme.text.muted}>
            {icons.arrowDown} {filteredItems.length - scrollOffset - listHeight} more below
          </Text>
        </Box>
      )}
      
      {/* Footer hints */}
      <Box marginTop={1}>
        <Text color={theme.text.muted}>
          <Text color={theme.accent.primary}>↑↓</Text> Nav{' '}
          <Text color={theme.accent.primary}> ⏎</Text> Select
          {multiSelect && (
            <>
              <Text color={theme.accent.primary}> Space</Text> Toggle
              {showSelectAllNone && (
                <>
                  <Text color={theme.accent.primary}> a</Text>/<Text color={theme.accent.primary}>n</Text> All/None
                </>
              )}
            </>
          )}
          {footerHint && <Text> {footerHint}</Text>}
        </Text>
      </Box>
    </Box>
  );
}

export default ItemSelector;
