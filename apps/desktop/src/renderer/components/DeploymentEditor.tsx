import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type {
  DeployableArtifactCandidate,
  DeploymentPlanPreview,
  MavenOptionKey,
  MavenProfileState,
  Project,
  WildFlyEnvironmentConfig,
} from '@gfos-build/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input, NumberField } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import { ProjectPathPicker } from '@/components/ProjectPathPicker';
import { configQuery, inspectDeploymentProject, previewDeploymentPlan } from '@/api/queries';

export interface DeploymentWorkflowFormValue {
  name: string;
  description: string;
  projectPath: string;
  goals: string[];
  optionKeys: MavenOptionKey[];
  profileStates: Record<string, MavenProfileState>;
  extraOptions: string[];
  javaVersion: string;
  modulePath: string;
  environmentName: string;
  standaloneProfileName: string;
  cleanupPresetName: string;
  startupPresetName: string;
  deployMode: 'filesystem-scanner' | 'management-cli';
  artifactSelection: string;
  explicitArtifactFile: string;
  startServer: boolean;
  debugEnabled: boolean;
  debugPort: number;
  jrebelEnabled: boolean;
}

interface DeploymentEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: Partial<DeploymentWorkflowFormValue>;
  defaultProjectPath?: string;
  onSave: (value: DeploymentWorkflowFormValue) => void;
  title: string;
  description: string;
  confirmLabel: string;
}

const DEFAULT_VALUE: DeploymentWorkflowFormValue = {
  name: '',
  description: '',
  projectPath: '',
  goals: ['clean', 'install'],
  optionKeys: [],
  profileStates: {},
  extraOptions: [],
  javaVersion: '',
  modulePath: '',
  environmentName: '',
  standaloneProfileName: '',
  cleanupPresetName: '',
  startupPresetName: '',
  deployMode: 'filesystem-scanner',
  artifactSelection: 'auto',
  explicitArtifactFile: '',
  startServer: true,
  debugEnabled: false,
  debugPort: 8787,
  jrebelEnabled: false,
};

