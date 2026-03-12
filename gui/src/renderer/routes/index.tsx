import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { buildStatsQuery, buildsQuery, pipelinesQuery, useRunPipeline } from '@/api/queries';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SkeletonRows } from '@/components/ui/skeleton';
import { formatDuration, timeAgo, cn } from '@/lib/utils';
import { useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Timer,
  Loader2,
  Play,
  ExternalLink,
  Zap,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { BuildRunRowApi, PipelineListItem } from '@shared/api';

export const Route = createFileRoute('/')({
  component: Dashboard,
});

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
  loading,
  accentClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconClass: string;
  loading?: boolean;
  accentClass?: string;
}) {
  return (
    <Card className={cn(accentClass && `border-l-2 ${accentClass}`)}>
      <CardContent className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <Icon size={15} className={iconClass} />
        </div>
        <div>
          {loading ? (
            <div className="h-8 w-16 rounded-md bg-border/60 animate-pulse" />
          ) : (
            <span className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
              {value}
            </span>
          )}
          {sub && !loading && (
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Inline error card (used inside section panels)
// ---------------------------------------------------------------------------

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="p-4 flex items-center gap-3 text-destructive">
      <AlertCircle size={14} className="shrink-0" />
      <span className="text-xs flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={11} />
          Retry
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status dot used in Quick Run row
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'bg-success',
    failed:  'bg-destructive',
    running: 'bg-warning animate-pulse',
  };
  return (
    <div
      className={cn(
        'w-1.5 h-1.5 rounded-full shrink-0',
        colors[status] ?? 'bg-muted-foreground',
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

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
  const [runningPipelines, setRunningPipelines] = useState<Set<string>>(new Set());

  const activeBuilds = builds?.filter((b) => b.status === 'running') ?? [];
  const recentBuilds = builds?.filter((b) => b.status !== 'running').slice(0, 8) ?? [];

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
        const n = new Set(s);
        n.delete(name);
        return n;
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
    <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto">

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Builds"
          value={stats?.totalBuilds ?? 0}
          icon={BarChart3}
          iconClass="text-primary"
          accentClass="border-l-primary/60"
          loading={statsLoading}
        />
        <StatCard
          label="Success Rate"
          value={successRate != null ? `${successRate}%` : '—'}
          sub={
            stats && stats.totalBuilds > 0
              ? `${stats.successCount} of ${stats.totalBuilds} builds`
              : undefined
          }
          icon={CheckCircle2}
          iconClass="text-success"
          accentClass="border-l-success/60"
          loading={statsLoading}
        />
        <StatCard
          label="Avg Duration"
          value={stats?.avgDurationMs ? formatDuration(stats.avgDurationMs) : '—'}
          sub={stats?.totalBuilds ? `across ${stats.totalBuilds} builds` : undefined}
          icon={Timer}
          iconClass="text-warning"
          accentClass="border-l-warning/60"
          loading={statsLoading}
        />
        <StatCard
          label="Active Jobs"
          value={activeBuilds.length}
          sub={activeBuilds.length > 0 ? 'running now' : 'all quiet'}
          icon={Zap}
          iconClass={activeBuilds.length > 0 ? 'text-warning' : 'text-muted-foreground'}
          accentClass={activeBuilds.length > 0 ? 'border-l-warning/60' : undefined}
        />
      </div>

      {/* ── Active builds ─────────────────────────────────────────────────── */}
      {activeBuilds.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Running now ({activeBuilds.length})
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
                    <div className="w-6 h-6 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                      <Loader2 size={12} className="text-warning animate-spin" />
                    </div>
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
        </section>
      )}

      {/* ── Two-column lower section ─────────────────────────────────────── */}
      <div className="flex gap-5">

        {/* Recent Builds */}
        <section className="flex flex-col gap-3 flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Builds
            </h2>
            <Link to="/builds" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>

          <div className="rounded-lg border border-border overflow-hidden bg-card">
            {buildsError ? (
              <ErrorCard
                message="Could not load recent builds"
                onRetry={retryBuilds}
              />
            ) : buildsLoading ? (
              <div className="p-4">
                <SkeletonRows count={4} />
              </div>
            ) : recentBuilds.length === 0 ? (
              <div className="p-8 text-center flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">No builds recorded yet</span>
                <span className="text-xs text-muted-foreground/60">
                  Run a pipeline or build a project to see results here
                </span>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentBuilds.map((b) => (
                  <RecentBuildRow key={b.id} build={b} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Quick Run */}
        <section className="flex flex-col gap-3 w-72 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Run
            </h2>
            <Link to="/pipelines" className="text-xs text-primary hover:underline">
              Manage →
            </Link>
          </div>

          <div className="rounded-lg border border-border overflow-hidden bg-card">
            {pipelinesError ? (
              <ErrorCard
                message="Could not load pipelines"
                onRetry={retryPipelines}
              />
            ) : pipelinesLoading ? (
              <div className="p-4">
                <SkeletonRows count={3} />
              </div>
            ) : !pipelines || pipelines.length === 0 ? (
              <div className="p-6 text-center flex flex-col gap-2">
                <span className="text-sm text-muted-foreground italic">No pipelines yet</span>
                <Link to="/pipelines" className="text-xs text-primary hover:underline">
                  Create one →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {pipelines.slice(0, 7).map((p) => (
                  <QuickRunRow
                    key={p.name}
                    pipeline={p}
                    isRunning={runningPipelines.has(p.name)}
                    onRun={handleRun}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

function RecentBuildRow({ build }: { build: BuildRunRowApi }) {
  return (
    <Link
      to="/builds/$jobId"
      params={{ jobId: String(build.id) }}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors"
    >
      <StatusBadge status={build.status} />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-foreground/80 truncate block">
          {build.pipeline_name ?? (
            <span className="italic text-muted-foreground">ad-hoc</span>
          )}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground truncate block">
          {build.project_name}
        </span>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-[10px] text-muted-foreground/70 tabular-nums">
          {timeAgo(build.started_at)}
        </span>
        {build.duration_ms != null && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            {formatDuration(build.duration_ms)}
          </span>
        )}
      </div>
    </Link>
  );
}

function QuickRunRow({
  pipeline,
  isRunning,
  onRun,
}: {
  pipeline: PipelineListItem;
  isRunning: boolean;
  onRun: (name: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-accent/20 transition-colors">
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-foreground truncate block">{pipeline.name}</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {pipeline.steps.length} step{pipeline.steps.length !== 1 ? 's' : ''}
          </span>
          {pipeline.lastRun && <StatusDot status={pipeline.lastRun.status} />}
        </div>
      </div>
      <Button
        size="sm"
        className="h-7 px-2.5 text-xs shrink-0"
        onClick={() => onRun(pipeline.name)}
        disabled={isRunning}
        title={`Run ${pipeline.name}`}
      >
        {isRunning ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <Play size={11} />
        )}
      </Button>
    </div>
  );
}
