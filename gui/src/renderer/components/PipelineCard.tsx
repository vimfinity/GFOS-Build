import { Play, CheckCircle2, XCircle, Loader2, Clock3, Pencil, Trash2, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDuration, timeAgo } from '@/lib/utils';
import type { PipelineListItem } from '@shared/api';

interface PipelineCardProps {
  pipeline: PipelineListItem;
  onRun: (name: string) => void;
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

          <Button size="sm" onClick={() => onRun(pipeline.name)} disabled={isRunning}>
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isRunning ? 'Running' : 'Run'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {pipeline.steps.map((step, index) => (
            <span
              key={`${step.label}-${index}`}
              className="pill-meta rounded-full border border-border bg-secondary text-secondary-foreground"
            >
              {step.label || `Step ${index + 1}`}
              {step.buildSystem === 'node' && step.executionMode === 'external' ? ' · external' : ''}
            </span>
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
