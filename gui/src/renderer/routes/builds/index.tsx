import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { buildsQuery } from '@/api/queries';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDuration, timeAgo } from '@/lib/utils';
import { useState } from 'react';
import { Hammer, Loader2, ExternalLink } from 'lucide-react';
import type { BuildRunRowApi } from '@shared/api';

export const Route = createFileRoute('/builds/')({
  component: BuildsView,
});

function BuildsView() {
  const [statusFilter, setStatusFilter] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const { data: builds, isLoading } = useQuery(buildsQuery({ limit: 200 }));

  const activeBuilds = builds?.filter((b) => b.status === 'running') ?? [];
  const pastBuilds = builds?.filter((b) => b.status !== 'running') ?? [];

  const filtered = pastBuilds.filter((b) => {
    if (statusFilter && b.status !== statusFilter) return false;
    if (pipelineFilter && (b.pipeline_name ?? '') !== pipelineFilter) return false;
    return true;
  });

  const pipelines = [...new Set(builds?.map((b) => b.pipeline_name).filter(Boolean) ?? [])];
  const statuses = [...new Set(pastBuilds.map((b) => b.status))];

  return (
    <div className="p-6 flex flex-col gap-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Hammer size={18} className="text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Builds</h1>
          <p className="text-xs text-muted-foreground">
            {builds?.length ?? 0} total builds recorded
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
          <Loader2 size={14} className="animate-spin" />
          <span>Loading builds...</span>
        </div>
      ) : (
        <>
          {/* Active builds section */}
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

          {/* Build history section */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Build History
              </h2>
              <div className="flex items-center gap-2">
                <select
                  value={pipelineFilter}
                  onChange={(e) => setPipelineFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All pipelines</option>
                  {pipelines.map((p) => (
                    <option key={p} value={p!}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All statuses</option>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-card text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Time</th>
                    <th className="text-left px-4 py-2.5 font-medium">Pipeline / Step</th>
                    <th className="text-left px-4 py-2.5 font-medium">Project</th>
                    <th className="text-left px-4 py-2.5 font-medium">Duration</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-muted-foreground italic"
                      >
                        No builds found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((b) => <BuildRow key={b.id} build={b} />)
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function BuildRow({ build }: { build: BuildRunRowApi }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-accent/30 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-2.5 text-muted-foreground">{timeAgo(build.started_at)}</td>
        <td className="px-4 py-2.5">
          <span className="text-foreground/80">
            {build.pipeline_name ?? <span className="italic text-muted-foreground">ad-hoc</span>}
          </span>
          {build.step_index != null && (
            <span className="text-muted-foreground ml-1">- step {build.step_index + 1}</span>
          )}
        </td>
        <td className="px-4 py-2.5 font-mono text-muted-foreground max-w-48 truncate">
          {build.project_name}
        </td>
        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
          {formatDuration(build.duration_ms)}
        </td>
        <td className="px-4 py-2.5">
          <StatusBadge status={build.status} />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-card/50">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex flex-col gap-1.5">
              <DetailRow label="Path" value={build.project_path} mono />
              <DetailRow label="Command" value={build.command} mono />
              {build.java_home && <DetailRow label="JAVA_HOME" value={build.java_home} mono />}
              {build.exit_code != null && (
                <DetailRow label="Exit code" value={String(build.exit_code)} />
              )}
              {build.finished_at && (
                <DetailRow
                  label="Finished"
                  value={new Date(build.finished_at).toLocaleString()}
                />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className={mono ? 'font-mono text-foreground/70 break-all' : 'text-foreground/70'}>
        {value}
      </span>
    </div>
  );
}
