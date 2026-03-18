import { ArrowUpRight, CheckCircle, XCircle, Loader2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/utils';
import { useGitInfo } from '@/api/queries';
import { BranchBadge } from '@/components/BranchBadge';
import type { BuildEvent } from '@gfos-build/contracts';

type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'launched';

interface StepState {
  label: string;
  status: StepStatus;
  durationMs?: number;
  path?: string;
}

function deriveSteps(events: BuildEvent[], _totalFromPipeline: number, stepLabels: string[]): StepState[] {
  const states: StepState[] = stepLabels.map((label) => ({ label, status: 'pending' as StepStatus }));

  for (const event of events) {
    if (event.type === 'step:start') {
      const i = event.index;
      if (states[i]) states[i] = { ...states[i]!, status: 'running', path: event.step.path };
    } else if (event.type === 'step:done') {
      const i = event.index;
      if (states[i]) {
        states[i] = {
          ...states[i]!,
          status: event.status,
          durationMs: event.durationMs,
        };
      }
    }
  }

  return states;
}

function StepBranchBadge({ path }: { path: string }) {
  const { data: gitInfo } = useGitInfo(path);
  return <BranchBadge branch={gitInfo?.branch ?? null} isDirty={gitInfo?.isDirty} />;
}

export interface StepTimelineProps {
  events: BuildEvent[];
  stepLabels: string[];
}

const icons: Record<StepStatus, React.ReactNode> = {
  pending: <Circle size={15} className="text-muted-foreground" />,
  running: <Loader2 size={15} className="text-warning animate-spin" />,
  success: <CheckCircle size={15} className="text-success" />,
  failed:  <XCircle size={15} className="text-destructive" />,
  launched: <ArrowUpRight size={15} className="text-warning" />,
};

const pillColors: Record<StepStatus, string> = {
  pending: 'border-border bg-card/70 text-muted-foreground',
  running: 'border-primary/20 bg-primary/10 text-primary',
  success: 'border-success/20 bg-success/10 text-success',
  failed: 'border-destructive/20 bg-destructive/10 text-destructive',
  launched: 'border-warning/20 bg-warning/10 text-warning',
};

export function StepTimeline({ events, stepLabels }: StepTimelineProps) {
  const steps = deriveSteps(events as BuildEvent[], stepLabels.length, stepLabels);

  return (
    <div className="flex flex-wrap gap-3">
      {steps.map((step, i) => (
        <div
          key={i}
          className={cn(
            'pill-control border transition-colors duration-200',
            pillColors[step.status],
          )}
        >
          {icons[step.status]}
          <span>{step.label}</span>
          {step.durationMs != null && (
            <span className="opacity-60 ml-0.5">{formatDuration(step.durationMs)}</span>
          )}
          {step.path && <StepBranchBadge path={step.path} />}
        </div>
      ))}
    </div>
  );
}
