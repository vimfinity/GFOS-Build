/**
 * Input Management System
 * 
 * Professional keyboard and focus management for the CLI.
 * Implements a layered input system with priority-based handling,
 * similar to modern CLI tools like OpenCode.
 */

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useInput, useApp } from 'ink';
import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

/**
 * Key event with normalized properties
 */
export interface KeyEvent {
  key: string;
  raw: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  // Convenience checks
  isEnter: boolean;
  isEscape: boolean;
  isTab: boolean;
  isBackspace: boolean;
  isDelete: boolean;
  isSpace: boolean;
  isUp: boolean;
  isDown: boolean;
  isLeft: boolean;
  isRight: boolean;
  // Modifiers + key combos
  isCtrlC: boolean;
  isCtrlQ: boolean;
  // Prevent default behavior
  preventDefault: () => void;
  stopPropagation: () => void;
}

/**
 * Input handler function type
 */
export type InputHandler = (event: KeyEvent) => void | boolean;

/**
 * Input layer configuration
 */
export interface InputLayer {
  id: string;
  priority: number;
  handler: InputHandler;
  active: boolean;
}

/**
 * Focus context for tracking focused elements
 */
export interface FocusContext {
  id: string;
  type: 'list' | 'input' | 'button' | 'panel' | 'dialog';
  index?: number;
  total?: number;
}

// ============================================================================
// Input Store
// ============================================================================

interface InputState {
  // Input layers
  layers: Map<string, InputLayer>;
  
  // Focus management
  focusStack: FocusContext[];
  activeFocusId: string | null;
  
  // Global state
  isInputBlocked: boolean;
  lastKeyTime: number;
  
  // Actions
  registerLayer: (layer: Omit<InputLayer, 'active'>) => void;
  unregisterLayer: (id: string) => void;
  setLayerActive: (id: string, active: boolean) => void;
  
  pushFocus: (context: FocusContext) => void;
  popFocus: () => FocusContext | undefined;
  setFocus: (id: string) => void;
  clearFocus: () => void;
  
  blockInput: (blocked: boolean) => void;
  updateLastKeyTime: () => void;
}

export const useInputStore = create<InputState>((set, get) => ({
  layers: new Map(),
  focusStack: [],
  activeFocusId: null,
  isInputBlocked: false,
  lastKeyTime: 0,

  registerLayer: (layer: Omit<InputLayer, 'active'>) => {
    set((state: InputState) => {
      const newLayers = new Map(state.layers);
      newLayers.set(layer.id, { ...layer, active: true });
      return { layers: newLayers };
    });
  },

  unregisterLayer: (id: string) => {
    set((state: InputState) => {
      const newLayers = new Map(state.layers);
      newLayers.delete(id);
      return { layers: newLayers };
    });
  },

  setLayerActive: (id: string, active: boolean) => {
    set((state: InputState) => {
      const layer = state.layers.get(id);
      if (!layer) return state;
      
      const newLayers = new Map(state.layers);
      newLayers.set(id, { ...layer, active });
      return { layers: newLayers };
    });
  },

  pushFocus: (context: FocusContext) => {
    set((state: InputState) => ({
      focusStack: [...state.focusStack, context],
      activeFocusId: context.id,
    }));
  },

  popFocus: () => {
    const { focusStack } = get();
    if (focusStack.length === 0) return undefined;
    
    const popped = focusStack[focusStack.length - 1];
    set((state: InputState) => {
      const newStack = state.focusStack.slice(0, -1);
      return {
        focusStack: newStack,
        activeFocusId: newStack[newStack.length - 1]?.id ?? null,
      };
    });
    return popped;
  },

  setFocus: (id: string | null) => {
    set({ activeFocusId: id });
  },

  clearFocus: () => {
    set({ focusStack: [], activeFocusId: null });
  },

  blockInput: (blocked: boolean) => {
    set({ isInputBlocked: blocked });
  },

  updateLastKeyTime: () => {
    set({ lastKeyTime: Date.now() });
  },
}));

// ============================================================================
// Hooks
// ============================================================================

/**
 * Create a normalized key event
 */

