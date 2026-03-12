import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  pipelinesQuery,
  useRunPipeline,
  useCreatePipeline,
  useUpdatePipeline,
  useDeletePipeline,
} from '@/api/queries';
import { PipelineCard } from '@/components/PipelineCard';
import { PipelineDialog, type PipelineFormData } from '@/components/PipelineDialog';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Plus, Workflow, Search, AlertCircle, RefreshCw } from 'lucide-react';
import type { PipelineListItem } from '@shared/api';

export const Route = createFileRoute('/pipelines/')({
  component: PipelinesView,
});

function PipelinesView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pipelines, isLoading, isError, refetch } = useQuery(pipelinesQuery);
  const runPipeline = useRunPipeline();
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PipelineListItem | null>(null);
  const [runningPipelines, setRunningPipelines] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');

  const filtered = (pipelines ?? []).filter((p) => {
    if (!searchText.trim()) return true;
    return p.name.toLowerCase().includes(searchText.trim().toLowerCase());
  });

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

  function handleEdit(pipeline: PipelineListItem) {
    setEditTarget(pipeline);
    setDialogOpen(true);
  }

  async function handleDelete(name: string) {
    await deletePipeline.mutateAsync(name);
    void queryClient.invalidateQueries({ queryKey: ['pipelines'] });
  }

  async function handleSave(data: PipelineFormData) {
    const payload = {
      description: data.description || undefined,
      failFast: data.failFast,
      steps: data.steps.map((s) => ({
        path: s.path,
        label: s.label || undefined,
        goals: s.goals.split(/\s+/).filter(Boolean),
        flags: s.flags.split(/\s+/).filter(Boolean),
        javaVersion: s.javaVersion || undefined,
        buildSystem: s.buildSystem as 'maven' | 'npm',
      })),
    };

    if (editTarget) {
      await updatePipeline.mutateAsync({ name: data.name, pipeline: payload });
    } else {
      await createPipeline.mutateAsync({ name: data.name, pipeline: payload });
    }

    void queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    setEditTarget(null);
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Workflow size={18} className="text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Pipelines</h1>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? 'Loading…'
                : isError
                  ? 'Failed to load'
                  : `${pipelines?.length ?? 0} pipeline${(pipelines?.length ?? 0) !== 1 ? 's' : ''} configured`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditTarget(null);
            setDialogOpen(true);
          }}
        >
          <Plus size={14} /> Create pipeline
        </Button>
      </div>

      {/* Search bar — only visible when pipelines are loaded and non-empty */}
      {!isLoading && !isError && (pipelines?.length ?? 0) > 0 && (
        <div className="relative max-w-sm">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search pipelines…"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* Pipeline cards */}
      {isLoading ? (
        <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <AlertCircle size={32} className="text-destructive/50" />
          <p className="text-sm text-destructive">Failed to load pipelines.</p>
          <p className="text-xs text-center max-w-xs">
            The server may be unavailable. Check the app status and try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw size={13} /> Retry
          </Button>
        </div>
      ) : !pipelines?.length ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <Workflow size={32} className="text-border" />
          <p className="text-sm">No pipelines configured yet.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditTarget(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={14} /> Create your first pipeline
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Search size={28} className="text-border" />
          <p className="text-sm">No pipelines match &quot;{searchText}&quot;.</p>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => setSearchText('')}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
          {filtered.map((p) => (
            <PipelineCard
              key={p.name}
              pipeline={p}
              onRun={handleRun}
              onEdit={() => handleEdit(p)}
              onDelete={() => void handleDelete(p.name)}
              isRunning={runningPipelines.has(p.name)}
            />
          ))}
        </div>
      )}

      <PipelineDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editTarget ?? undefined}
        onSave={(data) => void handleSave(data)}
        mode={editTarget ? 'edit' : 'create'}
      />
    </div>
  );
}
