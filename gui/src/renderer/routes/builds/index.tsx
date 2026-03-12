import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { buildsQuery, buildLogsQuery, useClearBuildLogs, useClearAllBuilds } from '@/api/queries';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn, formatDuration, timeAgo } from '@/lib/utils';
import { useState } from 'react';
import {
  Hammer, Loader2, ExternalLink, Search, AlertCircle, X,
  ScrollText, ChevronDown, ChevronUp, Trash2, FileX, Workflow,
} from 'lucide-react';
import type { BuildRunRowApi, BuildLogEntry } from '@shared/api';
import { AnsiLine } from '@/lib/ansi';

export const Route = createFileRoute('/builds/')({
  component: BuildsView,
});

// ---------------------------------------------------------------------------
// Grouping logic
// ---------------------------------------------------------------------------

interface PipelineGroup {
  type: 'pipeline';
  pipelineName: string;
  steps: BuildRunRowApi[];   // chronological order (step_index 0 → N)
  startedAt: string;
  finishedAt: string | null;
}

interface StandaloneItem {
  type: 'standalone';
  row: BuildRunRowApi;
}

type GroupedItem = PipelineGroup | StandaloneItem;

function deriveGroupStatus(steps: BuildRunRowApi[]): string {
  if (steps.some((s) => s.status === 'running')) return 'running';
  if (steps.some((s) => s.status === 'failed'))  return 'failed';
  if (steps.every((s) => s.status === 'success')) return 'success';
  return steps[steps.length - 1]?.status ?? 'running';
}

/** Groups rows newest-first into pipeline runs (grouped by pipeline+sequential steps) and ad-hoc rows. */
function groupBuilds(rows: BuildRunRowApi[]): GroupedItem[] {
  // rows arrive newest-first; reverse so we scan chronologically
  const chronological = [...rows].reverse();
  const resultChron: GroupedItem[] = [];
  const openGroups   = new Map<string, PipelineGroup>();

  for (const row of chronological) {
    if (row.pipeline_name !== null && row.step_index !== null) {
      if (row.step_index === 0) {
        const group: PipelineGroup = {
          type: 'pipeline',
          pipelineName: row.pipeline_name,
          steps: [row],
          startedAt: row.started_at,
          finishedAt: row.finished_at,
        };
        openGroups.set(row.pipeline_name, group);
        resultChron.push(group);
      } else {
        const group = openGroups.get(row.pipeline_name);
        if (group) {
          group.steps.push(row);
          if (row.finished_at) group.finishedAt = row.finished_at;
        } else {
          // Orphaned step (no opening step:0 in this batch) — show standalone
          resultChron.push({ type: 'standalone', row });
        }
      }
    } else {
      resultChron.push({ type: 'standalone', row });
    }
  }

  return resultChron.reverse(); // back to newest-first for display
}

// ---------------------------------------------------------------------------
// Filter constants
// ---------------------------------------------------------------------------

const STATUS_PILLS = ['All', 'Success', 'Failed', 'Running'] as const;
type StatusFilter   = (typeof STATUS_PILLS)[number];

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

