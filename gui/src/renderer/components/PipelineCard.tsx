import { Play, CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDuration, timeAgo } from '@/lib/utils';
import type { PipelineListItem } from '@shared/api';

interface PipelineCardProps {
  pipeline: PipelineListItem;
  onRun: (name: string) => void;
  isRunning?: boolean;
}

function LastRunIcon({ status }: { status: string }) {
  if (status === 'success') return <CheckCircle size={14} className="text-success shrink-0" />;
  if (status === 'failed')  return <XCircle size={14} className="text-destructive shrink-0" />;
  if (status === 'running') return <Loader2 size={14} className="text-warning animate-spin shrink-0" />;
  return <Clock size={14} className="text-muted-foreground shrink-0" />;
}

export function PipelineCard({ pipeline, onRun, isRunning }: PipelineCardProps) {
  return (
    <Card className="hover:border-border/80 transition-colors duration-150">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: info */}
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground truncate">{pipeline.name}</h3>
              <span className="text-xs text-muted-foreground shrink-0">{pipeline.steps.length} steps</span>
            </div>

            {pipeline.description && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{pipeline.description}</p>
            )}

            {/* Step chips */}
            <div className="flex flex-wrap gap-1">
              {pipeline.steps.map((step) => (
                <span
                  key={step.label}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground border border-border"
                >
                  {step.label}
                </span>
              ))}
            </div>

            {/* Last run */}
            {pipeline.lastRun ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LastRunIcon status={pipeline.lastRun.status} />
                <span>{timeAgo(pipeline.lastRun.startedAt)}</span>
                {pipeline.lastRun.durationMs != null && (
                  <>
                    <span className="text-border">·</span>
                    <span>{formatDuration(pipeline.lastRun.durationMs)}</span>
                  </>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/60 italic">Never run</span>
            )}
          </div>

          {/* Right: run button */}
          <Button
            size="sm"
            onClick={() => onRun(pipeline.name)}
            disabled={isRunning}
            className="shrink-0"
          >
            {isRunning ? (
              <><Loader2 size={12} className="animate-spin" /> Running…</>
            ) : (
              <><Play size={12} /> Run</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
