/**
 * ANSI Parser Utility
 * Parses ANSI escape codes and converts to styled segments for React rendering
 * Supports colors, bold, dim, reset for Maven output parsing
 */

import type { LogSegment, LogStyle, AnsiColor, LogEntry } from '../types';

// ANSI color code mappings
const ANSI_COLORS: Record<number, AnsiColor> = {
  30: 'black',
  31: 'red',
  32: 'green',
  33: 'yellow',
  34: 'blue',
  35: 'magenta',
  36: 'cyan',
  37: 'white',
  90: 'brightBlack',
  91: 'brightRed',
  92: 'brightGreen',
  93: 'brightYellow',
  94: 'brightBlue',
  95: 'brightMagenta',
  96: 'brightCyan',
  97: 'brightWhite',
};

const ANSI_BG_COLORS: Record<number, AnsiColor> = {
  40: 'black',
  41: 'red',
  42: 'green',
  43: 'yellow',
  44: 'blue',
  45: 'magenta',
  46: 'cyan',
  47: 'white',
  100: 'brightBlack',
  101: 'brightRed',
  102: 'brightGreen',
  103: 'brightYellow',
  104: 'brightBlue',
  105: 'brightMagenta',
  106: 'brightCyan',
  107: 'brightWhite',
};

// CSS color values for rendering
export const ANSI_COLOR_CSS: Record<AnsiColor, string> = {
  black: '#1a1a1f',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#e5e7eb',
  brightBlack: '#6b7280',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#fbbf24',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
};

// Dark mode color overrides
export const ANSI_COLOR_CSS_DARK: Record<AnsiColor, string> = {
  black: '#1a1a1f',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#f3f4f6',
  brightBlack: '#9ca3af',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#ffffff',
};

// ANSI escape sequence regex
// Matches: ESC[...m where ... is one or more numbers separated by semicolons
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

/**
 * Parse ANSI escape codes from a string and return styled segments
 */
export function parseAnsi(text: string): LogSegment[] {
  const segments: LogSegment[] = [];
  let currentStyle: LogStyle = {};
  let lastIndex = 0;
  
  // Reset regex state
  ANSI_REGEX.lastIndex = 0;
  
  let match: RegExpExecArray | null;
  while ((match = ANSI_REGEX.exec(text)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore) {
        segments.push({ text: textBefore, style: { ...currentStyle } });
      }
    }
    
    // Parse the escape codes
    const codes = match[1].split(';').map(Number).filter(n => !isNaN(n));
    
    for (const code of codes) {
      if (code === 0) {
        // Reset all styles
        currentStyle = {};
      } else if (code === 1) {
        currentStyle.bold = true;
      } else if (code === 2) {
        currentStyle.dim = true;
      } else if (code === 3) {
        currentStyle.italic = true;
      } else if (code === 4) {
        currentStyle.underline = true;
      } else if (code === 22) {
        // Normal weight (not bold, not dim)
        currentStyle.bold = false;
        currentStyle.dim = false;
      } else if (code === 23) {
        currentStyle.italic = false;
      } else if (code === 24) {
        currentStyle.underline = false;
      } else if (code >= 30 && code <= 37) {
        currentStyle.color = ANSI_COLORS[code];
      } else if (code >= 90 && code <= 97) {
        currentStyle.color = ANSI_COLORS[code];
      } else if (code === 39) {
        // Default foreground
        currentStyle.color = undefined;
      } else if (code >= 40 && code <= 47) {
        currentStyle.bgColor = ANSI_BG_COLORS[code];
      } else if (code >= 100 && code <= 107) {
        currentStyle.bgColor = ANSI_BG_COLORS[code];
      } else if (code === 49) {
        // Default background
        currentStyle.bgColor = undefined;
      }
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) {
      segments.push({ text: remaining, style: { ...currentStyle } });
    }
  }
  
  // If no segments were created, return the original text
  if (segments.length === 0 && text) {
    segments.push({ text, style: {} });
  }
  
  return segments;
}

