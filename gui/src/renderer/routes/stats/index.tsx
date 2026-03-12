import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { buildStatsQuery } from '@/api/queries';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { formatDuration, cn } from '@/lib/utils';
import { BarChart3, CheckCircle2, Timer, XCircle, RefreshCw } from 'lucide-react';

export const Route = createFileRoute('/stats/')({
  component: StatsView,
});

function MiniBar({ success, total }: { success: number; total: number }) {
  const pct = total > 0 ? (success / total) * 100 : 0;
  return (
    <div className="flex h-1.5 w-24 rounded-full overflow-hidden bg-destructive/20">
      <div
        className="bg-success rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  valueClass,
  icon: Icon,
  iconClass,
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  icon: React.ElementType;
  iconClass: string;
  sub?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <Icon size={15} className={iconClass} />
        </div>
        <div>
          <span
            className={cn(
              'text-2xl font-bold tabular-nums tracking-tight',
              valueClass ?? 'text-foreground',
            )}
          >
            {value}
          </span>
          {sub && <div className="mt-1">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function SuccessRateBar({ success, total }: { success: number; total: number }) {
  const pct = total > 0 ? (success / total) * 100 : 0;
  return (
    <div className="flex flex-col gap-1 mt-1.5">
      <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
        <div
          className="h-full bg-success rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {success} of {total} succeeded
      </p>
    </div>
  );
}

function StatsView() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery(buildStatsQuery);

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col gap-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <BarChart3 size={18} className="text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Statistics</h1>
            <p className="text-xs text-muted-foreground">Build performance analytics</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard className="h-48" />
        <SkeletonCard className="h-48" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 py-24">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <XCircle size={22} className="text-destructive" />
        </div>
        <div className="text-center flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">Failed to load statistics</p>
          <p className="text-xs text-muted-foreground">Could not reach the build server.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ['builds', 'stats'] })}
        >
          <RefreshCw size={13} /> Retry
        </Button>
      </div>
    );
  }

  const stats = data!;
  const successRate =
    stats.totalBuilds > 0 ? Math.round((stats.successCount / stats.totalBuilds) * 100) : 0;

  if (stats.totalBuilds === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 py-24">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <BarChart3 size={26} className="text-primary" />
        </div>
        <div className="text-center flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-foreground">No build data yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Run a pipeline or build a project to start seeing analytics here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 size={18} className="text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Statistics</h1>
          <p className="text-xs text-muted-foreground">Build performance analytics</p>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Total Builds"
          value={String(stats.totalBuilds)}
          icon={BarChart3}
          iconClass="text-primary"
        />
        <Card>
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Success Rate</span>
              <CheckCircle2 size={15} className="text-success" />
            </div>
            <div>
              <span className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
                {successRate}%
              </span>
              <SuccessRateBar success={stats.successCount} total={stats.totalBuilds} />
            </div>
          </CardContent>
        </Card>
        <SummaryCard
          label="Avg Duration"
          value={formatDuration(stats.avgDurationMs)}
          icon={Timer}
          iconClass="text-warning"
        />
        <SummaryCard
          label="Total Failures"
          value={String(stats.failureCount)}
          valueClass={stats.failureCount > 0 ? 'text-destructive' : 'text-foreground'}
          icon={XCircle}
          iconClass={stats.failureCount > 0 ? 'text-destructive' : 'text-muted-foreground'}
        />
      </div>

      {/* Pipeline Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pipeline Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.byPipeline.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground italic">
              No pipeline build data recorded yet.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-background/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Pipeline
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                    Runs
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Success Rate
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                    Avg Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stats.byPipeline.map((row) => (
                  <tr key={row.name} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {row.runs}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground tabular-nums w-8 shrink-0">
                          {row.runs > 0 ? Math.round((row.successes / row.runs) * 100) : 0}%
                        </span>
                        <MiniBar success={row.successes} total={row.runs} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {formatDuration(row.avgMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Project Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Project Breakdown
            {stats.byProject.length > 10 && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                (top 10 of {stats.byProject.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.byProject.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground italic">
              No project build data recorded yet.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-background/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Project
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                    Runs
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Success Rate
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                    Avg Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stats.byProject.slice(0, 10).map((row) => (
                  <tr key={row.path} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2.5 max-w-64">
                      <span className="font-medium text-foreground block truncate">{row.name}</span>
                      <span className="font-mono text-muted-foreground/70 block truncate">
                        {row.path}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {row.runs}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground tabular-nums w-8 shrink-0">
                          {row.runs > 0 ? Math.round((row.successes / row.runs) * 100) : 0}%
                        </span>
                        <MiniBar success={row.successes} total={row.runs} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {formatDuration(row.avgMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Slowest Steps */}
      {stats.slowestSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Slowest Steps</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="bg-background/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Step / Project
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                    Avg Duration
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                    Runs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stats.slowestSteps.map((step, idx) => (
                  <tr key={idx} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2.5 max-w-72">
                      <span className="font-medium text-foreground block truncate">
                        {step.label}
                      </span>
                      <span className="font-mono text-muted-foreground/70 block truncate">
                        {step.path}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-warning tabular-nums font-medium">
                      {formatDuration(step.avgMs)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {step.runs}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
