/**
 * Command System
 * 
 * Centralized command registration and keyboard shortcut management.
 * Similar to VS Code's command palette system.
 */

import { create } from 'zustand';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useKeyboard, type KeyEvent } from '../hooks/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Command definition
 */
export interface Command {
  /** Unique command ID */
  id: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Category for grouping */
  category?: string;
  /** Keyboard shortcut (e.g., 'ctrl+s', 'ctrl+shift+p') */
  shortcut?: string;
  /** Command action */
  action: () => void | Promise<void>;
  /** Whether command is currently available */
  when?: () => boolean;
  /** Icon for display */
  icon?: string;
}

/**
 * Parsed keyboard shortcut
 */
interface ParsedShortcut {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

// ============================================================================
// Command Store
// ============================================================================

interface CommandState {
  commands: Map<string, Command>;
  paletteOpen: boolean;
  recentCommands: string[];
  
  // Actions
  register: (command: Command) => void;
  unregister: (id: string) => void;
  execute: (id: string) => Promise<void>;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  addRecent: (id: string) => void;
}

export const useCommandStore = create<CommandState>((set, get) => ({
  commands: new Map(),
  paletteOpen: false,
  recentCommands: [],

  register: (command) => {
    set((state) => {
      const newCommands = new Map(state.commands);
      newCommands.set(command.id, command);
      return { commands: newCommands };
    });
  },

  unregister: (id) => {
    set((state) => {
      const newCommands = new Map(state.commands);
      newCommands.delete(id);
      return { commands: newCommands };
    });
  },

  execute: async (id) => {
    const { commands, addRecent } = get();
    const command = commands.get(id);
    
    if (!command) {
      return;
    }

    // Check if command is available
    if (command.when && !command.when()) {
      return;
    }

    addRecent(id);
    await command.action();
  },

  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  addRecent: (id) => {
    set((state) => {
      const filtered = state.recentCommands.filter((r) => r !== id);
      return {
        recentCommands: [id, ...filtered].slice(0, 10),
      };
    });
  },
}));

// ============================================================================
// Shortcut Parsing
// ============================================================================

/**
 * Parse a shortcut string like "ctrl+shift+p" into components
 */
function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.toLowerCase().split('+');
  
