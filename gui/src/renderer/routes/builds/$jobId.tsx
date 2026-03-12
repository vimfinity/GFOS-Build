import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCancelJob } from '@/api/queries';
import { useJobEvents } from '@/api/ws';
import { StepTimeline } from '@/components/StepTimeline';
import { BuildOutput } from '@/components/BuildOutput';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDuration, cn } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Square, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import type { BuildEvent } from '@shared/types';

export const Route = createFileRoute('/builds/$jobId')({
  component: LiveBuildView,
});

function LiveBuildView() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { events, done, error, startMs } = useJobEvents(jobId);
  const cancelJob = useCancelJob();

  // Elapsed timer — anchored to when the first WS event arrived (from cache if remounting)
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (done) return;
    const tick = () => setElapsedMs(Date.now() - startMs);
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [done, startMs]);

  // Invalidate the builds list so the Builds page reflects the new result
  useEffect(() => {
    if (done) {
      void queryClient.invalidateQueries({ queryKey: ['builds'] });
    }
  }, [done, queryClient]);

  // Narrow events to BuildEvent subtypes only
  const buildEvents = useMemo(
    () => events.filter(
      (e): e is BuildEvent =>
        'type' in e && (e.type.startsWith('step:') || e.type === 'run:done'),
    ),
    [events],
  );

  const runDoneEvent = buildEvents.find((e) => e.type === 'run:done');
  const isSuccess =
    runDoneEvent?.type === 'run:done' ? runDoneEvent.result.success : null;

  // Identify the pipeline name from the event stream
  const pipelineName = useMemo(() => {
    const ev = buildEvents.find((e) => e.type === 'step:start');
    return ev?.type === 'step:start' ? ev.pipelineName : undefined;
  }, [buildEvents]);

  // Derive step labels directly from events (works for both pipeline and ad-hoc builds)
  const stepLabels = useMemo(() => {
    const total = buildEvents.find((e) => e.type === 'step:start')?.total ?? 0;
    const labels = new Array<string>(total).fill('Step');
    for (const e of buildEvents) {
      if (e.type === 'step:start') labels[e.index] = e.step.label;
    }
    return labels;
  }, [buildEvents]);

  // Build title: pipeline name or first step's label for ad-hoc builds
  const buildTitle = useMemo(() => {
    if (pipelineName) return pipelineName;
    const firstStep = buildEvents.find((e) => e.type === 'step:start');
    return firstStep?.type === 'step:start' ? firstStep.step.label : null;
  }, [pipelineName, buildEvents]);

  // Final duration: use the server-reported value when available
  const finalDurationMs =
    runDoneEvent?.type === 'run:done' ? runDoneEvent.result.durationMs : elapsedMs;

  async function handleCancel() {
    await cancelJob.mutateAsync(jobId);
    void navigate({ to: '/builds' });
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4">

      {/* ── Header row ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: '/builds' })}>
          <ArrowLeft size={14} />
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex flex-col min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate leading-tight">
              {buildTitle ?? 'Build'}
            </h1>
            <span className="text-[10px] text-muted-foreground font-mono">
              job&nbsp;{jobId}
            </span>
          </div>

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

          <span className="text-xs text-muted-foreground font-mono ml-auto shrink-0 flex items-center gap-1">
            <Clock size={11} />
            {formatDuration(done ? finalDurationMs : elapsedMs)}
          </span>
        </div>

        {!done && (
          <Button variant="destructive" size="sm" onClick={() => void handleCancel()}>
            <Square size={12} /> Cancel
          </Button>
        )}
      </div>

      {/* ── Step timeline ─────────────────────────────────────────────────── */}
      {stepLabels.length > 0 && (
        <div className="shrink-0">
          <StepTimeline events={buildEvents} stepLabels={stepLabels} />
        </div>
      )}

      {/* ── WebSocket error ───────────────────────────────────────────────── */}
      {error && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm shrink-0 flex items-center gap-2">
          <XCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Completion summary banner ─────────────────────────────────────── */}
      {done && runDoneEvent?.type === 'run:done' && (
        <div
          className={cn(
            'shrink-0 rounded-lg border px-4 py-3 flex items-center gap-3',
            isSuccess
              ? 'border-success/30 bg-success/10'
              : 'border-destructive/30 bg-destructive/10',
          )}
        >
          {isSuccess ? (
            <CheckCircle2 size={16} className="text-success shrink-0" />
          ) : (
            <XCircle size={16} className="text-destructive shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <span
              className={cn(
                'text-sm font-medium',
                isSuccess ? 'text-success' : 'text-destructive',
              )}
            >
              {isSuccess ? 'Build completed successfully' : 'Build failed'}
            </span>
            {runDoneEvent.result.stoppedAt != null && (
              <span className="text-xs text-muted-foreground ml-2">
                · stopped at step {runDoneEvent.result.stoppedAt + 1}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono shrink-0">
            <Clock size={11} />
            {formatDuration(runDoneEvent.result.durationMs)}
          </div>

          {/* Per-step pass/fail summary */}
          {runDoneEvent.result.results.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs shrink-0">
              <span className="text-success">
                {runDoneEvent.result.results.filter((r) => r.success).length} passed
              </span>
              {runDoneEvent.result.results.some((r) => !r.success) && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-destructive">
                    {runDoneEvent.result.results.filter((r) => !r.success).length} failed
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Build output ──────────────────────────────────────────────────── */}
      <BuildOutput events={buildEvents} isRunning={!done} />
    </div>
  );
}