function BuildsView() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [searchText,   setSearchText]   = useState('');
  const queryClient = useQueryClient();
  const { data: builds, isLoading, isError } = useQuery(buildsQuery({ limit: 200 }));
  const clearLogs = useClearBuildLogs();
  const clearAll  = useClearAllBuilds();

  const activeBuilds = builds?.filter((b) => b.status === 'running') ?? [];
  const pastBuilds   = builds?.filter((b) => b.status !== 'running') ?? [];

  const hasFilters = statusFilter !== 'All' || searchText.trim() !== '';

  const filtered = pastBuilds.filter((b) => {
    if (statusFilter !== 'All' && b.status !== statusFilter.toLowerCase()) return false;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      if (
        !(b.pipeline_name ?? '').toLowerCase().includes(q) &&
        !b.project_name.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const grouped = groupBuilds(filtered);

  function clearFilters() {
    setStatusFilter('All');
    setSearchText('');
  }

  async function handleClearLogs() {
    if (!window.confirm('Delete all stored log lines? Build metadata and stats will be kept.')) return;
    await clearLogs.mutateAsync();
    await queryClient.invalidateQueries({ queryKey: ['builds'] });
  }

  async function handleClearAll() {
    if (!window.confirm('Delete ALL build history including stats? This cannot be undone.')) return;
    await clearAll.mutateAsync();
    await queryClient.invalidateQueries({ queryKey: ['builds'] });
  }

  return (
    <div className="p-6 flex flex-col gap-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Hammer size={18} className="text-primary" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">Builds</h1>
          <p className="text-xs text-muted-foreground">
            {builds?.length ?? 0} total builds recorded
          </p>
        </div>

        {/* Clear history controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void handleClearLogs()}
            disabled={clearLogs.isPending || !builds?.length}
            title="Clear stored logs — keeps build metadata for stats"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileX size={12} />
            Clear logs
          </button>
          <button
            onClick={() => void handleClearAll()}
            disabled={clearAll.isPending || !builds?.length}
            title="Clear all build history and stats"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-destructive/40 text-destructive/70 hover:text-destructive hover:border-destructive/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} />
            Clear all
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
          <Loader2 size={14} className="animate-spin" />
          <span>Loading builds…</span>
        </div>
      ) : isError ? (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <AlertCircle size={16} className="text-destructive shrink-0" />
          <span className="text-destructive">
            Failed to load builds. Check that the server is running.
          </span>
        </div>
      ) : (
        <>
          {/* Active builds */}
          {activeBuilds.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active builds ({activeBuilds.length})
              </h2>
              <div className="grid gap-2 grid-cols-1 lg:grid-cols-2">
                {activeBuilds.map((b) => (
                  <Link
                    key={b.id}
                    to="/builds/$jobId"
                    params={{ jobId: String(b.id) }}
                    className="block"
                  >
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                      <CardContent className="p-3 flex items-center gap-3">
                        <Loader2 size={14} className="text-warning animate-spin shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground truncate block">
                            {b.pipeline_name ?? 'ad-hoc build'}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono truncate block">
                            {b.project_name}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {timeAgo(b.started_at)}
                        </span>
                        <ExternalLink size={12} className="text-muted-foreground shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              <Separator className="mt-2" />
            </section>
          )}

          {/* Build history */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Build History
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search pipeline or project…"
                    className="h-9 rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring w-52"
                  />
                </div>

                <div className="flex items-center gap-1">
                  {STATUS_PILLS.map((pill) => (
                    <button
                      key={pill}
                      onClick={() => setStatusFilter(pill)}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-xs border transition-colors',
                        statusFilter === pill
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80',
                      )}
                    >
                      {pill}
                    </button>
                  ))}
                </div>

                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={11} />
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-card text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Started</th>
                    <th className="text-left px-4 py-2.5 font-medium">Pipeline / Project</th>
                    <th className="text-left px-4 py-2.5 font-medium">Duration</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {grouped.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">
                        {hasFilters ? 'No builds match the current filters.' : 'No builds recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    grouped.map((item, i) =>
                      item.type === 'pipeline'
                        ? <PipelineGroupRows key={`pg-${i}`} group={item} />
                        : <BuildRow key={item.row.id} build={item.row} />,
                    )
                  )}
                </tbody>
              </table>
            </div>

            {grouped.length > 0 && hasFilters && (
              <p className="text-xs text-muted-foreground">
                Showing {grouped.length} {grouped.length === 1 ? 'entry' : 'entries'} ({filtered.length} builds) of {pastBuilds.length} total
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline group row (collapsible — shows all steps when expanded)
// ---------------------------------------------------------------------------

function PipelineGroupRows({ group }: { group: PipelineGroup }) {
  const [expanded, setExpanded] = useState(false);
  const status  = deriveGroupStatus(group.steps);
  const totalMs = group.steps.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0);

  return (
    <>
      <tr
        className={cn(
          'hover:bg-accent/30 cursor-pointer transition-colors',
          expanded && 'bg-accent/20',
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
          {timeAgo(group.startedAt)}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Workflow size={12} className="text-primary/60 shrink-0" />
            <span className="font-medium text-foreground">{group.pipelineName}</span>
            <span className="text-muted-foreground/50 text-[10px] tabular-nums">
              {group.steps.length} step{group.steps.length !== 1 ? 's' : ''}
            </span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
          {totalMs > 0 ? formatDuration(totalMs) : '—'}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <span className="text-muted-foreground/50">
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </span>
          </div>
        </td>
      </tr>

      {expanded && group.steps.map((step) => (
        <PipelineStepRow key={step.id} step={step} />
      ))}
    </>
  );
}

function PipelineStepRow({ step }: { step: BuildRunRowApi }) {
  const navigate  = useNavigate();
  const [showLogs, setShowLogs] = useState(false);
  const isRunning = step.status === 'running';

  const { data: logs, isLoading: logsLoading, isError: logsError } = useQuery({
    ...buildLogsQuery(step.id),
    enabled: showLogs,
  });

  return (
    <>
      <tr
        className={cn(
          'bg-card/30 border-l-2 border-l-primary/20',
          isRunning && 'cursor-pointer hover:bg-accent/20 transition-colors',
        )}
        onClick={() => isRunning && void navigate({ to: '/builds/$jobId', params: { jobId: String(step.id) } })}
      >
        <td className="pl-8 pr-4 py-2 text-muted-foreground/70 tabular-nums whitespace-nowrap">
          {timeAgo(step.started_at)}
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-2">
            {step.step_index != null && (
              <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums shrink-0">
                step {step.step_index + 1}
              </span>
            )}
            <span className="font-mono text-muted-foreground/80 truncate max-w-48">
              {step.project_name}
            </span>
            {!isRunning && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowLogs((v) => !v); }}
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors shrink-0',
                  showLogs
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'border-border text-muted-foreground/60 hover:text-foreground hover:border-border/80',
                )}
              >
                <ScrollText size={9} />
                {showLogs ? 'Hide' : 'Logs'}
              </button>
            )}
            {isRunning && <ExternalLink size={10} className="text-muted-foreground shrink-0" />}
          </div>
        </td>
        <td className="px-4 py-2 text-muted-foreground/70 tabular-nums whitespace-nowrap">
          {step.duration_ms != null ? formatDuration(step.duration_ms) : '—'}
        </td>
        <td className="px-4 py-2">
          <StatusBadge status={step.status} />
        </td>
      </tr>

      {showLogs && (
        <tr className="bg-card/20">
          <td colSpan={4} className="px-4 pb-3 pt-1">
            <LogPanel logs={logs} logsLoading={logsLoading} logsError={logsError} />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Standalone (ad-hoc) build row
// ---------------------------------------------------------------------------

function BuildRow({ build }: { build: BuildRunRowApi }) {
  const navigate  = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const isRunning = build.status === 'running';

  const { data: logs, isLoading: logsLoading, isError: logsError } = useQuery({
    ...buildLogsQuery(build.id),
    enabled: showLogs,
  });

  function handleClick() {
    if (isRunning) {
      void navigate({ to: '/builds/$jobId', params: { jobId: String(build.id) } });
    } else {
      setExpanded((v) => !v);
      if (expanded) setShowLogs(false);
    }
  }

  return (
    <>
      <tr
        className={cn(
          'hover:bg-accent/30 cursor-pointer transition-colors',
          expanded && 'bg-accent/20',
        )}
        onClick={handleClick}
      >
        <td className="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
          {timeAgo(build.started_at)}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="italic text-muted-foreground text-[10px]">ad-hoc</span>
            <span className="font-mono text-muted-foreground/80 truncate max-w-52">
              {build.project_name}
            </span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
          {formatDuration(build.duration_ms)}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <StatusBadge status={build.status} />
            {!isRunning && (
              <span className="text-muted-foreground/50">
                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </span>
            )}
            {isRunning && <ExternalLink size={11} className="text-muted-foreground" />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-card/50">
          <td colSpan={4} className="px-4 py-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <DetailRow label="Path"    value={build.project_path} mono />
                <DetailRow label="Command" value={build.command}      mono />
                {build.java_home      && <DetailRow label="JAVA_HOME"  value={build.java_home}                        mono />}
                {build.exit_code != null && <DetailRow label="Exit code" value={String(build.exit_code)} />}
                {build.finished_at    && <DetailRow label="Finished"   value={new Date(build.finished_at).toLocaleString()} />}
              </div>

              <div className="pt-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowLogs((v) => !v); }}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors',
                    showLogs
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80',
                  )}
                >
                  <ScrollText size={11} />
                  View Logs
                  {showLogs ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
              </div>

              {showLogs && (
                <LogPanel logs={logs} logsLoading={logsLoading} logsError={logsError} />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared log panel
// ---------------------------------------------------------------------------

function LogPanel({
  logs,
  logsLoading,
  logsError,
}: {
  logs: BuildLogEntry[] | undefined;
  logsLoading: boolean;
  logsError: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden" style={{ backgroundColor: '#0d1117' }}>
      {logsLoading ? (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-500 font-mono">
          <Loader2 size={12} className="animate-spin" />
          Loading logs…
        </div>
      ) : logsError ? (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-red-400 font-mono">
          <AlertCircle size={12} />
          Failed to load logs.
        </div>
      ) : !logs || logs.length === 0 ? (
        <div className="px-4 py-3 text-xs text-zinc-500 font-mono italic">
          No logs stored for this build.
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {logs.map((entry) => (
            <LogLine key={entry.seq} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className={cn('break-all', mono ? 'font-mono text-foreground/70' : 'text-foreground/70')}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-keyword log line coloring (mirrors BuildOutput.tsx MavenAwareLine)
// ---------------------------------------------------------------------------

const MAVEN_TAG_RE_LOG = /^\[(INFO|WARNING|WARN|ERROR|DEBUG|FATAL)\] /;

const TAG_COLORS_LOG: Record<string, string> = {
  INFO:    '#89b4fa',
  WARNING: '#f9e2af',
  WARN:    '#f9e2af',
  ERROR:   '#f38ba8',
  FATAL:   '#ff6e6e',
  DEBUG:   '#7c7fa6',
};

const KEYWORD_COLORS_LOG: Array<{ re: RegExp; color: string; bold?: boolean }> = [
  { re: /BUILD SUCCESS/g, color: '#a6e3a1', bold: true },
  { re: /BUILD FAILURE/g, color: '#f38ba8', bold: true },
];

function renderWithKeywordsLog(text: string): React.ReactNode {
  if (!text) return null;
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  for (const { re, color, bold } of KEYWORD_COLORS_LOG) {
    if (re.test(stripped)) {
      re.lastIndex = 0;
      const parts: React.ReactNode[] = [];
      let last = 0;
      let match: RegExpExecArray | null;
      const raw = text.replace(/\x1b\[[0-9;]*m/g, '');
      re.lastIndex = 0;
      while ((match = re.exec(raw)) !== null) {
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

function MavenAwareLineLog({ line }: { line: string }): React.ReactElement {
  const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
  const tagMatch = MAVEN_TAG_RE_LOG.exec(stripped);
  if (tagMatch) {
    const rawTag   = tagMatch[1]!;
    const bracket  = `[${rawTag}]`;
    const tagColor = TAG_COLORS_LOG[rawTag] ?? '#89b4fa';
    const tagEnd   = stripped.indexOf(bracket) + bracket.length + 1; // +1 for trailing space
    const rest     = line.slice(Math.min(tagEnd, line.length));
    return (
      <span>
        <span style={{ color: tagColor }}>{bracket}</span>
        {' '}
        {renderWithKeywordsLog(rest)}
      </span>
    );
  }
  return <span>{renderWithKeywordsLog(line)}</span>;
}

function getLogAccent(line: string): 'error' | 'warn' | 'success' | null {
  const s = line.replace(/\x1b\[[0-9;]*m/g, '');
  if (/^\[(?:ERROR|FATAL)\] /.test(s) || /BUILD FAILURE/.test(s)) return 'error';
  if (/^\[(?:WARNING|WARN)\] /.test(s))                            return 'warn';
  if (/BUILD SUCCESS/.test(s))                                     return 'success';
  return null;
}

function LogLine({ entry }: { entry: BuildLogEntry }) {
  const isStderr = entry.stream === 'stderr';
  const accent   = getLogAccent(entry.line);

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
      <span className="flex-1 px-3 py-px" style={{ color: isStderr ? '#fca5a5' : '#d1fae5' }}>
        <MavenAwareLineLog line={entry.line} />
      </span>
    </div>
  );
}
