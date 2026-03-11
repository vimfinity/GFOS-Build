import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { pipelinesQuery, buildsQuery, useRunPipeline } from '@/api/queries';
import { PipelineCard } from '@/components/PipelineCard';
import { StatusBadge } from '@/components/ui/badge';
import { formatDuration, timeAgo } from '@/lib/utils';
import { useState } from 'react';
import { Loader2, Cpu } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { data: pipelines, isLoading: plLoading } = useQuery(pipelinesQuery);
  const { data: recentBuilds } = useQuery(buildsQuery({ limit: 8 }));
  const runPipeline = useRunPipeline();
  const [runningPipelines, setRunningPipelines] = useState<Set<string>>(new Set());

  async function handleRun(name: string) {
    setRunningPipelines((s) => new Set(s).add(name));
    try {
      const { jobId } = await runPipeline.mutateAsync(name);
      void navigate({ to: '/pipelines/$name', params: { name }, search: { jobId } });
    } finally {
      setRunningPipelines((s) => { const n = new Set(s); n.delete(name); return n; });
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu size={20} className="text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">GFOS Build</h1>
            <p className="text-xs text-muted-foreground">Build orchestration dashboard</p>
          </div>
        </div>
      </div>

      {/* Pipelines section */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pipelines</h2>
        {plLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
            <Loader2 size={14} className="animate-spin" />
            <span>Loading pipelines…</span>
          </div>
        ) : !pipelines?.length ? (
          <p className="text-sm text-muted-foreground italic p-4 border border-border rounded-lg">
            No pipelines configured. Edit your config file to add pipelines.
          </p>
        ) : (
          <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
            {pipelines.map((p) => (
              <PipelineCard
                key={p.name}
                pipeline={p}
                onRun={handleRun}
                isRunning={runningPipelines.has(p.name)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent builds */}
      {recentBuilds && recentBuilds.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent builds</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-card text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Project</th>
                  <th className="text-left px-4 py-2 font-medium">Pipeline</th>
                  <th className="text-left px-4 py-2 font-medium">Duration</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {recentBuilds.map((b) => (
                  <tr key={b.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-foreground/80">{b.project_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{b.pipeline_name ?? <span className="italic">ad-hoc</span>}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDuration(b.duration_ms)}</td>
                    <td className="px-4 py-2"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-2 text-muted-foreground/60 text-right">{timeAgo(b.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
