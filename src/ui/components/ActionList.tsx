/**
 * ActionList Component
 * 
 * Professional-looking wrapper around ink-select-input
 * with custom indicators, padding, and styling.
 */

import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { colors, icons } from '../theme.js';

/**
 * Select input item type (matching ink-select-input).
 */
interface SelectItem<V> {
  key?: string;
  label: string;
  value: V;
}

/**
 * Action item with optional metadata.
 */
export interface ActionItem<V = string> {
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

export interface ActionListProps<V = string> {
  /** List of action items */
  items: ActionItem<V>[];
  /** Callback when item is selected (Enter pressed) */
  onSelect?: (item: ActionItem<V>) => void;
  /** Callback when highlighted item changes */
  onHighlight?: (item: ActionItem<V>) => void;
  /** Initially selected item index */
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
 * Custom indicator component for the select input.
 */
interface IndicatorProps {
  isSelected?: boolean;
}

function createIndicator(indicator: string) {
  return function IndicatorComponent({ isSelected }: IndicatorProps): React.ReactElement {
    return (
      <Box marginRight={1}>
        <Text color={isSelected ? colors.primary : undefined}>
          {isSelected ? indicator : ' '}
        </Text>
      </Box>
    );
  };
}

/**
 * Create custom item component for enhanced styling.
 */
function createItemComponent<V>(items: ActionItem<V>[], showIndex: boolean) {
  return function ItemComponentWrapper({ 
    isSelected, 
    label,
  }: { 
    isSelected?: boolean; 
    label: string;
  }): React.ReactElement {
    const item = items.find((i) => i.label === label);
    const itemIndex = items.findIndex((i) => i.label === label);
    const isDisabled = item?.disabled;
    
    return (
      <Box flexDirection="column">
        <Box>
          {/* Index number */}
          {showIndex && (
            <Text color={colors.textDim} dimColor>
              {String(itemIndex + 1).padStart(2, ' ')}
              {'. '}
            </Text>
          )}
          
          {/* Icon */}
          {item?.icon && (
            <Text>{item.icon} </Text>
          )}
          
          {/* Label */}
          <Text
            color={isDisabled ? colors.textDim : isSelected ? colors.primaryBright : colors.text}
            bold={isSelected && !isDisabled}
            dimColor={isDisabled}
            strikethrough={isDisabled}
          >
            {label}
          </Text>
          
          {/* Badge */}
          {item?.badge && (
            <Text color={item.badgeColor || colors.accent}>
              {' '}[{item.badge}]
            </Text>
          )}
        </Box>
        
        {/* Description */}
        {item?.description && isSelected && (
          <Box marginLeft={showIndex ? 4 : 2}>
            <Text color={colors.textDim} italic>
              {item.description}
            </Text>
          </Box>
        )}
      </Box>
    );
  };
}

/**
 * ActionList - A professional select list with custom styling.
 */
export function ActionList<V = string>({
  items,
  onSelect,
  onHighlight,
  initialIndex = 0,
  indicator = icons.pointer,
  showIndex = false,
  limit,
  isFocused = true,
}: ActionListProps<V>): React.ReactElement {
  // Convert ActionItem to SelectInput Item format
  const selectItems: SelectItem<V>[] = items.map((item) => ({
    key: String(item.value),
    label: item.label,
    value: item.value,
  }));

  const handleSelect = (item: SelectItem<V>) => {
    const actionItem = items.find((i) => i.value === item.value);
    if (actionItem && !actionItem.disabled && onSelect) {
      onSelect(actionItem);
    }
  };

  const handleHighlight = (item: SelectItem<V>) => {
    const actionItem = items.find((i) => i.value === item.value);
    if (actionItem && onHighlight) {
      onHighlight(actionItem);
    }
  };

  if (items.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={colors.textDim} italic>
          No items available
        </Text>
      </Box>
    );
  }

  // Create the indicator and item components
  const IndicatorComponent = createIndicator(indicator);
  const ItemComponent = createItemComponent(items, showIndex);

  return (
    <Box flexDirection="column">
      <SelectInput
        items={selectItems}
        onSelect={handleSelect}
        onHighlight={handleHighlight}
        initialIndex={initialIndex}
        limit={limit}
        isFocused={isFocused}
        indicatorComponent={IndicatorComponent}
        itemComponent={ItemComponent}
      />
    </Box>
  );
}

export default ActionList;
