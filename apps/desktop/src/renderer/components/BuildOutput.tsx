import { memo, useMemo, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AnsiLine } from '@/lib/ansi';
import type { BuildEvent } from '@gfos-build/contracts';
import { ChevronsDown, Copy, Check } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OutputLine {
  line: string;
  stream: 'stdout' | 'stderr';
}

function extractLines(events: BuildEvent[]): OutputLine[] {
  const lines: OutputLine[] = [];
  for (const e of events) {
    if (e.type === 'step:output') {
      lines.push({ line: e.line, stream: e.stream });
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BuildOutputProps {
  events: BuildEvent[];
  isRunning: boolean;
  /**
   * When true, a line-number gutter is rendered to the left of each output
   * line.  Defaults to false.
   */
  showLineNumbers?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BuildOutput = memo(function BuildOutput({
  events,
  isRunning,
  showLineNumbers = false,
}: BuildOutputProps) {
  const lines = useMemo(() => extractLines(events), [events]);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [copied, setCopied] = useState(false);

  const scrollToBottom = useCallback(() => {
    if (lines.length === 0) return;
    virtuosoRef.current?.scrollToIndex({
      index: lines.length - 1,
      align: 'end',
      behavior: 'smooth',
    });
  }, [lines.length]);

  async function handleCopyAll() {
    // Strip ANSI before copying to clipboard — keep only the raw text
    const text = lines.map((l) => l.line).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (lines.length === 0) {
    return (
      <div
        className="flex h-full min-h-0 flex-1 items-center justify-center rounded-[24px] border border-zinc-800/70"
        style={{ backgroundColor: 'var(--terminal-bg)', borderColor: 'var(--terminal-border)' }}
      >
        <span className="text-sm font-mono" style={{ color: 'var(--terminal-muted)' }}>
          {isRunning ? 'Starting build...' : 'No output'}
        </span>
      </div>
    );
  }

  // ── Output view ──────────────────────────────────────────────────────────
  return (
    <div
      className="relative h-full min-h-0 flex-1 overflow-hidden rounded-[24px] border border-zinc-800/70"
      style={{ backgroundColor: 'var(--terminal-bg)', borderColor: 'var(--terminal-border)' }}
    >
      {/* ── Toolbar (top-right overlay) ─────────────────────────────────── */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        <button
          onClick={() => void handleCopyAll()}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all',
            'backdrop-blur-sm border rounded-full',
            'focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
            copied
              ? 'text-emerald-500'
              : 'hover:opacity-100',
          )}
          style={{
            backgroundColor: 'var(--terminal-toolbar-bg)',
            borderColor: copied ? 'rgb(22 163 74 / 0.35)' : 'var(--terminal-toolbar-border)',
            color: copied ? undefined : 'var(--terminal-toolbar-fg)',
          }}
        >
          {copied ? (
            <>
              <Check size={11} />
              Copied
            </>
          ) : (
            <>
              <Copy size={11} />
              Copy all
            </>
          )}
        </button>
      </div>

      {/* ── Virtualized line list ─────────────────────────────────────────── */}
      <Virtuoso
        ref={virtuosoRef}
        className="h-full min-h-0"
        style={{ backgroundColor: 'var(--terminal-bg)' }}
        data={lines}
        atBottomStateChange={setAtBottom}
        followOutput={isRunning && atBottom ? 'smooth' : false}
        increaseViewportBy={{ top: 400, bottom: 800 }}
        components={{
          Header: () => <div className="h-10" aria-hidden="true" />,
          Footer: () => <div className="h-10" aria-hidden="true" />,
        }}
        itemContent={(index, item) => (
          <OutputLineRow
            index={index}
            item={item}
            showLineNumbers={showLineNumbers}
          />
        )}
      />

      {/* ── Scroll-to-bottom button ───────────────────────────────────────── */}
      {!atBottom && (
        <button
          onClick={scrollToBottom}
          className={cn(
            'absolute bottom-3 right-3 flex items-center gap-1.5',
            'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            'shadow-lg',
            'focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
          )}
          style={{
            backgroundColor: 'var(--terminal-toolbar-bg)',
            border: '1px solid var(--terminal-toolbar-border)',
            color: 'var(--terminal-toolbar-fg)',
          }}
        >
          <ChevronsDown size={12} />
          Scroll to bottom
        </button>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Individual line row — extracted to avoid closure capture issues in Virtuoso
// ---------------------------------------------------------------------------

type MavenLevel = 'info' | 'warn' | 'error' | 'debug' | 'success' | 'failure';

function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.dataset.theme === 'dark';
}

const MAVEN_TAG_RE = /^\[(INFO|WARNING|WARN|ERROR|DEBUG|FATAL)\] /;

function getTagColors(): Record<string, string> {
  return isDarkTheme()
    ? {
        INFO: '#89b4fa',
        WARNING: '#f9e2af',
        WARN: '#f9e2af',
        ERROR: '#f38ba8',
        FATAL: '#ff6e6e',
        DEBUG: '#7c7fa6',
      }
    : {
        INFO: '#1d4ed8',
        WARNING: '#a16207',
        WARN: '#a16207',
        ERROR: '#b91c1c',
        FATAL: '#991b1b',
        DEBUG: '#4b5563',
      };
}

function getKeywordColors(): Array<{ re: RegExp; color: string; bold?: boolean }> {
  return isDarkTheme()
    ? [
        { re: /BUILD SUCCESS/g, color: '#a6e3a1', bold: true },
        { re: /BUILD FAILURE/g, color: '#f38ba8', bold: true },
      ]
    : [
        { re: /BUILD SUCCESS/g, color: '#166534', bold: true },
        { re: /BUILD FAILURE/g, color: '#b91c1c', bold: true },
      ];
}

// Splits text at keyword matches and returns JSX with the keywords colored.
function renderWithKeywords(text: string): React.ReactNode {
  if (!text) return null;
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  const keywordColors = getKeywordColors();

  for (const { re, color, bold } of keywordColors) {
    if (re.test(stripped)) {
      re.lastIndex = 0; // reset
      // Since Maven doesn't ANSI-encode these keywords, positions in stripped ≈ positions in raw text
      const parts: React.ReactNode[] = [];
      let last = 0;
      let match: RegExpExecArray | null;
      const rawToSearch = text.replace(/\x1b\[[0-9;]*m/g, ''); // stripped is same text
      re.lastIndex = 0;
      while ((match = re.exec(rawToSearch)) !== null) {
        if (match.index > last) parts.push(<AnsiLine key={last} line={text.slice(last, match.index)} />);
        parts.push(
          <span key={match.index} style={{ color, fontWeight: bold ? 'bold' : undefined }}>
            {match[0]}
          </span>,
        );
        last = match.index + match[0].length;
      }
      if (last < text.length) parts.push(<AnsiLine key={last} line={text.slice(last)} />);
      return <>{parts}</>;
    }
  }

  return <AnsiLine line={text} />;
}

// Renders a terminal line with Maven tag colored and rest handled by AnsiLine + keyword coloring.
// Only the bracket tag itself (`[INFO]`, `[ERROR]`, etc.) receives a level color.
// The remainder of the line uses the terminal's default foreground color (via AnsiLine),
// except for special keywords like BUILD SUCCESS / BUILD FAILURE.
function MavenAwareLine({ line }: { line: string }): React.ReactElement {
  const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
  const tagMatch = MAVEN_TAG_RE.exec(stripped);

  if (tagMatch) {
    const rawTag  = tagMatch[1]!;         // e.g. "INFO"
    const bracket = `[${rawTag}]`;        // e.g. "[INFO]"
    const tagColor = getTagColors()[rawTag] ?? (isDarkTheme() ? '#89b4fa' : '#1d4ed8');

    // The tag has no ANSI codes around it (Maven plain-text output), so the
    // index in `stripped` is the same as in the raw line.
    const tagEnd = stripped.indexOf(bracket) + bracket.length + 1; // +1 for the space
    const rest   = line.slice(Math.min(tagEnd, line.length));

    return (
      <span>
        <span style={{ color: tagColor }}>{bracket}</span>
        {' '}
        {renderWithKeywords(rest)}
      </span>
    );
  }

  // No Maven prefix — fall through to keyword highlighting + ANSI
  return <span>{renderWithKeywords(line)}</span>;
}

// Derives the line accent (left border) class from the log level.
function getLineAccent(line: string): MavenLevel | null {
  const s = line.replace(/\x1b\[[0-9;]*m/g, '');
  if (/^\[(?:ERROR|FATAL)\] /.test(s) || /BUILD FAILURE/.test(s)) return 'error';
  if (/^\[(?:WARNING|WARN)\] /.test(s))                            return 'warn';
  if (/BUILD SUCCESS/.test(s))                                     return 'success';
  return null;
}

function OutputLineRow({
  index,
  item,
  showLineNumbers,
}: {
  index: number;
  item: OutputLine;
  showLineNumbers: boolean;
}) {
  const isStderr = item.stream === 'stderr';
  const accent   = getLineAccent(item.line);

  return (
    <div
      className="flex font-mono text-xs leading-5 whitespace-pre-wrap break-all"
      style={
        accent === 'error'
          ? {
              borderLeft: '2px solid var(--terminal-row-error-border)',
              backgroundColor: 'var(--terminal-row-error-bg)',
            }
          : accent === 'warn'
            ? {
                borderLeft: '2px solid var(--terminal-row-warn-border)',
                backgroundColor: 'var(--terminal-row-warn-bg)',
              }
            : accent === 'success'
              ? {
                  borderLeft: '2px solid var(--terminal-row-success-border)',
                  backgroundColor: 'var(--terminal-row-success-bg)',
                }
              : isStderr
                ? {
                    borderLeft: '2px solid var(--terminal-row-error-border)',
                    backgroundColor: 'var(--terminal-row-error-bg)',
                  }
                : undefined
      }
    >
      {/* ── Line number gutter ─────────────────────────────────────────── */}
      {showLineNumbers && (
        <span
          className="select-none text-right shrink-0 pr-3 text-zinc-600"
          style={{
            width: '3.5rem',
            paddingLeft: '0.5rem',
            backgroundColor: 'var(--terminal-bg)',
            borderRight: '1px solid var(--terminal-border)',
            color: 'var(--terminal-muted)',
          }}
        >
          {index + 1}
        </span>
      )}

      {/* ── Line content: Maven tag colored, rest uses AnsiLine ──────── */}
      <span
        className="flex-1 px-3 py-px"
        style={{ color: isStderr ? 'var(--terminal-stderr)' : 'var(--terminal-fg)' }}
      >
        <MavenAwareLine line={item.line.length > 0 ? item.line : ' '} />
      </span>

    </div>
  );
}
