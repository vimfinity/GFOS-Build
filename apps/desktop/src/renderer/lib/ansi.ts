// Parses ANSI escape codes from terminal output into renderable spans.
// Supports: basic colors (30-37, 90-97), bright colors, bold, dim, reset.
// Supports: 256-color (38;5;N), truecolor (38;2;R;G;B), bg variants.

import React from 'react';

export interface AnsiSpan {
  text: string;
  color?: string;   // CSS color string for fg (e.g. '#ff0000', 'rgb(255,0,0)')
  bgColor?: string; // CSS color string for bg
  bold?: boolean;
  dim?: boolean;
}

const ANSI_COLORS_DARK: readonly string[] = [
  '#1e1e1e', // 0  black
  '#cd3131', // 1  red
  '#0dbc79', // 2  green
  '#e5e510', // 3  yellow
  '#2472c8', // 4  blue
  '#bc3fbc', // 5  magenta
  '#11a8cd', // 6  cyan
  '#e5e5e5', // 7  white
];

const ANSI_BRIGHT_COLORS: readonly string[] = [
  '#666666', // 90 bright black (gray)
  '#f14c4c', // 91 bright red
  '#23d18b', // 92 bright green
  '#f5f543', // 93 bright yellow
  '#3b8eea', // 94 bright blue
  '#d670d6', // 95 bright magenta
  '#29b8db', // 96 bright cyan
  '#e5e5e5', // 97 bright white
];

const ANSI_COLORS_LIGHT: readonly string[] = [
  '#111827', // 0  black
  '#b91c1c', // 1  red
  '#166534', // 2  green
  '#854d0e', // 3  yellow
  '#1d4ed8', // 4  blue
  '#a21caf', // 5  magenta
  '#0f766e', // 6  cyan
  '#374151', // 7  white-ish dark gray for light surfaces
];

const ANSI_BRIGHT_COLORS_LIGHT: readonly string[] = [
  '#4b5563', // 90 bright black (gray)
  '#b91c1c', // 91 bright red
  '#166534', // 92 bright green
  '#854d0e', // 93 bright yellow
  '#1d4ed8', // 94 bright blue
  '#a21caf', // 95 bright magenta
  '#0f766e', // 96 bright cyan
  '#1f2937', // 97 bright white-ish dark gray
];

function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.dataset.theme === 'dark';
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const LIGHT_TERMINAL_BG: RgbColor = { r: 248, g: 250, b: 252 };
const MIN_LIGHT_CONTRAST = 4.5;

function getAnsiPalettes(): {
  base: readonly string[];
  bright: readonly string[];
} {
  if (isDarkTheme()) {
    return { base: ANSI_COLORS_DARK, bright: ANSI_BRIGHT_COLORS };
  }
  return { base: ANSI_COLORS_LIGHT, bright: ANSI_BRIGHT_COLORS_LIGHT };
}

function parseCssColor(color: string): RgbColor | null {
  const value = color.trim();
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1]!;
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }

  const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
    };
  }

  return null;
}

function srgbToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: RgbColor): number {
  return (
    0.2126 * srgbToLinear(color.r) +
    0.7152 * srgbToLinear(color.g) +
    0.0722 * srgbToLinear(color.b)
  );
}

function contrastRatio(a: RgbColor, b: RgbColor): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function mixWithBlack(color: RgbColor, factor: number): RgbColor {
  return {
    r: Math.round(color.r * factor),
    g: Math.round(color.g * factor),
    b: Math.round(color.b * factor),
  };
}

function toRgbString(color: RgbColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function normalizeForegroundColor(color: string): string {
  if (isDarkTheme()) return color;
  const parsed = parseCssColor(color);
  if (!parsed) return color;
  if (contrastRatio(parsed, LIGHT_TERMINAL_BG) >= MIN_LIGHT_CONTRAST) {
    return color;
  }

  let low = 0;
  let high = 1;
  let best = parsed;
  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2;
    const candidate = mixWithBlack(parsed, mid);
    if (contrastRatio(candidate, LIGHT_TERMINAL_BG) >= MIN_LIGHT_CONTRAST) {
      best = candidate;
      high = mid;
    } else {
      low = mid;
    }
  }

  return toRgbString(best);
}

/**
 * Resolve an index from the xterm 256-color palette to a CSS color string.
 *
 *  0–7    standard colors  (ANSI_COLORS_DARK)
 *  8–15   bright colors    (ANSI_BRIGHT_COLORS)
 *  16–231 6×6×6 RGB cube
 *  232–255 grayscale ramp
 */
function get256Color(n: number): string {
  const { base, bright } = getAnsiPalettes();
  if (n < 0 || n > 255) return '#e5e5e5';

  if (n < 8) return base[n];
  if (n < 16) return bright[n - 8];

  if (n < 232) {
    // 6×6×6 cube: index 16 + 36*r + 6*g + b  where r,g,b ∈ 0..5
    const idx = n - 16;
    const b = idx % 6;
    const g = Math.floor(idx / 6) % 6;
    const r = Math.floor(idx / 36);
    // Cube value mapping: 0 → 0, 1 → 95, 2 → 135, 3 → 175, 4 → 215, 5 → 255
    const toVal = (v: number): number => (v === 0 ? 0 : 55 + v * 40);
    return `rgb(${toVal(r)}, ${toVal(g)}, ${toVal(b)})`;
  }

  // Grayscale ramp: 232 → rgb(8,8,8), each step +10, up to 255 → rgb(238,238,238)
  const level = 8 + (n - 232) * 10;
  return `rgb(${level}, ${level}, ${level})`;
}

