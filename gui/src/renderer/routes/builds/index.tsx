import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { buildsQuery, buildLogsQuery, useClearBuildLogs, useClearAllBuilds } from '@/api/queries';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { cn, formatDuration, timeAgo } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  ExternalLink,
  AlertCircle,
  ScrollText,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileX,
  Workflow,
} from 'lucide-react';
import type { BuildRunRowApi, BuildLogEntry } from '@shared/api';
import { AnsiLine } from '@/lib/ansi';

export const Route = createFileRoute('/builds/')({
  validateSearch: (search: Record<string, unknown>) => ({
    runId: typeof search.runId === 'string' ? search.runId : undefined,
  }),
  component: BuildsView,
});

interface PipelineGroup {
  type: 'pipeline';
  pipelineName: string;
  steps: BuildRunRowApi[];
  startedAt: string;
  finishedAt: string | null;
}

interface StandaloneItem {
  type: 'standalone';
  row: BuildRunRowApi;
}

type GroupedItem = PipelineGroup | StandaloneItem;

function getBuildJobParam(build: BuildRunRowApi): string {
  return build.job_id ?? String(build.id);
}

function deriveGroupStatus(steps: BuildRunRowApi[]): string {
  if (steps.some((step) => step.status === 'running')) return 'running';
  if (steps.some((step) => step.status === 'failed')) return 'failed';
  if (steps.every((step) => step.status === 'success')) return 'success';
  if (steps.some((step) => step.status === 'launched')) return 'launched';
  return steps[steps.length - 1]?.status ?? 'running';
}

function groupBuilds(rows: BuildRunRowApi[]): GroupedItem[] {
  const chronological = [...rows].reverse();
  const resultChron: GroupedItem[] = [];
  const openGroups = new Map<string, PipelineGroup>();

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
          resultChron.push({ type: 'standalone', row });
        }
      }
    } else {
      resultChron.push({ type: 'standalone', row });
    }
  }

  return resultChron.reverse();
}

const STATUS_PILLS = ['All', 'Success', 'Failed', 'Launched', 'Running'] as const;
type StatusFilter = (typeof STATUS_PILLS)[number];

