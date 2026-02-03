/**
 * Terminal and Rendering Hooks
 * 
 * Performance-optimized hooks for terminal rendering,
 * dimensions tracking, and render scheduling.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStdout, useApp } from 'ink';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { animation } from '../theme/index.js';

// ============================================================================
// Types
// ============================================================================

export interface TerminalDimensions {
  width: number;
  height: number;
  columns: number;
  rows: number;
}

export interface RenderState {
  // Frame tracking
  frameCount: number;
  lastRenderTime: number;
  fps: number;
  
  // Dirty tracking
  isDirty: boolean;
  dirtyRegions: Set<string>;
  
  // Performance
  renderCount: number;
  avgRenderTime: number;
}

// ============================================================================
// Render Store
// ============================================================================

interface RenderStoreState {
  dimensions: TerminalDimensions;
  renderState: RenderState;
  isReady: boolean;
  
  // Actions
  setDimensions: (dims: Partial<TerminalDimensions>) => void;
  markDirty: (region?: string) => void;
  clearDirty: () => void;
  recordRender: (duration: number) => void;
  setReady: (ready: boolean) => void;
}

export const useRenderStore = create<RenderStoreState>()(
  subscribeWithSelector((set, get) => ({
    dimensions: {
      width: globalThis.process?.stdout?.columns || 80,
      height: globalThis.process?.stdout?.rows || 24,
      columns: globalThis.process?.stdout?.columns || 80,
      rows: globalThis.process?.stdout?.rows || 24,
    },
    renderState: {
      frameCount: 0,
      lastRenderTime: 0,
      fps: 0,
      isDirty: false,
      dirtyRegions: new Set(),
      renderCount: 0,
      avgRenderTime: 0,
    },
    isReady: false,

    setDimensions: (dims: Partial<TerminalDimensions>) => {
      set((state: RenderStoreState) => ({
        dimensions: { ...state.dimensions, ...dims },
      }));
    },

    markDirty: (region?: string) => {
      set((state: RenderStoreState) => ({
        renderState: {
          ...state.renderState,
          isDirty: true,
          dirtyRegions: region
            ? new Set([...state.renderState.dirtyRegions, region])
            : state.renderState.dirtyRegions,
        },
      }));
    },

    clearDirty: () => {
      set((state: RenderStoreState) => ({
        renderState: {
          ...state.renderState,
          isDirty: false,
          dirtyRegions: new Set(),
        },
      }));
    },

    recordRender: (duration: number) => {
      set((state: RenderStoreState) => {
        const now = Date.now();
        const timeSinceLastRender = now - state.renderState.lastRenderTime;
        const fps = timeSinceLastRender > 0 ? 1000 / timeSinceLastRender : 0;
        
        const newCount = state.renderState.renderCount + 1;
        const newAvg = 
          (state.renderState.avgRenderTime * state.renderState.renderCount + duration) / 
          newCount;

        return {
          renderState: {
            ...state.renderState,
            frameCount: state.renderState.frameCount + 1,
            lastRenderTime: now,
            fps: Math.round(fps),
            renderCount: newCount,
            avgRenderTime: newAvg,
          },
        };
      });
    },

    setReady: (ready: boolean) => {
      set({ isReady: ready });
    },
  }))
);

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get current terminal dimensions with resize handling
 */
