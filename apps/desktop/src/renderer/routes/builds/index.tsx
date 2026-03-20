import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { buildsQuery, useClearBuildLogs, useClearAllBuilds } from '@/api/queries';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { cn, formatDuration, timeAgo } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  ExternalLink,
  AlertCircle,
  Trash2,
  FileX,
  Workflow,
} from 'lucide-react';
import type { BuildRunRowApi } from '@gfos-build/contracts';
import { BranchBadge } from '@/components/BranchBadge';

export const Route = createFileRoute('/builds/')({
  validateSearch: (search: Record<string, unknown>) => ({
    runId: typeof search.runId === 'string' ? search.runId : undefined,
  }),
  component: BuildsView,
});

interface PipelineGroup {
  type: 'pipeline';
  jobId: string;
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
  const groupsByJobId = new Map<string, PipelineGroup>();
  const standalone: StandaloneItem[] = [];

  for (const row of rows) {
    if (row.pipeline_name !== null && row.step_index !== null && row.job_id) {
      let group = groupsByJobId.get(row.job_id);
      if (!group) {
        group = {
          type: 'pipeline',
          jobId: row.job_id,
          pipelineName: row.pipeline_name,
          steps: [],
          startedAt: row.started_at,
          finishedAt: row.finished_at,
        };
        groupsByJobId.set(row.job_id, group);
      }
      group.steps.push(row);
      if (row.started_at < group.startedAt) group.startedAt = row.started_at;
      if (row.finished_at && (!group.finishedAt || row.finished_at > group.finishedAt)) {
        group.finishedAt = row.finished_at;
      }
      continue;
    }

    standalone.push({ type: 'standalone', row });
  }

  const grouped: GroupedItem[] = [
    ...Array.from(groupsByJobId.values()).map((group) => ({
      ...group,
      steps: [...group.steps].sort((left, right) => {
        const leftIndex = left.step_index ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = right.step_index ?? Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex || left.started_at.localeCompare(right.started_at);
      }),
    })),
    ...standalone,
  ];

  return grouped.sort((left, right) => {
    const leftStartedAt = left.type === 'pipeline' ? left.startedAt : left.row.started_at;
    const rightStartedAt = right.type === 'pipeline' ? right.startedAt : right.row.started_at;
    return rightStartedAt.localeCompare(leftStartedAt);
  });
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

  const activeBuilds = useMemo(
    () => builds?.filter((build) => build.status === 'running') ?? [],
    [builds],
  );
  const pastBuilds = useMemo(
    () => builds?.filter((build) => build.status !== 'running') ?? [],
    [builds],
  );

  const hasFilters = statusFilter !== 'All' || searchText.trim() !== '';

  // Group first so filters apply at the logical-run level, not the step level.
  // Filtering before grouping would corrupt pipeline group status and duration
  // (e.g. a failed pipeline filtered by "Success" would drop its failed steps).
  const allGrouped = useMemo(() => groupBuilds(pastBuilds), [pastBuilds]);

  const grouped = useMemo(() => {
    if (!hasFilters) return allGrouped;
    const query = searchText.trim().toLowerCase();
    return allGrouped.filter((item) => {
      if (item.type === 'pipeline') {
        if (statusFilter !== 'All' && deriveGroupStatus(item.steps) !== statusFilter.toLowerCase()) return false;
        if (query && !item.pipelineName.toLowerCase().includes(query) &&
            !item.steps.some((s) => s.project_name.toLowerCase().includes(query))) return false;
      } else {
        if (statusFilter !== 'All' && item.row.status !== statusFilter.toLowerCase()) return false;
        if (query && !item.row.project_name.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }, [allGrouped, statusFilter, searchText, hasFilters]);

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
          <span className="text-destructive">Failed to load builds. Check that the desktop runtime is running.</span>
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
                        {build.pipeline_name ?? 'Quick Run'}
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
                    grouped.map((item) =>
                      item.type === 'pipeline'
                        ? <PipelineGroupRow key={item.jobId} group={item} targetRunId={runId} />
                        : <BuildRow key={item.row.id} build={item.row} isTarget={runId === String(item.row.id)} />,
                    )
                  )}
                </tbody>
              </table>
            </div>

            {grouped.length > 0 && hasFilters && (
              <p className="text-xs text-muted-foreground">
                Showing {grouped.length} {grouped.length === 1 ? 'entry' : 'entries'} of {allGrouped.length} total
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

function PipelineGroupRow({ group, targetRunId }: { group: PipelineGroup; targetRunId?: string }) {
  const navigate = useNavigate();
  const isTarget = targetRunId
    ? group.steps.some((step) => String(step.id) === targetRunId)
    : false;
  const rowRef = useRef<HTMLTableRowElement | null>(null);
  const status = deriveGroupStatus(group.steps);
  const totalMs = group.steps.reduce((sum, step) => sum + (step.duration_ms ?? 0), 0);

  useEffect(() => {
    if (isTarget) {
      rowRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [isTarget]);

  return (
    <tr
      ref={rowRef}
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent/40',
        isTarget && 'bg-accent/35',
      )}
      onClick={() => void navigate({ to: '/builds/$jobId', params: { jobId: group.jobId } })}
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
          <ExternalLink size={12} className="text-muted-foreground" />
        </div>
      </td>
    </tr>
  );
}

function BuildRow({ build, isTarget = false }: { build: BuildRunRowApi; isTarget?: boolean }) {
  const navigate = useNavigate();
  const rowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (isTarget) {
      rowRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [isTarget]);

  return (
    <tr
      ref={rowRef}
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent/40',
        isTarget && 'bg-accent/35',
      )}
      onClick={() => void navigate({ to: '/builds/$jobId', params: { jobId: getBuildJobParam(build) } })}
    >
      <td className="whitespace-nowrap px-5 py-3 text-sm text-muted-foreground">
        {timeAgo(build.started_at)}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="pill-meta rounded-full bg-secondary text-muted-foreground">
            quick run
          </span>
          <span className="max-w-64 truncate font-mono text-xs text-foreground/80">
            {build.project_name}
          </span>
          <BranchBadge branch={build.branch} />
        </div>
      </td>
      <td className="whitespace-nowrap px-5 py-3 text-sm font-mono text-muted-foreground">
        {formatDuration(build.duration_ms)}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={build.status} />
          <ExternalLink size={12} className="text-muted-foreground" />
        </div>
      </td>
    </tr>
  );
}
