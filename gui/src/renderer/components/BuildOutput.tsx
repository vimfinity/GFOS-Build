import { useEffect, useRef, useState, useCallback } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { cn } from '@/lib/utils';
import { AnsiLine } from '@/lib/ansi';
import type { BuildEvent } from '@shared/types';
import { ChevronsDown, Copy, Check } from 'lucide-react';

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

export function BuildOutput({
  events,
  isRunning,
  showLineNumbers = false,
}: BuildOutputProps) {
  const lines = extractLines(events);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [copied, setCopied] = useState(false);

  // Auto-scroll when new lines arrive, as long as the user hasn't scrolled up
  useEffect(() => {
    if (isRunning && atBottom && lines.length > 0) {
      virtuosoRef.current?.scrollToIndex({
        index: lines.length - 1,
        behavior: 'auto',
      });
    }
  }, [lines.length, isRunning, atBottom]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: lines.length - 1,
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
        className="flex-1 flex items-center justify-center rounded-lg border border-zinc-800"
        style={{ backgroundColor: '#0d1117' }}
      >
        <span className="text-zinc-600 text-sm font-mono">
          {isRunning ? 'Starting build…' : 'No output'}
        </span>
      </div>
    );
  }

  // ── Output view ──────────────────────────────────────────────────────────
  return (
    <div
      className="flex-1 min-h-0 rounded-lg border border-zinc-800 overflow-hidden relative"
      style={{ backgroundColor: '#0d1117' }}
    >
      {/* ── Toolbar (top-right overlay) ─────────────────────────────────── */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        <button
          onClick={() => void handleCopyAll()}
          title="Copy all output"
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all',
            'bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/60',
            copied
              ? 'text-emerald-400 border-emerald-700/50'
              : 'text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
          )}
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
        data={lines}
        style={{ height: '100%', backgroundColor: '#0d1117' }}
        atBottomStateChange={setAtBottom}
        atBottomThreshold={80}
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
            'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            'bg-zinc-800 hover:bg-zinc-700',
            'border border-zinc-600/70 hover:border-zinc-500',
            'text-zinc-300 hover:text-zinc-100',
            'shadow-lg',
          )}
        >
          <ChevronsDown size={12} />
          Scroll to bottom
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual line row — extracted to avoid closure capture issues in Virtuoso
// ---------------------------------------------------------------------------

type MavenLevel = 'info' | 'warn' | 'error' | 'debug' | 'success' | 'failure';

const MAVEN_TAG_RE = /^\[(INFO|WARNING|WARN|ERROR|DEBUG|FATAL)\] /;

const TAG_COLORS: Record<string, string> = {
  INFO:    '#89b4fa',
  WARNING: '#f9e2af',
  WARN:    '#f9e2af',
  ERROR:   '#f38ba8',
  FATAL:   '#ff6e6e',
  DEBUG:   '#7c7fa6',
};

const KEYWORD_COLORS: Array<{ re: RegExp; color: string; bold?: boolean }> = [
  { re: /BUILD SUCCESS/g, color: '#a6e3a1', bold: true },
  { re: /BUILD FAILURE/g, color: '#f38ba8', bold: true },
  { re: /BUILD SUCCESS/g, color: '#a6e3a1', bold: true },
];

// Splits text at keyword matches and returns JSX with the keywords colored.
function renderWithKeywords(text: string): React.ReactNode {
  if (!text) return null;
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');

  for (const { re, color, bold } of KEYWORD_COLORS) {
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
    const tagColor = TAG_COLORS[rawTag] ?? '#89b4fa';

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
      className={cn(
        'flex font-mono text-xs leading-5 whitespace-pre-wrap break-all',
        isStderr && !accent && 'border-l-2 border-red-900/60 bg-red-950/10',
        accent === 'error'   ? 'border-l-2 border-red-800/50 bg-red-950/10'  :
        accent === 'warn'    ? 'border-l-2 border-amber-700/40'              :
        accent === 'success' ? 'border-l-2 border-emerald-700/50'            :
        null,
      )}
    >
      {/* ── Line number gutter ─────────────────────────────────────────── */}
      {showLineNumbers && (
        <span
          className="select-none text-right shrink-0 pr-3 text-zinc-600"
          style={{
            width: '3.5rem',
            paddingLeft: '0.5rem',
            backgroundColor: '#0d1117',
            borderRight: '1px solid rgba(48,54,61,0.6)',
          }}
        >
          {index + 1}
        </span>
      )}

      {/* ── Line content: Maven tag colored, rest uses AnsiLine ──────── */}
      <span
        className="flex-1 px-3 py-px"
        style={{ color: isStderr ? '#fca5a5' : '#d1fae5' }}
      >
        <MavenAwareLine line={item.line} />
      </span>

    </div>
  );
}
