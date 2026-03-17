import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { buildStatsQuery } from '@/api/queries';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { formatDuration, cn } from '@/lib/utils';
import { BarChart3, CheckCircle2, Timer, XCircle, RefreshCw, Gauge } from 'lucide-react';

export const Route = createFileRoute('/stats/')({
  component: StatsView,
});

function MiniBar({ success, total }: { success: number; total: number }) {
  const pct = total > 0 ? (success / total) * 100 : 0;
  return (
    <div className="h-2 w-28 overflow-hidden rounded-full bg-destructive/12">
      <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
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
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
          <div className="icon-chip flex h-8 w-8 items-center justify-center rounded-full">
            <Icon size={14} className={iconClass} />
          </div>
        </div>
        <div>
          <div className={cn('page-title text-[1.75rem] font-bold leading-none tracking-[-0.04em] text-foreground', valueClass)}>
            {value}
          </div>
          {sub && <div className="mt-2">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function SuccessRateBar({ success, total }: { success: number; total: number }) {
  const pct = total > 0 ? (success / total) * 100 : 0;
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Statistics
          </p>
          <h1 className="page-title mt-2 text-[2rem] font-semibold leading-none text-foreground">
            Build performance analytics
          </h1>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-4 py-24">
        <div className="rounded-full bg-destructive/10 p-4">
          <XCircle size={22} className="text-destructive" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">Failed to load statistics</p>
          <p className="mt-2 text-sm text-muted-foreground">Could not reach the desktop runtime.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ['builds', 'stats'] })}
        >
          <RefreshCw size={13} />
          Retry
        </Button>
      </div>
    );
  }

  const stats = data!;
  const successRate =
    stats.totalBuilds > 0 ? Math.round((stats.successCount / stats.totalBuilds) * 100) : 0;

  if (stats.totalBuilds === 0) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-4 py-24">
        <div className="rounded-full bg-primary/10 p-4">
          <BarChart3 size={26} className="text-primary" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">No build data yet</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Run a pipeline or build a project to start seeing analytics here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="page-title text-[1.6rem] font-semibold leading-tight text-foreground">
          Statistics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review build success, duration, and your slowest execution hotspots.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Builds"
          value={String(stats.totalBuilds)}
          icon={BarChart3}
          iconClass="text-primary"
        />
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Success Rate
              </span>
              <div className="icon-chip flex h-8 w-8 items-center justify-center rounded-full">
                <CheckCircle2 size={14} className="text-success" />
              </div>
            </div>
            <div>
              <div className="page-title text-[1.75rem] font-bold leading-none tracking-[-0.04em] text-foreground">
                {successRate}%
              </div>
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
          label="Failures"
          value={String(stats.failureCount)}
          valueClass={stats.failureCount > 0 ? 'text-destructive' : undefined}
          icon={Gauge}
          iconClass={stats.failureCount > 0 ? 'text-destructive' : 'text-muted-foreground'}
          sub={<p className="text-xs text-muted-foreground">Runs that did not complete successfully</p>}
        />
      </div>

      <StatTable
        title="Pipeline Breakdown"
        empty="No pipeline build data recorded yet."
        headers={['Pipeline', 'Runs', 'Success Rate', 'Avg Duration']}
        rows={
          stats.byPipeline.length === 0
            ? []
            : stats.byPipeline.map((row) => (
                <tr key={row.name} className="transition-colors hover:bg-accent/35">
                  <td className="px-5 py-3 font-medium text-foreground">{row.name}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{row.runs}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-9 shrink-0 text-muted-foreground">
                        {row.runs > 0 ? Math.round((row.successes / row.runs) * 100) : 0}%
                      </span>
                      <MiniBar success={row.successes} total={row.runs} />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-muted-foreground">
                    {formatDuration(row.avgMs)}
                  </td>
                </tr>
              ))
        }
      />

      <StatTable
        title={`Project Breakdown${stats.byProject.length > 10 ? ` (top 10 of ${stats.byProject.length})` : ''}`}
        empty="No project build data recorded yet."
        headers={['Project', 'Runs', 'Success Rate', 'Avg Duration']}
        rows={
          stats.byProject.length === 0
            ? []
            : stats.byProject.slice(0, 10).map((row) => (
                <tr key={row.path} className="transition-colors hover:bg-accent/35">
                  <td className="max-w-80 px-5 py-3">
                    <span className="block truncate font-medium text-foreground">{row.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{row.path}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{row.runs}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-9 shrink-0 text-muted-foreground">
                        {row.runs > 0 ? Math.round((row.successes / row.runs) * 100) : 0}%
                      </span>
                      <MiniBar success={row.successes} total={row.runs} />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-muted-foreground">
                    {formatDuration(row.avgMs)}
                  </td>
                </tr>
              ))
        }
      />

      {stats.slowestSteps.length > 0 && (
        <StatTable
          title="Slowest Steps"
          empty="No slow-step data recorded yet."
          headers={['Step / Project', 'Avg Duration', 'Runs']}
          rows={stats.slowestSteps.map((step, index) => (
            <tr key={index} className="transition-colors hover:bg-accent/35">
              <td className="max-w-80 px-5 py-3">
                <span className="block truncate font-medium text-foreground">{step.label}</span>
                <span className="block truncate font-mono text-xs text-muted-foreground">{step.path}</span>
              </td>
              <td className="px-5 py-3 text-right font-mono font-medium text-warning">
                {formatDuration(step.avgMs)}
              </td>
              <td className="px-5 py-3 text-right text-muted-foreground">{step.runs}</td>
            </tr>
          ))}
        />
      )}
    </div>
  );
}

function StatTable({
  title,
  empty,
  headers,
  rows,
}: {
  title: string;
  empty: string;
  headers: string[];
  rows: React.ReactNode[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">{empty}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/55 text-muted-foreground">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.12em]"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">{rows}</tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
