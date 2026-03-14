import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Plus, Trash2, ArrowUp, ArrowDown, FolderOpen, Loader2, Check } from 'lucide-react';
import type { PipelineStep } from '@shared/api';
import type { Project } from '@shared/types';
import { pickDirectory } from '@/api/bridge';
import { scanQuery, configQuery } from '@/api/queries';

interface StepFormData {
  label: string;
  path: string;
  buildSystem: 'maven' | 'npm';
  mavenGoals: string;
  mavenFlags: string;
  npmScript: string;
  javaVersion: string;
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

function createEmptyStep(mavenGoals: string, npmScript: string): StepFormData {
  return {
    label: '',
    path: '',
    buildSystem: 'maven',
    mavenGoals: mavenGoals || 'clean install',
    mavenFlags: '',
    npmScript: npmScript || 'build',
    javaVersion: '',
  };
}

function fromApiStep(step: PipelineStep, mavenGoals: string, npmScript: string): StepFormData {
  return {
    label: step.label,
    path: step.path,
    buildSystem: step.buildSystem ?? 'maven',
    mavenGoals: step.goals.join(' ') || mavenGoals || 'clean install',
    mavenFlags: step.flags.join(' '),
    npmScript: step.npmScript ?? npmScript ?? 'build',
    javaVersion: step.javaVersion ?? '',
  };
}

function getRelativePath(project: Project, roots: Record<string, string>): string {
  const rootPath = roots[project.rootName];
  if (!rootPath) return project.path;
  const norm = project.path.replace(/\\/g, '/');
  const rootNorm = rootPath.replace(/\\/g, '/').replace(/\/$/, '');
  return norm.startsWith(rootNorm) ? norm.slice(rootNorm.length + 1) : project.path;
}

function BuildSystemToggle({
  value,
  onChange,
}: {
  value: 'maven' | 'npm';
  onChange: (v: 'maven' | 'npm') => void;
}) {
  return (
    <div className="segmented-control">
      {(['maven', 'npm'] as const).map((sys) => (
        <button
          key={sys}
          type="button"
          aria-pressed={value === sys}
          onClick={() => onChange(sys)}
          className={cn(
            'segmented-control-button',
            value === sys && 'is-active',
          )}
        >
          {sys === 'maven' ? 'Maven' : 'npm'}
        </button>
      ))}
    </div>
  );
}

function JavaVersionSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { data: configData } = useQuery(configQuery);
  const jdkVersions = configData ? Object.keys(configData.config.jdkRegistry) : [];

  if (jdkVersions.length === 0) {
    return (
      <Input
        label="Java version"
        placeholder="e.g. 17"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Java version
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-select h-11 rounded-2xl border px-4 [background:var(--field-bg)] [border-color:var(--field-border)] focus:outline-none focus:border-ring focus:[box-shadow:0_0_0_1px_var(--color-ring)]"
      >
        <option value="">Default</option>
        {jdkVersions.map((version) => (
          <option key={version} value={version}>
            Java {version}
          </option>
        ))}
      </select>
    </div>
  );
}

function ProjectPathPicker({
  value,
  onChange,
  onProjectSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onProjectSelect?: (project: Project) => void;
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
          (project.npm?.name ?? '').toLowerCase().includes(q),
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
      setOpen(false);
      setQuery('');
    }
  }