export function DeploymentEditor({
  open,
  onOpenChange,
  initialValue,
  defaultProjectPath,
  onSave,
  title,
  description,
  confirmLabel,
}: DeploymentEditorProps) {
  const { data: configData } = useQuery(configQuery);
  const [value, setValue] = useState<DeploymentWorkflowFormValue>(DEFAULT_VALUE);
  const [candidates, setCandidates] = useState<DeployableArtifactCandidate[]>([]);
  const [preview, setPreview] = useState<DeploymentPlanPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue({
      ...DEFAULT_VALUE,
      ...initialValue,
      projectPath: initialValue?.projectPath ?? defaultProjectPath ?? '',
    });
  }, [open, initialValue, defaultProjectPath]);

  const environments = configData?.config.wildfly.environments ?? {};
  const selectedEnvironment = value.environmentName ? environments[value.environmentName] : undefined;
  const standaloneProfiles = selectedEnvironment?.standaloneProfiles ?? {};
  const cleanupPresets = selectedEnvironment?.cleanupPresets ?? {};
  const startupPresets = selectedEnvironment?.startupPresets ?? {};

  useEffect(() => {
    if (!open || !value.projectPath) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    void inspectDeploymentProject(value.projectPath)
      .then((result) => {
        if (cancelled) return;
        setCandidates(result.deployableCandidates);
        setInspectError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setCandidates([]);
        setInspectError(error instanceof Error ? error.message : 'Could not inspect deployment project.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, value.projectPath]);

  useEffect(() => {
    if (!open || !value.projectPath || !value.environmentName || !value.standaloneProfileName) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const artifact = resolveArtifactPayload(value, candidates);
    setLoadingPreview(true);
    void previewDeploymentPlan({
      projectPath: value.projectPath,
      description: value.description || undefined,
      build: {
        modulePath: value.modulePath || undefined,
        submoduleBuildStrategy: 'root-pl',
        goals: value.goals,
        optionKeys: value.optionKeys,
        profileStates: value.profileStates,
        extraOptions: value.extraOptions,
        javaVersion: value.javaVersion || undefined,
      },
      artifactSelector: artifact,
      environmentName: value.environmentName,
      standaloneProfileName: value.standaloneProfileName,
      cleanupPresetName: value.cleanupPresetName || undefined,
      startupPresetName: value.startupPresetName || undefined,
      deployMode: value.deployMode,
      startServer: value.startServer,
    })
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, value, candidates]);

  const artifactOptions = useMemo(
    () => [
      { key: 'auto', label: 'Auto select' },
      ...candidates.map((candidate) => ({
        key: `${candidate.modulePath}|${candidate.packaging}`,
        label: `${candidate.modulePath || '.'} (${candidate.packaging})`,
      })),
      { key: 'explicit', label: 'Explicit file name' },
    ],
    [candidates],
  );

  function update<K extends keyof DeploymentWorkflowFormValue>(key: K, next: DeploymentWorkflowFormValue[K]) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  function handleResolvedProject(path: string, project?: Project) {
    update('projectPath', path);
    if (!value.name) {
      update('name', project?.name ?? path.split(/[\\/]/).pop() ?? '');
    }
  }

  function handleSubmit() {
    onSave(value);
    onOpenChange(false);
  }

  const canSave =
    value.name.trim().length > 0 &&
    value.projectPath.trim().length > 0 &&
    value.environmentName.trim().length > 0 &&
    value.standaloneProfileName.trim().length > 0 &&
    (value.artifactSelection === 'auto' || value.artifactSelection === 'explicit' || candidates.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[min(82dvh,860px)] overflow-hidden">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>

        <div className="mt-5 flex min-h-0 flex-1 gap-5 overflow-hidden lg:flex-row flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
            <div className="grid gap-4 lg:grid-cols-2">
              <Input
                label="Workflow name"
                placeholder="local-dev-deploy"
                required
                value={value.name}
                onChange={(event) => update('name', event.target.value)}
              />
              <Input
                label="Description"
                placeholder="Optional short summary"
                value={value.description}
                onChange={(event) => update('description', event.target.value)}
              />
            </div>

            <ProjectPathPicker
              value={value.projectPath}
              onChange={(next) => update('projectPath', next)}
              onResolvedPath={handleResolvedProject}
              label="Maven project path"
              placeholder="Select a Maven project..."
              allowedBuildSystems={['maven']}
              required
            />

            {inspectError ? (
              <div className="rounded-[18px] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {inspectError}
              </div>
            ) : null}

            <TagInput
              label="Maven goals"
              description="Build phases and goals to run before deployment, for example `clean install` or `package`."
              required
              value={value.goals}
              onChange={(next) => update('goals', next)}
              placeholder="clean"
            />
            <TagInput
              label="Extra Maven options"
              value={value.extraOptions}
              onChange={(next) => update('extraOptions', next)}
              placeholder="-DskipTests, -Pdev"
            />
            <Input
              label="JAVA_HOME override version"
              value={value.javaVersion}
              onChange={(event) => update('javaVersion', event.target.value)}
              placeholder="e.g. 21"
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Environment
                  <span className="ml-1 text-destructive">*</span>
                </label>
                <Select value={value.environmentName} onValueChange={(next) => update('environmentName', String(next ?? ''))}>
                  <SelectTrigger><SelectValue placeholder="Select WildFly environment" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(environments).map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Deploy mode</label>
                <Select value={value.deployMode} onValueChange={(next) => update('deployMode', next as DeploymentWorkflowFormValue['deployMode'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filesystem-scanner">Filesystem scanner</SelectItem>
                    <SelectItem value="management-cli">Management CLI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Standalone profile
                  <span className="ml-1 text-destructive">*</span>
                </label>
                <Select value={value.standaloneProfileName} onValueChange={(next) => update('standaloneProfileName', String(next ?? ''))}>
                  <SelectTrigger><SelectValue placeholder="Select standalone profile" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(standaloneProfiles).map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Cleanup preset</label>
                <Select value={value.cleanupPresetName} onValueChange={(next) => update('cleanupPresetName', String(next ?? ''))}>
                  <SelectTrigger><SelectValue placeholder="Optional cleanup preset" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(cleanupPresets).map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Startup preset</label>
                <Select value={value.startupPresetName} onValueChange={(next) => update('startupPresetName', String(next ?? ''))}>
                  <SelectTrigger><SelectValue placeholder="Optional startup preset" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(startupPresets).map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Artifact target</label>
                <Select value={value.artifactSelection} onValueChange={(next) => update('artifactSelection', String(next ?? ''))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {artifactOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {value.artifactSelection === 'explicit' ? (
              <Input
                label="Explicit artifact file name"
                value={value.explicitArtifactFile}
                onChange={(event) => update('explicitArtifactFile', event.target.value)}
                placeholder="e.g. app.ear"
              />
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
              <button
                type="button"
                aria-pressed={value.startServer}
                onClick={() => update('startServer', !value.startServer)}
                className={`toggle-pill ${value.startServer ? 'is-active' : ''}`}
              >
                Start WildFly
              </button>
              <button
                type="button"
                aria-pressed={value.debugEnabled}
                onClick={() => update('debugEnabled', !value.debugEnabled)}
                className={`toggle-pill ${value.debugEnabled ? 'is-active' : ''}`}
              >
                Debug enabled
              </button>
              <button
                type="button"
                aria-pressed={value.jrebelEnabled}
                onClick={() => update('jrebelEnabled', !value.jrebelEnabled)}
                className={`toggle-pill ${value.jrebelEnabled ? 'is-active' : ''}`}
              >
                JRebel enabled
              </button>
            </div>

            {value.debugEnabled ? (
              <NumberField
                label="Debug port"
                value={value.debugPort}
                onChange={(next) => update('debugPort', next)}
                min={1}
                max={65535}
              />
            ) : null}
          </div>

          <div className="w-full shrink-0 lg:w-[22rem] flex flex-col gap-4 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
            <div className="rounded-[20px] border border-border bg-secondary/35 px-4 py-4 text-sm">
              <p className="font-medium text-foreground">Detected deployable artifacts</p>
              <div className="mt-3 flex flex-col gap-2">
                {candidates.length === 0 ? (
                  <p className="text-muted-foreground">No deployable candidates detected yet.</p>
                ) : (
                  candidates.map((candidate) => (
                    <div key={`${candidate.modulePath}:${candidate.packaging}`} className="rounded-[16px] border border-border/70 bg-card/60 px-3 py-2">
                      <div className="text-xs font-medium text-foreground">{candidate.modulePath || '.'}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{candidate.packaging.toUpperCase()} · {candidate.expectedDefaultFileName ?? 'unknown file'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[20px] border border-border bg-secondary/35 px-4 py-4 text-sm">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">Deployment preview</p>
                {loadingPreview ? <Loader2 size={12} className="animate-spin text-muted-foreground" /> : null}
              </div>
              {preview ? (
                <div className="mt-3 space-y-3 text-xs text-muted-foreground">
                  <div>
                    <div className="font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Artifact</div>
                    <div className="mt-1 font-mono text-foreground break-all">{preview.resolvedArtifactPattern}</div>
                  </div>
                  <div>
                    <div className="font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Deploy mode</div>
                    <div className="mt-1 text-foreground">{preview.recommendedDeployMode}</div>
                  </div>
                  <div>
                    <div className="font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Startup command</div>
                    <div className="mt-1 font-mono text-foreground break-all">{preview.resolvedStartupCommand ?? 'Startup disabled'}</div>
                  </div>
                  <div>
                    <div className="font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Cleanup paths</div>
                    {preview.cleanupPaths.length > 0 ? (
                      preview.cleanupPaths.map((entry) => (
                        <div key={entry} className="mt-1 font-mono text-foreground break-all">{entry}</div>
                      ))
                    ) : (
                      <div className="mt-1 text-foreground">No cleanup preset selected</div>
                    )}
                  </div>
                  {preview.warnings.length > 0 ? (
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] text-warning">Warnings</div>
                      {preview.warnings.map((warning) => (
                        <div key={warning} className="mt-1 text-warning">{warning}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Select a project, environment, and standalone profile to see the deployment plan.</p>
              )}
            </div>

            {selectedEnvironment ? (
              <div className="rounded-[20px] border border-border bg-secondary/35 px-4 py-4 text-xs text-muted-foreground">
                <div className="font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Environment</div>
                <div className="mt-2 space-y-1">
                  <div>Home: <span className="font-mono text-foreground">{selectedEnvironment.homeDir}</span></div>
                  <div>Base: <span className="font-mono text-foreground">{selectedEnvironment.baseDir}</span></div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-5">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSave}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function resolveArtifactPayload(value: DeploymentWorkflowFormValue, candidates: DeployableArtifactCandidate[]) {
  if (value.artifactSelection === 'auto') {
    return { kind: 'auto' as const };
  }
  if (value.artifactSelection === 'explicit') {
    return {
      kind: 'explicit-file' as const,
      fileName: value.explicitArtifactFile || undefined,
      modulePath: value.modulePath || undefined,
      packaging: candidates[0]?.packaging,
    };
  }
  const [modulePath, packaging] = value.artifactSelection.split('|');
  return {
    kind: 'module' as const,
    modulePath,
    packaging: packaging as DeployableArtifactCandidate['packaging'],
  };
}

export function serializeDeploymentWorkflow(
  value: DeploymentWorkflowFormValue,
  _environments: Record<string, WildFlyEnvironmentConfig>,
) {
  return {
    description: value.description || undefined,
    projectPath: value.projectPath,
    build: {
      modulePath: value.modulePath || undefined,
      submoduleBuildStrategy: 'root-pl',
      goals: value.goals,
      optionKeys: value.optionKeys,
      profileStates: value.profileStates,
      extraOptions: value.extraOptions,
      javaVersion: value.javaVersion || undefined,
    },
    artifactSelector: resolveArtifactPayload(value, []),
    environmentName: value.environmentName,
    standaloneProfileName: value.standaloneProfileName,
    cleanupPresetName: value.cleanupPresetName || undefined,
    startupPresetName: value.startupPresetName || undefined,
    deployMode: value.deployMode,
    startServer: value.startServer,
  };
}