/**
 * Strip ANSI codes from text
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

/**
 * Detect log level from Maven output
 */
export function detectLogLevel(text: string): LogEntry['level'] {
  const stripped = stripAnsi(text).toUpperCase();
  
  if (stripped.includes('[ERROR]') || stripped.includes('FAILURE') || stripped.includes('EXCEPTION')) {
    return 'error';
  }
  if (stripped.includes('[WARNING]') || stripped.includes('[WARN]')) {
    return 'warn';
  }
  if (stripped.includes('SUCCESS') || stripped.includes('BUILD SUCCESS')) {
    return 'success';
  }
  if (stripped.includes('[DEBUG]')) {
    return 'debug';
  }
  return 'info';
}

/**
 * Create a LogEntry from raw text
 */
export function createLogEntry(rawText: string, id?: string): LogEntry {
  return {
    id: id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date(),
    rawText,
    segments: parseAnsi(rawText),
    level: detectLogLevel(rawText),
  };
}

/**
 * Get CSS styles for a LogStyle
 */
export function getStyleCSS(style: LogStyle, isDark = false): React.CSSProperties {
  const colorMap = isDark ? ANSI_COLOR_CSS_DARK : ANSI_COLOR_CSS;
  const css: React.CSSProperties = {};
  
  if (style.color) {
    css.color = colorMap[style.color];
  }
  if (style.bgColor) {
    css.backgroundColor = colorMap[style.bgColor];
    css.padding = '0 2px';
    css.borderRadius = '2px';
  }
  if (style.bold) {
    css.fontWeight = 'bold';
  }
  if (style.dim) {
    css.opacity = 0.7;
  }
  if (style.italic) {
    css.fontStyle = 'italic';
  }
  if (style.underline) {
    css.textDecoration = 'underline';
  }
  
  return css;
}

/**
 * Format timestamp for log display
 */
export function formatLogTimestamp(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

/**
 * Sample Maven output for testing
 */
export const SAMPLE_MAVEN_OUTPUT = [
  '\x1b[1;34m[INFO]\x1b[0m Scanning for projects...',
  '\x1b[1;34m[INFO]\x1b[0m ',
  '\x1b[1;34m[INFO]\x1b[0m \x1b[1m------------------------< \x1b[36mcom.gfos:gfosweb\x1b[0;1m >------------------------\x1b[0m',
  '\x1b[1;34m[INFO]\x1b[0m \x1b[1mBuilding gfosweb 4.9.0-SNAPSHOT\x1b[0m',
  '\x1b[1;34m[INFO]\x1b[0m \x1b[1m--------------------------------[ war ]--------------------------------\x1b[0m',
  '\x1b[1;34m[INFO]\x1b[0m ',
  '\x1b[1;34m[INFO]\x1b[0m \x1b[1m--- \x1b[0;32mmaven-clean-plugin:3.2.0:clean\x1b[0;1m (default-clean) @ gfosweb ---\x1b[0m',
  '\x1b[1;34m[INFO]\x1b[0m Deleting /path/to/target',
  '\x1b[1;34m[INFO]\x1b[0m ',
  '\x1b[1;34m[INFO]\x1b[0m \x1b[1m--- \x1b[0;32mmaven-compiler-plugin:3.11.0:compile\x1b[0;1m (default-compile) @ gfosweb ---\x1b[0m',
  '\x1b[1;33m[WARNING]\x1b[0m Some warning message here',
  '\x1b[1;34m[INFO]\x1b[0m Compiling 234 source files to /path/to/target/classes',
  '\x1b[1;31m[ERROR]\x1b[0m Failed to compile: SomeClass.java:45 - NullPointerException',
  '\x1b[1;34m[INFO]\x1b[0m \x1b[1;32mBUILD SUCCESS\x1b[0m',
  '\x1b[1;34m[INFO]\x1b[0m \x1b[1m------------------------------------------------------------------------\x1b[0m',
  '\x1b[1;34m[INFO]\x1b[0m Total time: 12.345 s',
];
