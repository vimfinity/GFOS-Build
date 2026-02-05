/**
 * Keyboard Shortcuts Hook
 * Global keyboard navigation and actions for GFOS Build
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { AppView } from '../types';

interface ShortcutDefinition {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  description: string;
  category: 'navigation' | 'action' | 'dialog';
  action: () => void;
}

export function useKeyboardShortcuts() {
  const setActiveView = useAppStore((state) => state.setActiveView);
  const setIsSearchOpen = useAppStore((state) => state.setIsSearchOpen);
  const isSearchOpen = useAppStore((state) => state.isSearchOpen);
  const isShortcutsHelpOpen = useAppStore((state) => state.isShortcutsHelpOpen);
  const setIsShortcutsHelpOpen = useAppStore((state) => state.setIsShortcutsHelpOpen);
  const goBack = useAppStore((state) => state.goBack);
  const startBuild = useAppStore((state) => state.startBuild);
  const projects = useAppStore((state) => state.projects);

  // Navigate to a view
  const navigateTo = useCallback((view: AppView) => {
    setActiveView(view);
  }, [setActiveView]);

  // Start a quick build (first project)
  const quickBuild = useCallback(() => {
    if (projects.length > 0) {
      startBuild(projects[0].id);
    }
  }, [projects, startBuild]);

  // All shortcuts
  const shortcuts: ShortcutDefinition[] = useMemo(() => [
    // Navigation (Ctrl + 1-6)
    {
      key: '1',
      ctrlKey: true,
      description: 'Overview',
      category: 'navigation',
      action: () => navigateTo('overview'),
    },
    {
      key: '2',
      ctrlKey: true,
      description: 'Projekte',
      category: 'navigation',
      action: () => navigateTo('projects'),
    },
    {
      key: '3',
      ctrlKey: true,
      description: 'Builds',
      category: 'navigation',
      action: () => navigateTo('builds'),
    },
    {
      key: '4',
      ctrlKey: true,
      description: 'JDKs',
      category: 'navigation',
      action: () => navigateTo('jdks'),
    },
    {
      key: '5',
      ctrlKey: true,
      description: 'Pipelines',
      category: 'navigation',
      action: () => navigateTo('pipelines'),
    },
    {
      key: '6',
      ctrlKey: true,
      description: 'Einstellungen',
      category: 'navigation',
      action: () => navigateTo('settings'),
    },
    
    // Actions
    {
      key: 'k',
      ctrlKey: true,
      description: 'Globale Suche',
      category: 'action',
      action: () => setIsSearchOpen(!isSearchOpen),
    },
    {
      key: 'b',
      ctrlKey: true,
      description: 'Neuer Build',
      category: 'action',
      action: quickBuild,
    },
    {
      key: 'n',
      ctrlKey: true,
      description: 'Neue Pipeline',
      category: 'action',
      action: () => navigateTo('pipeline-editor'),
    },
    
    // Dialog
    {
      key: 'Escape',
      description: 'Schließen / Zurück',
      category: 'dialog',
      action: () => {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else if (isShortcutsHelpOpen) {
          setIsShortcutsHelpOpen(false);
        } else {
          goBack();
        }
      },
    },
    {
      key: '?',
      shiftKey: true,
      description: 'Shortcuts anzeigen',
      category: 'dialog',
      action: () => setIsShortcutsHelpOpen(!isShortcutsHelpOpen),
    },
  ], [navigateTo, setIsSearchOpen, isSearchOpen, isShortcutsHelpOpen, setIsShortcutsHelpOpen, goBack, quickBuild]);

  // Key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Only allow Escape in input fields
        if (e.key !== 'Escape') {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrlKey ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;
        
        if (e.key === shortcut.key && ctrlMatch && shiftMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  // Group shortcuts by category for display
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, ShortcutDefinition[]> = {
      navigation: [],
      action: [],
      dialog: [],
    };
    
    shortcuts.forEach(s => {
      groups[s.category].push(s);
    });
    
    return groups;
  }, [shortcuts]);

  return {
    shortcuts,
    groupedShortcuts,
    isShortcutsHelpOpen,
    setIsShortcutsHelpOpen,
  };
}

/**
 * Format shortcut keys for display
 */
export function formatShortcutKeys(shortcut: { key: string; ctrlKey?: boolean; shiftKey?: boolean }): string {
  const parts: string[] = [];
  
  if (shortcut.ctrlKey) {
    // Use Cmd on Mac, Ctrl on other platforms
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (shortcut.shiftKey) {
    parts.push(navigator.platform.includes('Mac') ? '⇧' : 'Shift');
  }
  
  // Format key name
  let keyName = shortcut.key;
  if (keyName === 'Escape') keyName = 'Esc';
  if (keyName === ' ') keyName = 'Space';
  if (keyName.length === 1) keyName = keyName.toUpperCase();
  
  parts.push(keyName);
  
  return parts.join(' + ');
}
