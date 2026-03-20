import { memo, useMemo, useRef, useState, useCallback, useEffect } from 'react';
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
  /** Called (after debounce) when the scroll position reaches or leaves the bottom. */
  onAtBottomChange?: (isAtBottom: boolean) => void;
  /** Increment this value to imperatively scroll to the bottom. */
  scrollToBottomTrigger?: number;
  /**
   * When true, the outer card container (glass-card, border, rounded corners) is
   * omitted so the component can be embedded inside a parent card without nesting.
   */
  embedded?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BuildOutput = memo(function BuildOutput({
  events,
  isRunning,
  showLineNumbers = false,
  onAtBottomChange,
  scrollToBottomTrigger,
  embedded = false,
}: BuildOutputProps) {
  const lines = useMemo(() => extractLines(events), [events]);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  // Keep a ref to the latest line count so mount/trigger effects can read it
  // without declaring it as a dependency (ref identity is stable).
  const linesLengthRef = useRef(lines.length);
  linesLengthRef.current = lines.length;
  const [atBottom, setAtBottom] = useState(true);
  const [copied, setCopied] = useState(false);
  const atBottomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce atBottom=false to prevent the scroll button from flickering
  // during Virtuoso's internal layout recalculations.
  const handleAtBottomChange = useCallback((isAtBottom: boolean) => {
    if (atBottomTimer.current) clearTimeout(atBottomTimer.current);
    if (isAtBottom) {
      setAtBottom(true);
      onAtBottomChange?.(true);
    } else {
      atBottomTimer.current = setTimeout(() => {
        setAtBottom(false);
        onAtBottomChange?.(false);
      }, 120);
    }
  }, [onAtBottomChange]);

  // Scroll to the end on mount so existing content starts at the bottom.
  useEffect(() => {
    if (linesLengthRef.current > 0) {
      virtuosoRef.current?.scrollToIndex({ index: linesLengthRef.current - 1, align: 'end', behavior: 'auto' });
    }
  }, []); // mount-only: linesLengthRef is a stable ref — current value is always up-to-date

  // Cancel any pending debounce timer on unmount so it can't fire onAtBottomChange(false)
  // after this component has been replaced (e.g. when the user clicks to a different step).
  useEffect(() => () => { if (atBottomTimer.current) clearTimeout(atBottomTimer.current); }, []);

  // Imperative scroll-to-bottom triggered by the parent (e.g. clicking the running step pill).
  // Uses 'auto' (instant) instead of 'smooth' because during live streaming, new items arriving
  // cause Virtuoso to recalculate layout and interrupt smooth scroll animations.
  useEffect(() => {
    if (!scrollToBottomTrigger) return;
    virtuosoRef.current?.scrollToIndex({ index: linesLengthRef.current - 1, align: 'end', behavior: 'auto' });
  }, [scrollToBottomTrigger]); // linesLengthRef is stable; current value read at trigger time

  const scrollToBottom = useCallback(() => {
    if (lines.length === 0) return;
    virtuosoRef.current?.scrollToIndex({
      index: lines.length - 1,
      align: 'end',
      behavior: 'smooth',
    });
  }, [lines.length]);

  async function handleCopyAll() {
    const text = lines.map((l) => l.line).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (lines.length === 0) {
    return (
      <div className={cn(
        'flex h-full min-h-0 flex-1 items-center justify-center',
        !embedded && 'glass-card rounded-[24px] border border-border',
      )}>
        <span className="font-mono text-sm text-muted-foreground">
          {isRunning ? 'Starting build...' : 'No output'}
        </span>
      </div>
    );
  }

  // ── Output view ──────────────────────────────────────────────────────────
  return (
    <div className={cn(
      'relative h-full min-h-0 flex-1 overflow-hidden',
      !embedded && 'glass-card rounded-[24px] border border-border',
    )}>
      {/* ── Toolbar (top-right overlay) ─────────────────────────────────── */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        <button
          onClick={() => void handleCopyAll()}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all',
            'backdrop-blur-sm border',
            'focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
            copied
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border bg-secondary/70 text-muted-foreground hover:text-foreground',
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
        className="h-full min-h-0"
        data={lines}
        atBottomStateChange={handleAtBottomChange}
        followOutput={isRunning ? 'auto' : false}
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
            'shadow-lg border border-border bg-secondary/80 text-muted-foreground hover:text-foreground',
            'focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
          )}
        >
          <ChevronsDown size={12} />
          Scroll to bottom
        </button>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Maven tag coloring — uses design-system tokens, no dark/light checks needed
// Exported so other log viewers can reuse the same rendering logic.
// ---------------------------------------------------------------------------

export const MAVEN_TAG_CLASSES: Record<string, string> = {
  INFO:    'text-primary',
  WARNING: 'text-warning',
  WARN:    'text-warning',
  ERROR:   'text-destructive',
  FATAL:   'text-destructive',
  DEBUG:   'text-muted-foreground',
};

export const MAVEN_TAG_RE = /^\[(INFO|WARNING|WARN|ERROR|DEBUG|FATAL)\] /;
export const ANSI_SGR_RE  = new RegExp(String.raw`\u001b\[[0-9;]*m`, 'g');

export interface KeywordRule {
  re: RegExp;
  className: string;
}

export const KEYWORD_RULES: KeywordRule[] = [
  { re: /BUILD SUCCESS/, className: 'text-success font-bold' },
  { re: /BUILD FAILURE/, className: 'text-destructive font-bold' },
];

export function renderWithKeywords(text: string): React.ReactNode {
  if (!text) return null;
  // Strip ANSI codes once; all matching and slicing operates on this to avoid
  // position mismatches between the raw (with-escape) and stripped strings.
  const stripped = text.replace(ANSI_SGR_RE, '');

  for (const { re, className } of KEYWORD_RULES) {
    // Non-global test avoids mutating shared lastIndex on the stored regex.
    if (!re.test(stripped)) continue;

    // Build a fresh global copy only when the keyword is actually present.
    const globalRe = new RegExp(re.source, 'g');
    const parts: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = globalRe.exec(stripped)) !== null) {
      if (match.index > last) parts.push(<AnsiLine key={last} line={stripped.slice(last, match.index)} />);
      parts.push(<span key={match.index} className={className}>{match[0]}</span>);
      last = match.index + match[0].length;
    }
    if (last < stripped.length) parts.push(<AnsiLine key={last} line={stripped.slice(last)} />);
    return <>{parts}</>;
  }

  return <AnsiLine line={text} />;
}

export function MavenAwareLine({ line }: { line: string }): React.ReactElement {
  const stripped = line.replace(ANSI_SGR_RE, '');
  const tagMatch = MAVEN_TAG_RE.exec(stripped);

  if (tagMatch) {
    const rawTag   = tagMatch[1]!;
    const bracket  = `[${rawTag}]`;
    const tagClass = MAVEN_TAG_CLASSES[rawTag] ?? 'text-primary';
    const tagEnd   = stripped.indexOf(bracket) + bracket.length + 1;
    const rest     = line.slice(Math.min(tagEnd, line.length));

    return (
      <span>
        <span className={tagClass}>{bracket}</span>
        {' '}
        {renderWithKeywords(rest)}
      </span>
    );
  }

  return <span>{renderWithKeywords(line)}</span>;
}

// ---------------------------------------------------------------------------
// Line accent classes
// ---------------------------------------------------------------------------

export type AccentType = 'error' | 'warn' | 'success';

export const ACCENT_CLASSES: Record<AccentType, string> = {
  error:   'border-l-2 border-l-destructive/40 bg-destructive/5',
  warn:    'border-l-2 border-l-warning/40 bg-warning/5',
  success: 'border-l-2 border-l-success/40 bg-success/5',
};

export function getLineAccent(line: string): AccentType | null {
  const s = line.replace(ANSI_SGR_RE, '');
  if (/^\[(?:ERROR|FATAL)\] /.test(s) || /BUILD FAILURE/.test(s)) return 'error';
  if (/^\[(?:WARNING|WARN)\] /.test(s))                            return 'warn';
  if (/BUILD SUCCESS/.test(s))                                     return 'success';
  return null;
}

// ---------------------------------------------------------------------------
// Individual line row
// ---------------------------------------------------------------------------

function OutputLineRow({
  index,
  item,
  showLineNumbers,
}: {
  index: number;
  item: OutputLine;
  showLineNumbers: boolean;
}) {
  const isStderr  = item.stream === 'stderr';
  const accent    = getLineAccent(item.line);
  const accentClass = accent ? ACCENT_CLASSES[accent] : isStderr ? ACCENT_CLASSES.error : '';

  return (
    <div className={cn('flex font-mono text-xs leading-5 whitespace-pre-wrap break-all', accentClass)}>
      {showLineNumbers && (
        <span
          className="select-none shrink-0 text-right pr-3 pl-2 text-muted-foreground bg-secondary/50 border-r border-border"
          style={{ width: '3.5rem' }}
        >
          {index + 1}
        </span>
      )}
      <span className={cn('flex-1 px-3 py-px', isStderr ? 'text-destructive' : 'text-foreground/85')}>
        <MavenAwareLine line={item.line.length > 0 ? item.line : ' '} />
      </span>
    </div>
  );
}
