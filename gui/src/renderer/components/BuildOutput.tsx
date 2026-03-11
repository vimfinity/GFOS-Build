import { useEffect, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { cn } from '@/lib/utils';
import type { BuildEvent } from '@shared/types';

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

interface BuildOutputProps {
  events: BuildEvent[];
  isRunning: boolean;
}

export function BuildOutput({ events, isRunning }: BuildOutputProps) {
  const lines = extractLines(events);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Auto scroll to bottom when running and user hasn't scrolled up
  useEffect(() => {
    if (isRunning && atBottom && lines.length > 0) {
      virtuosoRef.current?.scrollToIndex({ index: lines.length - 1, behavior: 'auto' });
    }
  }, [lines.length, isRunning, atBottom]);

  if (lines.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black rounded-lg border border-zinc-800">
        <span className="text-zinc-600 text-sm font-mono">
          {isRunning ? 'Starting build…' : 'No output yet'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 rounded-lg border border-zinc-800 overflow-hidden relative">
      <Virtuoso
        ref={virtuosoRef}
        data={lines}
        className="bg-black"
        atBottomStateChange={setAtBottom}
        itemContent={(_, item) => (
          <div
            className={cn(
              'px-3 py-px font-mono text-xs leading-5 whitespace-pre-wrap break-all',
              item.stream === 'stderr' ? 'text-destructive' : 'text-green-100',
            )}
          >
            {item.line}
          </div>
        )}
      />
      {!atBottom && (
        <button
          onClick={() => virtuosoRef.current?.scrollToIndex({ index: lines.length - 1, behavior: 'smooth' })}
          className="absolute bottom-3 right-3 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded border border-zinc-600 transition-colors"
        >
          ↓ Scroll to bottom
        </button>
      )}
    </div>
  );
}
