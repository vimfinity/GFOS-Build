/**
 * Professional Theme System
 * 
 * Design tokens and theme configuration inspired by modern CLI tools.
 * Provides consistent styling across the entire application.
 */

// ============================================================================
// Color Palette
// ============================================================================

/**
 * Primary brand color - GFOS Teal
 */
export const PRIMARY_COLOR = '#007d8f';
export const PRIMARY_COLOR_BRIGHT = '#00a5b8';

/**
 * Base color tokens - semantic colors for the UI
 */
export const palette = {
  // Grayscale
  black: '#0a0a0a',
  gray900: '#171717',
  gray800: '#262626',
  gray700: '#3f3f46',
  gray600: '#52525b',
  gray500: '#71717a',
  gray400: '#a1a1aa',
  gray300: '#d4d4d8',
  gray200: '#e4e4e7',
  gray100: '#f4f4f5',
  white: '#fafafa',

  // Simple color names for convenience
  red: 'red',
  green: 'green',
  blue: 'blue',
  yellow: 'yellow',
  cyan: 'cyan',
  magenta: 'magenta',

  // Primary - GFOS Teal (#007d8f)
  primary: PRIMARY_COLOR,
  primaryBright: PRIMARY_COLOR_BRIGHT,
  primary900: '#004d5a',
  primary800: '#005c6b',
  primary700: '#006b7d',
  primary600: PRIMARY_COLOR,
  primary500: '#009aad',
  primary400: PRIMARY_COLOR_BRIGHT,
  primary300: '#5cc8d6',
  primary200: '#99dbe5',
  primary100: '#d4f0f4',

  // Success - Green
  success700: '#15803d',
  success600: '#16a34a',
  success500: '#22c55e',
  success400: '#4ade80',
  success300: '#86efac',

  // Warning - Amber
  warning700: '#b45309',
  warning600: '#d97706',
  warning500: '#f59e0b',
  warning400: '#fbbf24',
  warning300: '#fcd34d',

  // Error - Red
  error700: '#b91c1c',
  error600: '#dc2626',
  error500: '#ef4444',
  error400: '#f87171',
  error300: '#fca5a5',

  // Info - Blue
  info700: '#1d4ed8',
  info600: '#2563eb',
  info500: '#3b82f6',
  info400: '#60a5fa',
  info300: '#93c5fd',

  // Accent - Cyan
  accent700: '#0e7490',
  accent600: '#0891b2',
  accent500: '#06b6d4',
  accent400: '#22d3ee',
  accent300: '#67e8f9',
} as const;

// ============================================================================
// Semantic Theme
// ============================================================================

/**
 * Semantic color assignments for UI elements
 */
export const theme = {
  // Text colors
  text: {
    primary: 'white',
    secondary: 'gray',
    muted: 'blackBright',
    inverse: 'black',
    accent: PRIMARY_COLOR,
    link: 'blueBright',
  },

  // Background colors (ink background colors)
  bg: {
    base: undefined, // Terminal default
    elevated: 'bgBlack',
    overlay: 'bgBlack',
    hover: 'bgBlackBright',
    active: 'bgBlue',
    selected: 'bgBlue',
    selection: 'bgBlackBright',
  },

  // Border colors
  border: {
    default: 'gray',
    focus: PRIMARY_COLOR,
    active: PRIMARY_COLOR_BRIGHT,
    muted: 'blackBright',
  },

  // Status colors
  status: {
    success: 'green',
    successBright: 'greenBright',
    warning: 'yellow',
    warningBright: 'yellowBright',
    error: 'red',
    errorBright: 'redBright',
    info: 'blue',
    infoBright: 'blueBright',
    pending: 'yellow',
    running: 'blue',
  },

  // Interactive element colors
  interactive: {
    default: 'white',
    hover: PRIMARY_COLOR_BRIGHT,
    active: PRIMARY_COLOR,
    disabled: 'blackBright',
    focus: PRIMARY_COLOR,
  },

  // Accent colors for highlights
  accent: {
    primary: PRIMARY_COLOR,
    primaryBright: PRIMARY_COLOR_BRIGHT,
    secondary: 'magenta',
    secondaryBright: 'magentaBright',
  },
} as const;