/**
 * Key object type from Ink's useInput
 */
interface InkKey {
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  return: boolean;
  escape: boolean;
  backspace: boolean;
  delete: boolean;
  tab: boolean;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
}

function createKeyEvent(
  input: string, 
  key: InkKey
): KeyEvent {
  return {
    key: input || '',
    raw: input,
    ctrl: key.ctrl ?? false,
    alt: key.meta ?? false, // In terminal, meta is often alt
    shift: key.shift ?? false,
    meta: key.meta ?? false,
    
    // Convenience checks
    isEnter: key.return ?? false,
    isEscape: key.escape ?? false,
    isTab: key.tab ?? false,
    isBackspace: key.backspace ?? false,
    isDelete: key.delete ?? false,
    isSpace: input === ' ',
    isUp: key.upArrow ?? false,
    isDown: key.downArrow ?? false,
    isLeft: key.leftArrow ?? false,
    isRight: key.rightArrow ?? false,
    
    // Common combos
    isCtrlC: (key.ctrl ?? false) && input === 'c',
    isCtrlQ: (key.ctrl ?? false) && (input === 'q' || input === 'Q'),
    
    preventDefault: () => {},
    stopPropagation: () => {},
  };
}

/**
 * Hook to register an input layer with priority
 */
export function useInputLayer(
  id: string,
  handler: InputHandler,
  priority: number = 0,
  active: boolean = true
) {
  // Store handler in a ref to avoid re-registration on handler changes
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  
  // Stable wrapper that calls the latest handler
  const stableHandler = useCallback<InputHandler>((event) => {
    return handlerRef.current(event);
  }, []);

  useEffect(() => {
    useInputStore.getState().registerLayer({ id, handler: stableHandler, priority });
    return () => useInputStore.getState().unregisterLayer(id);
  }, [id, priority, stableHandler]);

  useEffect(() => {
    useInputStore.getState().setLayerActive(id, active);
  }, [id, active]);
}

/**
 * Hook for global keyboard handling with layer support
 */
export function useKeyboard(handler: InputHandler, options?: { 
  priority?: number;
  active?: boolean;
  id?: string;
}) {
  // Generate stable ID once (useRef to preserve across renders)
  const generatedIdRef = useRef<string | null>(null);
  if (!generatedIdRef.current) {
    generatedIdRef.current = `keyboard-${Math.random().toString(36).slice(2)}`;
  }
  
  const layerId = options?.id ?? generatedIdRef.current;
  const priority = options?.priority ?? 0;
  const active = options?.active ?? true;
  
  useInputLayer(layerId, handler, priority, active);
}

/**
 * Hook for processing all registered input layers
 */
export function useGlobalInputHandler() {
  const layers = useInputStore((s: InputState) => s.layers);
  const isBlocked = useInputStore((s: InputState) => s.isInputBlocked);

  // Sort layers by priority (higher priority first)
  const sortedLayers = useMemo(() => {
    return Array.from(layers.values())
      .filter((l: InputLayer & { active: boolean }) => l.active)
      .sort((a: InputLayer, b: InputLayer) => b.priority - a.priority);
  }, [layers]);

  useInput((input: string, key: InkKey) => {
    if (isBlocked) return;
    
    useInputStore.getState().updateLastKeyTime();
    
    const event = createKeyEvent(input, key);
    
    // Process layers in priority order
    for (const layer of sortedLayers) {
      const result = layer.handler(event);
      // If handler returns true or calls stopPropagation, stop processing
      if (result === true) break;
    }
  });
}

/**
 * Hook for list navigation with vim-style bindings
 */
