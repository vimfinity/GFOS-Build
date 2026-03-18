import { Fragment } from 'react';
import { Play, CheckCircle2, XCircle, Loader2, Clock3, Pencil, Trash2, ArrowUpRight, ChevronRight, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDuration, timeAgo } from '@/lib/utils';
import type { PipelineListItem } from '@gfos-build/contracts';

interface PipelineCardProps {
  pipeline: PipelineListItem;
  onRun: (name: string, from?: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  isRunning?: boolean;
}

function LastRunIcon({ status }: { status: string }) {
  if (status === 'success') return <CheckCircle2 size={14} className="text-success shrink-0" />;
  if (status === 'failed') return <XCircle size={14} className="text-destructive shrink-0" />;
  if (status === 'launched') return <ArrowUpRight size={14} className="text-warning shrink-0" />;
  if (status === 'running') {
    return <Loader2 size={14} className="text-primary animate-spin shrink-0" />;
  }
  return <Clock3 size={14} className="text-muted-foreground shrink-0" />;
}

export function PipelineCard({ pipeline, onRun, onEdit, onDelete, isRunning }: PipelineCardProps) {
  const lastRunFailed = pipeline.lastRun?.status === 'failed';
  const resumeFrom = pipeline.lastRun?.stoppedAt;
  const canResume = lastRunFailed && resumeFrom != null;
  const resumeStepLabel = canResume ? (pipeline.steps[resumeFrom]?.label ?? `Step ${resumeFrom + 1}`) : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex h-full flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="page-title truncate text-xl font-semibold text-foreground">
                {pipeline.name}
              </h3>
              <span className="pill-meta rounded-full bg-secondary text-muted-foreground">
                {pipeline.steps.length} step{pipeline.steps.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
              {pipeline.description || 'Reusable build flow for repeated multi-step execution.'}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button size="sm" onClick={() => onRun(pipeline.name)} disabled={isRunning}>
              {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {isRunning ? 'Running' : 'Run'}
            </Button>
            {canResume && !isRunning && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRun(pipeline.name, String(resumeFrom + 1))}
                title={`Restart from "${resumeStepLabel}"`}
              >
                <RotateCcw size={12} />
                Resume
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {pipeline.steps.map((step, index) => (
            <Fragment key={`${step.label}-${index}`}>
              {index > 0 && <ChevronRight size={12} className="shrink-0 text-muted-foreground" />}
              <button
                type="button"
                disabled={isRunning}
                onClick={() => !isRunning && onRun(pipeline.name, String(index + 1))}
                title={`Run from "${step.label || `Step ${index + 1}`}"`}
                className="pill-meta group cursor-pointer rounded-full border border-border bg-secondary text-secondary-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:cursor-default disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-secondary disabled:hover:text-secondary-foreground"
              >
                {step.label || `Step ${index + 1}`}
                {step.buildSystem === 'node' && step.executionMode === 'external' ? ' · external' : ''}
              </button>
            </Fragment>
          ))}
        </div>

        <div className="rounded-[18px] border border-border/80 bg-secondary/55 px-4 py-3">
          {pipeline.lastRun ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LastRunIcon status={pipeline.lastRun.status} />
              <span>Last run {timeAgo(pipeline.lastRun.startedAt)}</span>
              {pipeline.lastRun.durationMs != null && (
                <>
                  <span className="text-border">·</span>
                  <span className="font-mono">{formatDuration(pipeline.lastRun.durationMs)}</span>
                </>
              )}
              {canResume && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-destructive">Failed at &ldquo;{resumeStepLabel}&rdquo;</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 size={14} />
              <span>Never run yet</span>
            </div>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowUpRight size={12} />
            {pipeline.failFast ? 'Fail-fast enabled' : 'Continues after failures'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil size={12} />
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 size={12} />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
