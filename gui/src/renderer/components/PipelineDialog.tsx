import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Plus, Trash2, ArrowUp, ArrowDown, FolderOpen } from 'lucide-react';
import type { PipelineStep } from '@shared/api';
import { pickDirectory } from '@/api/bridge';

interface StepFormData {
  label: string;
  path: string;
  goals: string;
  flags: string;
  buildSystem: 'maven' | 'npm';
  javaVersion: string;
}

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

function BuildSystemToggle({ value, onChange }: { value: 'maven' | 'npm'; onChange: (v: 'maven' | 'npm') => void }) {
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
  async function browsePath() {
    const dir = await pickDirectory();
    if (dir) onUpdate('path', dir);
  }

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

      {/* Row 2: Path + Browse */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 min-w-0">
          <Input
            label="Project path"
            placeholder="e.g. root-name:services/my-module or /absolute/path"
            value={step.path}
            onChange={(e) => onUpdate('path', e.target.value)}
          />
        </div>
        <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => void browsePath()}
            title="Browse directory"
          >
            <FolderOpen size={14} />
          </Button>
      </div>

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
          <Input
            label="Java version (optional)"
            placeholder="e.g. 17"
            value={step.javaVersion}
            onChange={(e) => onUpdate('javaVersion', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export function PipelineDialog({ open, onOpenChange, initialData, onSave, mode }: PipelineDialogProps) {
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

  const canSave = name.trim().length > 0 && steps.length > 0 && steps.every((s) => s.path.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>{mode === 'create' ? 'Create Pipeline' : `Edit "${name}"`}</DialogTitle>
        <DialogDescription>
          {mode === 'create'
            ? 'Define a build pipeline with one or more ordered steps.'
            : 'Update this pipeline\'s steps and configuration.'}
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
            <span className="text-xs text-muted-foreground/60">(stop pipeline on first step failure)</span>
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
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSave}>
            {mode === 'create' ? 'Create pipeline' : 'Save changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