interface AnsiStyle {
  color?: string;
  bgColor?: string;
  bold?: boolean;
  dim?: boolean;
}

/**
 * Parse a single terminal output line containing ANSI escape sequences into
 * an array of AnsiSpan objects that can be rendered by React.
 */
export function parseAnsi(line: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  const { base, bright } = getAnsiPalettes();
  let style: AnsiStyle = {};
  let text = '';
  let i = 0;

  const flush = (): void => {
    if (text.length > 0) {
      const span: AnsiSpan = { text };
      if (style.color !== undefined) span.color = style.color;
      if (style.bgColor !== undefined) span.bgColor = style.bgColor;
      if (style.bold) span.bold = true;
      if (style.dim) span.dim = true;
      spans.push(span);
      text = '';
    }
  };

  while (i < line.length) {
    // Detect ESC [ (CSI — Control Sequence Introducer)
    if (line[i] === '\x1b' && i + 1 < line.length && line[i + 1] === '[') {
      const seqStart = i + 2;
      let seqEnd = seqStart;

      // Advance past digits and semicolons until we hit the final byte or a
      // character that cannot belong to the sequence.
      while (seqEnd < line.length) {
        const ch = line[seqEnd];
        if (ch === 'm') break;
        if ((ch >= '0' && ch <= '9') || ch === ';') {
          seqEnd++;
        } else {
          // Unexpected character — treat the whole ESC as literal text.
          seqEnd = line.length; // force the malformed-sequence branch below
          break;
        }
      }

      if (seqEnd < line.length && line[seqEnd] === 'm') {
        // Well-formed SGR sequence — apply it.
        flush();

        const raw = line.slice(seqStart, seqEnd);
        const codes: number[] = raw === '' ? [0] : raw.split(';').map(Number);

        let ci = 0;
        while (ci < codes.length) {
          const code = codes[ci];

          if (code === 0) {
            style = {};
          } else if (code === 1) {
            style.bold = true;
          } else if (code === 2) {
            style.dim = true;
          } else if (code === 22) {
            style.bold = undefined;
            style.dim = undefined;
          } else if (code >= 30 && code <= 37) {
            style.color = normalizeForegroundColor(base[code - 30]);
          } else if (code === 38) {
            // Extended foreground color
            const mode = codes[ci + 1];
            if (mode === 5 && ci + 2 < codes.length) {
              // 256-color: 38;5;N
              style.color = normalizeForegroundColor(get256Color(codes[ci + 2]));
              ci += 2;
            } else if (mode === 2 && ci + 4 < codes.length) {
              // Truecolor: 38;2;R;G;B
              style.color = normalizeForegroundColor(`rgb(${codes[ci + 2]}, ${codes[ci + 3]}, ${codes[ci + 4]})`);
              ci += 4;
            }
          } else if (code === 39) {
            style.color = undefined;
          } else if (code >= 40 && code <= 47) {
            style.bgColor = base[code - 40];
          } else if (code === 48) {
            // Extended background color
            const mode = codes[ci + 1];
            if (mode === 5 && ci + 2 < codes.length) {
              // 256-color: 48;5;N
              style.bgColor = get256Color(codes[ci + 2]);
              ci += 2;
            } else if (mode === 2 && ci + 4 < codes.length) {
              // Truecolor: 48;2;R;G;B
              style.bgColor = `rgb(${codes[ci + 2]}, ${codes[ci + 3]}, ${codes[ci + 4]})`;
              ci += 4;
            }
          } else if (code === 49) {
            style.bgColor = undefined;
          } else if (code >= 90 && code <= 97) {
            style.color = normalizeForegroundColor(bright[code - 90]);
          } else if (code >= 100 && code <= 107) {
            style.bgColor = bright[code - 100];
          }
          // All other codes (italic, underline, etc.) are silently ignored.

          ci++;
        }

        i = seqEnd + 1;
      } else {
        // Malformed escape sequence — emit the ESC character literally and
        // continue parsing from the character after it.
        text += line[i];
        i++;
      }
    } else {
      text += line[i];
      i++;
    }
  }

  flush();

  // If nothing was produced (empty line or purely whitespace), return a
  // single empty span so the caller can always render something.
  if (spans.length === 0) {
    return [{ text: line }];
  }

  return spans;
}

/**
 * A lightweight React component that renders a single terminal line with
 * ANSI colour/style support. Renders as an inline <span> with child spans
 * for each styled segment.
 *
 * Usage:
 *   <AnsiLine line={rawTerminalLine} />
 */
export function AnsiLine({
  line,
  className,
}: {
  line: string;
  className?: string;
}): React.ReactElement {
  const spans = parseAnsi(line);
  const darkTheme = isDarkTheme();

  return React.createElement(
    'span',
    { className },
    ...spans.map((span, idx) =>
      React.createElement(
        'span',
        {
          key: idx,
          style: {
            color: span.color,
            backgroundColor: span.bgColor,
            fontWeight: span.bold ? 'bold' : undefined,
            opacity: span.dim ? (darkTheme ? 0.72 : undefined) : undefined,
          },
        },
        span.text,
      ),
    ),
  );
}
