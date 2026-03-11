import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { buildsQuery } from '@/api/queries';
import { StatusBadge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectContent, SelectOption } from '@/components/ui/select';
import { formatDuration, timeAgo } from '@/lib/utils';
import { useState } from 'react';
import { History } from 'lucide-react';
import type { BuildRunRowApi } from '@shared/api';

export const Route = createFileRoute('/history/')({
  component: BuildHistoryView,
});

function BuildHistoryView() {
  const [pipelineFilter, setPipelineFilter] = useState('');
  const { data: builds } = useQuery(buildsQuery({ limit: 200 }));

  const filtered = builds?.filter((b) =>
    !pipelineFilter || (b.pipeline_name ?? '').toLowerCase().includes(pipelineFilter.toLowerCase()),
  ) ?? [];

  // Unique pipeline names for filter dropdown
  const pipelines = [...new Set(builds?.map((b) => b.pipeline_name).filter(Boolean) ?? [])];

  return (
    <div className="p-6 flex flex-col gap-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History size={18} className="text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Build History</h1>
            <p className="text-xs text-muted-foreground">{builds?.length ?? 0} total builds recorded</p>
          </div>
        </div>

        {/* Filter — Base UI Select with translucent popup */}
        <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
          <SelectTrigger placeholder="All pipelines" />
          <SelectContent>
            <SelectOption value="">All pipelines</SelectOption>
            {pipelines.map((p) => (
              <SelectOption key={p} value={p!}>{p}</SelectOption>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
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
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                  No builds found
                </td>
              </tr>
            ) : (
              filtered.map((b) => <BuildRow key={b.id} build={b} />)
            )}
          </tbody>
        </table>
      </div>
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
          <span className="text-foreground/80">{build.pipeline_name ?? <span className="italic text-muted-foreground">ad-hoc</span>}</span>
          {build.step_index != null && (
            <span className="text-muted-foreground ml-1">· step {build.step_index + 1}</span>
          )}
        </td>
        <td className="px-4 py-2.5 font-mono text-muted-foreground max-w-48 truncate">{build.project_name}</td>
        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{formatDuration(build.duration_ms)}</td>
        <td className="px-4 py-2.5"><StatusBadge status={build.status} /></td>
      </tr>
      {expanded && (
        <tr className="bg-card/50">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex flex-col gap-1.5">
              <DetailRow label="Path" value={build.project_path} mono />
              <DetailRow label="Command" value={build.command} mono />
              {build.java_home && <DetailRow label="JAVA_HOME" value={build.java_home} mono />}
              {build.exit_code != null && <DetailRow label="Exit code" value={String(build.exit_code)} />}
              {build.finished_at && <DetailRow label="Finished" value={new Date(build.finished_at).toLocaleString()} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className={mono ? 'font-mono text-foreground/70 break-all' : 'text-foreground/70'}>{value}</span>
    </div>
  );
}
