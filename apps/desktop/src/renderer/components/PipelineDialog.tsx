import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MavenCommandFields, getSuggestedJavaOverride, type MavenCommandValue } from '@/components/MavenCommandFields';
import { ComboboxField } from '@/components/ui/combobox-field';
import { Tooltip } from '@/components/ui/tooltip';
import { getNodeScriptChoices, getNodeScriptComboboxOptions, type NodeScriptChoice } from '@/lib/node-script-options';
import { cn } from '@/lib/utils';
import { Plus, Trash2, ArrowUp, ArrowDown, FolderOpen, Loader2, Check } from 'lucide-react';
import type { PipelineStep } from '@gfos-build/contracts';
import type { ExecutionMode, MavenMetadata, MavenOptionKey, MavenProfileState, NodeCommandType, PackageManager, Project } from '@gfos-build/contracts';
import { pickDirectory } from '@/api/bridge';
import { inspectProject, scanQuery, configQuery } from '@/api/queries';

interface StepFormData {
  label: string;
  path: string;
  buildSystem: 'maven' | 'node' | null;
  mavenModulePath: string;
  mavenGoals: string[];
  mavenOptionKeys: MavenOptionKey[];
  mavenProfileStates: Record<string, MavenProfileState>;
  mavenExtraOptions: string[];
  commandType: NodeCommandType;
  script: string;
  args: string;
  executionMode: ExecutionMode;
  javaVersion: string;
  mavenMetadata?: MavenMetadata;
  packageManager?: PackageManager;
  availableScripts: NodeScriptChoice[];
  inspectionError?: string;
}

export interface PipelineFormData {
  name: string;
  description: string;
  failFast: boolean;
  steps: StepFormData[];
}

interface PipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: { name: string; description?: string; failFast: boolean; steps: PipelineStep[] };
  onSave: (data: PipelineFormData) => void;
  mode: 'create' | 'edit';
}

function createEmptyStep(mavenGoals: string): StepFormData {
  return {
    label: '',
    path: '',
    buildSystem: null,
    mavenModulePath: '',
    mavenGoals: mavenGoals ? mavenGoals.split(/\s+/).filter(Boolean) : ['clean', 'install'],
    mavenOptionKeys: [],
    mavenProfileStates: {},
    mavenExtraOptions: [],
    commandType: 'script',
    script: '',
    args: '',
    executionMode: 'internal',
    javaVersion: '',
    availableScripts: [],
  };
}

function fromApiStep(step: PipelineStep, mavenGoals: string): StepFormData {
  return {
    label: step.label,
    path: step.path,
    buildSystem: step.buildSystem ?? null,
    mavenModulePath: step.modulePath ?? '',
    mavenGoals: step.goals ?? (mavenGoals ? mavenGoals.split(/\s+/).filter(Boolean) : ['clean', 'install']),
    mavenOptionKeys: step.optionKeys ?? [],
    mavenProfileStates: step.profileStates ?? {},
    mavenExtraOptions: step.extraOptions ?? [],
    commandType: step.commandType ?? 'script',
    script: step.script ?? '',
    args: step.args?.join(' ') ?? '',
    executionMode: step.executionMode ?? 'internal',
    javaVersion: step.javaVersion ?? '',
    packageManager: step.packageManager,
    availableScripts: [],
  };
}

function getRelativePath(project: Project, roots: Record<string, string>): string {
  const rootPath = roots[project.rootName];
  if (!rootPath) return project.path;
  const norm = project.path.replace(/\\/g, '/');
  const rootNorm = rootPath.replace(/\\/g, '/').replace(/\/$/, '');
  return norm.startsWith(rootNorm) ? norm.slice(rootNorm.length + 1) : project.path;
}

