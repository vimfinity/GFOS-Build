/**
 * Theme Configuration
 * 
 * Centralized color palette and styling constants for consistent UI.
 * Primary brand color: GFOS Teal #007d8f
 */

/**
 * Color palette for the application.
 * Built around GFOS Teal (#007d8f) as the primary brand color.
 */
export const colors = {
  // Primary colors (GFOS Teal)
  primary: '#007d8f',
  primaryBright: '#00a3b8',
  primaryDim: '#005a66',
  
  // Secondary colors (Complementary warm tone)
  secondary: '#8f4500',
  secondaryBright: '#b85a00',
  
  // Accent colors (Golden highlight)
  accent: '#d4a017',
  accentBright: '#ffc107',
  
  // Status colors
  success: '#22c55e',
  successBright: '#4ade80',
  warning: '#eab308',
  warningBright: '#facc15',
  error: '#ef4444',
  errorBright: '#f87171',
  info: '#3b82f6',
  infoBright: '#60a5fa',
  
  // Neutral colors
  text: 'white',
  textDim: 'gray',
  textMuted: '#6b7280',
  
  // Background (for inverse/badges)
  bgPrimary: '#007d8f',
  bgSecondary: '#374151',
  bgSuccess: '#166534',
  bgWarning: '#854d0e',
  bgError: '#991b1b',
  bgInfo: '#1e40af',
  
  // Border colors
  border: '#4b5563',
  borderFocus: '#007d8f',
  borderDim: '#374151',
} as const;

/**
 * Box/border characters for drawing.
 */
export const borderChars = {
  // Single line
  single: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  },
  // Double line
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
  },
  // Rounded
  rounded: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
  },
} as const;

/**
 * Spacing constants.
 */
export const spacing = {
  xs: 1,
  sm: 2,
  md: 4,
  lg: 8,
} as const;

/**
 * Icon/Symbol definitions.
 * Using Unicode symbols for better visual appearance.
 */
export const icons = {
  // Navigation
  pointer: '▸',
  pointerSmall: '›',
  arrowRight: '→',
  arrowLeft: '←',
  arrowUp: '↑',
  arrowDown: '↓',
  search: '⌕',
  
  // Checkboxes (Square style - consistent width)
  checkboxOn: '◉',
  checkboxOff: '○',
  checkboxPartial: '◐',
  
  // Status
  success: '✔',
  error: '✘',
  warning: '!',
  info: 'i',
  pending: '◌',
  running: '●',
  
  // Objects
  folder: '📁',
  file: '📄',
  package: '📦',
  git: '⎇',
  java: '☕',
  maven: '◈',
  
  // Actions
  play: '▶',
  stop: '■',
  pause: '⏸',
  refresh: '↻',
  
  // Misc
  bullet: '•',
  dot: '·',
  star: '★',
  check: '✓',
  cross: '✗',
  hourglass: '⏳',
  clock: '⏱',
  gear: '⚙',
  wrench: '🔧',
  rocket: '🚀',
} as const;

/**
 * Keyboard shortcut display mappings.
 */
export const keyLabels = {
  enter: '⏎ Enter',
  escape: 'Esc',
  space: '␣ Space',
  tab: '⇥ Tab',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  q: 'Q',
  b: 'B',
  r: 'R',
  s: 'S',
  h: 'H',
} as const;

export type ColorName = keyof typeof colors;
export type IconName = keyof typeof icons;
export type BorderStyle = keyof typeof borderChars;
