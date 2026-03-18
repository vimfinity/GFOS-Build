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
import { SearchField } from '@/components/ui/search-field';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Plus, Workflow, Search, AlertCircle, RefreshCw } from 'lucide-react';
import type { PipelineListItem } from '@gfos-build/contracts';

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
  const filtered = (pipelines ?? []).filter((pipeline) => {
    if (!searchText.trim()) return true;
    return pipeline.name.toLowerCase().includes(searchText.trim().toLowerCase());
  });

  async function handleRun(name: string, from?: string) {
    setRunningPipelines((s) => new Set(s).add(name));
    try {
      const { jobId } = await runPipeline.mutateAsync({ name, from });
      void navigate({ to: '/builds/$jobId', params: { jobId } });
    } finally {
      setRunningPipelines((s) => {
        const next = new Set(s);
        next.delete(name);
        return next;
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
      steps: data.steps.map((step) =>
        step.buildSystem === 'node'
          ? {
              path: step.path,
              label: step.label || undefined,
              buildSystem: 'node' as const,
              commandType: step.commandType,
              script: step.commandType === 'script' ? step.script.trim() : undefined,
              args: step.args.split(/\s+/).filter(Boolean),
              executionMode: step.executionMode,
            }
          : {
              path: step.path,
              label: step.label || undefined,
              modulePath: step.mavenModulePath || undefined,
              goals: step.mavenGoals,
              optionKeys: step.mavenOptionKeys,
              profileStates: step.mavenProfileStates,
              extraOptions: step.mavenExtraOptions,
              executionMode: step.executionMode,
              javaVersion: step.javaVersion || undefined,
              buildSystem: 'maven' as const,
            },
      ),
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title text-[1.6rem] font-semibold leading-tight text-foreground">
            Pipelines
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage reusable build sequences for your projects.
          </p>
        </div>
        {(pipelines?.length ?? 0) > 0 ? (
          <Button
            size="sm"
            onClick={() => {
              setEditTarget(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={14} />
            Create pipeline
          </Button>
        ) : null}
      </div>

      {!isLoading && !isError && (pipelines?.length ?? 0) > 0 && (
        <SearchField
          value={searchText}
          onChange={setSearchText}
          placeholder="Search pipelines..."
          className="max-w-sm"
        />
      )}

      {isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <div className="glass-card flex flex-col items-center gap-4 rounded-[24px] border border-border px-8 py-16 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle size={28} className="text-destructive" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Failed to load pipelines</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The desktop runtime may be unavailable. Retry after the app recovers.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw size={13} />
            Retry
          </Button>
        </div>
      ) : !pipelines?.length ? (
        <div className="glass-card flex flex-col items-center gap-4 rounded-[24px] border border-border px-8 py-16 text-center">
          <div className="icon-chip flex h-14 w-14 items-center justify-center rounded-full">
            <Workflow size={28} className="text-primary" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">No pipelines yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first reusable flow for Maven or Node projects.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditTarget(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={14} />
            Create your first pipeline
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 rounded-[24px] border border-border px-8 py-14 text-center">
          <Search size={24} className="text-muted-foreground" />
          <p className="text-base font-semibold text-foreground">
            No pipelines match &quot;{searchText}&quot;
          </p>
          <button
            className="text-sm font-medium text-primary"
            onClick={() => setSearchText('')}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((pipeline) => (
            <PipelineCard
              key={pipeline.name}
              pipeline={pipeline}
              onRun={handleRun}
              onEdit={() => handleEdit(pipeline)}
              onDelete={() => void handleDelete(pipeline.name)}
              isRunning={runningPipelines.has(pipeline.name)}
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