  function selectProject(project: Project) {
    onChange(project.path);
    onProjectSelect?.(project);
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
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
                        {project.buildSystem === 'maven' ? 'Maven' : 'npm'}
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
  onRemove,
  onMoveUp,
  onMoveDown,
  defaultMavenGoals,
  defaultNpmScript,
}: {
  step: StepFormData;
  index: number;
  total: number;
  onUpdate: (updater: (current: StepFormData) => StepFormData) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  defaultMavenGoals: string;
  defaultNpmScript: string;
}) {
  function handleBuildSystemChange(next: 'maven' | 'npm') {
    onUpdate((current) => ({
      ...current,
      buildSystem: next,
      mavenGoals: next === 'maven' && !current.mavenGoals ? defaultMavenGoals : current.mavenGoals,
      npmScript: next === 'npm' && !current.npmScript ? defaultNpmScript : current.npmScript,
    }));
  }

  function handleProjectSelect(project: Project) {
    onUpdate((current) => ({
      ...current,
      path: project.path,
      buildSystem: project.buildSystem,
      npmScript:
        project.buildSystem === 'npm' && !current.npmScript ? defaultNpmScript : current.npmScript,
      mavenGoals:
        project.buildSystem === 'maven' && !current.mavenGoals ? defaultMavenGoals : current.mavenGoals,
    }));
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
              {step.buildSystem === 'maven' ? 'Maven' : 'npm'}
            </span>
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
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Build system
          </span>
          <BuildSystemToggle value={step.buildSystem} onChange={handleBuildSystemChange} />
        </div>
      </div>

      <div className="mt-4">
        <ProjectPathPicker
          value={step.path}
          onChange={(value) => onUpdate((current) => ({ ...current, path: value }))}
          onProjectSelect={handleProjectSelect}
        />
      </div>

      {step.buildSystem === 'maven' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px] lg:items-end">
          <Input
            label="Goals"
            placeholder="e.g. clean install"
            value={step.mavenGoals}
            onChange={(e) => onUpdate((current) => ({ ...current, mavenGoals: e.target.value }))}
          />
          <Input
            label="Flags"
            placeholder="e.g. -DskipTests -T4"
            value={step.mavenFlags}
            onChange={(e) => onUpdate((current) => ({ ...current, mavenFlags: e.target.value }))}
          />
          <JavaVersionSelect
            value={step.javaVersion}
            onChange={(value) => onUpdate((current) => ({ ...current, javaVersion: value }))}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)] lg:items-end">
          <Input
            label="Script"
            placeholder="e.g. build"
            value={step.npmScript}
            onChange={(e) => onUpdate((current) => ({ ...current, npmScript: e.target.value }))}
          />
          <div className="rounded-[18px] border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
            npm steps run `npm run &lt;script&gt;`.
          </div>
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
  const defaultNpmScript = configData?.config.npm.defaultBuildScript ?? 'build';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [failFast, setFailFast] = useState(true);
  const [steps, setSteps] = useState<StepFormData[]>([createEmptyStep(defaultMavenGoals, defaultNpmScript)]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description ?? '');
      setFailFast(initialData.failFast);
      setSteps(
        initialData.steps.length > 0
          ? initialData.steps.map((step) => fromApiStep(step, defaultMavenGoals, defaultNpmScript))
          : [createEmptyStep(defaultMavenGoals, defaultNpmScript)],
      );
      return;
    }

    setName('');
    setDescription('');
    setFailFast(true);
    setSteps([createEmptyStep(defaultMavenGoals, defaultNpmScript)]);
  }, [open, initialData, defaultMavenGoals, defaultNpmScript]);

  function addStep() {
    setSteps((current) => [...current, createEmptyStep(defaultMavenGoals, defaultNpmScript)]);
  }

  function removeStep(index: number) {
    setSteps((current) => current.filter((_, i) => i !== index));
  }

  function updateStep(index: number, updater: (current: StepFormData) => StepFormData) {
    setSteps((current) => current.map((step, i) => (i === index ? updater(step) : step)));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
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
      return step.buildSystem === 'maven'
        ? step.mavenGoals.trim().length > 0
        : step.npmScript.trim().length > 0;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogTitle>{mode === 'create' ? 'Create pipeline' : `Edit "${name}"`}</DialogTitle>
        <DialogDescription>
          Build a multi-step pipeline with separate Maven and npm step behavior.
        </DialogDescription>

        <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-visible">
          <div className="grid gap-4 border-b border-border pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <Input
              label="Pipeline name"
              placeholder="e.g. full-build"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mode === 'edit'}
            />
            <Input
              label="Description"
              placeholder="Short summary of what this pipeline does"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              type="button"
              aria-pressed={failFast}
              onClick={() => setFailFast((current) => !current)}
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
                  onRemove={() => removeStep(index)}
                  onMoveUp={() => moveStep(index, -1)}
                  onMoveDown={() => moveStep(index, 1)}
                  defaultMavenGoals={defaultMavenGoals}
                  defaultNpmScript={defaultNpmScript}
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
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
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