// ============================================================================
// Icons & Symbols
// ============================================================================

/**
 * Unicode symbols for consistent iconography
 * Using ASCII/Unicode without emojis for professional CLI look
 */
export const icons = {
  // ─────────────────────────────────────────────────────────────────────────
  // Navigation - Elegantere Unicode-Zeichen
  // ─────────────────────────────────────────────────────────────────────────
  pointer: '>',           // Statt '>'
  pointerSmall: '›',      // Subtiler
  pointerActive: '▶',     // Für aktive Auswahl

  arrowRight: '→',        // Statt '->'
  arrowLeft: '←',
  arrowUp: '↑',
  arrowDown: '↓',
  arrowReturn: '↵',       // Für "zurück"

  chevronRight: '›',
  chevronLeft: '‹',
  chevronDown: '⌄',       // Statt 'v'
  chevronUp: '⌃',

  doubleRight: '»',       // Für Breadcrumbs
  doubleLeft: '«',

  expand: '▸',            // Collapsed tree node
  collapse: '▾',          // Expanded tree node

  // ─────────────────────────────────────────────────────────────────────────
  // Status Indicators - Professioneller Look
  // ─────────────────────────────────────────────────────────────────────────
  success: '✓',           // Statt '[ok]'
  error: '✗',             // Statt '[x]'  
  warning: '⚠\uFE0E',           // Statt '[!]'
  info: 'i',              // Statt '[i]'

  pending: '○',           // Leer, wartend
  running: '◐',           // Halb gefüllt = in Arbeit
  complete: '●',          // Voll = fertig
  cancelled: '⊘',         // Durchgestrichen
  skipped: '⊖',           // Minus im Kreis
  queued: '◌',            // Gepunktet = in Warteschlange

  // Alternative: Noch minimalistischer
  statusMinimal: {
    success: '·',         // Punkt = OK (unauffällig)
    error: '×',           // Klein X
    warning: '!',
    info: '›',
    pending: ' ',
    running: '~',
  },

  // Mit Klammern für bessere Lesbarkeit in Listen
  statusBracketed: {
    success: '[✓]',
    error: '[✗]',
    warning: '[!]',
    info: '[i]',
    pending: '[·]',
    running: '[~]',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Selection Controls
  // ─────────────────────────────────────────────────────────────────────────
  radioOn: '◉',           // Gefüllter Radio
  radioOff: '○',          // Leerer Radio

  checkOn: '◼',           // Gefüllte Box (oder ▣)
  checkOff: '□',          // Leere Box
  checkMixed: '▪',        // Teilweise ausgewählt

  // Alternative: Mit Klammern
  checkBracketOn: '[×]',  // Einfaches ASCII X
  checkBracketOff: '[ ]',

  // Toggle Switch Style
  toggleOn: '●━',
  toggleOff: '━○',

  // ─────────────────────────────────────────────────────────────────────────
  // Inline Markers & Bullets
  // ─────────────────────────────────────────────────────────────────────────
  bullet: '•',            // Standard Bullet
  bulletSmall: '·',       // Kleiner Punkt
  bulletHollow: '◦',      // Hollow Bullet
  dash: '─',              // Gedankenstrich
  ellipsis: '…',          // Auslassung
  separator: '│',         // Vertikale Trennung

  // List markers für verschiedene Ebenen
  listL1: '•',
  listL2: '◦',
  listL3: '‣',
  listL4: '·',

  // ─────────────────────────────────────────────────────────────────────────
  // File System & Structure
  // ─────────────────────────────────────────────────────────────────────────
  folder: '▸',            // Collapsed
  folderOpen: '▾',        // Expanded  
  folderIcon: '◫',        // Als Icon
  file: '○',              // Neutral
  fileIcon: '◻',          // Als Icon
  fileFilled: '●',        // Für aktive Datei

  // Tree Structure
  tree: {
    pipe: '│',
    branch: '├',
    corner: '└',
    dash: '─',
    blank: ' ',
  },

  // Alternative Tree (mit Abstand)
  treeSpaced: {
    pipe: '│  ',
    branch: '├─ ',
    corner: '└─ ',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UI Elements
  // ─────────────────────────────────────────────────────────────────────────
  menu: '≡',              // Hamburger
  more: '⋯',              // Horizontal ellipsis
  moreVert: '⋮',          // Vertical ellipsis (kebab)

  search: '⌕',            // Lupe
  filter: '⧩',            // Filter
  sort: '↕',              // Sort bidirectional
  sortAsc: '↑',
  sortDesc: '↓',

  refresh: '↻',           // Reload
  sync: '⇄',              // Bidirectional sync

  close: '×',             // Schließen
  add: '+',               // Hinzufügen
  remove: '−',            // Entfernen (echtes Minus)

  edit: '✎',              // Bearbeiten
  view: '◎',              // Ansehen
  copy: '⧉',              // Kopieren

  pin: '⌃',               // Anpinnen
  pinned: '⌃',

  link: '↗',              // Externer Link
  anchor: '#',            // Interner Link/Anchor

  // ─────────────────────────────────────────────────────────────────────────
  // Development & Build
  // ─────────────────────────────────────────────────────────────────────────
  git: '⎇',               // Branch Symbol
  branch: '⎇',
  merge: '⎌',
  commit: '◆',
  tag: '⚑',

  play: '▶',              // Start/Run
  pause: '❚❚',            // Pause (zwei Balken)
  stop: '■',              // Stop

  build: '⚙',             // Build/Compile
  test: '◈',              // Test
  deploy: '▲',            // Deploy (wie Vercel)

  terminal: '>_',         // Terminal prompt
  code: '</>',            // Code

  // Tech Icons (stilisiert)
  java: '◆',              // Oder 'J'
  maven: '◈',             // Oder 'M'  
  gradle: '▷',
  docker: '◫',

  // ─────────────────────────────────────────────────────────────────────────
  // Time & Progress
  // ─────────────────────────────────────────────────────────────────────────
  clock: '◷',
  timer: '⏱',
  calendar: '▦',

  // ─────────────────────────────────────────────────────────────────────────
  // Priority & Importance
  // ─────────────────────────────────────────────────────────────────────────
  star: '★',
  starEmpty: '☆',
  starHalf: '⯪',

  flagged: '⚑',
  unflagged: '⚐',

  priorityHigh: '↑',
  priorityMedium: '→',
  priorityLow: '↓',

  // ─────────────────────────────────────────────────────────────────────────
  // Box Drawing - Verschiedene Stile
  // ─────────────────────────────────────────────────────────────────────────

  // Rounded (Modern, Default)
  box: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    cross: '┼',
    teeRight: '├',
    teeLeft: '┤',
    teeDown: '┬',
    teeUp: '┴',
  },

  // Sharp (Klassisch)
  boxSharp: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    cross: '┼',
    teeRight: '├',
    teeLeft: '┤',
    teeDown: '┬',
    teeUp: '┴',
  },

  // Heavy (Für Betonung)
  boxHeavy: {
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
    horizontal: '━',
    vertical: '┃',
    cross: '╋',
    teeRight: '┣',
    teeLeft: '┫',
    teeDown: '┳',
    teeUp: '┻',
  },

  // Double (Für wichtige Elemente)
  boxDouble: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    cross: '╬',
    teeRight: '╠',
    teeLeft: '╣',
    teeDown: '╦',
    teeUp: '╩',
  },

  // ASCII Fallback
  boxAscii: {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
    cross: '+',
    teeRight: '+',
    teeLeft: '+',
    teeDown: '+',
    teeUp: '+',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Block Characters
  // ─────────────────────────────────────────────────────────────────────────
  blocks: {
    full: '█',
    dark: '▓',
    medium: '▒',
    light: '░',
    empty: ' ',

    upper: '▀',
    lower: '▄',
    left: '▌',
    right: '▐',

    // Für Pixelgrafik
    quadrants: {
      upperLeft: '▘',
      upperRight: '▝',
      lowerLeft: '▖',
      lowerRight: '▗',
      diagonal: '▚',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Progress Indicators
  // ─────────────────────────────────────────────────────────────────────────
  progress: {
    filled: '█',
    empty: '░',
    partial: ['▏', '▎', '▍', '▌', '▋', '▊', '▉'],

    // Alternativer Stil
    bar: '━',
    barEmpty: '─',
    barStart: '╺',
    barEnd: '╸',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Spinners (Animiert)
  // ─────────────────────────────────────────────────────────────────────────
  spinners: {
    // Braille Dots (Smooth, Default)
    dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],

    // Braille Bars
    bars: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],

    // Klassische Linie
    line: ['|', '/', '─', '\\'],

    // Kreis-Viertel
    circle: ['◐', '◓', '◑', '◒'],

    // Wachsende Punkte
    grow: ['·', '•', '●', '•'],

    // Bogen
    arc: ['◜', '◠', '◝', '◞', '◡', '◟'],

    // Quadranten
    quad: ['◴', '◷', '◶', '◵'],

    // Blöcke
    blocks: ['▖', '▘', '▝', '▗'],

    // Pfeile
    arrows: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],

    // Bouncing
    bounce: ['⠁', '⠂', '⠄', '⠂'],

    // Minimal
    minimal: ['-', '\\', '|', '/'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Backward Compatibility Aliases
  // ─────────────────────────────────────────────────────────────────────────

  // Legacy icon names used throughout the app
  selected: '◼',           // Alias for checkOn
  unselected: '□',         // Alias for checkOff
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const,  // Alias for spinners.dots
  pipeline: '*',           // Neutral, kein Emoji
  module: '◫',             // Alias for folderIcon
  home: '~',               // Home icon
  nav: '#',                // Navigation icon
  jobs: '▸',               // Jobs list icon
  logs: '≡',               // Logs/menu icon
  help: '?',               // Help icon
  settings: '*',           // Neutral, kein Emoji

  // Progress bar characters
  progressFilled: '█',
  progressEmpty: '░',

  // Checkbox icons
  check: '✓',              // Legacy check icon
  checkboxOn: '◼',
  checkboxOff: '□',
  checkboxPartial: '▪',

} as const;

// ============================================================================
// Keyboard Symbols (Konsolidiert - vorher doppelt)
// ============================================================================

export const keys = {
  // Aktionstasten
  enter: '↵',             // Oder '⏎'
  escape: 'esc',
  tab: '⇥',
  space: '␣',
  backspace: '⌫',
  delete: '⌦',

  // Pfeiltasten
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',

  // Modifikatoren
  ctrl: '^',              // Kurz, Unix-Style
  alt: 'alt',
  shift: '⇧',
  meta: '⌘',              // Mac

  // Kombinationen
  separator: '+',         // z.B. "^+c" für Ctrl+C
  or: '/',                // z.B. "↑/↓"

  // Plattform-spezifisch
  platforms: {
    mac: {
      ctrl: '⌃',
      alt: '⌥',
      shift: '⇧',
      meta: '⌘',
    },
    windows: {
      ctrl: 'Ctrl',
      alt: 'Alt',
      shift: 'Shift',
      meta: 'Win',
    },
    unix: {
      ctrl: '^',
      alt: 'M-',           // Meta prefix
      shift: 'S-',
      meta: 's-',          // Super
    },
  },
} as const;

// ============================================================================
// Progress Bar Styles (Erweitert)
// ============================================================================

export const progressBars = {
  // Modern Block
  block: {
    filled: '█',
    empty: '░',
    partial: ['░', '▒', '▓'],
    left: '',
    right: '',
  },

  // Smooth Line
  line: {
    filled: '━',
    empty: '─',
    partial: ['╺', '━'],
    left: '',
    right: '',
  },

  // Dots
  dots: {
    filled: '●',
    empty: '○',
    partial: ['◐', '◑'],
    left: '',
    right: '',
  },

  // Bracketed
  bracketed: {
    filled: '■',
    empty: '·',
    partial: ['▪'],
    left: '[',
    right: ']',
  },

  // Minimal
  minimal: {
    filled: '=',
    empty: ' ',
    partial: ['-'],
    left: '[',
    right: ']',
  },

  // Gradient
  gradient: {
    chars: ['░', '▒', '▓', '█'],
    empty: ' ',
    left: '',
    right: '',
  },
} as const;

// ============================================================================
// Semantic Badge/Label Prefixes
// ============================================================================

export const badges = {
  // Status Badges
  success: { icon: '✓', left: '[', right: ']' },
  error: { icon: '✗', left: '[', right: ']' },
  warning: { icon: '!', left: '[', right: ']' },
  info: { icon: 'i', left: '[', right: ']' },

  // Type Badges  
  new: { text: 'NEW', left: '«', right: '»' },
  beta: { text: 'β', left: '(', right: ')' },
  deprecated: { text: 'DEP', left: '[', right: ']' },

  // Count Badges
  count: { left: '(', right: ')' },

  // Tag Style
  tag: { left: '‹', right: '›' },
} as const;

// ============================================================================
// Dividers & Separators
// ============================================================================

export const dividers = {
  // Horizontale Linien
  thin: '─',
  thick: '━',
  double: '═',
  dotted: '┄',
  dashed: '┈',

  // Dekorative Linien
  fancy: '─────────────────────────',
  wave: '〰〰〰〰〰〰〰〰〰〰〰〰',

  // Mit Text
  withText: (text: string, char = '─', width = 40) => {
    const padding = Math.max(0, (width - text.length - 2) / 2);
    const line = char.repeat(Math.floor(padding));
    return `${line} ${text} ${line}`;
  },
} as const;

/**
 * Keyboard shortcuts for display
 */
export const keyboard = {
  enter: '⏎',
  escape: 'Esc',
  tab: '⇥',
  space: '␣',
  backspace: '⌫',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: '⇧',
} as const;

// ============================================================================
// Typography
// ============================================================================

/**
 * Text styling presets
 */
export const typography = {
  // Heading styles (using bold + colors)
  h1: { bold: true, color: 'white' as const },
  h2: { bold: true, color: 'gray' as const },
  h3: { bold: false, color: 'white' as const },

  // Body text
  body: { color: 'white' as const },
  bodyMuted: { color: 'gray' as const },
  bodyDim: { color: 'blackBright' as const },

  // Code/mono
  code: { color: 'green' as const },

  // Labels
  label: { color: 'gray' as const },
  labelActive: { color: 'white' as const },
} as const;

// ============================================================================
// Spacing & Layout
// ============================================================================

/**
 * Spacing scale
 */
export const spacing = {
  none: 0,
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 6,
  xxl: 8,
} as const;

/**
 * Common layout constraints
 */
export const layout = {
  maxContentWidth: 120,
  sidebarWidth: 30,
  minPanelWidth: 20,
  headerHeight: 3,
  footerHeight: 1,
  statusBarHeight: 1,
} as const;

// ============================================================================
// Animation Timing
// ============================================================================

/**
 * Animation frame rates and durations
 */
export const animation = {
  spinnerInterval: 80,
  progressInterval: 100,
  fadeInterval: 50,
  debounceMs: 150,
  throttleMs: 16, // ~60fps
  pulseInterval: 400,
  sparkleInterval: 120,
} as const;

// ============================================================================
// Animated Spinners
// ============================================================================

/**
 * Different spinner styles for various contexts
 */
export const spinners = {
  // Classic dots spinner (default)
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],

  // Braille dots
  braille: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],

  // Simple line spinner
  line: ['|', '/', '-', '\\'],

  // Bouncing ball
  bounce: ['⠁', '⠂', '⠄', '⠂'],

  // Growing dots
  grow: ['·', '•', '●', '•'],

  // Arc spinner
  arc: ['◜', '◠', '◝', '◞', '◡', '◟'],

  // Circle quarters
  circle: ['◴', '◷', '◶', '◵'],

  // Sparkle effect - like stars twinkling ✨
  sparkle: ['✦', '✧', '✦', '✧', '★', '✧', '✦', '✦', '✧', '✶'],

  // Pulse/breathing effect - expanding and contracting
  pulse: ['○', '◎', '●', '◉', '●', '◎', '○', '·'],

  // Breathing with blocks
  breathe: ['░', '▒', '▓', '█', '▓', '▒', '░', ' '],

  // Stars sparkle
  stars: ['✧', '✦', '✧', '★', '✧', '✦', '✧', '☆'],

  // Loading bar segments
  loading: ['▱▱▱', '▰▱▱', '▰▰▱', '▰▰▰', '▱▰▰', '▱▱▰', '▱▱▱'],

  // Dots expanding
  expand: ['   ', '.  ', '.. ', '...', ' ..', '  .', '   '],

  // Arrow bounce
  arrow: ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'],

  // Block building
  blocks: ['▖', '▘', '▝', '▗'],

  // Flip effect
  flip: ['_', '_', '_', '-', '`', '`', "'", '´', '-', '_', '_', '_'],
} as const;

