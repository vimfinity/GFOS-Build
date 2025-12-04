/**
 * SearchInput Component
 * 
 * A robust text input component for search functionality.
 * Handles rapid typing and backspace better than ink-text-input.
 */

import React, { useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { colors } from '../theme.js';

export interface SearchInputProps {
  /** Current input value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Callback when Enter is pressed */
  onSubmit?: () => void;
  /** Callback when Escape is pressed */
  onEscape?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is focused */
  focus?: boolean;
}

/**
 * SearchInput - A simple, robust text input for search.
 */
export function SearchInput({
  value,
  onChange,
  onSubmit,
  onEscape,
  placeholder = 'Type to search...',
  focus = true,
}: SearchInputProps): React.ReactElement {
  const { stdin, setRawMode } = useStdin();
  const valueRef = useRef(value);
  
  // Keep ref in sync with value
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Handle raw stdin for better input handling
  useEffect(() => {
    if (!focus || !stdin) return;

    const handleData = (data: Buffer) => {
      const input = data.toString();
      const currentValue = valueRef.current;
      
      // Handle special keys
      for (let i = 0; i < input.length; i++) {
        const char = input[i];
        const code = input.charCodeAt(i);
        
        // Escape (27)
        if (code === 27) {
          // Check for escape sequences (arrow keys, etc.)
          if (input[i + 1] === '[') {
            // Skip arrow key sequences
            i += 2;
            continue;
          }
          onEscape?.();
          return;
        }
        
        // Enter (13)
        if (code === 13) {
          onSubmit?.();
          return;
        }
        
        // Backspace (127) or Ctrl+H (8)
        if (code === 127 || code === 8) {
          if (currentValue.length > 0) {
            const newValue = currentValue.slice(0, -1);
            valueRef.current = newValue;
            onChange(newValue);
          }
          continue;
        }
        
        // Ctrl+U - clear line
        if (code === 21) {
          valueRef.current = '';
          onChange('');
          continue;
        }
        
        // Ctrl+W - delete word
        if (code === 23) {
          const trimmed = currentValue.trimEnd();
          const lastSpace = trimmed.lastIndexOf(' ');
          const newValue = lastSpace > 0 ? currentValue.slice(0, lastSpace + 1) : '';
          valueRef.current = newValue;
          onChange(newValue);
          continue;
        }
        
        // Ignore other control characters
        if (code < 32) {
          continue;
        }
        
        // Regular character - append
        if (char) {
          const newValue = currentValue + char;
          valueRef.current = newValue;
          onChange(newValue);
        }
      }
    };

    // Set raw mode for character-by-character input
    setRawMode?.(true);
    stdin.on('data', handleData);

    return () => {
      stdin.off('data', handleData);
    };
  }, [focus, stdin, setRawMode, onChange, onSubmit, onEscape]);

  // Render cursor
  const showCursor = focus;
  const cursorChar = '█';

  return (
    <Box>
      <Text color={colors.text}>
        {value}
        {showCursor && (
          <Text color={colors.primary}>{cursorChar}</Text>
        )}
        {!value && !showCursor && (
          <Text color={colors.textDim}>{placeholder}</Text>
        )}
      </Text>
    </Box>
  );
}

export default SearchInput;