export function useTerminalSize(): TerminalDimensions {
  const { stdout } = useStdout();
  const dimensions = useRenderStore((s: RenderStoreState) => s.dimensions);

  useEffect(() => {
    const updateSize = () => {
      const width = stdout?.columns ?? process.stdout.columns ?? 80;
      const height = stdout?.rows ?? process.stdout.rows ?? 24;
      
      useRenderStore.getState().setDimensions({
        width,
        height,
        columns: width,
        rows: height,
      });
    };

    // Initial size
    updateSize();

    // Listen for resize
    const handleResize = () => {
      updateSize();
    };

    stdout?.on('resize', handleResize);
    process.stdout.on('resize', handleResize);

    return () => {
      stdout?.off('resize', handleResize);
      process.stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return dimensions;
}

/**
 * Hook for debounced/throttled updates
 */
export function useDebouncedValue<T>(value: T, delay: number = animation.debounceMs): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * Hook for throttled callback execution
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = animation.throttleMs
): T {
  const lastRan = useRef(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastArgs = useRef<Parameters<T> | undefined>(undefined);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      lastArgs.current = args;
      
      if (now - lastRan.current >= delay) {
        lastRan.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          lastRan.current = Date.now();
          if (lastArgs.current) {
            callback(...lastArgs.current);
          }
        }, delay - (now - lastRan.current));
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Hook for RAF-based animation
 */
export function useAnimationFrame(callback: (delta: number) => void, active: boolean = true) {
  const frameRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const callbackRef = useRef(callback);
  
  callbackRef.current = callback;

  useEffect(() => {
    if (!active) return;

    const tick = (time: number) => {
      if (lastTimeRef.current !== 0) {
        const delta = time - lastTimeRef.current;
        callbackRef.current(delta);
      }
      lastTimeRef.current = time;
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [active]);
}

/**
 * Hook for interval-based updates (for spinners, etc.)
 */
export function useInterval(callback: () => void, delay: number | null, immediate: boolean = false) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    if (immediate) {
      savedCallback.current();
    }

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay, immediate]);
}

/**
 * Hook for spinner animation frame
 */
export function useSpinner(
  frames: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  intervalMs: number = animation.spinnerInterval
): string {
  const [frameIndex, setFrameIndex] = useState(0);

  useInterval(() => {
    setFrameIndex((i) => (i + 1) % frames.length);
  }, intervalMs);

  return frames[frameIndex] ?? frames[0] ?? '⠋';
}

/**
 * Hook for tracking if component is mounted
 */
export function useMounted() {
  const mounted = useRef(false);
  
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  
  return mounted;
}

/**
 * Hook for stable callback references
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(callback: T): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback(
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    []
  );
}

/**
 * Hook for previous value tracking
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

/**
 * Hook for lazy initialization
 */
export function useLazy<T>(factory: () => T): T {
  const ref = useRef<T | undefined>(undefined);
  
  if (ref.current === undefined) {
    ref.current = factory();
  }
  
  return ref.current as T;
}

/**
 * Hook for conditional visibility with animation support
 */
export function useVisibility(
  visible: boolean,
  options?: {
    enterDelay?: number;
    exitDelay?: number;
    onEnter?: () => void;
    onExit?: () => void;
  }
) {
  const [isVisible, setIsVisible] = useState(visible);
  const [isAnimating, setIsAnimating] = useState(false);
  const { enterDelay = 0, exitDelay = 0, onEnter, onExit } = options ?? {};

  useEffect(() => {
    if (visible) {
      if (enterDelay > 0) {
        setIsAnimating(true);
        const timer = setTimeout(() => {
          setIsVisible(true);
          setIsAnimating(false);
          onEnter?.();
        }, enterDelay);
        return () => clearTimeout(timer);
      } else {
        setIsVisible(true);
        onEnter?.();
      }
    } else {
      if (exitDelay > 0) {
        setIsAnimating(true);
        const timer = setTimeout(() => {
          setIsVisible(false);
          setIsAnimating(false);
          onExit?.();
        }, exitDelay);
        return () => clearTimeout(timer);
      } else {
        setIsVisible(false);
        onExit?.();
      }
    }
  }, [visible, enterDelay, exitDelay, onEnter, onExit]);

  return { isVisible, isAnimating };
}

/**
 * Hook for clean screen clearing
 */
export function useClearScreen() {
  const { stdout } = useStdout();

  return useCallback(() => {
    if (stdout) {
      // Clear screen and move cursor to top-left
      stdout.write('\x1B[2J\x1B[H');
    }
  }, [stdout]);
}

/**
 * Hook for alternate screen buffer (full screen apps)
 */
export function useAlternateScreen(enabled: boolean = true) {
  const { stdout } = useStdout();

  useEffect(() => {
    if (!enabled || !stdout) return;

    // Enter alternate screen buffer
    stdout.write('\x1B[?1049h');
    // Hide cursor
    stdout.write('\x1B[?25l');

    return () => {
      // Show cursor
      stdout.write('\x1B[?25h');
      // Exit alternate screen buffer
      stdout.write('\x1B[?1049l');
    };
  }, [enabled, stdout]);
}

/**
 * Calculate visible window for virtual scrolling
 */
export function useVirtualScroll(options: {
  totalItems: number;
  visibleHeight: number;
  itemHeight?: number;
  focusIndex: number;
  overscan?: number;
}) {
  const { 
    totalItems, 
    visibleHeight, 
    itemHeight = 1, 
    focusIndex,
    overscan = 2 
  } = options;

  return useMemo(() => {
    const visibleCount = Math.ceil(visibleHeight / itemHeight);
    
    // Calculate scroll offset to keep focus in view
    let startIndex = Math.max(0, focusIndex - Math.floor(visibleCount / 2));
    const maxStart = Math.max(0, totalItems - visibleCount);
    startIndex = Math.min(startIndex, maxStart);
    
    // Add overscan for smoother scrolling
    const overscanStart = Math.max(0, startIndex - overscan);
    const overscanEnd = Math.min(totalItems, startIndex + visibleCount + overscan);
    
    return {
      startIndex,
      endIndex: Math.min(totalItems, startIndex + visibleCount),
      overscanStart,
      overscanEnd,
      visibleCount,
      totalItems,
      // Scroll indicators
      canScrollUp: startIndex > 0,
      canScrollDown: startIndex + visibleCount < totalItems,
      scrollProgress: totalItems > visibleCount 
        ? startIndex / (totalItems - visibleCount) 
        : 0,
    };
  }, [totalItems, visibleHeight, itemHeight, focusIndex, overscan]);
}

export default {
  useRenderStore,
  useTerminalSize,
  useDebouncedValue,
  useThrottledCallback,
  useAnimationFrame,
  useInterval,
  useSpinner,
  useMounted,
  useStableCallback,
  usePrevious,
  useLazy,
  useVisibility,
  useClearScreen,
  useAlternateScreen,
  useVirtualScroll,
};
