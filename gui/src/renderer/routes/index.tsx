import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { buildStatsQuery, buildsQuery, pipelinesQuery, useAdHocBuild, useRunPipeline } from '@/api/queries';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonRows } from '@/components/ui/skeleton';
import { formatDuration, timeAgo, cn } from '@/lib/utils';
import { useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
  Timer,
  Zap,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { BuildRunRowApi, PipelineListItem } from '@shared/api';

export const Route = createFileRoute('/')({
  component: Dashboard,
});

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
  loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconClass: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
          <div className="icon-chip flex h-8 w-8 items-center justify-center rounded-full">
            <Icon size={14} className={iconClass} />
          </div>
        </div>
        {loading ? (
          <div className="h-8 w-20 animate-pulse rounded-full bg-border/80" />
        ) : (
          <div>
            <div className="page-title text-[1.75rem] font-bold leading-none tracking-[-0.04em] text-foreground">
              {value}
            </div>
            {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 text-destructive">
      <AlertCircle size={14} className="shrink-0" />
      <span className="flex-1 text-sm">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]"
        >
          <RefreshCw size={11} />
          Retry
        </button>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'bg-success',
    failed: 'bg-destructive',
    running: 'bg-primary animate-pulse',
  };
  return <div className={cn('h-2 w-2 rounded-full shrink-0', colors[status] ?? 'bg-muted-foreground')} />;
}

interface AdHocQuickRunItem {
  key: string;
  projectName: string;
  projectPath: string;
  buildSystem: 'maven' | 'npm';
  label: string;
  meta: string;
  count: number;
  body:
    | { path: string; buildSystem: 'npm'; npmScript: string }
    | { path: string; buildSystem: 'maven'; goals: string[]; flags?: string[] };
}

function parseAdHocCommand(build: BuildRunRowApi): AdHocQuickRunItem['body'] | null {
  const command = build.command.trim();
  if (build.build_system === 'npm') {
    const npmMatch = command.match(/^\S+\s+run\s+(.+)$/);
    const npmScript = npmMatch?.[1]?.trim();
    if (!npmScript) return null;
    return {
      path: build.project_path,
      buildSystem: 'npm',
      npmScript,
    };
  }

  if (build.build_system === 'maven') {
    const parts = command.split(/\s+/).slice(1);
    if (parts.length === 0) return null;
    const goals = parts.filter((part) => !part.startsWith('-'));
    const flags = parts.filter((part) => part.startsWith('-'));
    if (goals.length === 0) return null;
    return {
      path: build.project_path,
      buildSystem: 'maven',
      goals,
      flags: flags.length > 0 ? flags : undefined,
    };
  }

  return null;
}

function deriveAdHocQuickRuns(builds: BuildRunRowApi[]): AdHocQuickRunItem[] {
  const byKey = new Map<string, { build: BuildRunRowApi; count: number; latestAt: number; body: AdHocQuickRunItem['body'] }>();

  for (const build of builds) {
    if (build.pipeline_name !== null || build.status === 'running') continue;
    const body = parseAdHocCommand(build);
    if (!body) continue;
    const key = `${build.build_system}:${build.project_path}:${build.command}`;
    const latestAt = new Date(build.started_at).getTime();
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      if (latestAt > existing.latestAt) {
        existing.build = build;
        existing.latestAt = latestAt;
      }
    } else {
      byKey.set(key, { build, count: 1, latestAt, body });
    }
  }

  return [...byKey.entries()]
    .filter(([, entry]) => entry.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || b[1].latestAt - a[1].latestAt)
    .slice(0, 4)
    .map(([key, entry]) => {
      const { build, count, body } = entry;
      const label =
        build.build_system === 'npm'
          ? `npm ${'npmScript' in body ? body.npmScript : ''}`.trim()
          : [
              ...(body.buildSystem === 'maven' ? body.goals : []),
              ...(body.buildSystem === 'maven' ? body.flags ?? [] : []),
            ].join(' ');
      return {
        key,
        projectName: build.project_name,
        projectPath: build.project_path,
        buildSystem: build.build_system as 'maven' | 'npm',
        label,
        meta: `${count} recent runs`,
        count,
        body,
      };
    });
}

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery(buildStatsQuery);
  const {
    data: builds,
    isLoading: buildsLoading,
    isError: buildsError,
  } = useQuery(buildsQuery({ limit: 15 }));
  const {
    data: pipelines,
    isLoading: pipelinesLoading,
    isError: pipelinesError,
  } = useQuery(pipelinesQuery);

  const runPipeline = useRunPipeline();
  const adHocBuild = useAdHocBuild();
  const [runningPipelines, setRunningPipelines] = useState<Set<string>>(new Set());
  const [runningAdHoc, setRunningAdHoc] = useState<Set<string>>(new Set());

  const activeBuilds = builds?.filter((b) => b.status === 'running') ?? [];
  const recentBuilds = builds?.filter((b) => b.status !== 'running').slice(0, 8) ?? [];
  const adHocQuickRuns = deriveAdHocQuickRuns(builds ?? []);

  const successRate =
    stats && stats.totalBuilds > 0
      ? Math.round((stats.successCount / stats.totalBuilds) * 100)
      : null;

  async function handleRun(name: string) {
    setRunningPipelines((s) => new Set(s).add(name));
    try {
      const { jobId } = await runPipeline.mutateAsync(name);
      void navigate({ to: '/builds/$jobId', params: { jobId } });
    } finally {
      setRunningPipelines((s) => {
        const next = new Set(s);
        next.delete(name);
        return next;
      });
    }
  }

  async function handleRunAdHoc(item: AdHocQuickRunItem) {
    setRunningAdHoc((s) => new Set(s).add(item.key));
    try {
      const { jobId } = await adHocBuild.mutateAsync(item.body);
      void navigate({ to: '/builds/$jobId', params: { jobId } });
    } finally {
      setRunningAdHoc((s) => {
        const next = new Set(s);
        next.delete(item.key);
        return next;
      });
    }
  }

  function retryBuilds() {
    void queryClient.refetchQueries({ queryKey: ['builds'] });
  }

  function retryPipelines() {
    void queryClient.refetchQueries({ queryKey: ['pipelines'] });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="page-title text-[1.6rem] font-semibold leading-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track active jobs, recent results, and quick build actions.
        </p>
      </div>

      {activeBuilds.length > 0 && (
        <div className="panel-muted flex items-center gap-3 rounded-[20px] border border-primary/15 px-5 py-4">
          <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium text-primary">Building</span>
          <span className="truncate text-sm text-muted-foreground">
            {activeBuilds[0]?.project_name}
            {activeBuilds.length > 1 && ` + ${activeBuilds.length - 1} more`}
          </span>
          <span className="ml-auto text-xs font-mono text-primary">
            {timeAgo(activeBuilds[0]!.started_at)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Builds"
          value={stats?.totalBuilds ?? 0}
          sub={stats?.totalBuilds ? `${stats.totalBuilds} recorded runs` : 'No build history yet'}
          icon={BarChart3}
          iconClass="text-primary"
          loading={statsLoading}
        />
        <StatCard
          label="Success Rate"
          value={successRate != null ? `${successRate}%` : '—'}
          sub={
            stats && stats.totalBuilds > 0
              ? `${stats.successCount} successful runs`
              : 'Waiting for completed builds'
          }
          icon={CheckCircle2}
          iconClass="text-success"
          loading={statsLoading}
        />
        <StatCard
          label="Avg Duration"
          value={stats?.avgDurationMs ? formatDuration(stats.avgDurationMs) : '—'}
          sub={stats?.totalBuilds ? 'Across all recorded builds' : 'No timings available yet'}
          icon={Timer}
          iconClass="text-warning"
          loading={statsLoading}
        />
        <StatCard
          label="Active Jobs"
          value={activeBuilds.length}
          sub={activeBuilds.length > 0 ? 'Running right now' : 'All quiet'}
          icon={Zap}
          iconClass={activeBuilds.length > 0 ? 'text-primary' : 'text-muted-foreground'}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border">
            <div>
              <CardTitle className="text-sm">Recent Builds</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Latest finished work across pipelines and ad-hoc runs</p>
            </div>
            <Link to="/builds" search={{ runId: undefined }} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)] focus-visible:text-primary">
              View all
              <ArrowUpRight size={11} />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {buildsError ? (
              <ErrorCard message="Could not load recent builds" onRetry={retryBuilds} />
            ) : buildsLoading ? (
              <div className="p-5">
                <SkeletonRows count={5} />
              </div>
            ) : recentBuilds.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">No builds recorded yet</p>
                <p className="mt-1 text-xs text-muted-foreground/80">
                  Run a pipeline or start an ad-hoc build to populate this list.
                </p>
              </div>
            ) : (
              <div>
                {recentBuilds.map((build) => (
                  <RecentBuildRow key={build.id} build={build} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border">
            <div>
              <CardTitle className="text-sm">Quick Run</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Start frequent pipelines and repeated ad-hoc runs without leaving the dashboard</p>
            </div>
            {(pipelines && pipelines.length > 0) || adHocQuickRuns.length > 0 ? (
              <Link to="/pipelines" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)] focus-visible:text-primary">
                Manage
                <ArrowUpRight size={11} />
              </Link>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            {pipelinesError ? (
              <ErrorCard message="Could not load pipelines" onRetry={retryPipelines} />
            ) : pipelinesLoading ? (
              <div className="p-5">
                <SkeletonRows count={4} />
              </div>
            ) : (!pipelines || pipelines.length === 0) && adHocQuickRuns.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">No quick runs available yet</p>
                <p className="max-w-xs text-xs text-muted-foreground/80">
                  Pipelines and repeated ad-hoc builds will start showing up here once you use them a few times.
                </p>
                <Button size="sm" onClick={() => void navigate({ to: '/pipelines' })}>
                  Create pipeline
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {pipelines?.slice(0, 4).map((pipeline) => (
                  <QuickRunPipelineRow
                    key={`pipeline-${pipeline.name}`}
                    pipeline={pipeline}
                    isRunning={runningPipelines.has(pipeline.name)}
                    onRun={handleRun}
                  />
                ))}
                {adHocQuickRuns.map((item) => (
                  <QuickRunAdHocRow
                    key={`adhoc-${item.key}`}
                    item={item}
                    isRunning={runningAdHoc.has(item.key)}
                    onRun={handleRunAdHoc}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecentBuildRow({ build }: { build: BuildRunRowApi }) {
  return (
    <Link
      to="/builds"
      search={{ runId: String(build.id) }}
      className="flex items-center gap-3 border-b border-border/70 px-5 py-3 transition-colors last:border-b-0 hover:bg-accent/55 focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]"
    >
      <StatusBadge status={build.status} />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {build.pipeline_name ?? 'Ad-hoc build'}
        </span>
        <span className="block truncate text-[11px] font-mono text-muted-foreground">
          {build.project_name}
        </span>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs text-muted-foreground">{timeAgo(build.started_at)}</div>
        {build.duration_ms != null && (
          <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">
            {formatDuration(build.duration_ms)}
          </div>
        )}
      </div>
    </Link>
  );
}

function QuickRunPipelineRow({
  pipeline,
  isRunning,
  onRun,
}: {
  pipeline: PipelineListItem;
  isRunning: boolean;
  onRun: (name: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/70 px-5 py-3 last:border-b-0 hover:bg-accent/55">
      <div className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{pipeline.name}</span>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="pill-meta rounded-full bg-secondary uppercase tracking-[0.08em] text-muted-foreground">
            Pipeline
          </span>
          <span>
            {pipeline.steps.length} step{pipeline.steps.length !== 1 ? 's' : ''}
          </span>
          {pipeline.lastRun && (
            <>
              <StatusDot status={pipeline.lastRun.status} />
              <span>{timeAgo(pipeline.lastRun.startedAt)}</span>
            </>
          )}
        </div>
      </div>
      <Button
        size="sm"
        className="shrink-0"
        onClick={() => onRun(pipeline.name)}
        disabled={isRunning}
      >
        {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
        {isRunning ? 'Starting' : 'Run'}
      </Button>
    </div>
  );
}

function QuickRunAdHocRow({
  item,
  isRunning,
  onRun,
}: {
  item: AdHocQuickRunItem;
  isRunning: boolean;
  onRun: (item: AdHocQuickRunItem) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-accent/55">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="pill-meta rounded-full bg-secondary uppercase tracking-[0.08em] text-muted-foreground">
            Ad-hoc
          </span>
          <span className="truncate text-sm font-medium text-foreground">{item.projectName}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="truncate font-mono">{item.label}</span>
          <span>{item.meta}</span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => void onRun(item)}
        disabled={isRunning}
      >
        {isRunning ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
        {isRunning ? 'Starting' : 'Run again'}
      </Button>
    </div>
  );
}
