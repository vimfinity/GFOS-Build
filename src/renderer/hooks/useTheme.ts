/**
 * Theme Hook
 * Manages theme state with system preference detection and localStorage persistence
 */

import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Theme } from '../types';

export function useTheme() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const resolvedTheme = useAppStore((state) => state.resolvedTheme);
  const setResolvedTheme = useAppStore((state) => state.setResolvedTheme);

  // Detect system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateResolvedTheme = () => {
      if (theme === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedTheme(theme as 'light' | 'dark');
      }
    };

    updateResolvedTheme();

    // Listen for system preference changes
    const handler = () => updateResolvedTheme();
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, setResolvedTheme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [resolvedTheme]);

  const toggleTheme = useCallback(() => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  }, [theme, setTheme]);

  const cycleTheme = useCallback(() => {
    // Toggle between light and dark only (system is just the initial default)
    if (resolvedTheme === 'light') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, [resolvedTheme, setTheme]);

  return {
    theme,
    setTheme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    toggleTheme,
    cycleTheme,
  };
}

/**
 * Theme icon based on current setting
 */
export function getThemeIcon(theme: Theme): 'sun' | 'moon' | 'monitor' {
  switch (theme) {
    case 'light': return 'sun';
    case 'dark': return 'moon';
    case 'system': return 'monitor';
  }
}

/**
 * Theme label for UI display
 */
export function getThemeLabel(theme: Theme): string {
  switch (theme) {
    case 'light': return 'Hell';
    case 'dark': return 'Dunkel';
    case 'system': return 'System';
  }
}
