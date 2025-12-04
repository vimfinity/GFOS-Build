/**
 * Theme Configuration
 * 
 * Centralized color palette and styling constants for consistent UI.
 */

/**
 * Color palette for the application.
 */
export const colors = {
  // Primary colors (Pastel Indigo-Blue)
  primary: '#818CF8',
  primaryBright: '#A5B4FC',
  
  // Secondary colors
  secondary: 'magenta',
  secondaryBright: 'magentaBright',
  
  // Accent colors
  accent: 'yellow',
  accentBright: 'yellowBright',
  
  // Status colors
  success: 'green',
  successBright: 'greenBright',
  warning: 'yellow',
  warningBright: 'yellowBright',
  error: 'red',
  errorBright: 'redBright',
  info: 'blue',
  infoBright: 'blueBright',
  
  // Neutral colors
  text: 'white',
  textDim: 'gray',
  textMuted: 'blackBright',
  
  // Background (for inverse/badges)
  bgPrimary: 'bgCyan',
  bgSecondary: 'bgMagenta',
  bgSuccess: 'bgGreen',
  bgWarning: 'bgYellow',
  bgError: 'bgRed',
  bgInfo: 'bgBlue',
  
  // Border colors
  border: 'gray',
  borderFocus: 'cyan',
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
 */
export const icons = {
  // Navigation
  pointer: '❯',
  pointerSmall: '›',
  arrowRight: '→',
  arrowLeft: '←',
  arrowUp: '↑',
  arrowDown: '↓',
  search: '/',
  
  // Checkboxes (Square style - guaranteed same width)
  checkboxOn: '■',
  checkboxOff: '□',
  checkboxPartial: '▣',
  
  // Status
  success: '✔',
  error: '✖',
  warning: '⚠',
  info: 'ℹ',
  pending: '○',
  running: '◐',
  
  // Objects
  folder: '▪',
  file: '▫',
  package: '□',
  git: '',
  java: '◆',
  maven: '◈',
  
  // Actions
  play: '▶',
  stop: '■',
  pause: '⏸',
  refresh: '⟳',
  
  // Misc
  bullet: '•',
  dot: '·',
  star: '★',
  check: '✓',
  cross: '✗',
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
