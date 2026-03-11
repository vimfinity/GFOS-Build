import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pipelinesQuery, configQuery, useRunPipeline, useCreatePipeline, useUpdatePipeline, useDeletePipeline, useSaveConfig } from '@/api/queries';
import { PipelineCard } from '@/components/PipelineCard';
import { PipelineDialog, type PipelineFormData } from '@/components/PipelineDialog';
import { OnboardingDialog } from '@/components/OnboardingDialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import type { PipelineListItem } from '@shared/api';

export const Route = createFileRoute('/')({
  component: PipelinesView,
});

function PipelinesView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pipelines, isLoading } = useQuery(pipelinesQuery);
  const { data: configData } = useQuery(configQuery);
  const runPipeline = useRunPipeline();
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();
  const saveConfig = useSaveConfig();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PipelineListItem | null>(null);
  const [runningPipelines, setRunningPipelines] = useState<Set<string>>(new Set());

  // Show onboarding when config has no roots
  const needsOnboarding = configData && Object.keys(configData.config.roots).length === 0;

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

  async function handleOnboardingComplete(config: {
    roots: Record<string, string>;
    maven: { executable: string; defaultGoals: string[]; defaultFlags: string[] };
    jdkRegistry: Record<string, string>;
  }) {
    await saveConfig.mutateAsync(config);
    void queryClient.invalidateQueries({ queryKey: ['config'] });
    void queryClient.invalidateQueries({ queryKey: ['pipelines'] });
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Pipelines</h1>
          <p className="text-xs text-muted-foreground">
            {pipelines?.length ?? 0} pipeline{(pipelines?.length ?? 0) !== 1 ? 's' : ''} configured
          </p>
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

      {/* Pipeline cards */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
          <Loader2 size={14} className="animate-spin" />
          <span>Loading pipelines...</span>
        </div>
      ) : !pipelines?.length ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
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
      ) : (
        <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
          {pipelines.map((p) => (
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

      {/* Pipeline create/edit dialog */}
      <PipelineDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editTarget ?? undefined}
        onSave={(data) => void handleSave(data)}
        mode={editTarget ? 'edit' : 'create'}
      />

      {/* Onboarding dialog */}
      {needsOnboarding && (
        <OnboardingDialog
          open={true}
          onComplete={(config) => void handleOnboardingComplete(config)}
        />
      )}
    </div>
  );
}