export function useListNavigation(options: {
  itemCount: number;
  initialIndex?: number;
  wrap?: boolean;
  pageSize?: number;
  onSelect?: (index: number) => void;
  onChange?: (index: number) => void;
  isActive?: boolean;
}) {
  const {
    itemCount,
    initialIndex = 0,
    wrap = false,
    pageSize = 10,
    onSelect,
    onChange,
    isActive = true,
  } = options;

  const indexRef = useRef(initialIndex);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const setIndex = useCallback((newIndex: number) => {
    if (newIndex !== indexRef.current) {
      indexRef.current = newIndex;
      onChange?.(newIndex);
      forceUpdate();
    }
  }, [onChange]);

  const moveUp = useCallback(() => {
    if (itemCount === 0) return;
    
    let newIndex = indexRef.current - 1;
    if (newIndex < 0) {
      newIndex = wrap ? itemCount - 1 : 0;
    }
    setIndex(newIndex);
  }, [itemCount, wrap, setIndex]);

  const moveDown = useCallback(() => {
    if (itemCount === 0) return;
    
    let newIndex = indexRef.current + 1;
    if (newIndex >= itemCount) {
      newIndex = wrap ? 0 : itemCount - 1;
    }
    setIndex(newIndex);
  }, [itemCount, wrap, setIndex]);

  const pageUp = useCallback(() => {
    const newIndex = Math.max(0, indexRef.current - pageSize);
    setIndex(newIndex);
  }, [pageSize, setIndex]);

  const pageDown = useCallback(() => {
    const newIndex = Math.min(itemCount - 1, indexRef.current + pageSize);
    setIndex(newIndex);
  }, [itemCount, pageSize, setIndex]);

  const goToFirst = useCallback(() => {
    setIndex(0);
  }, [setIndex]);

  const goToLast = useCallback(() => {
    setIndex(Math.max(0, itemCount - 1));
  }, [itemCount, setIndex]);

  // Store onSelect in a ref to always use the latest version
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const select = useCallback(() => {
    onSelectRef.current?.(indexRef.current);
  }, []);

  // Handle keyboard input
  useKeyboard(
    useCallback((event: KeyEvent) => {
      // Vim bindings
      if (event.key === 'j' || event.isDown) {
        moveDown();
        return true;
      }
      if (event.key === 'k' || event.isUp) {
        moveUp();
        return true;
      }
      if (event.key === 'g' && !event.shift) {
        goToFirst();
        return true;
      }
      if (event.key === 'G' || (event.key === 'g' && event.shift)) {
        goToLast();
        return true;
      }
      if (event.ctrl && event.key === 'u') {
        pageUp();
        return true;
      }
      if (event.ctrl && event.key === 'd') {
        pageDown();
        return true;
      }
      if (event.isEnter || event.key === 'l' || event.isRight) {
        select();
        return true;
      }
      
      return false;
    }, [moveDown, moveUp, goToFirst, goToLast, pageUp, pageDown, select]),
    { active: isActive, priority: 10 }
  );

  return {
    index: indexRef.current,
    setIndex,
    moveUp,
    moveDown,
    pageUp,
    pageDown,
    goToFirst,
    goToLast,
    select,
  };
}

// Import useReducer for forceUpdate
import { useReducer } from 'react';

/**
 * Hook for text input with common editing features
 */
