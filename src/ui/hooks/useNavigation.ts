/**
 * Navigation State Machine
 * 
 * Proper state machine for navigation with history,
 * transitions, and parameter passing.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * Route definitions with typed parameters
 */
export type Route =
  | { type: 'home' }
  | { type: 'repos'; search?: string }
  | { type: 'repo-detail'; projectPath: string }
  | { type: 'build-config'; projectPath: string; modules?: string[] }
  | { type: 'jobs'; filter?: 'all' | 'running' | 'pending' | 'success' | 'failed' | 'cancelled' }
  | { type: 'job-detail'; jobId: string }
  | { type: 'pipelines' }
  | { type: 'pipeline-detail'; pipelineId: string }
  | { type: 'pipeline-editor'; pipelineId?: string }
  | { type: 'settings'; section?: string }
  | { type: 'help' };

/**
 * Navigation transition types
 */
export type TransitionType = 'push' | 'replace' | 'pop' | 'reset';

/**
 * Navigation event for logging/debugging
 */
export interface NavigationEvent {
  from: Route;
  to: Route;
  transition: TransitionType;
  timestamp: number;
}

/**
 * Navigation guard function
 */
export type NavigationGuard = (from: Route, to: Route) => boolean | Promise<boolean>;

// ============================================================================
// Navigation Store
// ============================================================================

interface NavigationState {
  // Current state
  currentRoute: Route;
  history: Route[];
  
  // Transition state
  isTransitioning: boolean;
  lastTransition: TransitionType | null;
  
  // Guards
  guards: Map<string, NavigationGuard>;
  
  // Event log (for debugging)
  eventLog: NavigationEvent[];
  
  // Actions
  navigate: (to: Route, options?: { replace?: boolean }) => Promise<void>;
  goBack: () => Promise<boolean>;
  goHome: () => Promise<void>;
  reset: (route?: Route) => void;
  
  // Guard management
  addGuard: (id: string, guard: NavigationGuard) => void;
  removeGuard: (id: string) => void;
  
  // History management
  canGoBack: () => boolean;
  getHistoryDepth: () => number;
  clearHistory: () => void;
}