  return {
    key: parts[parts.length - 1] ?? '',
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    alt: parts.includes('alt') || parts.includes('option'),
    shift: parts.includes('shift'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
  };
}

/**
 * Check if a key event matches a parsed shortcut
 */
function matchesShortcut(event: KeyEvent, shortcut: ParsedShortcut): boolean {
  const eventKey = event.key.toLowerCase();
  
  // Check modifiers
  if (shortcut.ctrl !== event.ctrl) return false;
  if (shortcut.alt !== event.alt) return false;
  if (shortcut.shift !== event.shift) return false;
  if (shortcut.meta !== event.meta) return false;
  
  // Check key
  return eventKey === shortcut.key;
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: string): string {
  const parts = shortcut.toLowerCase().split('+');
  const formatted: string[] = [];
  
  if (parts.includes('ctrl') || parts.includes('control')) {
    formatted.push('Ctrl');
  }
  if (parts.includes('alt') || parts.includes('option')) {
    formatted.push('Alt');
  }
  if (parts.includes('shift')) {
    formatted.push('Shift');
  }
  if (parts.includes('meta') || parts.includes('cmd') || parts.includes('command')) {
    formatted.push('⌘');
  }
  
  const key = parts[parts.length - 1];
  if (key) {
    formatted.push(key.toUpperCase());
  }
  
  return formatted.join('+');
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to register a command
 */
export function useCommand(command: Command, deps: unknown[] = []) {
  // Get stable references to actions to avoid re-renders
  const store = useCommandStore;

  useEffect(() => {
    store.getState().register(command);
    return () => store.getState().unregister(command.id);
  }, [command.id, ...deps]);
}

/**
 * Hook to register multiple commands
 */
export function useCommands(commands: Command[], deps: unknown[] = []) {
  // Get stable references to actions to avoid re-renders
  const store = useCommandStore;

  useEffect(() => {
    const { register, unregister } = store.getState();
    for (const cmd of commands) {
      register(cmd);
    }
    return () => {
      for (const cmd of commands) {
        unregister(cmd.id);
      }
    };
  }, deps);
}

/**
 * Hook to execute a command
 */
export function useCommandExecutor() {
  return useCallback((id: string) => useCommandStore.getState().execute(id), []);
}

/**
 * Hook for command palette
 */
export function useCommandPalette() {
  const paletteOpen = useCommandStore((s) => s.paletteOpen);

  return useMemo(() => ({
    isOpen: paletteOpen,
    open: () => useCommandStore.getState().openPalette(),
    close: () => useCommandStore.getState().closePalette(),
    toggle: () => useCommandStore.getState().togglePalette(),
  }), [paletteOpen]);
}

/**
 * Hook for getting available commands
 */
export function useAvailableCommands() {
  const commands = useCommandStore((s) => s.commands);
  const recentCommands = useCommandStore((s) => s.recentCommands);

  return useMemo(() => {
    const available = Array.from(commands.values()).filter(
      (cmd) => !cmd.when || cmd.when()
    );

    // Sort: recent first, then alphabetically
    return available.sort((a, b) => {
      const aRecent = recentCommands.indexOf(a.id);
      const bRecent = recentCommands.indexOf(b.id);
      
      if (aRecent !== -1 && bRecent === -1) return -1;
      if (aRecent === -1 && bRecent !== -1) return 1;
      if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;
      
      return a.label.localeCompare(b.label);
    });
  }, [commands, recentCommands]);
}

/**
 * Hook for global keyboard shortcut handling
 */
export function useGlobalShortcuts() {
  const commands = useCommandStore((s) => s.commands);

  // Parse all shortcuts once
  const shortcuts = useMemo(() => {
    const result: Array<{ id: string; parsed: ParsedShortcut }> = [];
    
    for (const [id, command] of commands) {
      if (command.shortcut) {
        result.push({
          id,
          parsed: parseShortcut(command.shortcut),
        });
      }
    }
    
    return result;
  }, [commands]);

  useKeyboard(
    useCallback((event: KeyEvent) => {
      const { execute, togglePalette } = useCommandStore.getState();
      const cmds = useCommandStore.getState().commands;
      
      // Command palette shortcut (Ctrl+Shift+P or Ctrl+P)
      if (event.ctrl && event.key === 'p') {
        togglePalette();
        return true;
      }

      // Check registered shortcuts
      for (const { id, parsed } of shortcuts) {
        if (matchesShortcut(event, parsed)) {
          const cmd = cmds.get(id);
          if (cmd && (!cmd.when || cmd.when())) {
            execute(id);
            return true;
          }
        }
      }

      return false;
    }, [shortcuts]),
    { priority: 90, id: 'global-shortcuts' }
  );
}

// ============================================================================
// Built-in Commands
// ============================================================================

/**
 * Register core commands for the application
 */
export function useCoreCommands(options: {
  onExit?: () => void;
  onGoHome?: () => void;
  onGoBack?: () => void;
  onOpenSettings?: () => void;
  onOpenJobs?: () => void;
  onRefresh?: () => void;
}) {
  // Use refs to store callbacks - avoids re-registration
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const store = useCommandStore.getState();
    
    const commands: Command[] = [
      {
        id: 'app.exit',
        label: 'Exit Application',
        description: 'Quit GFOS-Build',
        category: 'Application',
        shortcut: 'ctrl+q',
        action: () => optionsRef.current.onExit?.(),
        icon: '⏻',
      },
      {
        id: 'app.home',
        label: 'Go to Home',
        description: 'Navigate to home screen',
        category: 'Navigation',
        shortcut: 'ctrl+h',
        action: () => optionsRef.current.onGoHome?.(),
        icon: '🏠',
      },
      {
        id: 'app.back',
        label: 'Go Back',
        description: 'Navigate to previous screen',
        category: 'Navigation',
        shortcut: 'escape',
        action: () => optionsRef.current.onGoBack?.(),
        icon: '←',
      },
      {
        id: 'app.settings',
        label: 'Open Settings',
        description: 'Configure application settings',
        category: 'Application',
        shortcut: 'ctrl+,',
        action: () => optionsRef.current.onOpenSettings?.(),
        icon: '*',
      },
      {
        id: 'app.jobs',
        label: 'View Jobs',
        description: 'View build job queue',
        category: 'Build',
        shortcut: 'ctrl+j',
        action: () => optionsRef.current.onOpenJobs?.(),
        icon: '📋',
      },
      {
        id: 'app.refresh',
        label: 'Refresh',
        description: 'Refresh current view',
        category: 'Application',
        shortcut: 'ctrl+r',
        action: () => optionsRef.current.onRefresh?.(),
        icon: '🔄',
      },
      {
        id: 'app.palette',
        label: 'Command Palette',
        description: 'Open command palette',
        category: 'Application',
        shortcut: 'ctrl+p',
        action: () => useCommandStore.getState().togglePalette(),
        icon: '⌘',
      },
    ];

    // Register all commands
    for (const cmd of commands) {
      store.register(cmd);
    }

    // Cleanup
    return () => {
      for (const cmd of commands) {
        store.unregister(cmd.id);
      }
    };
  }, []); // Empty deps - only run once
}

export default {
  useCommandStore,
  useCommand,
  useCommands,
  useCommandExecutor,
  useCommandPalette,
  useAvailableCommands,
  useGlobalShortcuts,
  useCoreCommands,
  formatShortcut,
};
