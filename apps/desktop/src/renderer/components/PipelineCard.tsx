import { useState, useMemo } from 'react';
import { Play, CheckCircle2, XCircle, Loader2, Clock3, Pencil, Trash2, ArrowUpRight, ChevronRight, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BranchBadge } from '@/components/BranchBadge';
import { formatDuration, timeAgo, cn } from '@/lib/utils';
import type { GitInfoResponse, PipelineListItem } from '@gfos-build/contracts';

interface PipelineCardProps {
  pipeline: PipelineListItem;
  onRun: (name: string, from?: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  isRunning?: boolean;
  gitInfoMap?: Record<string, GitInfoResponse>;
}

/** Last path segment as the repo/project folder name */
function repoName(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
}

function LastRunIcon({ status }: { status: string }) {
  if (status === 'success') return <CheckCircle2 size={14} className="text-success shrink-0" />;
  if (status === 'failed') return <XCircle size={14} className="text-destructive shrink-0" />;
  if (status === 'launched') return <ArrowUpRight size={14} className="text-warning shrink-0" />;
  if (status === 'running') return <Loader2 size={14} className="text-primary animate-spin shrink-0" />;
  return <Clock3 size={14} className="text-muted-foreground shrink-0" />;
}

export function PipelineCard({ pipeline, onRun, onEdit, onDelete, isRunning, gitInfoMap }: PipelineCardProps) {
  const [expanded, setExpanded] = useState(false);

  const lastRunFailed = pipeline.lastRun?.status === 'failed';
  const resumeFrom = pipeline.lastRun?.stoppedAt;
  const canResume = lastRunFailed && resumeFrom != null;
  const resumeStepLabel = canResume ? (pipeline.steps[resumeFrom]?.label ?? `Step ${resumeFrom + 1}`) : null;

  const uniqueBranches = useMemo(() => {
    if (!gitInfoMap) return [];
    const seen = new Map<string, GitInfoResponse>();
    for (const step of pipeline.steps) {
      const info = gitInfoMap[step.path];
      if (info?.branch && !seen.has(info.branch)) seen.set(info.branch, info);
    }
    return [...seen.values()];
  }, [gitInfoMap, pipeline.steps]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex h-full flex-col gap-4 p-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-xl font-semibold text-foreground">{pipeline.name}</h3>
              <span className="pill-meta shrink-0 rounded-full bg-secondary text-muted-foreground">
                {pipeline.steps.length} step{pipeline.steps.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
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

        {/* Collapsible step section */}
        <div className="overflow-hidden rounded-2xl border border-border/70">

          {/* Toggle row */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]"
          >
            <ChevronRight
              size={12}
              className={cn(
                'shrink-0 text-muted-foreground transition-transform duration-200',
                expanded && 'rotate-90',
              )}
            />
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
              {pipeline.steps.length} step{pipeline.steps.length !== 1 ? 's' : ''}
            </span>

            {/* Branch summary — only visible when collapsed */}
            <div
              className={cn(
                'ml-auto flex min-w-0 flex-wrap justify-end gap-1 transition-opacity duration-150',
                expanded ? 'pointer-events-none opacity-0' : 'opacity-100',
              )}
            >
              {uniqueBranches.map((info) => (
                <BranchBadge key={info.branch} branch={info.branch ?? null} isDirty={info.isDirty} />
              ))}
            </div>
          </button>

          {/* Animated step list */}
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-200 ease-in-out',
              expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              {pipeline.steps.map((step, index) => {
                const gitInfo = gitInfoMap?.[step.path];
                const label = step.label || `Step ${index + 1}`;
                const repo = repoName(step.path);
                const showRepo = !!step.path && repo.toLowerCase() !== label.toLowerCase();
                const isExternal = step.buildSystem === 'node' && step.executionMode === 'external';

                return (
                  <button
                    key={index}
                    type="button"
                    disabled={isRunning}
                    onClick={() => !isRunning && onRun(pipeline.name, String(index + 1))}
                    title={`Run from "${label}"`}
                    className="group flex w-full items-center gap-3 border-t border-border/50 px-3.5 py-2 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)] disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                  >
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] text-muted-foreground/40">
                      {index + 1}
                    </span>
                    <ChevronRight
                      size={10}
                      className="shrink-0 text-muted-foreground/25 transition-colors group-hover:text-primary/40"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">
                        {label}
                        {isExternal && (
                          <span className="text-muted-foreground"> · external</span>
                        )}
                      </div>
                      {showRepo && (
                        <div className="truncate font-mono text-[11px] leading-tight text-muted-foreground/50">
                          {repo}
                        </div>
                      )}
                    </div>
                    <BranchBadge branch={gitInfo?.branch ?? null} isDirty={gitInfo?.isDirty} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Last run */}
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

        {/* Footer */}
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
