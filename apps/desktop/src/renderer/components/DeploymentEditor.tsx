import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { DeployableArtifactCandidate, DeploymentPlanPreview, Project, WildFlyEnvironmentConfig } from '@gfos-build/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input, NumberField } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { ProjectPathPicker } from '@/components/ProjectPathPicker';
import { configQuery, inspectDeploymentProject, previewDeploymentPlan } from '@/api/queries';

export interface DeploymentWorkflowFormValue {
  name: string;
  description: string;
  projectPath: string;
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
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [candidates, setCandidates] = useState<DeployableArtifactCandidate[]>([]);
  const [preview, setPreview] = useState<DeploymentPlanPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [artifactPanelMaxHeight, setArtifactPanelMaxHeight] = useState<number | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const artifactPanelRef = useRef<HTMLDivElement | null>(null);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const environmentPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitAttempted(false);
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
  const selectedStartupPreset = value.startupPresetName ? startupPresets[value.startupPresetName] : undefined;
  const environmentNames = Object.keys(environments);
  const standaloneProfileNames = Object.keys(standaloneProfiles);
  const cleanupPresetNames = Object.keys(cleanupPresets);
  const startupPresetNames = Object.keys(startupPresets);
  const debugToggleDisabled = !value.startServer || !selectedStartupPreset;
  const jrebelToggleDisabled =
    !value.startServer || !selectedStartupPreset || !selectedStartupPreset.jrebelAgentPath;
  const toggleHelpText = !value.startServer
    ? 'Debug and JRebel are only available when Start WildFly is enabled.'
    : !selectedStartupPreset
      ? 'Select a startup preset to enable Debug and JRebel.'
      : !selectedStartupPreset.jrebelAgentPath
        ? 'The selected startup preset has no JRebel agent path, so JRebel stays unavailable.'
        : null;

  useEffect(() => {
    if (debugToggleDisabled && value.debugEnabled) {
      setValue((current) => ({ ...current, debugEnabled: false }));
    }
    if (jrebelToggleDisabled && value.jrebelEnabled) {
      setValue((current) => ({ ...current, jrebelEnabled: false }));
    }
  }, [debugToggleDisabled, jrebelToggleDisabled, value.debugEnabled, value.jrebelEnabled]);

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

