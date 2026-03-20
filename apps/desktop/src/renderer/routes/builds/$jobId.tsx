import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCancelJob, useRunPipeline, buildsQuery, useBuildLogs, pipelinesQuery } from '@/api/queries';
import { useJobEvents } from '@/api/run-events';

import {
  BuildOutput,
  MavenAwareLine,
  getLineAccent,
  ACCENT_CLASSES,
} from '@/components/BuildOutput';
import { BranchBadge } from '@/components/BranchBadge';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { formatDuration, cn } from '@/lib/utils';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Square,
  XCircle,
  Loader2,
  Clock3,
  Activity,
  RotateCcw,
  Play,
  ArrowUpRight,
  CheckCircle,
  Circle,
  ChevronsDown,
  Copy,
  Check,
} from 'lucide-react';
import type { BuildEvent, BuildRunRowApi, BuildLogEntry } from '@gfos-build/contracts';

export const Route = createFileRoute('/builds/$jobId')({
  component: BuildDetailPage,
});

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function deriveDbStatus(steps: BuildRunRowApi[]): string {
  if (steps.length === 0) return 'running';
  if (steps.some((s) => s.status === 'running')) return 'running';
  if (steps.some((s) => s.status === 'failed')) return 'failed';
  if (steps.every((s) => s.status === 'success')) return 'success';
  if (steps.some((s) => s.status === 'launched')) return 'launched';
  return steps[steps.length - 1]?.status ?? 'running';
}

// ---------------------------------------------------------------------------
// Step pills (for completed pipeline timeline — DB-driven)
// ---------------------------------------------------------------------------

type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'launched';

const stepIcons: Record<StepStatus, React.ReactNode> = {
  pending:  <Circle size={15} className="text-muted-foreground" />,
  running:  <Loader2 size={15} className="text-warning animate-spin" />,
  success:  <CheckCircle size={15} className="text-success" />,
  failed:   <XCircle size={15} className="text-destructive" />,
  launched: <ArrowUpRight size={15} className="text-warning" />,
};

const stepPillColors: Record<StepStatus, string> = {
  pending:  'border-border bg-card/70 text-muted-foreground',
  running:  'border-primary/20 bg-primary/10 text-primary',
  success:  'border-success/20 bg-success/10 text-success',
  failed:   'border-destructive/20 bg-destructive/10 text-destructive',
  launched: 'border-warning/20 bg-warning/10 text-warning',
};