function ProjectPathPicker({
  value,
  onChange,
  onResolvedPath,
}: {
  value: string;
  onChange: (v: string) => void;
  onResolvedPath?: (path: string, project?: Project) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: scanData, isLoading: scanLoading } = useQuery(scanQuery);
  const { data: configData } = useQuery(configQuery);
  const roots = configData?.config.roots ?? {};

  const displayValue = useMemo(() => {
    if (!value) return '';
    const match = scanData?.projects.find((project) => project.path === value);
    if (match) {
      const relPath = getRelativePath(match, roots);
      return `${match.name} (${match.rootName}:${relPath})`;
    }
    return value;
  }, [value, scanData, roots]);

  const filtered = useMemo(() => {
    if (!scanData?.projects) return [];
    if (!query.trim()) return scanData.projects.slice(0, 20);
    const q = query.toLowerCase();
    return scanData.projects
      .filter(
        (project) =>
          project.name.toLowerCase().includes(q) ||
          project.path.toLowerCase().includes(q) ||
          (project.maven?.artifactId ?? '').toLowerCase().includes(q) ||
          (project.node?.name ?? '').toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [scanData, query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  async function handleBrowse(event: React.MouseEvent) {
    event.preventDefault();
    const dir = await pickDirectory();
    if (dir) {
      onChange(dir);
      onResolvedPath?.(dir);
      setOpen(false);
      setQuery('');
    }
  }

  function selectProject(project: Project) {
    onChange(project.path);
    onResolvedPath?.(project.path, project);
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (open) {
        // Prevent the parent dialog from seeing this Escape so it doesn't
        // trigger the discard-confirmation while just closing the dropdown.
        event.nativeEvent.stopImmediatePropagation();
      }
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const trimmed = query.trim();
      if (trimmed && /^([A-Za-z]:[/\\]|\/)/.test(trimmed)) {
        onChange(trimmed);
        onResolvedPath?.(trimmed);
        setOpen(false);
        setQuery('');
      } else if (filtered.length > 0 && filtered[0]) {
        selectProject(filtered[0]);
      }
    }
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Project path
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            value={open ? query : displayValue}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setOpen(true);
              setQuery('');
            }}
            onKeyDown={handleKeyDown}
            placeholder={open ? 'Search projects or type an absolute path...' : 'Select a project...'}
            className="field-input h-11 w-full rounded-2xl border px-4 [background:var(--field-bg)] [border-color:var(--field-border)] focus:outline-none focus:border-ring focus:[box-shadow:0_0_0_1px_var(--color-ring)]"
          />

          {open && (
            <div className="glass-card listbox-panel absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-auto">
              {scanLoading ? (
                <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                  <Loader2 size={12} className="shrink-0 animate-spin" />
                  Loading projects...
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted-foreground">
                  {query.trim() ? 'No matching projects' : 'No projects found'}
                </div>
              ) : (
                filtered.map((project) => {
                  const relPath = getRelativePath(project, roots);
                  return (
                    <button
                      key={project.path}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectProject(project)}
                      className={cn(
                        'listbox-option transition-colors',
                        value === project.path && 'is-active',
                      )}
                    >
                      <span
                        className={cn(
                          'pill-meta font-semibold',
                          project.buildSystem === 'maven'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-success/10 text-success',
                        )}
                      >
                        {project.buildSystem === 'maven' ? 'Maven' : 'Node'}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-foreground">{project.name}</span>
                      <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                        {relPath}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <Tooltip content="Browse directory" side="bottom">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={(e) => void handleBrowse(e)}
            aria-label="Browse directory"
          >
            <FolderOpen size={14} />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

function StepCard({
  step,
  index,
  total,
  onUpdate,
  onResolvePath,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: StepFormData;
  index: number;
  total: number;
  onUpdate: (updater: (current: StepFormData) => StepFormData) => void;
  onResolvePath: (path: string, project?: Project) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { data: configData } = useQuery(configQuery);
  const jdkVersions = useMemo(() => Object.keys(configData?.config.jdkRegistry ?? {}), [configData]);

  function handleResolvedPath(path: string, project?: Project) {
    onUpdate((current) => ({
      ...current,
      path,
      inspectionError: undefined,
    }));
    onResolvePath(path, project);
  }

  return (
    <div className="rounded-[24px] border border-border bg-secondary/35 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="pill-meta rounded-full bg-card font-mono text-muted-foreground">
              Step {index + 1}
            </span>
            <span className="pill-meta rounded-full bg-secondary text-muted-foreground">
              {step.buildSystem === 'maven' ? 'Maven' : step.buildSystem === 'node' ? 'Node' : 'Awaiting project'}
            </span>
            {step.packageManager && (
              <span className="pill-meta rounded-full bg-secondary text-muted-foreground uppercase">
                {step.packageManager}
              </span>
            )}
            {step.buildSystem === 'node' && (
              <span className="pill-meta rounded-full bg-secondary text-muted-foreground">
                {step.commandType === 'install' ? 'Install' : 'Script'}
              </span>
            )}
          </div>
          <p className="mt-2 truncate text-sm font-medium text-foreground">
            {step.label || 'Untitled step'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content="Move up" side="bottom" disabled={index === 0}>
            <button
              type="button"
              onClick={onMoveUp}
              disabled={index === 0}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-25"
              aria-label="Move step up"
            >
              <ArrowUp size={12} />
            </button>
          </Tooltip>
          <Tooltip content="Move down" side="bottom" disabled={index === total - 1}>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={index === total - 1}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-25"
              aria-label="Move step down"
            >
              <ArrowDown size={12} />
            </button>
          </Tooltip>
          <Tooltip content="Remove step" side="bottom" disabled={total === 1}>
            <button
              type="button"
              onClick={onRemove}
              disabled={total === 1}
              className="rounded-full p-2 text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-25"
              aria-label="Remove step"
            >
              <Trash2 size={13} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <Input
          label="Label"
          placeholder="e.g. web-app"
          value={step.label}
          onChange={(e) => onUpdate((current) => ({ ...current, label: e.target.value }))}
        />
        <div className="rounded-[18px] border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
          Build system is detected from the selected project path.
        </div>
      </div>

      <div className="mt-4">
        <ProjectPathPicker
          value={step.path}
          onChange={(value) => onUpdate((current) => ({ ...current, path: value }))}
          onResolvedPath={handleResolvedPath}
        />
      </div>

      {step.inspectionError && (
        <div className="mt-4 rounded-[18px] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {step.inspectionError}
        </div>
      )}

      {step.buildSystem === 'maven' ? (
        <div className="mt-4">
          <MavenCommandFields
            metadata={step.mavenMetadata}
            value={toMavenCommandValue(step)}
            onChange={(nextValue) =>
              onUpdate((current) => ({
                ...current,
                mavenModulePath: nextValue.modulePath,
                mavenGoals: nextValue.goals,
                mavenOptionKeys: nextValue.optionKeys,
                mavenProfileStates: nextValue.profileStates,
                mavenExtraOptions: nextValue.extraOptions,
                javaVersion: nextValue.javaVersion,
                executionMode: nextValue.executionMode,
              }))
            }
            jdkVersions={jdkVersions}
          />
        </div>
      ) : step.buildSystem === 'node' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Command
            </label>
            <div className="segmented-control w-fit">
              {([
                { value: 'script', label: 'Run script' },
                { value: 'install', label: 'Install deps' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={step.commandType === option.value}
                  onClick={() =>
                    onUpdate((current) => ({
                      ...current,
                      commandType: option.value,
                      script:
                        option.value === 'script'
                          ? current.script || current.availableScripts[0]?.name || ''
                          : current.script,
                      inspectionError:
                        option.value === 'script' && current.availableScripts.length === 0
                          ? 'No scripts were found in this package.json.'
                          : undefined,
                    }))
                  }
                  className={cn('segmented-control-button', step.commandType === option.value && 'is-active')}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {step.commandType === 'script' ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Script
            </label>
            {step.availableScripts.length > 0 ? (
              <ComboboxField
                value={step.script}
                options={getNodeScriptComboboxOptions(
                  Object.fromEntries(step.availableScripts.map((scriptEntry) => [scriptEntry.name, scriptEntry.command])),
                )}
                onValueChange={(value) => onUpdate((current) => ({ ...current, script: value }))}
                placeholder="Select a script"
                emptyText="No matching scripts"
              />
            ) : (
              <div className="rounded-[18px] border border-warning/20 bg-warning/8 px-4 py-3 text-sm text-warning">
                No scripts were found in this package.json.
              </div>
            )}
          </div>
          ) : (
            <div className="rounded-[18px] border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
              Uses the detected package manager install command.
            </div>
          )}
          <Input
            label={step.commandType === 'install' ? 'Install args' : 'Optional args'}
            placeholder={step.commandType === 'install' ? 'e.g. --frozen-lockfile' : 'e.g. --host 0.0.0.0'}
            value={step.args}
            onChange={(e) => onUpdate((current) => ({ ...current, args: e.target.value }))}
          />
          <div className="lg:col-span-2 flex flex-col gap-2">
            <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Execution mode
            </label>
            <div className="segmented-control w-fit">
              {(['internal', 'external'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={step.executionMode === mode}
                  onClick={() => onUpdate((current) => ({ ...current, executionMode: mode }))}
                  className={cn('segmented-control-button', step.executionMode === mode && 'is-active')}
                >
                  {mode === 'internal' ? 'In app' : 'External terminal'}
                </button>
              ))}
            </div>
            {step.executionMode === 'external' && (
              <p className="text-xs leading-relaxed text-warning">
                External steps launch a new terminal window and the pipeline continues immediately.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {step.buildSystem === 'node' && step.availableScripts.length === 0 && !step.inspectionError && step.commandType === 'install' && (
        <div className="mt-4 rounded-[18px] border border-warning/20 bg-warning/8 px-4 py-3 text-sm text-warning">
          Install is still available even though no scripts were found in this package.json.
        </div>
      )}
    </div>
  );
}

export function PipelineDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
  mode,
}: PipelineDialogProps) {
  const { data: configData } = useQuery(configQuery);
  const defaultMavenGoals = configData?.config.maven.defaultGoals.join(' ') ?? 'clean install';
  const registeredJdkVersions = useMemo(
    () => Object.keys(configData?.config.jdkRegistry ?? {}),
    [configData],
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [failFast, setFailFast] = useState(true);
  const [steps, setSteps] = useState<StepFormData[]>([createEmptyStep(defaultMavenGoals)]);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  async function resolveStepPath(index: number, path: string, project?: Project) {
    const applyInspection = (current: StepFormData, resolvedProject: Project | null, error?: string): StepFormData => {
      if (!resolvedProject) {
        return {
          ...current,
          buildSystem: null,
          mavenMetadata: undefined,
          packageManager: undefined,
          availableScripts: [],
          script: '',
          commandType: current.commandType,
          inspectionError: error ?? 'No supported build manifest was found at this path.',
        };
      }

      if (resolvedProject.buildSystem === 'node') {
        const availableScripts = getNodeScriptChoices(resolvedProject.node?.scripts);
        const nextScript =
          current.script && availableScripts.some((scriptEntry) => scriptEntry.name === current.script)
            ? current.script
            : availableScripts[0]?.name ?? '';
        return {
          ...current,
          label: current.label || resolvedProject.name,
          buildSystem: 'node',
          packageManager: resolvedProject.node?.packageManager,
          availableScripts,
          script: nextScript,
          inspectionError:
            current.commandType === 'script' && current.script && !availableScripts.some((scriptEntry) => scriptEntry.name === current.script)
              ? `Script "${current.script}" is no longer defined in package.json.`
              : current.commandType === 'script' && availableScripts.length === 0
                ? 'No scripts were found in this package.json.'
                : undefined,
        };
      }

      return {
        ...current,
        label: current.label || resolvedProject.name,
        buildSystem: 'maven',
        mavenMetadata: resolvedProject.maven,
        packageManager: undefined,
        availableScripts: [],
        script: '',
        inspectionError: undefined,
        mavenGoals: current.mavenGoals.length > 0 ? current.mavenGoals : defaultMavenGoals.split(/\s+/).filter(Boolean),
        mavenProfileStates: Object.fromEntries(
          (resolvedProject.maven?.profiles ?? []).map((profile) => [
            profile.id,
            current.mavenProfileStates[profile.id] ?? 'default',
          ]),
        ),
        javaVersion:
          current.javaVersion && registeredJdkVersions.includes(current.javaVersion)
            ? current.javaVersion
            : getSuggestedJavaOverride(resolvedProject.maven, registeredJdkVersions),
      };
    };

    if (project) {
      setSteps((current) =>
        current.map((step, stepIndex) =>
          stepIndex === index ? applyInspection(step, project) : step,
        ),
      );
      return;
    }

    try {
      const result = await inspectProject(path);
      setSteps((current) =>
        current.map((step, stepIndex) =>
          stepIndex === index ? applyInspection(step, result.project) : step,
        ),
      );
    } catch (error) {
      setSteps((current) =>
        current.map((step, stepIndex) =>
          stepIndex === index
            ? {
                ...step,
                buildSystem: null,
                mavenMetadata: undefined,
                packageManager: undefined,
                availableScripts: [],
                script: '',
                commandType: step.commandType,
                inspectionError: error instanceof Error ? error.message : 'Could not inspect project path.',
              }
            : step,
        ),
      );
    }
  }

  useEffect(() => {
    if (!open) return;
    setIsDirty(false);
    setConfirmClose(false);
    let cancelled = false;

    const nextSteps =
      initialData?.steps.length
        ? initialData.steps.map((step) => fromApiStep(step, defaultMavenGoals))
        : [createEmptyStep(defaultMavenGoals)];

    setName(initialData?.name ?? '');
    setDescription(initialData?.description ?? '');
    setFailFast(initialData?.failFast ?? true);
    setSteps(nextSteps);

    void (async () => {
      for (let index = 0; index < nextSteps.length; index++) {
        if (cancelled) return;
        const step = nextSteps[index];
        if (!step?.path) continue;
        await resolveStepPath(index, step.path);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialData, defaultMavenGoals, registeredJdkVersions]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isDirty) {
      setConfirmClose(true);
      return;
    }
    setConfirmClose(false);
    onOpenChange(nextOpen);
  }

  function handleDiscard() {
    setConfirmClose(false);
    setIsDirty(false);
    onOpenChange(false);
  }

  function addStep() {
    setIsDirty(true);
    setSteps((current) => [...current, createEmptyStep(defaultMavenGoals)]);
  }

  function removeStep(index: number) {
    setIsDirty(true);
    setSteps((current) => current.filter((_, i) => i !== index));
  }

  function updateStep(index: number, updater: (current: StepFormData) => StepFormData) {
    setIsDirty(true);
    setSteps((current) => current.map((step, i) => (i === index ? updater(step) : step)));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setIsDirty(true);
    setSteps((current) => {
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target]!, copy[index]!];
      return copy;
    });
  }

  function handleSubmit() {
    onSave({ name, description, failFast, steps });
    onOpenChange(false);
  }

  const canSave =
    name.trim().length > 0 &&
    steps.length > 0 &&
    steps.every((step) => {
      if (!step.path.trim()) return false;
      if (step.inspectionError) return false;
      if (step.buildSystem === 'maven') return step.mavenGoals.length > 0;
      if (step.buildSystem === 'node') return step.commandType === 'install' || step.script.trim().length > 0;
      return false;
    });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogTitle>{mode === 'create' ? 'Create pipeline' : `Edit "${name}"`}</DialogTitle>
        <DialogDescription>
          Build a multi-step pipeline with detected Maven and Node step behavior.
        </DialogDescription>

        {confirmClose && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center rounded-[24px] bg-background/80 backdrop-blur-sm">
            <div className="rounded-[20px] border border-border bg-card p-6 text-center shadow-lg">
              <p className="font-semibold text-foreground">Discard changes?</p>
              <p className="mt-1 text-sm text-muted-foreground">Any unsaved progress will be lost.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmClose(false)}>
                  Keep editing
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDiscard}>
                  Discard
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-visible">
          <div className="grid gap-4 border-b border-border pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <Input
              label="Pipeline name"
              placeholder="e.g. full-build"
              value={name}
              onChange={(e) => { setIsDirty(true); setName(e.target.value); }}
              disabled={mode === 'edit'}
            />
            <Input
              label="Description"
              placeholder="Short summary of what this pipeline does"
              value={description}
              onChange={(e) => { setIsDirty(true); setDescription(e.target.value); }}
            />
            <button
              type="button"
              aria-pressed={failFast}
              onClick={() => { setIsDirty(true); setFailFast((current) => !current); }}
              className={cn('toggle-pill', failFast && 'is-active')}
            >
              <span className="toggle-pill-indicator">
                {failFast ? <Check size={11} /> : null}
              </span>
              Fail fast
            </button>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-visible px-1 py-1 -mx-1 -my-1 pr-3">
            <div className="flex flex-col gap-4">
              {steps.map((step, index) => (
                <StepCard
                  key={index}
                  step={step}
                  index={index}
                  total={steps.length}
                  onUpdate={(updater) => updateStep(index, updater)}
                  onResolvePath={(path, project) => void resolveStepPath(index, path, project)}
                  onRemove={() => removeStep(index)}
                  onMoveUp={() => moveStep(index, -1)}
                  onMoveDown={() => moveStep(index, 1)}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
            <Button variant="outline" size="sm" onClick={addStep}>
              <Plus size={14} />
              Add step
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={!canSave}>
                {mode === 'create' ? 'Create pipeline' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function toMavenCommandValue(step: StepFormData): MavenCommandValue {
  return {
    modulePath: step.mavenModulePath,
    goals: step.mavenGoals,
    optionKeys: step.mavenOptionKeys,
    profileStates: step.mavenProfileStates,
    extraOptions: step.mavenExtraOptions,
    javaVersion: step.javaVersion,
    executionMode: step.executionMode,
  };
}
