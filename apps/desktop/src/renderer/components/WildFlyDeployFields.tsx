import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type {
  DeployableArtifactCandidate,
  DeploymentArtifactSelector,
  DeploymentPlanPreview,
} from '@gfos-build/contracts';
import { configQuery, inspectDeploymentProject, previewDeploymentPlan } from '@/api/queries';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';

export interface WildFlyDeployFormValue {
  environmentName: string;
  standaloneProfileName: string;
  cleanupPresetName: string;
  startupPresetName: string;
  deployMode: 'filesystem-scanner' | 'management-cli';
  artifactSelection: string;
  explicitArtifactFile: string;
  startServer: boolean;
}

export const DEFAULT_WILDFLY_DEPLOY_FORM: WildFlyDeployFormValue = {
  environmentName: '',
  standaloneProfileName: '',
  cleanupPresetName: '',
  startupPresetName: '',
  deployMode: 'filesystem-scanner',
  artifactSelection: 'auto',
  explicitArtifactFile: '',
  startServer: true,
};

export function serializeWildFlyDeployTarget(
  value: WildFlyDeployFormValue,
  candidates: DeployableArtifactCandidate[],
) {
  return {
    artifactSelector: resolveArtifactPayload(value, candidates),
    environmentName: value.environmentName,
    standaloneProfileName: value.standaloneProfileName,
    cleanupPresetName: value.cleanupPresetName || undefined,
    startupPresetName: value.startupPresetName || undefined,
    deployMode: value.deployMode,
    startServer: value.startServer,
  };
}

