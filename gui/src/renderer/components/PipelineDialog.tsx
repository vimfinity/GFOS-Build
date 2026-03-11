import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import type { PipelineStep } from '@shared/api';

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
      <DialogContent className="max-w-2xl">
        <DialogTitle>{mode === 'create' ? 'Create Pipeline' : `Edit "${name}"`}</DialogTitle>
        <DialogDescription>
          {mode === 'create' ? 'Define a new build pipeline with ordered steps.' : 'Modify pipeline configuration.'}
        </DialogDescription>

        <div className="flex flex-col gap-4 mt-4 max-h-[60vh] overflow-y-auto pr-1">
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
              placeholder="Build all modules"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={failFast}
              onChange={(e) => setFailFast(e.target.checked)}
              className="rounded border-input"
            />
            Fail fast (stop on first error)
          </label>

          {/* Steps editor */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Steps</span>
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-start p-3 rounded-lg border border-border bg-background">
                <div className="flex flex-col gap-1 pt-1 shrink-0">
                  <button
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <GripVertical size={12} className="text-muted-foreground/40" />
                  <button
                    onClick={() => moveStep(i, 1)}
                    disabled={i === steps.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>

                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Label"
                    value={step.label}
                    onChange={(e) => updateStep(i, 'label', e.target.value)}
                  />
                  <Input
                    placeholder="Path (e.g. 2025/shared)"
                    value={step.path}
                    onChange={(e) => updateStep(i, 'path', e.target.value)}
                  />
                  <Input
                    placeholder="Goals (e.g. clean install)"
                    value={step.goals}
                    onChange={(e) => updateStep(i, 'goals', e.target.value)}
                  />
                  <Input
                    placeholder="Flags (e.g. -DskipTests)"
                    value={step.flags}
                    onChange={(e) => updateStep(i, 'flags', e.target.value)}
                  />
                  <Input
                    placeholder="Java version (optional)"
                    value={step.javaVersion}
                    onChange={(e) => updateStep(i, 'javaVersion', e.target.value)}
                  />
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeStep(i)}
                  disabled={steps.length === 1}
                  className="shrink-0 text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
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
            {mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
