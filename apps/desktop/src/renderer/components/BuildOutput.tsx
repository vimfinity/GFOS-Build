import { memo, useMemo, useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';
import { AnsiLine } from '@/lib/ansi';
import type { BuildEvent } from '@gfos-build/contracts';
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
// Helpers
// ---------------------------------------------------------------------------

const AT_BOTTOM_THRESHOLD = 32; // px from bottom to count as "at bottom"

function isScrolledToBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_THRESHOLD;
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
  /** Called when the scroll position reaches or leaves the bottom. */
  onAtBottomChange?: (isAtBottom: boolean) => void;
  /** Increment this value to imperatively scroll to the bottom. */
  scrollToBottomTrigger?: number;
  /**
   * When true, the outer card container (glass-card, border, rounded corners) is
   * omitted so the component can be embedded inside a parent card without nesting.
   */
  embedded?: boolean;
  /** When false the log starts at the top instead of auto-scrolling to the bottom. */
  startAtBottom?: boolean;
  /** Current step index — lets the component detect step changes without remounting. */
  activeStepIndex?: number;
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
  startAtBottom = true,
  activeStepIndex,
}: BuildOutputProps) {
  const lines = useMemo(() => extractLines(events), [events]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [copied, setCopied] = useState(false);
  // Track whether we should auto-scroll on new content.
  const autoScrollRef = useRef(true);
  // Timestamp of the last programmatic scroll — used to ignore spurious scroll
  // events fired by the browser before layout has fully settled.
  const lastProgrammaticScrollRef = useRef(0);

  // Scroll to the very bottom of the container.
  const scrollToEnd = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = containerRef.current;
    if (!el) return;
    lastProgrammaticScrollRef.current = Date.now();
    if (behavior === 'smooth') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // On mount, jump to the bottom before the browser paints.
  useLayoutEffect(() => {
    autoScrollRef.current = true;
    scrollToEnd('auto');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect step changes (without remounting) and scroll to the right position
  // before the browser paints — eliminates the visible flash.
  const prevStepRef = useRef(activeStepIndex);
  useLayoutEffect(() => {
    if (prevStepRef.current === activeStepIndex) return;
    prevStepRef.current = activeStepIndex;
    setCopied(false);
    lastProgrammaticScrollRef.current = Date.now();
    if (startAtBottom) {
      autoScrollRef.current = true;
      setAtBottom(true);
      onAtBottomChange?.(true);
      scrollToEnd('auto');
    } else {
      autoScrollRef.current = false;
      const el = containerRef.current;
      if (el) el.scrollTop = 0;
      setAtBottom(false);
      onAtBottomChange?.(false);
    }
  }, [activeStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Imperative scroll-to-bottom triggered by the parent (e.g. clicking the running step pill).
  useLayoutEffect(() => {
    if (!scrollToBottomTrigger) return;
    autoScrollRef.current = true;
    setAtBottom(true);
    onAtBottomChange?.(true);
    scrollToEnd('auto');
  }, [scrollToBottomTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll when new lines arrive and we're following.
  useEffect(() => {
    if (autoScrollRef.current && lines.length > 0) {
      scrollToEnd('auto');
    }
  }, [lines.length, scrollToEnd]);

  // Track scroll position to pause/resume auto-follow.
  const handleScroll = useCallback(() => {
    // Ignore scroll events shortly after a programmatic scroll — the browser
    // may fire intermediate events before layout settles.
    if (Date.now() - lastProgrammaticScrollRef.current < 80) return;
    const el = containerRef.current;
    if (!el) return;
    const bottom = isScrolledToBottom(el);
    autoScrollRef.current = bottom;
    setAtBottom(bottom);
    onAtBottomChange?.(bottom);
  }, [onAtBottomChange]);

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

      {/* ── Log lines ─────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="h-full min-h-0 overflow-y-auto"
        onScroll={handleScroll}
      >
        <div className="h-2" aria-hidden="true" />
        {lines.map((item, index) => (
          <OutputLineRow
            key={index}
            index={index}
            item={item}
            showLineNumbers={showLineNumbers}
          />
        ))}
        <div className="h-10" aria-hidden="true" />
      </div>

      {/* ── Scroll-to-bottom button ───────────────────────────────────────── */}
      {!atBottom && (
        <button
          onClick={() => scrollToEnd('smooth')}
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