export function useTextInput(options?: {
  initialValue?: string;
  onSubmit?: (value: string) => void;
  onChange?: (value: string) => void;
  isActive?: boolean;
  maxLength?: number;
}) {
  const {
    initialValue = '',
    onSubmit,
    onChange,
    isActive = true,
    maxLength,
  } = options ?? {};

  const valueRef = useRef(initialValue);
  const cursorRef = useRef(initialValue.length);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const setValue = useCallback((newValue: string) => {
    if (maxLength && newValue.length > maxLength) {
      newValue = newValue.slice(0, maxLength);
    }
    if (newValue !== valueRef.current) {
      valueRef.current = newValue;
      cursorRef.current = Math.min(cursorRef.current, newValue.length);
      onChange?.(newValue);
      forceUpdate();
    }
  }, [maxLength, onChange]);

  const clear = useCallback(() => {
    setValue('');
    cursorRef.current = 0;
  }, [setValue]);

  const insert = useCallback((char: string) => {
    const before = valueRef.current.slice(0, cursorRef.current);
    const after = valueRef.current.slice(cursorRef.current);
    setValue(before + char + after);
    cursorRef.current += char.length;
  }, [setValue]);

  const backspace = useCallback(() => {
    if (cursorRef.current > 0) {
      const before = valueRef.current.slice(0, cursorRef.current - 1);
      const after = valueRef.current.slice(cursorRef.current);
      setValue(before + after);
      cursorRef.current -= 1;
    }
  }, [setValue]);

  const deleteChar = useCallback(() => {
    const before = valueRef.current.slice(0, cursorRef.current);
    const after = valueRef.current.slice(cursorRef.current + 1);
    setValue(before + after);
  }, [setValue]);

  const moveCursorLeft = useCallback(() => {
    cursorRef.current = Math.max(0, cursorRef.current - 1);
    forceUpdate();
  }, []);

  const moveCursorRight = useCallback(() => {
    cursorRef.current = Math.min(valueRef.current.length, cursorRef.current + 1);
    forceUpdate();
  }, []);

  const moveCursorToStart = useCallback(() => {
    cursorRef.current = 0;
    forceUpdate();
  }, []);

  const moveCursorToEnd = useCallback(() => {
    cursorRef.current = valueRef.current.length;
    forceUpdate();
  }, []);

  const submit = useCallback(() => {
    onSubmit?.(valueRef.current);
  }, [onSubmit]);

  useKeyboard(
    useCallback((event: KeyEvent) => {
      if (event.isEnter) {
        submit();
        return true;
      }
      if (event.isBackspace) {
        backspace();
        return true;
      }
      if (event.isDelete) {
        deleteChar();
        return true;
      }
      if (event.isLeft) {
        moveCursorLeft();
        return true;
      }
      if (event.isRight) {
        moveCursorRight();
        return true;
      }
      if (event.ctrl && event.key === 'a') {
        moveCursorToStart();
        return true;
      }
      if (event.ctrl && event.key === 'e') {
        moveCursorToEnd();
        return true;
      }
      if (event.ctrl && event.key === 'u') {
        clear();
        return true;
      }
      
      // Printable characters
      if (event.key.length === 1 && event.key.charCodeAt(0) >= 32 && !event.ctrl && !event.alt) {
        insert(event.key);
        return true;
      }

      return false;
    }, [submit, backspace, deleteChar, moveCursorLeft, moveCursorRight, 
        moveCursorToStart, moveCursorToEnd, clear, insert]),
    { active: isActive, priority: 20 }
  );

  return {
    value: valueRef.current,
    cursor: cursorRef.current,
    setValue,
    clear,
    insert,
    backspace,
    deleteChar,
    moveCursorLeft,
    moveCursorRight,
    moveCursorToStart,
    moveCursorToEnd,
    submit,
  };
}

/**
 * Hook for focus management
 */
export function useFocus(id: string, type: FocusContext['type'] = 'panel') {
  const activeFocusId = useInputStore((s: InputState) => s.activeFocusId);
  
  const isFocused = activeFocusId === id;
  
  const focus = useCallback(() => {
    useInputStore.getState().setFocus(id);
  }, [id]);

  const takeFocus = useCallback((index?: number, total?: number) => {
    useInputStore.getState().pushFocus({ id, type, index, total });
  }, [id, type]);

  return {
    isFocused,
    focus,
    takeFocus,
  };
}

/**
 * Hook for modal/dialog handling
 */
export function useModal(id: string) {
  const activeFocusId = useInputStore((s: InputState) => s.activeFocusId);
  
  const isOpen = activeFocusId === id;
  
  const open = useCallback(() => {
    useInputStore.getState().pushFocus({ id, type: 'dialog' });
  }, [id]);
  
  const close = useCallback(() => {
    if (useInputStore.getState().activeFocusId === id) {
      useInputStore.getState().popFocus();
    }
  }, [id]);
  
  // Handle escape to close
  useKeyboard(
    useCallback((event: KeyEvent) => {
      if (event.isEscape && isOpen) {
        close();
        return true;
      }
      return false;
    }, [isOpen, close]),
    { active: isOpen, priority: 100 }
  );

  return {
    isOpen,
    open,
    close,
  };
}

export default {
  useInputStore,
  useInputLayer,
  useKeyboard,
  useGlobalInputHandler,
  useListNavigation,
  useTextInput,
  useFocus,
  useModal,
};