  useEffect(() => {
    if (!open) {
      setArtifactPanelMaxHeight(null);
      return;
    }

    const sidebar = sidebarRef.current;
    const artifactPanel = artifactPanelRef.current;
    if (!sidebar || !artifactPanel) {
      setArtifactPanelMaxHeight(null);
      return;
    }

    const previewPanel = previewPanelRef.current;
    const environmentPanel = environmentPanelRef.current;

    const updateArtifactPanelMaxHeight = () => {
      const sidebarHeight = sidebar.clientHeight;
      if (sidebarHeight <= 0) {
        setArtifactPanelMaxHeight(null);
        return;
      }

      const sidebarStyles = window.getComputedStyle(sidebar);
      const gap = Number.parseFloat(sidebarStyles.rowGap || sidebarStyles.gap || '0') || 0;
      const previewHeight = previewPanel?.offsetHeight ?? 0;
      const environmentHeight = environmentPanel?.offsetHeight ?? 0;
      const lowerPanelCount = (previewPanel ? 1 : 0) + (environmentPanel ? 1 : 0);
      const verticalGapCount = lowerPanelCount > 0 ? lowerPanelCount : 0;
      const remainingHeight = sidebarHeight - previewHeight - environmentHeight - gap * verticalGapCount;
      setArtifactPanelMaxHeight(Math.max(160, remainingHeight));
    };

    updateArtifactPanelMaxHeight();

    const observer = new ResizeObserver(() => {
      updateArtifactPanelMaxHeight();
    });

    observer.observe(sidebar);
    observer.observe(artifactPanel);
    if (previewPanel) observer.observe(previewPanel);
    if (environmentPanel) observer.observe(environmentPanel);

    window.addEventListener('resize', updateArtifactPanelMaxHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateArtifactPanelMaxHeight);
    };
  }, [open, preview, selectedEnvironment]);

  const artifactOptions = useMemo(
    () => {
      const preferredCandidates = getPreferredDeployableCandidates(candidates);
      return [
        { key: 'auto', label: 'Auto select' },
        ...preferredCandidates.map((candidate) => ({
          key: `${candidate.modulePath}|${candidate.packaging}`,
          label: `${candidate.modulePath || '.'} (${candidate.packaging})`,
        })),
        { key: 'explicit', label: 'Explicit file name' },
      ];
    },
    [candidates],
  );
  const visibleCandidates = useMemo(
    () => getPreferredDeployableCandidates(candidates),
    [candidates],
  );
  const selectedArtifactLabel = useMemo(
    () => artifactOptions.find((option) => option.key === value.artifactSelection)?.label,
    [artifactOptions, value.artifactSelection],
  );
  const deployModeOptions = useMemo(
    () => [
      { key: 'filesystem-scanner' as const, label: 'Filesystem scanner' },
      { key: 'management-cli' as const, label: 'Management CLI' },
    ],
    [],
  );
  const selectedDeployModeLabel = useMemo(
    () => deployModeOptions.find((option) => option.key === value.deployMode)?.label,
    [deployModeOptions, value.deployMode],
  );
  const artifactSelectDisabled = visibleCandidates.length === 0;

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
    setSubmitAttempted(true);
    if (!canSave) {
      return;
    }
    onSave(value);
    onOpenChange(false);
  }

  const canSave =
    value.name.trim().length > 0 &&
    value.projectPath.trim().length > 0 &&
    value.environmentName.trim().length > 0 &&
    value.standaloneProfileName.trim().length > 0 &&
    (value.artifactSelection === 'auto' || value.artifactSelection === 'explicit' || candidates.length > 0);
  const nameError = submitAttempted && value.name.trim().length === 0 ? 'Enter a workflow name.' : undefined;
  const projectPathError = submitAttempted && value.projectPath.trim().length === 0 ? 'Select a Maven project path.' : undefined;
  const environmentError = submitAttempted && value.environmentName.trim().length === 0 ? 'Select a WildFly environment.' : undefined;
  const standaloneProfileError =
    submitAttempted && value.standaloneProfileName.trim().length === 0 ? 'Select a standalone profile.' : undefined;

  return (
        <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[min(82dvh,860px)] overflow-hidden">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>

        <div className="mt-5 flex min-h-0 flex-1 gap-5 overflow-hidden lg:flex-row flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
            <section className="flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/75">Basics</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Workflow name"
                  placeholder="local-dev-deploy"
                  error={nameError}
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
                error={projectPathError}
                placeholder="Select a Maven project..."
                allowedBuildSystems={['maven']}
              />
            </section>

            {inspectError ? (
              <div className="rounded-[18px] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {inspectError}
              </div>
            ) : null}

            <section className="flex flex-col gap-4 border-t border-border/60 pt-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/75">Deployment</p>
                {!selectedEnvironment ? (
                  <p className="mt-2 text-sm text-muted-foreground">Select an environment to configure the deployment details.</p>
                ) : null}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Environment
                  </label>
                  <Tooltip content="Selects the local WildFly installation and base directory that this workflow will clean, deploy to, and optionally start." side="top">
                    <div>
                      <Select value={value.environmentName} onValueChange={(next) => update('environmentName', String(next ?? ''))}>
                        <SelectTrigger disabled={environmentNames.length === 0}>
                          <SelectValue
                            placeholder={
                              environmentNames.length === 0
                                ? 'No WildFly environments configured'
                                : 'Select WildFly environment'
                            }
                          />
                        </SelectTrigger>
                        {environmentNames.length > 0 ? (
                          <SelectContent>
                            {environmentNames.map((name) => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        ) : null}
                      </Select>
                    </div>
                  </Tooltip>
                  {environmentError ? <span className="text-xs text-destructive">{environmentError}</span> : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Deploy mode</label>
                  <Tooltip content="Filesystem scanner copies the artifact into the WildFly deployments folder and is best when the server is offline or started by this workflow. Management CLI deploys through jboss-cli against a running server." side="top">
                    <div>
                      <Select value={value.deployMode} onValueChange={(next) => update('deployMode', next as DeploymentWorkflowFormValue['deployMode'])}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select deploy mode">
                            {selectedDeployModeLabel ?? <span className="text-muted-foreground">Select deploy mode</span>}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {deployModeOptions.map((option) => (
                            <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </Tooltip>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Standalone profile
                  </label>
                  <Tooltip content="Chooses which WildFly standalone configuration file is used for startup, for example a local dev or integration profile." side="top">
                    <div>
                      <Select value={value.standaloneProfileName} onValueChange={(next) => update('standaloneProfileName', String(next ?? ''))}>
                        <SelectTrigger disabled={!selectedEnvironment || standaloneProfileNames.length === 0}>
                          <SelectValue
                            placeholder={
                              standaloneProfileNames.length === 0
                                  ? 'No standalone profiles configured'
                                  : 'Select standalone profile'
                            }
                          />
                        </SelectTrigger>
                        {standaloneProfileNames.length > 0 ? (
                          <SelectContent>
                            {standaloneProfileNames.map((name) => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        ) : null}
                      </Select>
                    </div>
                  </Tooltip>
                  {standaloneProfileError ? <span className="text-xs text-destructive">{standaloneProfileError}</span> : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Cleanup preset</label>
                  <Tooltip content="Controls which old deployments, marker files, or WildFly runtime folders are cleaned before the new artifact is deployed." side="top">
                    <div>
                      <Select value={value.cleanupPresetName} onValueChange={(next) => update('cleanupPresetName', String(next ?? ''))}>
                        <SelectTrigger disabled={!selectedEnvironment || cleanupPresetNames.length === 0}>
                          <SelectValue
                            placeholder={
                              cleanupPresetNames.length === 0
                                  ? 'No cleanup presets configured'
                                  : 'Select cleanup preset'
                            }
                          />
                        </SelectTrigger>
                        {cleanupPresetNames.length > 0 ? (
                          <SelectContent>
                            {cleanupPresetNames.map((name) => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        ) : null}
                      </Select>
                    </div>
                  </Tooltip>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Artifact target</label>
                  <Tooltip content="Selects which detected deployable module should be deployed. Auto select prefers EARs, then other high-confidence deployable artifacts." side="top">
                    <div>
                      <Select value={value.artifactSelection} onValueChange={(next) => update('artifactSelection', String(next ?? ''))}>
                        <SelectTrigger disabled={artifactSelectDisabled}>
                          <SelectValue placeholder="Select artifact target">
                            {selectedArtifactLabel ?? (
                              <span className="text-muted-foreground">
                                {artifactSelectDisabled ? 'No deployable artifacts detected' : 'Select artifact target'}
                              </span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        {!artifactSelectDisabled ? (
                          <SelectContent>
                            {artifactOptions.map((option) => (
                              <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        ) : null}
                      </Select>
                    </div>
                  </Tooltip>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4 border-t border-border/60 pt-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/75">Startup</p>
                {!selectedEnvironment ? (
                  <p className="mt-2 text-sm text-muted-foreground">Select an environment to choose a startup preset.</p>
                ) : null}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Startup preset</label>
                  <Tooltip content="Provides the WildFly startup arguments and optional debug or JRebel defaults used when Start WildFly is enabled." side="top">
                    <div>
                      <Select value={value.startupPresetName} onValueChange={(next) => update('startupPresetName', String(next ?? ''))}>
                        <SelectTrigger disabled={!selectedEnvironment || startupPresetNames.length === 0}>
                          <SelectValue
                            placeholder={
                              startupPresetNames.length === 0
                                  ? 'No startup presets configured'
                                  : 'Select startup preset'
                            }
                          />
                        </SelectTrigger>
                        {startupPresetNames.length > 0 ? (
                          <SelectContent>
                            {startupPresetNames.map((name) => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        ) : null}
                      </Select>
                    </div>
                  </Tooltip>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Tooltip content="Starts the selected WildFly environment after deployment. Disable this if you only want to deploy to an already running server." side="top">
                  <button
                    type="button"
                    aria-pressed={value.startServer}
                    onClick={() => update('startServer', !value.startServer)}
                    className={`toggle-pill ${value.startServer ? 'is-active' : ''}`}
                  >
                    Start WildFly
                  </button>
                </Tooltip>
                <Tooltip
                  content={
                    'Adds JVM remote debugging to the WildFly startup command so you can attach from IntelliJ or another debugger.'
                  }
                  side="top"
                >
                  <button
                    type="button"
                    aria-pressed={value.debugEnabled}
                    onClick={() => update('debugEnabled', !value.debugEnabled)}
                    disabled={debugToggleDisabled}
                    className={`toggle-pill ${value.debugEnabled ? 'is-active' : ''}`}
                  >
                    Debug enabled
                  </button>
                </Tooltip>
                <Tooltip
                  content={
                    'Enables the JRebel agent from the selected startup preset so class/resource changes can reload without full redeploys.'
                  }
                  side="top"
                >
                  <button
                    type="button"
                    aria-pressed={value.jrebelEnabled}
                    onClick={() => update('jrebelEnabled', !value.jrebelEnabled)}
                    disabled={jrebelToggleDisabled}
                    className={`toggle-pill ${value.jrebelEnabled ? 'is-active' : ''}`}
                  >
                    JRebel enabled
                  </button>
                </Tooltip>
              </div>
            </section>

            {value.artifactSelection === 'explicit' ? (
              <Input
                label="Explicit artifact file name"
                value={value.explicitArtifactFile}
                onChange={(event) => update('explicitArtifactFile', event.target.value)}
                placeholder="e.g. app.ear"
              />
            ) : null}

            {toggleHelpText ? (
              <p className="text-sm text-muted-foreground">{toggleHelpText}</p>
            ) : null}

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

          <div ref={sidebarRef} className="flex min-h-0 w-full shrink-0 flex-col gap-4 overflow-hidden lg:w-[22rem]">
            <div
              ref={artifactPanelRef}
              className="flex min-h-0 flex-col overflow-hidden rounded-[20px] border border-border bg-secondary/35 px-4 py-4 text-sm"
              style={artifactPanelMaxHeight ? { maxHeight: `${artifactPanelMaxHeight}px` } : undefined}
            >
              <p className="font-medium text-foreground">Detected deployable artifacts</p>
              <div className="mt-3 flex min-h-0 flex-col gap-2 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
                {visibleCandidates.length === 0 ? (
                  <p className="text-muted-foreground">No deployable candidates detected yet.</p>
                ) : (
                  visibleCandidates.map((candidate) => (
                    <div key={`${candidate.modulePath}:${candidate.packaging}`} className="rounded-[16px] border border-border/70 bg-card/60 px-3 py-2">
                      <div className="text-xs font-medium text-foreground">{candidate.modulePath || '.'}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{candidate.packaging.toUpperCase()} · {candidate.expectedDefaultFileName ?? 'unknown file'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div ref={previewPanelRef} className="rounded-[20px] border border-border bg-secondary/35 px-4 py-4 text-sm">
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
              <div ref={environmentPanelRef} className="rounded-[20px] border border-border bg-secondary/35 px-4 py-4 text-xs text-muted-foreground">
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

function getPreferredDeployableCandidates(candidates: DeployableArtifactCandidate[]): DeployableArtifactCandidate[] {
  const ears = candidates.filter((candidate) => candidate.packaging === 'ear');
  if (ears.length > 0) {
    return ears;
  }
  const highConfidence = candidates.filter((candidate) => candidate.selectionConfidence !== 'manual');
  if (highConfidence.length > 0) {
    return highConfidence;
  }
  return candidates;
}

export function serializeDeploymentWorkflow(
  value: DeploymentWorkflowFormValue,
  _environments: Record<string, WildFlyEnvironmentConfig>,
) {
  return {
    description: value.description || undefined,
    projectPath: value.projectPath,
    artifactSelector: resolveArtifactPayload(value, []),
    environmentName: value.environmentName,
    standaloneProfileName: value.standaloneProfileName,
    cleanupPresetName: value.cleanupPresetName || undefined,
    startupPresetName: value.startupPresetName || undefined,
    deployMode: value.deployMode,
    startServer: value.startServer,
  };
}
