import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { pipelinesQuery, useCancelJob } from '@/api/queries';
import { useJobEvents } from '@/api/ws';
import { StepTimeline } from '@/components/StepTimeline';
import { BuildOutput } from '@/components/BuildOutput';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Square, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { BuildEvent } from '@shared/types';

export const Route = createFileRoute('/builds/$jobId')({
  component: LiveBuildView,
});

function LiveBuildView() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { data: pipelines } = useQuery(pipelinesQuery);
  const { events, done, error } = useJobEvents(jobId);
  const cancelJob = useCancelJob();
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(Date.now());

  const buildEvents = events.filter(
    (e): e is BuildEvent => 'type' in e && (e.type.startsWith('step:') || e.type === 'run:done'),
  );

  useEffect(() => {
    if (done) return;
    const interval = setInterval(() => setElapsedMs(Date.now() - startRef.current), 500);
    return () => clearInterval(interval);
  }, [done]);

  const runDoneEvent = buildEvents.find((e) => e.type === 'run:done');
  const isSuccess = runDoneEvent?.type === 'run:done' ? runDoneEvent.result.success : null;

  // Try to identify the pipeline from a step:start event
  const firstStepEvent = buildEvents.find((e) => e.type === 'step:start');
  const pipelineName =
    firstStepEvent?.type === 'step:start' ? firstStepEvent.pipelineName : undefined;
  const pipeline = pipelineName ? pipelines?.find((p) => p.name === pipelineName) : undefined;
  const stepLabels = pipeline?.steps.map((s) => s.label) ?? [];

  async function handleCancel() {
    await cancelJob.mutateAsync(jobId);
    void navigate({ to: '/builds' });
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header row */}
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: '/builds' })}>
          <ArrowLeft size={14} />
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">
            {pipelineName ?? 'Build'}
          </h1>
          {done ? (
            isSuccess === true ? (
              <Badge variant="success">
                <CheckCircle2 size={11} /> Success
              </Badge>
            ) : isSuccess === false ? (
              <Badge variant="destructive">
                <XCircle size={11} /> Failed
              </Badge>
            ) : (
              <Badge variant="secondary">Done</Badge>
            )
          ) : (
            <Badge variant="warning">
              <Loader2 size={11} className="animate-spin" /> Running
            </Badge>
          )}
          <span className="text-xs text-muted-foreground font-mono ml-auto shrink-0">
            {formatDuration(
              done
                ? runDoneEvent?.type === 'run:done'
                  ? runDoneEvent.result.durationMs
                  : elapsedMs
                : elapsedMs,
            )}
          </span>
        </div>

        {!done && (
          <Button variant="destructive" size="sm" onClick={() => void handleCancel()}>
            <Square size={12} /> Cancel
          </Button>
        )}
      </div>

      {/* Step timeline */}
      {stepLabels.length > 0 && (
        <div className="shrink-0">
          <StepTimeline events={buildEvents} stepLabels={stepLabels} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm shrink-0">
          {error}
        </div>
      )}

      {/* Build output */}
      <BuildOutput events={buildEvents} isRunning={!done} />
    </div>
  );
}
