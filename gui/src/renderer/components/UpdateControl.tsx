import type { UpdateState } from '@gfos-build/shared';
import { useUpdateState } from '@/api/update';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, formatDate } from '@/lib/utils';
import { AlertTriangle, ArrowUpCircle, CheckCircle2, Download, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

function getStatusCopy(state: UpdateState): {
  icon: ReactNode;
  tooltip: string;
  title: string;
  actionLabel: string | null;
} {
  switch (state.status) {
    case 'checking':
      return {
        icon: <Loader2 size={15} className="animate-spin" />,
        tooltip: 'Checking for updates',
        title: 'Checking for updates',
        actionLabel: null,
      };
    case 'available':
      return {
        icon: <ArrowUpCircle size={15} />,
        tooltip: `Update ${state.availableVersion ?? ''} available`,
        title: 'Update available',
        actionLabel: state.distribution === 'managed' ? 'Download update' : 'Download latest ZIP',
      };
    case 'downloading':
      return {
        icon: <Loader2 size={15} className="animate-spin" />,
        tooltip: `Downloading update${state.downloadPercent ? ` (${Math.round(state.downloadPercent)}%)` : ''}`,
        title: 'Downloading update',
        actionLabel: null,
      };
    case 'downloaded':
      return {
        icon: <CheckCircle2 size={15} />,
        tooltip: 'Update ready to apply',
        title: 'Update ready',
        actionLabel: 'Restart to update',
      };
    case 'apply_blocked_active_jobs':
      return {
        icon: <AlertTriangle size={15} />,
        tooltip: 'Update is ready, but active jobs must finish first',
        title: 'Update ready',
        actionLabel: 'Restart blocked while jobs run',
      };
    case 'error':
      return {
        icon: <AlertTriangle size={15} />,
        tooltip: state.error ?? 'Update error',
        title: 'Update error',
        actionLabel: 'Check again',
      };
    default:
      return {
        icon: <Download size={15} />,
        tooltip: 'Check for updates',
        title: 'Updates',
        actionLabel: 'Check now',
      };
  }
}

export function UpdateControl() {
  const [open, setOpen] = useState(false);
  const { state, busyAction, checkForUpdates, downloadUpdate, applyUpdate } = useUpdateState();
  const copy = useMemo(() => getStatusCopy(state), [state]);

  async function handlePrimaryAction() {
    if (state.status === 'available') {
      await downloadUpdate();
      return;
    }
    if (state.status === 'downloaded' || state.status === 'apply_blocked_active_jobs') {
      await applyUpdate();
      return;
    }
    await checkForUpdates();
  }

  const disablePrimary =
    busyAction !== null || state.status === 'checking' || state.status === 'downloading';

  return (
    <>
      <Tooltip content={copy.tooltip} side="bottom">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex h-9 items-center justify-center rounded-full px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
            (state.status === 'available' || state.status === 'downloaded' || state.status === 'apply_blocked_active_jobs') &&
              'text-primary',
            state.status === 'error' && 'text-destructive',
          )}
          aria-label={copy.tooltip}
        >
          {copy.icon}
        </button>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <div className="space-y-5">
            <div>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>
                {state.distribution === 'managed'
                  ? 'Managed installs can download and apply updates from GitHub Releases.'
                  : 'Portable builds stay manual. GFOS Build can still point you to the latest release ZIP.'}
              </DialogDescription>
            </div>

            <div className="rounded-[18px] border border-border bg-secondary/45 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground">Current version</span>
                <span className="text-muted-foreground">v{state.currentVersion}</span>
                <span className="text-muted-foreground/50">•</span>
                <span className="font-medium text-foreground capitalize">{state.distribution}</span>
                <span className="text-muted-foreground">channel {state.channel}</span>
              </div>
              {state.availableVersion ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Latest available: <span className="font-medium text-foreground">v{state.availableVersion}</span>
                </p>
              ) : null}
              {state.publishedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">Published {formatDate(state.publishedAt)}</p>
              ) : null}
              {state.downloadPercent != null && (state.status === 'downloading' || state.status === 'downloaded') ? (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${Math.max(3, Math.round(state.downloadPercent))}%` }}
                  />
                </div>
              ) : null}
            </div>

            {state.releaseName || state.releaseNotes ? (
              <div className="space-y-2">
                {state.releaseName ? (
                  <div className="text-sm font-medium text-foreground">{state.releaseName}</div>
                ) : null}
                {state.releaseNotes ? (
                  <pre className="max-h-52 overflow-auto rounded-[18px] border border-border bg-secondary/45 p-4 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {state.releaseNotes}
                  </pre>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {state.status === 'not_available'
                  ? 'No newer release is currently available.'
                  : 'Release details will appear here after an update check.'}
              </p>
            )}

            {state.status === 'apply_blocked_active_jobs' ? (
              <p className="text-sm text-warning">
                An update is already downloaded. Finish or stop active jobs before restarting to apply it.
              </p>
            ) : null}
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => void checkForUpdates()} disabled={busyAction !== null}>
                <RefreshCw size={14} className={cn(busyAction === 'check' && 'animate-spin')} />
                Check now
              </Button>
              {copy.actionLabel ? (
                <Button
                  onClick={() => void handlePrimaryAction()}
                  disabled={disablePrimary || state.status === 'apply_blocked_active_jobs'}
                >
                  {busyAction === 'download' || busyAction === 'apply' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ArrowUpCircle size={14} />
                  )}
                  {copy.actionLabel}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