export const useNavigation = create<NavigationState>()(
  subscribeWithSelector((set, get) => ({
    currentRoute: { type: 'home' },
    history: [],
    isTransitioning: false,
    lastTransition: null,
    guards: new Map(),
    eventLog: [],

    navigate: async (to, options = {}) => {
      const state = get();
      const from = state.currentRoute;
      
      // Check guards
      for (const guard of state.guards.values()) {
        const allowed = await guard(from, to);
        if (!allowed) {
          return;
        }
      }

      set({ isTransitioning: true });

      const transition: TransitionType = options.replace ? 'replace' : 'push';
      
      // Log event
      const event: NavigationEvent = {
        from,
        to,
        transition,
        timestamp: Date.now(),
      };

      set((s) => ({
        currentRoute: to,
        history: options.replace 
          ? s.history 
          : [...s.history, from],
        isTransitioning: false,
        lastTransition: transition,
        eventLog: [...s.eventLog.slice(-49), event], // Keep last 50 events
      }));
    },

    goBack: async () => {
      const state = get();
      
      if (state.history.length === 0) {
        return false;
      }

      const to = state.history[state.history.length - 1]!;
      const from = state.currentRoute;

      // Check guards
      for (const guard of state.guards.values()) {
        const allowed = await guard(from, to);
        if (!allowed) {
          return false;
        }
      }

      set({ isTransitioning: true });

      // Log event
      const event: NavigationEvent = {
        from,
        to,
        transition: 'pop',
        timestamp: Date.now(),
      };

      set((s) => ({
        currentRoute: to,
        history: s.history.slice(0, -1),
        isTransitioning: false,
        lastTransition: 'pop',
        eventLog: [...s.eventLog.slice(-49), event],
      }));

      return true;
    },

    goHome: async () => {
      const state = get();
      const from = state.currentRoute;
      const to: Route = { type: 'home' };

      // Check guards
      for (const guard of state.guards.values()) {
        const allowed = await guard(from, to);
        if (!allowed) {
          return;
        }
      }

      // Log event
      const event: NavigationEvent = {
        from,
        to,
        transition: 'reset',
        timestamp: Date.now(),
      };

      set({
        currentRoute: to,
        history: [],
        isTransitioning: false,
        lastTransition: 'reset',
        eventLog: [...state.eventLog.slice(-49), event],
      });
    },

    reset: (route = { type: 'home' }) => {
      set({
        currentRoute: route,
        history: [],
        isTransitioning: false,
        lastTransition: 'reset',
      });
    },

    addGuard: (id, guard) => {
      set((s) => {
        const newGuards = new Map(s.guards);
        newGuards.set(id, guard);
        return { guards: newGuards };
      });
    },

    removeGuard: (id) => {
      set((s) => {
        const newGuards = new Map(s.guards);
        newGuards.delete(id);
        return { guards: newGuards };
      });
    },

    canGoBack: () => get().history.length > 0,
    getHistoryDepth: () => get().history.length,
    clearHistory: () => set({ history: [] }),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectCurrentRoute = (state: NavigationState) => state.currentRoute;
export const selectIsTransitioning = (state: NavigationState) => state.isTransitioning;
export const selectCanGoBack = (state: NavigationState) => state.history.length > 0;
export const selectHistoryDepth = (state: NavigationState) => state.history.length;

/**
 * Type-safe route checker
 */
export function isRoute<T extends Route['type']>(
  route: Route,
  type: T
): route is Extract<Route, { type: T }> {
  return route.type === type;
}

/**
 * Get route param with type safety
 */
export function getRouteParam<T extends Route, K extends keyof T>(
  route: T,
  key: K
): T[K] {
  return route[key];
}

// ============================================================================
// Navigation Helpers
// ============================================================================

type JobFilter = 'all' | 'running' | 'pending' | 'success' | 'failed' | 'cancelled';

/**
 * Create typed navigation functions
 */
export function createNavigator() {
  const { navigate, goBack, goHome, reset, canGoBack } = useNavigation.getState();

  return {
    toHome: () => navigate({ type: 'home' }),
    toRepos: (search?: string) => navigate({ type: 'repos', search }),
    toRepoDetail: (projectPath: string) => navigate({ type: 'repo-detail', projectPath }),
    toBuildConfig: (projectPath: string, modules?: string[]) => 
      navigate({ type: 'build-config', projectPath, modules }),
    toJobs: (filter?: JobFilter) => navigate({ type: 'jobs', filter }),
    toJobDetail: (jobId: string) => navigate({ type: 'job-detail', jobId }),
    toPipelines: () => navigate({ type: 'pipelines' }),
    toPipelineDetail: (pipelineId: string) => navigate({ type: 'pipeline-detail', pipelineId }),
    toSettings: (section?: string) => navigate({ type: 'settings', section }),
    toHelp: () => navigate({ type: 'help' }),
    back: goBack,
    home: goHome,
    reset,
    canGoBack,
  };
}

// ============================================================================
// React Hooks
// ============================================================================

import { useCallback, useEffect } from 'react';
import { useKeyboard, type KeyEvent } from './useInput.js';

/**
 * Hook for accessing navigation in components
 */
export function useNavigator() {
  const currentRoute = useNavigation((s) => s.currentRoute);
  const canGoBackFn = useNavigation((s) => s.canGoBack);
  const isTransitioning = useNavigation((s) => s.isTransitioning);

  const navigate = useCallback((route: Route) => 
    useNavigation.getState().navigate(route), []);
  const goBack = useCallback(() => 
    useNavigation.getState().goBack(), []);
  const goHome = useCallback(() => 
    useNavigation.getState().goHome(), []);

  return {
    currentRoute,
    canGoBack: canGoBackFn(),
    isTransitioning,
    navigate,
    goBack,
    goHome,
    // Typed navigators
    toHome: useCallback(() => navigate({ type: 'home' }), [navigate]),
    toRepos: useCallback((search?: string) => 
      navigate({ type: 'repos', search }), [navigate]),
    toRepoDetail: useCallback((projectPath: string) => 
      navigate({ type: 'repo-detail', projectPath }), [navigate]),
    toBuildConfig: useCallback((projectPath: string, modules?: string[]) =>
      navigate({ type: 'build-config', projectPath, modules }), [navigate]),
    toJobs: useCallback((filter?: JobFilter) => 
      navigate({ type: 'jobs', filter }), [navigate]),
    toJobDetail: useCallback((jobId: string) => 
      navigate({ type: 'job-detail', jobId }), [navigate]),
    toPipelines: useCallback(() => navigate({ type: 'pipelines' }), [navigate]),
    toPipelineEditor: useCallback((pipelineId?: string) => 
      navigate({ type: 'pipeline-editor', pipelineId }), [navigate]),
    toSettings: useCallback((section?: string) => 
      navigate({ type: 'settings', section }), [navigate]),
  };
}

/**
 * Hook for current route with type safety
 */
export function useRoute<T extends Route['type']>(type: T) {
  const currentRoute = useNavigation((s) => s.currentRoute);
  
  if (currentRoute.type === type) {
    return currentRoute as Extract<Route, { type: T }>;
  }
  return null;
}

/**
 * Hook for navigation guards
 */
export function useNavigationGuard(
  id: string,
  guard: NavigationGuard,
  deps: unknown[] = []
) {
  useEffect(() => {
    useNavigation.getState().addGuard(id, guard);
    return () => useNavigation.getState().removeGuard(id);
  }, [id, ...deps]);
}

/**
 * Hook for global navigation keyboard shortcuts
 */
export function useNavigationKeyboard() {
  const { goBack, goHome, canGoBack, currentRoute } = useNavigator();

  useKeyboard(
    useCallback((event: KeyEvent) => {
      // ESC to go back (but not from home)
      if (event.isEscape && canGoBack) {
        goBack();
        return true;
      }
      
      // Ctrl+H to go home
      if (event.ctrl && event.key === 'h') {
        if (currentRoute.type !== 'home') {
          goHome();
        }
        return true;
      }

      return false;
    }, [goBack, goHome, canGoBack, currentRoute]),
    { priority: 50, id: 'navigation' }
  );
}

export default {
  useNavigation,
  useNavigator,
  useRoute,
  useNavigationGuard,
  useNavigationKeyboard,
  createNavigator,
  isRoute,
  getRouteParam,
  selectCurrentRoute,
  selectIsTransitioning,
  selectCanGoBack,
  selectHistoryDepth,
};
