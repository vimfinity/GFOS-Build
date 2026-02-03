/**
 * UI Hooks Index
 * 
 * Re-exports all UI hooks for convenient importing.
 */

// Input management
export {
  useInputStore,
  useInputLayer,
  useKeyboard,
  useGlobalInputHandler,
  useListNavigation,
  useTextInput,
  useFocus,
  useModal,
  type KeyEvent,
  type InputHandler,
  type InputLayer,
  type FocusContext,
} from './useInput.js';

// Rendering and terminal
export {
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
  type TerminalDimensions,
  type RenderState,
} from './useRender.js';

// Navigation
export {
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
  type Route,
  type TransitionType,
  type NavigationEvent,
  type NavigationGuard,
} from './useNavigation.js';
