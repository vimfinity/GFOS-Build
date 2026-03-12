import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Plus, Trash2, ArrowUp, ArrowDown, FolderOpen, Loader2 } from 'lucide-react';
import type { PipelineStep } from '@shared/api';
import type { Project } from '@shared/types';
import { pickDirectory } from '@/api/bridge';
import { scanQuery, configQuery } from '@/api/queries';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepFormData {
  label: string;
  path: string;
  goals: string;
  flags: string;
  buildSystem: 'maven' | 'npm';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyStep(): StepFormData {
  return { label: '', path: '', goals: 'clean install', flags: '', buildSystem: 'maven', javaVersion: '' };
}

function fromApiStep(s: PipelineStep): StepFormData {
  return {
    label: s.label,
    path: s.path,
    goals: s.goals.join(' '),
    flags: s.flags.join(' '),
    buildSystem: 'maven',
    javaVersion: s.javaVersion ?? '',
  };
}

function getRelativePath(project: Project, roots: Record<string, string>): string {
  const rootPath = roots[project.rootName];
  if (!rootPath) return project.path;
  const norm = project.path.replace(/\\/g, '/');
  const rootNorm = rootPath.replace(/\\/g, '/').replace(/\/$/, '');
  return norm.startsWith(rootNorm) ? norm.slice(rootNorm.length + 1) : project.path;
}

// ─── Build system toggle ──────────────────────────────────────────────────────

function BuildSystemToggle({
  value,
  onChange,
}: {
  value: 'maven' | 'npm';
  onChange: (v: 'maven' | 'npm') => void;
}) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden shrink-0" style={{ width: 100 }}>
      {(['maven', 'npm'] as const).map((sys) => (
        <button
          key={sys}
          type="button"
          onClick={() => onChange(sys)}
          className={cn(
            'flex-1 text-xs py-1.5 font-medium transition-colors',
            value === sys
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          {sys === 'maven' ? 'Maven' : 'npm'}
        </button>
      ))}
    </div>
  );
}

// ─── Java version select ──────────────────────────────────────────────────────

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
        label="Java version (optional)"
        placeholder="e.g. 17"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">Java version</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Default</option>
        {jdkVersions.map((v) => (
          <option key={v} value={v}>
            Java {v}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Project path picker ──────────────────────────────────────────────────────

function ProjectPathPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: scanData, isLoading: scanLoading } = useQuery(scanQuery);
  const { data: configData } = useQuery(configQuery);
  const roots = configData?.config.roots ?? {};

  // Display value: matched project name + location, or raw path
  const displayValue = useMemo(() => {
    if (!value) return '';
    const match = scanData?.projects.find((p) => p.path === value);
    if (match) {
      const relPath = getRelativePath(match, roots);
      return `${match.name} (${match.rootName}:${relPath})`;
    }
    return value;
  }, [value, scanData, roots]);

  // Filtered projects for dropdown
  const filtered = useMemo(() => {
    if (!scanData?.projects) return [];
    if (!query.trim()) return scanData.projects.slice(0, 20);
    const q = query.toLowerCase();
    return scanData.projects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.path.toLowerCase().includes(q) ||
          (p.maven?.artifactId ?? '').toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [scanData, query]);

  // Close when clicking outside the picker
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  async function handleBrowse(e: React.MouseEvent) {
    e.preventDefault();
    const dir = await pickDirectory();
    if (dir) {
      onChange(dir);
      setOpen(false);
      setQuery('');
    }
  }

  function selectProject(project: Project) {
    onChange(project.path);
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = query.trim();
      // If the typed text looks like an absolute path, commit it directly
      if (trimmed && /^([A-Za-z]:[/\\]|\/)/.test(trimmed)) {
        onChange(trimmed);
        setOpen(false);
        setQuery('');
      } else if (filtered.length > 0 && filtered[0]) {
        // Otherwise select the first dropdown result
        selectProject(filtered[0]);
      }
    }
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">Project path</label>
      <div className="flex gap-2">
        {/* Input + dropdown wrapper */}
        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            value={open ? query : displayValue}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setOpen(true);
              setQuery('');
            }}
            onKeyDown={handleKeyDown}
            placeholder={open ? 'Search projects or type an absolute path…' : 'Select a project…'}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Dropdown */}
          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-auto rounded-md border border-border bg-background shadow-lg">
              {scanLoading ? (
                <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                  <Loader2 size={12} className="animate-spin shrink-0" />
                  Loading projects…
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-2.5 text-xs text-muted-foreground">
                  {query.trim() ? 'No matching projects' : 'No projects found'}
                </div>
              ) : (
                filtered.map((project) => {
                  const relPath = getRelativePath(project, roots);
                  return (
                    <button
                      key={project.path}
                      type="button"
                      // Prevent the input from blurring before the click fires
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectProject(project)}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent transition-colors',
                        value === project.path && 'bg-accent/50',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex items-center text-[10px] px-1.5 py-0 rounded font-semibold shrink-0 leading-[18px]',
                          project.buildSystem === 'maven'
                            ? 'bg-primary/20 text-primary'
                            : 'bg-emerald-500/20 text-emerald-400',
                        )}
                      >
                        {project.buildSystem === 'maven' ? 'mvn' : 'npm'}
                      </span>
                      <span className="text-sm font-medium text-foreground shrink-0">
                        {project.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono truncate min-w-0">
                        {relPath}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Browse button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={(e) => void handleBrowse(e)}
          title="Browse directory"
        >
          <FolderOpen size={14} />
        </Button>
      </div>
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: StepFormData;
  index: number;
  total: number;
  onUpdate: (field: keyof StepFormData, value: string | boolean) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-background/50">
      {/* Step header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded shrink-0">
          Step {index + 1}
        </span>
        <span className="flex-1 text-sm font-medium text-foreground/70 truncate select-none">
          {step.label || <span className="italic text-muted-foreground/60">unlabelled</span>}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            title="Move up"
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            title="Move down"
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={total === 1}
            className="p-1 rounded text-destructive/70 hover:text-destructive disabled:opacity-25 disabled:cursor-not-allowed transition-colors ml-1"
            title="Remove step"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Row 1: Label + Build system */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <Input
            label="Label"
            placeholder="e.g. shared-core"
            value={step.label}
            onChange={(e) => onUpdate('label', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <span className="text-xs text-muted-foreground font-medium">Build system</span>
          <BuildSystemToggle value={step.buildSystem} onChange={(v) => onUpdate('buildSystem', v)} />
        </div>
      </div>

      {/* Row 2: Project path picker */}
      <ProjectPathPicker
        value={step.path}
        onChange={(v) => onUpdate('path', v)}
      />

      {/* Row 3: Goals + Flags */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Goals"
          placeholder="e.g. clean install"
          value={step.goals}
          onChange={(e) => onUpdate('goals', e.target.value)}
        />
        <Input
          label="Flags (optional)"
          placeholder="e.g. -DskipTests -T4"
          value={step.flags}
          onChange={(e) => onUpdate('flags', e.target.value)}
        />
      </div>

      {/* Row 4 (Maven only): Java version */}
      {step.buildSystem === 'maven' && (
        <div className="max-w-[200px]">
          <JavaVersionSelect
            value={step.javaVersion}
            onChange={(v) => onUpdate('javaVersion', v)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Pipeline dialog ──────────────────────────────────────────────────────────

export function PipelineDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
  mode,
}: PipelineDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [failFast, setFailFast] = useState(true);
  const [steps, setSteps] = useState<StepFormData[]>([emptyStep()]);

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name);
      setDescription(initialData.description ?? '');
      setFailFast(initialData.failFast);
      setSteps(initialData.steps.length > 0 ? initialData.steps.map(fromApiStep) : [emptyStep()]);
    } else if (open && !initialData) {
      setName('');
      setDescription('');
      setFailFast(true);
      setSteps([emptyStep()]);
    }
  }, [open, initialData]);

  function addStep() {
    setSteps((s) => [...s, emptyStep()]);
  }

  function removeStep(index: number) {
    setSteps((s) => s.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: keyof StepFormData, value: string | boolean) {
    setSteps((s) => s.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((s) => {
      const copy = [...s];
      [copy[index], copy[target]] = [copy[target]!, copy[index]!];
      return copy;
    });
  }

  function handleSubmit() {
    onSave({ name, description, failFast, steps });
    onOpenChange(false);
  }

  const canSave =
    name.trim().length > 0 && steps.length > 0 && steps.every((s) => s.path.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>{mode === 'create' ? 'Create Pipeline' : `Edit "${name}"`}</DialogTitle>
        <DialogDescription>
          {mode === 'create'
            ? 'Define a build pipeline with one or more ordered steps.'
            : "Update this pipeline's steps and configuration."}
        </DialogDescription>

        <div className="flex flex-col gap-5 mt-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Pipeline metadata */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Pipeline name"
              placeholder="e.g. full-build"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mode === 'edit'}
            />
            <Input
              label="Description (optional)"
              placeholder="What does this pipeline build?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={failFast}
              onChange={(e) => setFailFast(e.target.checked)}
              className="rounded border-input accent-primary"
            />
            <span className="text-muted-foreground">Fail fast</span>
            <span className="text-xs text-muted-foreground/60">
              (stop pipeline on first step failure)
            </span>
          </label>

          {/* Steps */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Steps ({steps.length})
            </span>
            {steps.map((step, i) => (
              <StepCard
                key={i}
                step={step}
                index={i}
                total={steps.length}
                onUpdate={(field, value) => updateStep(i, field, value)}
                onRemove={() => removeStep(i)}
                onMoveUp={() => moveStep(i, -1)}
                onMoveDown={() => moveStep(i, 1)}
              />
            ))}
            <Button variant="outline" size="sm" onClick={addStep} className="self-start">
              <Plus size={14} /> Add step
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSave}>
            {mode === 'create' ? 'Create pipeline' : 'Save changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