function BuildsView() {
  const { runId } = Route.useSearch();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [searchText, setSearchText] = useState('');
  const [confirmMode, setConfirmMode] = useState<'logs' | 'all' | null>(null);
  const queryClient = useQueryClient();
  const { data: builds, isLoading, isError } = useQuery(buildsQuery({ limit: 200 }));
  const clearLogs = useClearBuildLogs();
  const clearAll = useClearAllBuilds();

  const activeBuilds = builds?.filter((build) => build.status === 'running') ?? [];
  const pastBuilds = builds?.filter((build) => build.status !== 'running') ?? [];

  const hasFilters = statusFilter !== 'All' || searchText.trim() !== '';

  const filtered = pastBuilds.filter((build) => {
    if (statusFilter !== 'All' && build.status !== statusFilter.toLowerCase()) return false;
    if (searchText.trim()) {
      const query = searchText.trim().toLowerCase();
      if (
        !(build.pipeline_name ?? '').toLowerCase().includes(query) &&
        !build.project_name.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  const grouped = groupBuilds(filtered);

  async function handleClearLogs() {
    await clearLogs.mutateAsync();
    await queryClient.invalidateQueries({ queryKey: ['builds'] });
    setConfirmMode(null);
  }

  async function handleClearAll() {
    await clearAll.mutateAsync();
    await queryClient.invalidateQueries({ queryKey: ['builds'] });
    setConfirmMode(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title text-[1.6rem] font-semibold leading-tight text-foreground">
            Builds
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inspect running jobs, build history, and stored logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmMode('logs')}
            disabled={clearLogs.isPending || !builds?.length}
          >
            <FileX size={12} />
            Clear logs
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmMode('all')}
            disabled={clearAll.isPending || !builds?.length}
          >
            <Trash2 size={12} />
            Clear all
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card flex items-center gap-3 rounded-[24px] border border-border px-5 py-4 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Loading builds...
        </div>
      ) : isError ? (
        <div className="glass-card flex items-center gap-3 rounded-[24px] border border-destructive/20 px-5 py-4 text-sm">
          <AlertCircle size={16} className="shrink-0 text-destructive" />
          <span className="text-destructive">Failed to load builds. Check that the server is running.</span>
        </div>
      ) : (
        <>
          {activeBuilds.length > 0 && (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {activeBuilds.length} build{activeBuilds.length !== 1 ? 's' : ''} running now
                </h2>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {activeBuilds.map((build) => (
                  <Link
                    key={build.id}
                    to="/builds/$jobId"
                    params={{ jobId: getBuildJobParam(build) }}
                    className="glass-card flex items-center gap-4 rounded-[22px] border border-border px-5 py-4 transition-colors hover:border-primary/20 hover:bg-accent/40"
                  >
                    <div className="rounded-full bg-primary/10 p-3">
                      <Loader2 size={14} className="animate-spin text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {build.pipeline_name ?? 'Ad-hoc build'}
                      </span>
                      <span className="block truncate text-xs font-mono text-muted-foreground">
                        {build.project_name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo(build.started_at)}</span>
                    <ExternalLink size={12} className="shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Previous runs</h2>
            </div>

            <div className="glass-card flex flex-wrap items-center gap-3 rounded-[24px] border border-border p-4">
              <SearchField
                value={searchText}
                onChange={setSearchText}
                placeholder="Search pipeline or project..."
              />

              <div className="flex flex-wrap items-center gap-2">
                {STATUS_PILLS.map((pill) => (
                  <button
                    key={pill}
                    onClick={() => setStatusFilter(pill)}
                    className={cn(
                      'pill-control border transition-colors focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
                      statusFilter === pill
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border bg-card/70 text-muted-foreground hover:bg-accent/60 hover:text-foreground active:bg-accent/80',
                    )}
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card overflow-hidden rounded-[24px] border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/55 text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.12em]">Started</th>
                    <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.12em]">Pipeline / Project</th>
                    <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.12em]">Duration</th>
                    <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.12em]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {grouped.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-14 text-center text-sm text-muted-foreground">
                        {hasFilters ? 'No builds match the current filters.' : 'No builds recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    grouped.map((item, index) =>
                      item.type === 'pipeline'
                        ? <PipelineGroupRows key={`pg-${index}`} group={item} targetRunId={runId} />
                        : <BuildRow key={item.row.id} build={item.row} isTarget={runId === String(item.row.id)} />,
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

      <ConfirmationDialog
        open={confirmMode === 'logs'}
        onOpenChange={(open) => !open && setConfirmMode(null)}
        title="Clear stored logs?"
        description="This removes saved log output for previous builds but keeps the build records and statistics."
        confirmLabel={clearLogs.isPending ? 'Clearing...' : 'Clear logs'}
        confirmVariant="destructive"
        isPending={clearLogs.isPending}
        onConfirm={() => void handleClearLogs()}
      />

      <ConfirmationDialog
        open={confirmMode === 'all'}
        onOpenChange={(open) => !open && setConfirmMode(null)}
        title="Delete all build history?"
        description="This removes build records, stored logs, and related statistics. This action cannot be undone."
        confirmLabel={clearAll.isPending ? 'Deleting...' : 'Delete all'}
        confirmVariant="destructive"
        isPending={clearAll.isPending}
        onConfirm={() => void handleClearAll()}
      />
    </div>
  );
}

function PipelineGroupRows({ group, targetRunId }: { group: PipelineGroup; targetRunId?: string }) {
  const matchedStepId = targetRunId ? group.steps.find((step) => String(step.id) === targetRunId)?.id : undefined;
  const [expanded, setExpanded] = useState(Boolean(matchedStepId));
  const rowRef = useRef<HTMLTableRowElement | null>(null);
  const status = deriveGroupStatus(group.steps);
  const totalMs = group.steps.reduce((sum, step) => sum + (step.duration_ms ?? 0), 0);

  useEffect(() => {
    if (matchedStepId) setExpanded(true);
  }, [matchedStepId]);

  useEffect(() => {
    if (matchedStepId) {
      rowRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [matchedStepId]);

  return (
    <>
      <tr
        ref={rowRef}
        className={cn('cursor-pointer transition-colors hover:bg-accent/40', expanded && 'bg-accent/35')}
        onClick={() => setExpanded((value) => !value)}
      >
        <td className="whitespace-nowrap px-5 py-3 text-sm text-muted-foreground">{timeAgo(group.startedAt)}</td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <Workflow size={13} className="shrink-0 text-primary" />
            <span className="font-medium text-foreground">{group.pipelineName}</span>
            <span className="text-xs text-muted-foreground">
              {group.steps.length} step{group.steps.length !== 1 ? 's' : ''}
            </span>
          </div>
        </td>
        <td className="whitespace-nowrap px-5 py-3 text-sm font-mono text-muted-foreground">
          {totalMs > 0 ? formatDuration(totalMs) : '—'}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {expanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
          </div>
        </td>
      </tr>

      {expanded && group.steps.map((step) => (
        <PipelineStepRow key={step.id} step={step} isTarget={matchedStepId === step.id} />
      ))}
    </>
  );
}

function PipelineStepRow({ step, isTarget = false }: { step: BuildRunRowApi; isTarget?: boolean }) {
  const navigate = useNavigate();
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
          'border-l-2 border-l-primary/10 bg-secondary/35',
          isTarget && 'bg-accent/35',
          isRunning && 'cursor-pointer transition-colors hover:bg-accent/25',
        )}
        onClick={() => isRunning && void navigate({ to: '/builds/$jobId', params: { jobId: getBuildJobParam(step) } })}
      >
        <td className="whitespace-nowrap pl-10 pr-5 py-2.5 text-xs text-muted-foreground">
          {timeAgo(step.started_at)}
        </td>
        <td className="px-5 py-2.5">
          <div className="flex items-center gap-2">
            {step.step_index != null && (
            <span className="pill-meta rounded-full bg-card font-mono text-muted-foreground">
                step {step.step_index + 1}
            </span>
            )}
            <span className="max-w-64 truncate font-mono text-xs text-foreground/80">
              {step.project_name}
            </span>
            {!isRunning && (
              <Button
                type="button"
                variant={showLogs ? 'secondary' : 'outline'}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLogs((value) => !value);
                }}
                className={cn(
                  'h-7 gap-1.5 px-2.5 text-[11px]',
                  showLogs
                    ? 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/12 active:bg-primary/14'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ScrollText size={10} />
                {showLogs ? 'Hide logs' : 'Logs'}
              </Button>
            )}
            {isRunning && <ExternalLink size={10} className="text-muted-foreground" />}
          </div>
        </td>
        <td className="whitespace-nowrap px-5 py-2.5 text-xs font-mono text-muted-foreground">
          {step.duration_ms != null ? formatDuration(step.duration_ms) : '—'}
        </td>
        <td className="px-5 py-2.5">
          <StatusBadge status={step.status} />
        </td>
      </tr>

      {showLogs && (
        <tr className="bg-secondary/20">
          <td colSpan={4} className="px-5 pb-4 pt-2">
            <LogPanel logs={logs} logsLoading={logsLoading} logsError={logsError} />
          </td>
        </tr>
      )}
    </>
  );
}

function BuildRow({ build, isTarget = false }: { build: BuildRunRowApi; isTarget?: boolean }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(isTarget);
  const [showLogs, setShowLogs] = useState(false);
  const rowRef = useRef<HTMLTableRowElement | null>(null);
  const isRunning = build.status === 'running';

  const { data: logs, isLoading: logsLoading, isError: logsError } = useQuery({
    ...buildLogsQuery(build.id),
    enabled: showLogs,
  });

  useEffect(() => {
    if (isTarget) setExpanded(true);
  }, [isTarget]);

  useEffect(() => {
    if (isTarget) {
      rowRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [isTarget]);

  function handleClick() {
    if (isRunning) {
      void navigate({ to: '/builds/$jobId', params: { jobId: getBuildJobParam(build) } });
    } else {
      setExpanded((value) => !value);
      if (expanded) setShowLogs(false);
    }
  }

  return (
    <>
      <tr
        ref={rowRef}
        className={cn('cursor-pointer transition-colors hover:bg-accent/40', (expanded || isTarget) && 'bg-accent/35')}
        onClick={handleClick}
      >
        <td className="whitespace-nowrap px-5 py-3 text-sm text-muted-foreground">
          {timeAgo(build.started_at)}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="pill-meta rounded-full bg-secondary text-muted-foreground">
              ad-hoc
            </span>
            <span className="max-w-64 truncate font-mono text-xs text-foreground/80">
              {build.project_name}
            </span>
          </div>
        </td>
        <td className="whitespace-nowrap px-5 py-3 text-sm font-mono text-muted-foreground">
          {formatDuration(build.duration_ms)}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={build.status} />
            {!isRunning && (expanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />)}
            {isRunning && <ExternalLink size={12} className="text-muted-foreground" />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-secondary/25">
          <td colSpan={4} className="px-5 py-4">
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <DetailRow label="Path" value={build.project_path} mono />
                <DetailRow label="Command" value={build.command} mono />
                {build.java_home && <DetailRow label="JAVA_HOME" value={build.java_home} mono />}
                {build.exit_code != null && <DetailRow label="Exit code" value={String(build.exit_code)} />}
                {build.finished_at && <DetailRow label="Finished" value={new Date(build.finished_at).toLocaleString()} />}
              </div>

              <div>
                <Button
                  type="button"
                  variant={showLogs ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLogs((value) => !value);
                  }}
                  className={cn(
                    'pill-control',
                    showLogs
                      ? 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/12 active:bg-primary/14'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ScrollText size={11} />
                  View logs
                  {showLogs ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </Button>
              </div>

              {showLogs && <LogPanel logs={logs} logsLoading={logsLoading} logsError={logsError} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

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
    <div
      className="overflow-hidden rounded-[20px] border"
      style={{ backgroundColor: 'var(--terminal-bg)', borderColor: 'var(--terminal-border)' }}
    >
      {logsLoading ? (
        <div className="flex items-center gap-2 px-4 py-3 text-xs font-mono" style={{ color: 'var(--terminal-muted)' }}>
          <Loader2 size={12} className="animate-spin" />
          Loading logs...
        </div>
      ) : logsError ? (
        <div className="flex items-center gap-2 px-4 py-3 text-xs font-mono text-red-400">
          <AlertCircle size={12} />
          Failed to load logs.
        </div>
      ) : !logs || logs.length === 0 ? (
        <div className="px-4 py-3 text-sm" style={{ color: 'var(--terminal-muted)' }}>
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

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('break-all text-foreground/75', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

const MAVEN_TAG_RE_LOG = /^\[(INFO|WARNING|WARN|ERROR|DEBUG|FATAL)\] /;

function isDarkThemeLog(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.dataset.theme === 'dark';
}

function getTagColorsLog(): Record<string, string> {
  return isDarkThemeLog()
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

function getKeywordColorsLog(): Array<{ re: RegExp; color: string; bold?: boolean }> {
  return isDarkThemeLog()
    ? [
        { re: /BUILD SUCCESS/g, color: '#a6e3a1', bold: true },
        { re: /BUILD FAILURE/g, color: '#f38ba8', bold: true },
      ]
    : [
        { re: /BUILD SUCCESS/g, color: '#166534', bold: true },
        { re: /BUILD FAILURE/g, color: '#b91c1c', bold: true },
      ];
}

function renderWithKeywordsLog(text: string): React.ReactNode {
  if (!text) return null;
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  const keywordColors = getKeywordColorsLog();
  for (const { re, color, bold } of keywordColors) {
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
    const rawTag = tagMatch[1]!;
    const bracket = `[${rawTag}]`;
    const tagColor = getTagColorsLog()[rawTag] ?? (isDarkThemeLog() ? '#89b4fa' : '#1d4ed8');
    const tagEnd = stripped.indexOf(bracket) + bracket.length + 1;
    const rest = line.slice(Math.min(tagEnd, line.length));
    return (
      <span>
        <span style={{ color: tagColor }}>{bracket}</span>{' '}
        {renderWithKeywordsLog(rest)}
      </span>
    );
  }
  return <span>{renderWithKeywordsLog(line)}</span>;
}

function getLogAccent(line: string): 'error' | 'warn' | 'success' | null {
  const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
  if (/^\[(?:ERROR|FATAL)\] /.test(stripped) || /BUILD FAILURE/.test(stripped)) return 'error';
  if (/^\[(?:WARNING|WARN)\] /.test(stripped)) return 'warn';
  if (/BUILD SUCCESS/.test(stripped)) return 'success';
  return null;
}

function LogLine({ entry }: { entry: BuildLogEntry }) {
  const isStderr = entry.stream === 'stderr';
  const accent = getLogAccent(entry.line);

  return (
    <div
      className="flex break-all font-mono text-xs leading-5 whitespace-pre-wrap"
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
      <span className="flex-1 px-3 py-px" style={{ color: isStderr ? 'var(--terminal-stderr)' : 'var(--terminal-fg)' }}>
        <MavenAwareLineLog line={entry.line.length > 0 ? entry.line : ' '} />
      </span>
    </div>
  );
}