function DbStepTimeline({
  steps,
  selectedIndex,
  onSelect,
}: {
  steps: BuildRunRowApi[];
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {steps.map((step, i) => {
        const status: StepStatus =
          step.status === 'success' || step.status === 'failed' ||
          step.status === 'launched' || step.status === 'running'
            ? (step.status as StepStatus)
            : 'pending';
        const isSelected = selectedIndex === i;
        return (
          <div
            key={step.id}
            onClick={() => onSelect?.(i)}
            role={onSelect ? 'button' : undefined}
            className={cn(
              'pill-control border transition-all duration-200',
              stepPillColors[status],
              onSelect && 'cursor-pointer',
              isSelected && 'ring-2 ring-current ring-offset-1 ring-offset-background',
            )}
          >
            {stepIcons[status]}
            <span>{step.step_label ?? `Step ${i + 1}`}</span>
            {step.duration_ms != null && (
              <span className="ml-0.5 opacity-60">{formatDuration(step.duration_ms)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completed step card (one per pipeline step or the single quick-run step)
// ---------------------------------------------------------------------------

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('break-all text-foreground/75', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

function LogLine({ entry }: { entry: BuildLogEntry }) {
  const isStderr = entry.stream === 'stderr';
  const accent = getLineAccent(entry.line);
  const accentClass = accent ? ACCENT_CLASSES[accent] : isStderr ? ACCENT_CLASSES.error : '';

  return (
    <div className={cn('flex font-mono text-xs leading-5 whitespace-pre-wrap break-all', accentClass)}>
      <span className={cn('flex-1 px-3 py-px', isStderr ? 'text-destructive' : 'text-foreground/85')}>
        <MavenAwareLine line={entry.line.length > 0 ? entry.line : ' '} />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stored log viewer — same look/feel as BuildOutput but driven by useBuildLogs
// ---------------------------------------------------------------------------

const AT_BOTTOM_THRESHOLD = 32;

function isScrolledToBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_THRESHOLD;
}

function StoredLogViewer({
  stepId,
  onAtBottomChange,
  startAtBottom = true,
}: {
  stepId: number;
  /** Called when the scroll position reaches or leaves the bottom. */
  onAtBottomChange?: (atBottom: boolean) => void;
  /** When false the log starts at the top instead of the bottom (e.g. past step selected). */
  startAtBottom?: boolean;
}) {
  const {
    data: logsData,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useBuildLogs(stepId);
  const logs = logsData?.pages.flatMap((p) => p.entries) ?? [];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(startAtBottom);
  const [copied, setCopied] = useState(false);

  // Scroll to the right position once per step (mount or stepId change).
  // Without remounting (key={jobId}), the container stays alive across step
  // switches — we need to reset scroll explicitly when the step changes.
  const startAtBottomRef = useRef(startAtBottom);
  startAtBottomRef.current = startAtBottom;
  const scrolledForStepRef = useRef<number | null>(null);
  useEffect(() => {
    if (logs.length === 0) return;
    if (scrolledForStepRef.current === stepId) return;
    scrolledForStepRef.current = stepId;
    setCopied(false);
    const el = containerRef.current;
    if (!el) return;
    const shouldStartAtBottom = startAtBottomRef.current;
    if (shouldStartAtBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
    } else {
      el.scrollTo({ top: 0, behavior: 'auto' });
    }
    setAtBottom(shouldStartAtBottom);
    onAtBottomChange?.(shouldStartAtBottom);
  }, [stepId, logs.length, onAtBottomChange]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const bottom = isScrolledToBottom(el);
    setAtBottom(bottom);
    onAtBottomChange?.(bottom);
  }, [onAtBottomChange]);

  const scrollToBottom = useCallback(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  async function handleCopyAll() {
    const text = logs.map((l) => l.line).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={13} className="animate-spin" />
        Loading logs…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-destructive">
        <XCircle size={13} />
        Failed to load logs.
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground">No output stored for this step.</span>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Copy all */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={() => void handleCopyAll()}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all',
            'backdrop-blur-sm border',
            'focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
            copied
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border bg-secondary/70 text-muted-foreground hover:text-foreground',
          )}
        >
          {copied ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy all</>}
        </button>
      </div>

      {/* Load older logs */}
      {hasNextPage && (
        <div className="shrink-0 border-b border-border/60 px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage && <Loader2 size={11} className="animate-spin" />}
            Load older logs
          </Button>
        </div>
      )}

      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        <div className="h-2" aria-hidden="true" />
        {logs.map((entry, i) => <LogLine key={i} entry={entry} />)}
        <div className="h-2" aria-hidden="true" />
      </div>

      {!atBottom && (
        <button
          onClick={scrollToBottom}
          className={cn(
            'absolute bottom-3 right-3 flex items-center gap-1.5',
            'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            'shadow-lg border border-border bg-secondary/80 text-muted-foreground hover:text-foreground',
            'focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
          )}
        >
          <ChevronsDown size={12} />
          Scroll to bottom
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step detail panel — works for both running and completed steps.
// NOT remounted on step changes (key={jobId}) so the DOM stays alive and
// there is no visible flash between steps.  Internal state resets are
// handled by tracking the activeStepIndex.  Steps that were ever live
// during this component's lifetime keep using BuildOutput (avoids the
// BuildOutput→StoredLogViewer swap).  StoredLogViewer is only used for
// steps first viewed in already-completed state.
// ---------------------------------------------------------------------------

function StepDetail({
  step,
  index,
  total,
  liveEvents = [],
  isLiveRunning = false,
  onAtBottomChange,
  startAtBottom = true,
  scrollToBottomTrigger,
}: {
  step: BuildRunRowApi;
  index: number;
  total: number;
  liveEvents?: BuildEvent[];
  isLiveRunning?: boolean;
  /** Bubbled up to the parent so it can pause/resume auto-switch on scroll. */
  onAtBottomChange?: (atBottom: boolean) => void;
  /** When false the stored log starts at the top (past step explicitly selected). */
  startAtBottom?: boolean;
  scrollToBottomTrigger?: number;
}) {
  const isPipeline = total > 1;
  // Synthetic steps (id < 0) are pending pipeline steps not yet recorded in the DB.
  const isSynthetic = step.id < 0;

  // Track which step indices were ever live during this component's lifetime.
  // Once a step has been live we keep showing BuildOutput for it (even after
  // it finishes) so that switching back to it reuses the same component type
  // and React can update the DOM in-place (no unmount → mount flash).
  const everLiveSteps = useRef(new Set<number>());
  if (isLiveRunning) everLiveSteps.current.add(index);
  const showBuildOutput = isLiveRunning || everLiveSteps.current.has(index);

  return (
    <div className="glass-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-border">
      {/* Step header */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-5 py-4">
        {isPipeline && (
          <span className="pill-meta rounded-full bg-secondary text-muted-foreground">
            step {index + 1}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {step.step_label ?? step.project_name}
          </p>
          {step.project_path && (
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {step.project_path}
            </p>
          )}
        </div>
        {step.branch && <BranchBadge branch={step.branch} />}
        {step.duration_ms != null && (
          <div className="pill-control rounded-full bg-secondary font-mono text-muted-foreground">
            <Clock3 size={11} />
            {formatDuration(step.duration_ms)}
          </div>
        )}
        <StatusBadge status={step.status} />
      </div>

      {/* Metadata strip — always in DOM, collapses when synthetic and
           expands smoothly once the DB record arrives.  Only stable fields
           are shown (command + java_home) so the height never shifts
           mid-build.  Exit code is conveyed by the status badge; finished
           time = started + duration (both in the header). */}
      <div className={cn(
        'grid shrink-0 transition-[grid-template-rows] duration-200 ease-out',
        !isSynthetic ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}>
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-2 border-t border-border/60 bg-secondary/25 px-5 py-3">
            <DetailRow label="Command" value={step.command} mono />
            {step.java_home && <DetailRow label="JAVA_HOME" value={step.java_home} mono />}
          </div>
        </div>
      </div>

      {/* Log output */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-border/60">
        {isSynthetic && !isLiveRunning ? (
          <div className="flex h-full flex-1 items-center justify-center">
            <span className="font-mono text-sm text-muted-foreground">Waiting to start…</span>
          </div>
        ) : showBuildOutput ? (
          // Step was (or is) live — keep BuildOutput so React can update the
          // DOM in-place when switching steps (no unmount flash).
          <BuildOutput
            events={liveEvents}
            isRunning={isLiveRunning}
            embedded
            onAtBottomChange={onAtBottomChange}
            scrollToBottomTrigger={scrollToBottomTrigger}
            startAtBottom={startAtBottom}
            activeStepIndex={index}
          />
        ) : (
          // Completed step viewed from the completed-builds page (never live in this session).
          <StoredLogViewer
            stepId={step.id}
            onAtBottomChange={onAtBottomChange}
            startAtBottom={startAtBottom}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function BuildDetailPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Live events — always subscribe (no-op if job is not in memory)
  const { events, done, error, startMs, eventVersion } = useJobEvents(jobId);

  // DB data — always load (cached, instant on revisit)
  const allBuilds = useQuery(buildsQuery({ limit: 200 }));
  const allPipelines = useQuery(pipelinesQuery);

  // Mutations
  const cancelJob = useCancelJob();
  const runPipeline = useRunPipeline();

  // Elapsed timer for live view
  const [elapsedMs, setElapsedMs] = useState(() => Math.max(0, Date.now() - startMs));

  // Explicitly pinned step index, or null to auto-follow the current running step.
  const [pinnedStep, setPinnedStep] = useState<number | null>(null);
  // Real-time scroll position of the currently displayed step's log.
  // When at the bottom, auto-switch is active; when scrolled up, it pauses.
  const [atBottom, setAtBottom] = useState(true);
  // Increment to imperatively scroll the displayed log to the bottom.
  const [scrollToBottomTrigger, setScrollToBottomTrigger] = useState(0);
  // Stable ref for reading pinnedStep inside effects (avoids listing it as a dep).
  const pinnedStepRef = useRef<number | null>(null);
  pinnedStepRef.current = pinnedStep;
  // Last step shown in auto-follow mode — frozen when scrolled up so we don't jump.
  const lastAutoStepRef = useRef(0);

  // Filter build events from the live stream.
  // `events` is mutated in-place by the LRU cache (same reference, new items pushed in).
  // `eventVersion` is the real invalidation trigger; reading it here makes it a genuine dep.
  const buildEvents = useMemo(() => {
    void eventVersion;
    return events.filter(
      (e): e is BuildEvent =>
        'type' in e && (e.type.startsWith('step:') || e.type === 'run:done'),
    );
  }, [events, eventVersion]);

  // Map step index → its output events (step:output has no index field, so we infer
  // from position: all step:output events between step:start(N) and the next step:start belong to N)
  const stepOutputsMap = useMemo(() => {
    const byStep = new Map<number, BuildEvent[]>();
    let current = -1;
    for (const e of buildEvents) {
      if (e.type === 'step:start') {
        current = e.index;
        if (!byStep.has(current)) byStep.set(current, []);
      } else if (e.type === 'step:output' && current >= 0) {
        byStep.get(current)!.push(e);
      }
    }
    return byStep;
  }, [buildEvents]);

  // The last step that fired step:start (stays on it even after done, until next step starts).
  // Using "last started" rather than "currently running" avoids a brief null between steps
  // that would cause two key changes and a double-remount.
  const currentRunningStepIndex = useMemo(() => {
    let last: number | null = null;
    for (const e of buildEvents) {
      if (e.type === 'step:start') last = e.index;
    }
    return last;
  }, [buildEvents]);

  // Derive which step index to display:
  //   pinned       → always that step
  //   at bottom    → track currentRunningStepIndex (update ref so freeze has the latest)
  //   scrolled up  → freeze on lastAutoStepRef (don't switch while user is reading)
  const selectedStep = (() => {
    if (pinnedStep !== null) return pinnedStep;
    if (currentRunningStepIndex !== null && atBottom) {
      lastAutoStepRef.current = currentRunningStepIndex;
      return currentRunningStepIndex;
    }
    return lastAutoStepRef.current;
  })();

  // DB steps for this job, sorted by step_index
  const dbSteps = useMemo(
    () =>
      (allBuilds.data ?? [])
        .filter((b) => b.job_id === jobId || String(b.id) === jobId)
        .sort((a, b) => (a.step_index ?? 0) - (b.step_index ?? 0)),
    [allBuilds.data, jobId],
  );

  // Mode detection
  const hasLiveEvents = buildEvents.length > 0;
  const isRunningInDb = dbSteps.some((s) => s.status === 'running');
  const isCompletedInDb = dbSteps.length > 0 && !isRunningInDb;

  const viewMode =
    hasLiveEvents && !done ? 'live' :       // actively streaming
    isCompletedInDb        ? 'completed' :  // DB confirms done (covers recently-finished sessions too)
    hasLiveEvents          ? 'live' :       // done=true but DB refetch not yet settled
    isRunningInDb          ? 'live' :
    allBuilds.isLoading    ? 'loading' : 'not_found';

  // ── Live view derived data ───────────────────────────────────────────────
  const runDoneEvent = buildEvents.find((e) => e.type === 'run:done');
  const runStatus    = runDoneEvent?.type === 'run:done' ? runDoneEvent.result.status : null;
  const latestStepDone = [...buildEvents].reverse().find((e) => e.type === 'step:done');

  const liveDisplayStatus = !done
    ? 'running'
    : runStatus === 'success'
      ? 'success'
      : runStatus === 'launched'
        ? 'launched'
        : runStatus === 'failed' || error ||
          (latestStepDone?.type === 'step:done' && latestStepDone.status === 'failed')
          ? 'failed'
          : latestStepDone?.type === 'step:done' && latestStepDone.status === 'success'
            ? 'success'
            : latestStepDone?.type === 'step:done' && latestStepDone.status === 'launched'
              ? 'launched'
              : 'done';

  const livePipelineName = useMemo(() => {
    const e = buildEvents.find((ev) => ev.type === 'step:start');
    return e?.type === 'step:start' ? e.pipelineName : undefined;
  }, [buildEvents]);

  const stepLabels = useMemo(() => {
    const firstStart = buildEvents.find((e) => e.type === 'step:start');
    const total = firstStart?.total ?? 0;
    // Seed from pipeline definition so pending steps show their real label
    const pipelineDef = livePipelineName
      ? (allPipelines.data ?? []).find((p) => p.name === livePipelineName)
      : undefined;
    const labels = pipelineDef
      ? pipelineDef.steps.map((s) => s.label)
      : new Array<string>(total).fill('Step');
    // Override with event-derived labels as steps start (handles dynamic label overrides)
    for (const e of buildEvents) {
      if (e.type === 'step:start' && e.index < labels.length) labels[e.index] = e.step.label;
    }
    return labels;
  }, [buildEvents, livePipelineName, allPipelines.data]);

  const liveBuildTitle = useMemo(() => {
    if (livePipelineName) return livePipelineName;
    const first = buildEvents.find((e) => e.type === 'step:start');
    return first?.type === 'step:start' ? first.step.label : null;
  }, [livePipelineName, buildEvents]);

  const finalDurationMs =
    runDoneEvent?.type === 'run:done' ? runDoneEvent.result.durationMs : elapsedMs;
  const liveStoppedAt =
    runDoneEvent?.type === 'run:done' ? (runDoneEvent.result.stoppedAt ?? null) : null;

  // ── Completed view derived data ──────────────────────────────────────────
  const dbPipelineName = dbSteps[0]?.pipeline_name ?? null;
  const dbTitle        = dbPipelineName ?? dbSteps[0]?.project_name ?? 'Build';
  const dbStatus       = deriveDbStatus(dbSteps);
  const dbTotalMs      = dbSteps.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0);
  const dbStartedAt    = dbSteps[0]?.started_at;
  const dbStoppedAtIndex   = dbSteps.findIndex((s) => s.status === 'failed');
  const dbFinishedAt       = (() => {
    for (let i = dbSteps.length - 1; i >= 0; i--) {
      if (dbSteps[i]?.finished_at) return dbSteps[i]!.finished_at!;
    }
    return null;
  })();

  // ── Shared ────────────────────────────────────────────────────────────────
  const pipelineName   = viewMode === 'live' ? (livePipelineName ?? null) : dbPipelineName;
  const buildTitle     = viewMode === 'live' ? (liveBuildTitle ?? 'Build') : dbTitle;
  const overallStatus  = viewMode === 'live' ? liveDisplayStatus : dbStatus;
  const isLiveRunning  = viewMode === 'live' && !done;

  // ── Unified steps ─────────────────────────────────────────────────────────
  // For live mode: fill in synthetic pending placeholders for pipeline steps not yet started.
  // For completed mode: just use DB steps directly.
  const unifiedSteps = useMemo<BuildRunRowApi[]>(() => {
    if (viewMode !== 'live') return dbSteps;
    const total = Math.max(stepLabels.length, dbSteps.length);
    return Array.from({ length: total }, (_, i) => {
      if (i < dbSteps.length) return dbSteps[i]!;
      return {
        id: -(i + 1),
        job_id: jobId,
        step_index: i,
        step_label: stepLabels[i] ?? `Step ${i + 1}`,
        project_name: '',
        project_path: '',
        build_system: '',
        package_manager: null,
        execution_mode: null,
        status: 'pending',
        command: '',
        branch: null,
        started_at: '',
        finished_at: null,
        duration_ms: null,
        exit_code: null,
        java_home: null,
        pipeline_name: livePipelineName ?? null,
      } as BuildRunRowApi;
    });
  }, [viewMode, dbSteps, stepLabels, jobId, livePipelineName]);

  const showStepTimeline  = unifiedSteps.length > 1;
  const selectedUnifiedStep = unifiedSteps[selectedStep] ?? unifiedSteps[0];
  const selectedStepIdx   = selectedUnifiedStep?.step_index ?? selectedStep;
  // Output events for the selected step from the live stream
  const selectedStepLiveEvents = stepOutputsMap.get(selectedStepIdx) ?? [];
  // Is the selected step actively streaming? (started but not yet done, and build is live)
  // We do NOT gate on id > 0 here: during the brief window between step:start firing and
  // the DB refetch completing, the step may still be synthetic — we still want to stream.
  const isSelectedStepRunning =
    viewMode === 'live' && !done &&
    buildEvents.some((e) => e.type === 'step:start' && e.index === selectedStepIdx) &&
    !buildEvents.some((e) => e.type === 'step:done' && e.index === selectedStepIdx);

  function handleUnifiedStepSelect(index: number) {
    const runningIdx = currentRunningStepIndex;

    // Clicking the currently running step → unpin, resume auto-follow + scroll to bottom.
    if (runningIdx !== null && index === runningIdx) {
      setPinnedStep(null);
      setAtBottom(true);
      lastAutoStepRef.current = runningIdx;
      setScrollToBottomTrigger((v) => v + 1);
      return;
    }

    // Any other step: pin to it.
    // Past step in a live build → start at the top (user wants to read from the beginning).
    // Future step or step in a completed build → start at the bottom (most recent output).
    const isPast = runningIdx !== null && index < runningIdx;
    setPinnedStep(index);
    setAtBottom(!isPast); // false for past (start at top), true for future/completed
  }

  // Propagated from the displayed step's log — pauses/resumes auto-switch.
  const handleAtBottomChange = useCallback((bottom: boolean) => {
    setAtBottom(bottom);
  }, []);

  const headerBorderClass =
    overallStatus === 'failed'   ? 'border-destructive/20' :
    overallStatus === 'launched' ? 'border-warning/20' :
    'border-border';

  // ── Effects ───────────────────────────────────────────────────────────────

  // Reset per-build UI state when navigating to a different job (e.g. after "Run again").
  // TanStack Router reuses the component instance across same-route navigations, so state
  // must be reset manually when jobId changes.
  useEffect(() => {
    setPinnedStep(null);
    setAtBottom(true);
    setScrollToBottomTrigger(0);
    lastAutoStepRef.current = 0;
    // Immediately fetch fresh DB rows for the new job.
    void queryClient.invalidateQueries({ queryKey: ['builds'] });
  }, [jobId, queryClient]);

  // Re-fetch builds whenever a new step starts so the DB row for that step lands in
  // dbSteps quickly. Without this, allBuilds stays on its stale cache and all steps
  // appear as synthetic (pending) even while actively streaming.
  // Also: if the user had pinned to a future step that just started, unpin and auto-follow.
  useEffect(() => {
    if (currentRunningStepIndex === null) return;
    // Only invalidate the runs-list query, NOT the per-step log queries.
    // Invalidating ['builds'] broadly would also bust ['builds', stepId, 'logs'] queries
    // (which have staleTime:Infinity), forcing StoredLogViewer to refetch and causing a
    // visible update while the user is reading a past step.
    void queryClient.invalidateQueries({ queryKey: ['builds', { limit: 200 }] });
    if (pinnedStepRef.current === currentRunningStepIndex) {
      // The awaited future step just started → unpin and auto-follow.
      setPinnedStep(null);
      setAtBottom(true);
      lastAutoStepRef.current = currentRunningStepIndex;
      setScrollToBottomTrigger((v) => v + 1);
    }
  }, [currentRunningStepIndex, queryClient]);

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

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleCancel() {
    try {
      await cancelJob.mutateAsync(jobId);
    } catch {
      // error surfaced via cancelJob.isError / cancelJob.error
    }
  }

  async function handleRestart(from?: string) {
    if (!pipelineName) return;
    try {
      const { jobId: newJobId } = await runPipeline.mutateAsync({ name: pipelineName, from });
      void navigate({ to: '/builds/$jobId', params: { jobId: newJobId } });
    } catch {
      // error surfaced via runPipeline.isError / runPipeline.error
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (viewMode === 'loading') {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="glass-card flex items-center gap-3 rounded-[24px] border border-border px-5 py-4 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Loading build...
        </div>
      </div>
    );
  }

  // ── Not found state ───────────────────────────────────────────────────────
  if (viewMode === 'not_found') {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="glass-card flex flex-col items-center gap-4 rounded-[24px] border border-border px-8 py-16 text-center">
          <div className="icon-chip flex h-14 w-14 items-center justify-center rounded-full">
            <XCircle size={24} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Build not found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This build could not be found. It may have been cleared or may no longer exist.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void navigate({ to: '/builds', search: { runId: undefined } })}
          >
            <ArrowLeft size={14} />
            Back to builds
          </Button>
        </div>
      </div>
    );
  }

  // ── Header helpers ──────────────────────────────────────────────────────
  const headerTimestamp = (() => {
    if (viewMode === 'live') {
      const started = new Date(startMs).toLocaleString();
      if (!done) return `Started ${started}`;
      return `${started} – ${new Date(startMs + finalDurationMs).toLocaleTimeString()}`;
    }
    if (dbStartedAt) {
      const started = new Date(dbStartedAt).toLocaleString();
      if (!dbFinishedAt) return `Started ${started}`;
      return `${started} – ${new Date(dbFinishedAt).toLocaleTimeString()}`;
    }
    return `Job ${jobId}`;
  })();

  const headerDuration = viewMode === 'live'
    ? formatDuration(done ? finalDurationMs : elapsedMs)
    : formatDuration(dbTotalMs);

  const showRestartButtons =
    (viewMode === 'live' && done && pipelineName) ||
    (viewMode === 'completed' && pipelineName);

  const failedStepRestart = (() => {
    if (viewMode === 'live' && runStatus === 'failed' && liveStoppedAt != null) {
      return {
        arg: String(liveStoppedAt + 1),
        label: stepLabels[liveStoppedAt] ?? `Step ${liveStoppedAt + 1}`,
      };
    }
    if (viewMode === 'completed' && dbStatus === 'failed' && dbStoppedAtIndex >= 0) {
      return {
        arg: String(dbStoppedAtIndex + 1),
        label: dbSteps[dbStoppedAtIndex]?.step_label ?? `Step ${dbStoppedAtIndex + 1}`,
      };
    }
    return null;
  })();

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-5 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={cn(
        'glass-card rounded-[24px] border px-5 py-4',
        headerBorderClass,
      )}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => void navigate({ to: '/builds', search: { runId: undefined } })}
          >
            <ArrowLeft size={14} />
            Back
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold leading-tight text-foreground">
              {buildTitle}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {headerTimestamp}
            </p>
          </div>

          {/* Duration pill — tabular-nums keeps width stable while ticking */}
          <div className="pill-control shrink-0 rounded-full bg-secondary font-mono tabular-nums text-muted-foreground">
            <Clock3 size={11} />
            {headerDuration}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isLiveRunning ? (
              <Badge variant="default">
                <Loader2 size={11} className="animate-spin" />
                Running
              </Badge>
            ) : (
              <StatusBadge status={overallStatus} />
            )}

            {isLiveRunning && (
              <Button variant="destructive" size="sm" onClick={() => void handleCancel()}>
                <Square size={12} />
                Cancel
              </Button>
            )}

            {showRestartButtons && (
              <>
                {failedStepRestart && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRestart(failedStepRestart.arg)}
                    disabled={runPipeline.isPending}
                    title={`Restart from "${failedStepRestart.label}"`}
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
                  Run again
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Error messages ───────────────────────────────────────────────── */}
      {viewMode === 'live' && error && (
        <div className="glass-card flex items-center gap-3 rounded-[24px] border border-destructive/20 px-5 py-4 text-sm text-destructive">
          <XCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}
      {cancelJob.isError && (
        <div className="glass-card flex items-center gap-3 rounded-[24px] border border-destructive/20 px-5 py-4 text-sm text-destructive">
          <XCircle size={14} className="shrink-0" />
          Failed to cancel build.
        </div>
      )}
      {runPipeline.isError && (
        <div className="glass-card flex items-center gap-3 rounded-[24px] border border-destructive/20 px-5 py-4 text-sm text-destructive">
          <XCircle size={14} className="shrink-0" />
          Failed to start pipeline.
        </div>
      )}

      {/* ── Step timeline ─────────────────────────────────────────────────── */}
      {showStepTimeline && (
        <div className="glass-card shrink-0 rounded-[24px] border border-border px-5 py-4">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={14} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Pipeline steps</p>
          </div>
          <DbStepTimeline
            steps={unifiedSteps}
            selectedIndex={selectedStep}
            onSelect={handleUnifiedStepSelect}
          />
        </div>
      )}

      {/* ── Step detail ───────────────────────────────────────────────────── */}
      {selectedUnifiedStep != null && (
        <StepDetail
          key={jobId}
          step={selectedUnifiedStep}
          index={selectedStep}
          total={unifiedSteps.length}
          liveEvents={selectedStepLiveEvents}
          isLiveRunning={isSelectedStepRunning}
          onAtBottomChange={handleAtBottomChange}
          startAtBottom={atBottom}
          scrollToBottomTrigger={scrollToBottomTrigger}
        />
      )}
    </div>
  );
}