export function WildFlyDeployFields({
  projectPath,
  value,
  onChange,
}: {
  projectPath: string;
  value: WildFlyDeployFormValue;
  onChange: (value: WildFlyDeployFormValue) => void;
}) {
  const { data: configData } = useQuery(configQuery);
  const environments = configData?.config.wildfly.environments ?? {};
  const selectedEnvironment = value.environmentName ? environments[value.environmentName] : undefined;
  const standaloneProfiles = selectedEnvironment?.standaloneProfiles ?? {};
  const cleanupPresets = selectedEnvironment?.cleanupPresets ?? {};
  const startupPresets = selectedEnvironment?.startupPresets ?? {};
  const environmentNames = Object.keys(environments);
  const standaloneProfileNames = Object.keys(standaloneProfiles);
  const cleanupPresetNames = Object.keys(cleanupPresets);
  const startupPresetNames = Object.keys(startupPresets);

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
    if (!projectPath) {
      setCandidates([]);
      setInspectError(null);
      return;
    }
    let cancelled = false;
    void inspectDeploymentProject(projectPath)
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
  }, [projectPath]);

  useEffect(() => {
    if (!projectPath || !value.environmentName || !value.standaloneProfileName) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    void previewDeploymentPlan({
      projectPath,
      ...serializeWildFlyDeployTarget(value, candidates),
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
  }, [candidates, projectPath, value]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const artifactPanel = artifactPanelRef.current;
    if (!sidebar || !artifactPanel) return;
    const previewPanel = previewPanelRef.current;
    const environmentPanel = environmentPanelRef.current;

    const updateArtifactPanelMaxHeight = () => {
      const sidebarHeight = sidebar.clientHeight;
      const sidebarStyles = window.getComputedStyle(sidebar);
      const gap = Number.parseFloat(sidebarStyles.rowGap || sidebarStyles.gap || '0') || 0;
      const previewHeight = previewPanel?.offsetHeight ?? 0;
      const environmentHeight = environmentPanel?.offsetHeight ?? 0;
      const lowerPanelCount = (previewPanel ? 1 : 0) + (environmentPanel ? 1 : 0);
      const remainingHeight = sidebarHeight - previewHeight - environmentHeight - gap * lowerPanelCount;
      setArtifactPanelMaxHeight(Math.max(160, remainingHeight));
    };

    updateArtifactPanelMaxHeight();
    const observer = new ResizeObserver(updateArtifactPanelMaxHeight);
    observer.observe(sidebar);
    observer.observe(artifactPanel);
    if (previewPanel) observer.observe(previewPanel);
    if (environmentPanel) observer.observe(environmentPanel);
    window.addEventListener('resize', updateArtifactPanelMaxHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateArtifactPanelMaxHeight);
    };
  }, [preview, selectedEnvironment]);

  const artifactOptions = useMemo(() => {
    const preferredCandidates = getPreferredDeployableCandidates(candidates);
    return [
      { key: 'auto', label: 'Auto select' },
      ...preferredCandidates.map((candidate) => ({
        key: `${candidate.modulePath}|${candidate.packaging}`,
        label: `${candidate.modulePath || '.'} (${candidate.packaging})`,
      })),
      { key: 'explicit', label: 'Explicit file name' },
    ];
  }, [candidates]);
  const visibleCandidates = useMemo(() => getPreferredDeployableCandidates(candidates), [candidates]);
  const selectedArtifactLabel = useMemo(
    () => artifactOptions.find((option) => option.key === value.artifactSelection)?.label,
    [artifactOptions, value.artifactSelection],
  );
  const selectedDeployModeLabel = useMemo(
    () =>
      [
        { key: 'filesystem-scanner' as const, label: 'Filesystem scanner' },
        { key: 'management-cli' as const, label: 'Management CLI' },
      ].find((option) => option.key === value.deployMode)?.label,
    [value.deployMode],
  );

  function update<K extends keyof WildFlyDeployFormValue>(key: K, next: WildFlyDeployFormValue[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        {inspectError ? (
          <div className="rounded-[18px] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {inspectError}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Environment</label>
            <Tooltip content="Selects the local WildFly installation and base directory that this deploy will clean, deploy to, and optionally start." side="top">
              <div>
                <Select value={value.environmentName} onValueChange={(next) => update('environmentName', String(next ?? ''))}>
                  <SelectTrigger disabled={environmentNames.length === 0}>
                    <SelectValue placeholder={environmentNames.length === 0 ? 'No WildFly environments configured' : 'Select WildFly environment'} />
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
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Deploy mode</label>
            <Tooltip content="Filesystem scanner copies the artifact into the WildFly deployments folder. Management CLI deploys through jboss-cli against a running server." side="top">
              <div>
                <Select value={value.deployMode} onValueChange={(next) => update('deployMode', next as WildFlyDeployFormValue['deployMode'])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select deploy mode">
                      {selectedDeployModeLabel ?? <span className="text-muted-foreground">Select deploy mode</span>}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filesystem-scanner">Filesystem scanner</SelectItem>
                    <SelectItem value="management-cli">Management CLI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Tooltip>
          </div>

          <SelectField
            label="Standalone profile"
            tooltip="Chooses which WildFly standalone configuration file is used for startup."
            value={value.standaloneProfileName}
            options={standaloneProfileNames}
            disabled={!selectedEnvironment || standaloneProfileNames.length === 0}
            emptyLabel="No standalone profiles configured"
            placeholder="Select standalone profile"
            onValueChange={(next) => update('standaloneProfileName', String(next ?? ''))}
          />
          <SelectField
            label="Cleanup preset"
            tooltip="Controls which old deployments, marker files, or WildFly runtime folders are cleaned before deployment."
            value={value.cleanupPresetName}
            options={cleanupPresetNames}
            disabled={!selectedEnvironment || cleanupPresetNames.length === 0}
            emptyLabel="No cleanup presets configured"
            placeholder="Select cleanup preset"
            onValueChange={(next) => update('cleanupPresetName', String(next ?? ''))}
          />
          <SelectField
            label="Startup preset"
            tooltip="Provides the WildFly startup arguments and optional debug or JRebel defaults when Start WildFly is enabled."
            value={value.startupPresetName}
            options={startupPresetNames}
            disabled={!selectedEnvironment || startupPresetNames.length === 0}
            emptyLabel="No startup presets configured"
            placeholder="Select startup preset"
            onValueChange={(next) => update('startupPresetName', String(next ?? ''))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Artifact target</label>
            <Tooltip content="Selects which detected deployable module should be deployed. Auto select prefers EARs, then other high-confidence artifacts." side="top">
              <div>
                <Select value={value.artifactSelection} onValueChange={(next) => update('artifactSelection', String(next ?? ''))}>
                  <SelectTrigger disabled={visibleCandidates.length === 0}>
                    <SelectValue placeholder={visibleCandidates.length === 0 ? 'No deployable artifacts detected' : 'Select artifact target'}>
                      {selectedArtifactLabel ?? null}
                    </SelectValue>
                  </SelectTrigger>
                  {visibleCandidates.length > 0 ? (
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

        <div className="grid gap-4 lg:grid-cols-3">
          <TogglePill active={value.startServer} onClick={() => update('startServer', !value.startServer)}>
            Start WildFly
          </TogglePill>
        </div>

        {value.artifactSelection === 'explicit' ? (
          <Input
            label="Explicit artifact file name"
            value={value.explicitArtifactFile}
            onChange={(event) => update('explicitArtifactFile', event.target.value)}
            placeholder="e.g. app.ear"
          />
        ) : null}
      </div>

      <div ref={sidebarRef} className="flex min-h-0 w-full shrink-0 flex-col gap-4 overflow-hidden">
        <div ref={artifactPanelRef} className="flex min-h-0 flex-col overflow-hidden rounded-[20px] border border-border bg-secondary/35 px-4 py-4 text-sm" style={artifactPanelMaxHeight ? { maxHeight: `${artifactPanelMaxHeight}px` } : undefined}>
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
              <SidebarBlock label="Artifact" value={preview.resolvedArtifactPattern} mono />
              <SidebarBlock label="Deploy mode" value={preview.recommendedDeployMode} />
              <SidebarBlock label="Startup command" value={preview.resolvedStartupCommand ?? 'Startup disabled'} mono />
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
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Select an environment and standalone profile to see the deployment plan.</p>
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
  );
}

function SelectField({
  label,
  tooltip,
  value,
  options,
  disabled,
  emptyLabel,
  placeholder,
  onValueChange,
}: {
  label: string;
  tooltip: string;
  value: string;
  options: string[];
  disabled: boolean;
  emptyLabel: string;
  placeholder: string;
  onValueChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</label>
      <Tooltip content={tooltip} side="top">
        <div>
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger disabled={disabled}>
              <SelectValue placeholder={options.length === 0 ? emptyLabel : placeholder} />
            </SelectTrigger>
            {options.length > 0 ? (
              <SelectContent>
                {options.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            ) : null}
          </Select>
        </div>
      </Tooltip>
    </div>
  );
}

function TogglePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`toggle-pill ${active ? 'is-active' : ''}`}>
      {children}
    </button>
  );
}

function SidebarBlock({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">{label}</div>
      <div className={`mt-1 text-foreground break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function resolveArtifactPayload(value: WildFlyDeployFormValue, candidates: DeployableArtifactCandidate[]): DeploymentArtifactSelector {
  if (value.artifactSelection === 'auto') {
    return { kind: 'auto' };
  }
  if (value.artifactSelection === 'explicit') {
    return {
      kind: 'explicit-file',
      fileName: value.explicitArtifactFile || undefined,
      packaging: candidates[0]?.packaging,
    };
  }
  const [modulePath, packaging] = value.artifactSelection.split('|');
  return {
    kind: 'module',
    modulePath,
    packaging: packaging as DeployableArtifactCandidate['packaging'],
  };
}

function getPreferredDeployableCandidates(candidates: DeployableArtifactCandidate[]): DeployableArtifactCandidate[] {
  const ears = candidates.filter((candidate) => candidate.packaging === 'ear');
  if (ears.length > 0) return ears;
  const highConfidence = candidates.filter((candidate) => candidate.selectionConfidence !== 'manual');
  if (highConfidence.length > 0) return highConfidence;
  return candidates;
}
