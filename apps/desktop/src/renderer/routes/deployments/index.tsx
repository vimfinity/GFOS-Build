import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deploymentWorkflowsQuery,
  getDeploymentWorkflow,
  useCreateDeploymentWorkflow,
  useDeleteDeploymentWorkflow,
  useRunDeploymentWorkflow,
  useUpdateDeploymentWorkflow,
  configQuery,
} from '@/api/queries';
import { DeploymentEditor, serializeDeploymentWorkflow, type DeploymentWorkflowFormValue } from '@/components/DeploymentEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchField } from '@/components/ui/search-field';
import { useMemo, useState } from 'react';
import { Loader2, Play, Plus, Trash2, Pencil } from 'lucide-react';

export const Route = createFileRoute('/deployments/')({
  component: DeploymentsView,
});

function DeploymentsView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workflows, isLoading } = useQuery(deploymentWorkflowsQuery);
  const { data: configData } = useQuery(configQuery);
  const createWorkflow = useCreateDeploymentWorkflow();
  const updateWorkflow = useUpdateDeploymentWorkflow();
  const deleteWorkflow = useDeleteDeploymentWorkflow();
  const runWorkflow = useRunDeploymentWorkflow();
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorValue, setEditorValue] = useState<Partial<DeploymentWorkflowFormValue> | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filtered = useMemo(
    () => (workflows ?? []).filter((workflow) => workflow.name.toLowerCase().includes(search.trim().toLowerCase())),
    [workflows, search],
  );

  async function handleEdit(name: string) {
    const workflow = await getDeploymentWorkflow(name);
    if (!workflow || typeof workflow !== 'object') return;
    const definition = workflow as Record<string, unknown>;
    setEditorValue({
      name,
      description: String(definition['description'] ?? ''),
      projectPath: String(definition['projectPath'] ?? ''),
      environmentName: String(definition['environmentName'] ?? ''),
      standaloneProfileName: String(definition['standaloneProfileName'] ?? ''),
      cleanupPresetName: String(definition['cleanupPresetName'] ?? ''),
      startupPresetName: String(definition['startupPresetName'] ?? ''),
      deployMode: (definition['deployMode'] as DeploymentWorkflowFormValue['deployMode']) ?? 'filesystem-scanner',
      artifactSelection: definition['artifactSelector'] && typeof definition['artifactSelector'] === 'object'
        ? ((((definition['artifactSelector'] as Record<string, unknown>)['kind'] as string) === 'module')
            ? `${String((definition['artifactSelector'] as Record<string, unknown>)['modulePath'] ?? '')}|${String((definition['artifactSelector'] as Record<string, unknown>)['packaging'] ?? '')}`
            : String((definition['artifactSelector'] as Record<string, unknown>)['kind'] ?? 'auto'))
        : 'auto',
      explicitArtifactFile: definition['artifactSelector'] && typeof definition['artifactSelector'] === 'object'
        ? String((definition['artifactSelector'] as Record<string, unknown>)['fileName'] ?? '')
        : '',
      startServer: Boolean(definition['startServer'] ?? true),
    });
    setEditorOpen(true);
  }

  async function handleSave(value: DeploymentWorkflowFormValue) {
    const payload = serializeDeploymentWorkflow(value, configData?.config.wildfly.environments ?? {});
    if (editorValue?.name && editorValue.name === value.name) {
      await updateWorkflow.mutateAsync({ name: value.name, workflow: payload });
    } else {
      await createWorkflow.mutateAsync({ name: value.name, workflow: payload });
    }
    await queryClient.invalidateQueries({ queryKey: ['deployment-workflows'] });
  }

  async function handleRun(name: string) {
    const { jobId } = await runWorkflow.mutateAsync({ name });
    void navigate({ to: '/builds/$jobId', params: { jobId } });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title text-[1.6rem] font-semibold leading-tight text-foreground">Deployments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage reusable WildFly deployment workflows.</p>
        </div>
        <Button size="sm" onClick={() => { setEditorValue(undefined); setEditorOpen(true); }}>
          <Plus size={14} />
          New deployment
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="text-sm">Saved deployment workflows</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-5">
          <SearchField value={search} onChange={setSearch} placeholder="Search deployments..." />
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Loading deployment workflows...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deployment workflows found.</p>
          ) : (
            filtered.map((workflow) => (
              <div key={workflow.name} className="flex items-center gap-3 rounded-[18px] border border-border bg-secondary/30 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{workflow.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {workflow.environmentName} · {workflow.deployMode} · {workflow.startServer ? 'starts server' : 'deploy only'}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => void handleRun(workflow.name)}>
                  <Play size={12} />
                  Run
                </Button>
                <Button size="icon" variant="outline" onClick={() => void handleEdit(workflow.name)} aria-label={`Edit ${workflow.name}`}>
                  <Pencil size={12} />
                </Button>
                <Button size="icon" variant="destructive" onClick={() => setDeleteTarget(workflow.name)} aria-label={`Delete ${workflow.name}`}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <DeploymentEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialValue={editorValue}
        onSave={(value) => void handleSave(value)}
        title={editorValue?.name ? `Edit "${editorValue.name}"` : 'Create deployment workflow'}
        description="Configure a reusable local WildFly deployment workflow."
        confirmLabel={editorValue?.name ? 'Save workflow' : 'Create workflow'}
      />

      {deleteTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-border bg-card p-6 shadow-lg">
            <p className="text-base font-semibold text-foreground">Delete deployment workflow?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              "{deleteTarget}" will be removed from GFOS Build.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  void deleteWorkflow.mutateAsync(deleteTarget).then(async () => {
                    setDeleteTarget(null);
                    await queryClient.invalidateQueries({ queryKey: ['deployment-workflows'] });
                  });
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