// ============================================================================
// ASCII Art Logo
// ============================================================================

/**
 * GFOS Build ASCII Art Logo
 * Uses block characters for a clean, modern look
 */
export const LOGO = [
  ' ██████╗ ███████╗ ██████╗ ███████╗',
  '██╔════╝ ██╔════╝██╔═══██╗██╔════╝',
  '██║  ███╗█████╗  ██║   ██║███████╗',
  '██║   ██║██╔══╝  ██║   ██║╚════██║',
  '╚██████╔╝██║     ╚██████╔╝███████║',
  ' ╚═════╝ ╚═╝      ╚═════╝ ╚══════╝',
  '   ░▒▓█ B U I L D   T O O L █▓▒░  ',
] as const;

/**
 * Compact logo for smaller displays
 */
export const LOGO_COMPACT = [
  '┌──────────────────────────┐',
  '│    GFOS Build Manager    │',
  '└──────────────────────────┘',
] as const;

// ============================================================================
// Mascots - "Buildy" the Builder Bot
// ============================================================================

/**
 * GFOS Build Mascot - "Buildy" the cute Builder Bot
 * A pixel-art style robot with a hard hat, inspired by retro games
 * Multiple expressions for different states
 */
export const MASCOTS = {
  // ─────────────────────────────────────────────────────────────────────────
  // Neutral - Friendly idle state
  // ─────────────────────────────────────────────────────────────────────────


  neutral: [
    '  ▄▀   ▀▄  ',
    ' ▄█▀▀█▀▀█▄ ',
    ' █ ▓   ▓ █ ',
    ' █▄  ▄  ▄█ ',
    '  ▀▀   ▀▀  '
  ],


  // ─────────────────────────────────────────────────────────────────────────
  // Working - Active/busy state with animated elements
  // ─────────────────────────────────────────────────────────────────────────
  working: [
    '  ▄▀   ▀▄  ',
    ' ▄█▀▀█▀▀█▄ ',
    ' █ ▓▒ ▓▒ █ ',
    ' █▄  ω  ▄█ ',
    '  ▀▀   ▀▀  '
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Happy - Success/celebration state
  // ─────────────────────────────────────────────────────────────────────────
  happy: [
    ' ✦▄▀   ▀▄✦',
    ' ▄█▀▀█▀▀█▄ ',
    ' █ ^   ^ █ ',
    ' █▄▀ ᵕ ▀▄█ ',
    '  ▀▀   ▀▀  '
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Thinking - Processing/loading state
  // ─────────────────────────────────────────────────────────────────────────
  thinking: [
    '  ▄▀   ▀▄  ',
    ' ▄█▀▀█▀▀█▄ ',
    ' █ ▓   ▒ █ ',
    ' █▄ ▄▀▄ ▄█ ',
    '  ▀▀   ▀▀  '
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Error - Something went wrong
  // ─────────────────────────────────────────────────────────────────────────
  error: [
    ' !▄▀   ▀▄! ',
    ' ▄█▀▀█▀▀█▄ ',
    ' █ x   x █ ',
    ' █▄ ▄▀▄ ▄█ ',
    '  ▀▀   ▀▀  '
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Waving - Welcome/greeting pose
  // ─────────────────────────────────────────────────────────────────────────
  waving: [
    ' ▀▄     ▄▀ ╱',
    ' ▄█▀▀█▀▀█▄╱',
    ' █ ▓   ▓ █ ',
    ' █▄  ᵕ  ▄█ ',
    '  ▀▀   ▀▀  '
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Sleeping - Idle/inactive state
  // ─────────────────────────────────────────────────────────────────────────
  sleeping: [
    '  ▄▀   ▀▄ Zzz',
    ' ▄█▀▀█▀▀█▄ ',
    ' █ ─   ─ █ ',
    ' █▄  ▄  ▄█ ',
    '  ▀▀   ▀▀  '
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Mini mascot for compact displays
  // ─────────────────────────────────────────────────────────────────────────
  mini: [
    ' █ ─   ─ █ ',
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Animated frames for working state
  // ─────────────────────────────────────────────────────────────────────────
  workingFrames: [
    // Frame 1 - Eyes left, gear spinning
    [
      ' ▀▄     ▄▀ ',
      ' ▄█▀▀█▀▀█▄ ',
      ' █ ▓▒ ▓▒ █ ',
      ' █▄  ▄  ▄█ ',
      '  ▀▀   ▀▀  '
    ],
    // Frame 2 - Eyes center
    [
      ' ▀▄     ▄▀ ',
      ' ▄█▀▀█▀▀█▄ ',
      ' █ ▓▓ ▓▓ █ ',
      ' █▄  ▄  ▄█ ',
      '  ▀▀   ▀▀  '
    ],
    // Frame 3 - Eyes right
    [
      ' ▀▄     ▄▀ ',
      ' ▄█▀▀█▀▀█▄ ',
      ' █ ▒▓ ▒▓ █ ',
      ' █▄  ▄  ▄█ ',
      '  ▀▀   ▀▀  '
    ],
    // Frame 4 - Blink
    [
      '  ▄▀   ▀▄  ',
      ' ▄█▀▀█▀▀█▄ ',
      ' █ ▀▀ ▀▀ █ ',
      ' █▄  ▄  ▄█ ',
      '  ▀▀   ▀▀  '
    ],
  ],
};

// ============================================================================
// Note: SCENERY elements have been moved to SetupWizardView.tsx
// The MASCOTS above are kept for reuse throughout the application.
// ============================================================================

// ============================================================================
// Re-export for convenience
// ============================================================================

export { colors } from '../theme.js';

// Default export for easy importing
export default {
  palette,
  theme,
  icons,
  typography,
  spacing,
  layout,
  keys,
  keyboard,
  animation,
  LOGO,
  LOGO_COMPACT,
};
