import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCancelJob, useGitInfo, useRunPipeline } from '@/api/queries';
import { useJobEvents } from '@/api/run-events';
import { StepTimeline } from '@/components/StepTimeline';
import { BuildOutput } from '@/components/BuildOutput';
import { BranchBadge } from '@/components/BranchBadge';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { formatDuration, cn } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Square,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock3,
  Activity,
  RotateCcw,
  Play,
} from 'lucide-react';
import type { BuildEvent } from '@gfos-build/contracts';

export const Route = createFileRoute('/builds/$jobId')({
  component: LiveBuildView,
});

function LiveBuildView() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { events, done, error, startMs, eventVersion } = useJobEvents(jobId);
  const cancelJob = useCancelJob();
  const runPipeline = useRunPipeline();

  const [elapsedMs, setElapsedMs] = useState(() => Math.max(0, Date.now() - startMs));

  useEffect(() => {
    if (done) return;
    const tick = () => setElapsedMs(Date.now() - startMs);
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [done, startMs]);

  useEffect(() => {
    setElapsedMs(Math.max(0, Date.now() - startMs));
  }, [startMs]);

  useEffect(() => {
    if (done) {
      void queryClient.invalidateQueries({ queryKey: ['builds'] });
      void queryClient.invalidateQueries({ queryKey: ['git-info'] });
    }
  }, [done, queryClient]);

  const buildEvents = useMemo(
    () =>
      events.filter(
        (event): event is BuildEvent =>
          'type' in event && (event.type.startsWith('step:') || event.type === 'run:done'),
      ),
    [events, eventVersion],
  );

  const runDoneEvent = buildEvents.find((event) => event.type === 'run:done');
  const runStatus = runDoneEvent?.type === 'run:done' ? runDoneEvent.result.status : null;
  const latestStepDone = [...buildEvents].reverse().find((event) => event.type === 'step:done');
  const displayStatus = !done
    ? 'running'
    : runStatus === 'success'
      ? 'success'
      : runStatus === 'launched'
        ? 'launched'
        : runStatus === 'failed' || error || (latestStepDone?.type === 'step:done' && latestStepDone.status === 'failed')
        ? 'failed'
        : latestStepDone?.type === 'step:done' && latestStepDone.status === 'success'
          ? 'success'
          : latestStepDone?.type === 'step:done' && latestStepDone.status === 'launched'
            ? 'launched'
          : 'done';

  const pipelineName = useMemo(() => {
    const event = buildEvents.find((item) => item.type === 'step:start');
    return event?.type === 'step:start' ? event.pipelineName : undefined;
  }, [buildEvents]);

  const stepLabels = useMemo(() => {
    const total = buildEvents.find((event) => event.type === 'step:start')?.total ?? 0;
    const labels = new Array<string>(total).fill('Step');
    for (const event of buildEvents) {
      if (event.type === 'step:start') labels[event.index] = event.step.label;
    }
    return labels;
  }, [buildEvents]);

  const buildTitle = useMemo(() => {
    if (pipelineName) return pipelineName;
    const firstStep = buildEvents.find((event) => event.type === 'step:start');
    return firstStep?.type === 'step:start' ? firstStep.step.label : null;
  }, [pipelineName, buildEvents]);

  const currentStepPath = useMemo(() => {
    const stepStarts = buildEvents.filter((e) => e.type === 'step:start');
    const last = stepStarts[stepStarts.length - 1];
    return last?.type === 'step:start' ? last.step.path : '';
  }, [buildEvents]);

  const { data: gitInfo } = useGitInfo(currentStepPath);

  const showStepTimeline = Boolean(pipelineName) || stepLabels.length > 1;

  const finalDurationMs =
    runDoneEvent?.type === 'run:done' ? runDoneEvent.result.durationMs : elapsedMs;

  async function handleCancel() {
    await cancelJob.mutateAsync(jobId);
    void navigate({ to: '/builds', search: { runId: undefined } });
  }

  async function handleRestart(from?: string) {
    if (!pipelineName) return;
    const { jobId: newJobId } = await runPipeline.mutateAsync({ name: pipelineName, from });
    void navigate({ to: '/builds/$jobId', params: { jobId: newJobId } });
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-border bg-card px-5 py-4">
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: '/builds', search: { runId: undefined } })}>
          <ArrowLeft size={14} />
          Back
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="page-title truncate text-[1.6rem] font-semibold leading-tight text-foreground">
              {buildTitle ?? 'Build'}
            </h1>
            <BranchBadge branch={gitInfo?.branch ?? null} isDirty={gitInfo?.isDirty} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Streaming output for job {jobId}.
          </p>
        </div>

        {displayStatus === 'running' ? (
          <Badge variant="default">
            <Loader2 size={11} className="animate-spin" />
            Running
          </Badge>
        ) : (
          <StatusBadge status={displayStatus} />
        )}

        <div className="pill-control rounded-full bg-secondary font-mono text-muted-foreground">
          <Clock3 size={11} />
          {formatDuration(done ? finalDurationMs : elapsedMs)}
        </div>

        {!done && (
          <Button variant="destructive" size="sm" onClick={() => void handleCancel()}>
            <Square size={12} />
            Cancel
          </Button>
        )}
      </div>

      {showStepTimeline && (
        <div className="rounded-[24px] border border-border bg-card px-5 py-4">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={14} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Pipeline steps</p>
          </div>
          <StepTimeline events={buildEvents} stepLabels={stepLabels} />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-[24px] border border-destructive/20 bg-card px-5 py-4 text-sm text-destructive">
          <XCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {done && runDoneEvent?.type === 'run:done' && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-3 rounded-[24px] border bg-card px-5 py-4',
            runStatus === 'success'
              ? 'border-success/20'
              : runStatus === 'launched'
                ? 'border-warning/20'
                : 'border-destructive/20',
          )}
        >
          {runStatus === 'success' ? (
            <CheckCircle2 size={16} className="text-success" />
          ) : runStatus === 'launched' ? (
            <ArrowUpRight size={16} className="text-warning" />
          ) : (
            <XCircle size={16} className="text-destructive" />
          )}

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-sm font-semibold',
                runStatus === 'success'
                  ? 'text-success'
                  : runStatus === 'launched'
                    ? 'text-warning'
                    : 'text-destructive',
              )}
            >
              {runStatus === 'success'
                ? 'Build completed successfully'
                : runStatus === 'launched'
                  ? 'Build handed off to an external terminal'
                  : 'Build failed'}
            </p>
            {runDoneEvent.result.stoppedAt != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Stopped at step {runDoneEvent.result.stoppedAt + 1}
                {stepLabels[runDoneEvent.result.stoppedAt] && ` · "${stepLabels[runDoneEvent.result.stoppedAt]}"`}
              </p>
            )}
          </div>

          <div className="pill-control rounded-full bg-secondary font-mono text-muted-foreground">
            {formatDuration(runDoneEvent.result.durationMs)}
          </div>

          {runDoneEvent.result.results.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-success">
                {runDoneEvent.result.results.filter((result) => result.status === 'success').length} passed
              </span>
              {runDoneEvent.result.results.some((result) => result.status === 'launched') && (
                <span className="text-warning">
                  {runDoneEvent.result.results.filter((result) => result.status === 'launched').length} launched
                </span>
              )}
              {runDoneEvent.result.results.some((result) => result.status === 'failed') && (
                <span className="text-destructive">
                  {runDoneEvent.result.results.filter((result) => result.status === 'failed').length} failed
                </span>
              )}
            </div>
          )}

          {runStatus === 'failed' && pipelineName && (
            <div className="flex items-center gap-2">
              {runDoneEvent.result.stoppedAt != null && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleRestart(String(runDoneEvent.result.stoppedAt! + 1))}
                  disabled={runPipeline.isPending}
                  title={`Restart from "${stepLabels[runDoneEvent.result.stoppedAt] ?? `Step ${runDoneEvent.result.stoppedAt + 1}`}"`}
                >
                  <RotateCcw size={12} />
                  Restart from failed step
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRestart()}
                disabled={runPipeline.isPending}
              >
                <Play size={12} />
                Restart from beginning
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <BuildOutput events={buildEvents} isRunning={!done} />
      </div>
    </div>
  );
}
