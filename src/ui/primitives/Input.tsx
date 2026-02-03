/**
 * Input Components
 * 
 * Text input, search input, and related form controls.
 */

import React, { useCallback } from 'react';
import { Box, Text } from 'ink';
import { theme, icons } from '../theme/index.js';
import { useTextInput } from '../hooks/index.js';

// ============================================================================
// Types
// ============================================================================

export interface TextInputProps {
  /** Current value */
  value: string;
  /** Placeholder text */
  placeholder?: string;
  /** Called when value changes */
  onChange?: (value: string) => void;
  /** Called when Enter is pressed */
  onSubmit?: (value: string) => void;
  /** Is input focused */
  focused?: boolean;
  /** Maximum input length */
  maxLength?: number;
  /** Input width */
  width?: number;
  /** Show cursor */
  showCursor?: boolean;
  /** Prefix text/icon */
  prefix?: string;
  /** Label above input */
  label?: string;
}

export interface SearchInputProps {
  /** Current search query */
  value: string;
  /** Called when search changes */
  onChange?: (value: string) => void;
  /** Called when Enter is pressed */
  onSubmit?: (value: string) => void;
  /** Is input focused */
  focused?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Result count to display */
  resultCount?: number;
  /** Total count for filtering display */
  totalCount?: number;
  /** Width of the search box */
  width?: number;
}

// ============================================================================
// Text Input Component
// ============================================================================

export function TextInput({
  value,
  placeholder = '',
  onChange,
  onSubmit,
  focused = true,
  maxLength,
  width,
  showCursor = true,
  prefix,
  label,
}: TextInputProps): React.ReactElement {
  const { cursor, setValue, submit } = useTextInput({
    initialValue: value,
    onChange,
    onSubmit,
    isActive: focused,
    maxLength,
  });

  // Sync external value changes
  React.useEffect(() => {
    if (value !== undefined) {
      setValue(value);
    }
  }, [value, setValue]);

  // Display value with cursor
  const displayValue = value || '';
  const showPlaceholder = displayValue.length === 0;
  
  // Build the display with cursor
  let textDisplay: React.ReactElement;
  if (showPlaceholder) {
    textDisplay = (
      <Text color={theme.text.muted}>
        {focused && showCursor ? (
          <>
            <Text backgroundColor="white" color="black"> </Text>
            {placeholder.slice(1)}
          </>
        ) : (
          placeholder
        )}
      </Text>
    );
  } else if (focused && showCursor) {
    const beforeCursor = displayValue.slice(0, cursor);
    const cursorChar = displayValue[cursor] ?? ' ';
    const afterCursor = displayValue.slice(cursor + 1);
    
    textDisplay = (
      <Text>
        <Text color={theme.text.primary}>{beforeCursor}</Text>
        <Text backgroundColor="white" color="black">{cursorChar}</Text>
        <Text color={theme.text.primary}>{afterCursor}</Text>
      </Text>
    );
  } else {
    textDisplay = <Text color={theme.text.primary}>{displayValue}</Text>;
  }

  return (
    <Box flexDirection="column" width={width}>
      {label && (
        <Box marginBottom={0}>
          <Text color={theme.text.secondary}>{label}</Text>
        </Box>
      )}
      <Box flexDirection="row">
        {prefix && (
          <Text color={focused ? theme.accent.primary : theme.text.muted}>
            {prefix}{' '}
          </Text>
        )}
        <Box 
          borderStyle={focused ? 'single' : undefined}
          borderColor={focused ? theme.accent.primary : theme.border.default}
          paddingLeft={prefix ? 0 : 1}
          paddingRight={1}
          flexGrow={1}
        >
          {textDisplay}
        </Box>
      </Box>
    </Box>
  );
}

// ============================================================================
// Search Input Component
// ============================================================================

export function SearchInput({
  value,
  onChange,
  onSubmit,
  focused = true,
  placeholder = 'Search...',
  resultCount,
  totalCount,
  width,
}: SearchInputProps): React.ReactElement {
  const hasResults = resultCount !== undefined;
  const isFiltering = value.length > 0 && hasResults;

  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row" alignItems="center">
        {/* Search icon */}
        <Text color={focused ? theme.accent.primary : theme.text.muted}>
          {icons.search}{' '}
        </Text>

        {/* Input */}
        <Box flexGrow={1}>
          <TextInput
            value={value}
            placeholder={placeholder}
            onChange={onChange}
            onSubmit={onSubmit}
            focused={focused}
            showCursor={true}
            width={width ? width - 4 : undefined}
          />
        </Box>

        {/* Results count */}
        {isFiltering && (
          <Box marginLeft={1}>
            <Text color={theme.text.muted}>
              {resultCount}/{totalCount}
            </Text>
          </Box>
        )}
      </Box>

      {/* Hint */}
      {focused && (
        <Box marginTop={0} paddingLeft={3}>
          <Text color={theme.text.muted}>
            Type to filter{value.length > 0 ? ' • Ctrl+U to clear' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Select Input (Dropdown-like)
// ============================================================================

export interface SelectOption<T = string> {
  value: T;
  label: string;
}

export interface SelectInputProps<T = string> {
  options: SelectOption<T>[];
  value: T;
  onChange?: (value: T) => void;
  focused?: boolean;
  label?: string;
  width?: number;
}

export function SelectInput<T = string>({
  options,
  value,
  onChange,
  focused = false,
  label,
  width,
}: SelectInputProps<T>): React.ReactElement {
  const currentIndex = options.findIndex((o) => o.value === value);
  const currentOption = options[currentIndex];

  // This is a display-only component - navigation handled externally
  return (
    <Box flexDirection="column" width={width}>
      {label && (
        <Text color={theme.text.secondary}>{label}</Text>
      )}
      <Box flexDirection="row">
        <Text color={focused ? theme.accent.primary : theme.text.muted}>
          {icons.chevronRight}{' '}
        </Text>
        <Text color={focused ? theme.text.primary : theme.text.secondary}>
          {currentOption?.label ?? 'None'}
        </Text>
        <Text color={theme.text.muted}>
          {' '}({currentIndex + 1}/{options.length})
        </Text>
      </Box>
    </Box>
  );
}

// ============================================================================
// Checkbox Input
// ============================================================================

export interface CheckboxProps {
  checked: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
  focused?: boolean;
  disabled?: boolean;
}

export function Checkbox({
  checked,
  label,
  onChange,
  focused = false,
  disabled = false,
}: CheckboxProps): React.ReactElement {
  const checkIcon = checked ? icons.check : ' ';
  const box = `[${checkIcon}]`;

  return (
    <Box flexDirection="row">
      <Text 
        color={disabled 
          ? theme.text.muted 
          : focused 
            ? theme.accent.primary 
            : theme.text.secondary}
      >
        {box}{' '}
      </Text>
      <Text 
        color={disabled 
          ? theme.text.muted 
          : focused 
            ? theme.text.primary 
            : theme.text.secondary}
      >
        {label}
      </Text>
    </Box>
  );
}

export default {
  TextInput,
  SearchInput,
  SelectInput,
  Checkbox,
};
