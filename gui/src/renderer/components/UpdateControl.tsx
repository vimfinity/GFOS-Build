import type { UpdateState } from '@gfos-build/shared';
import { useUpdateState } from '@/api/update';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowUpCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

function getStatusCopy(state: UpdateState): {
  visible: boolean;
  tooltip: string;
  label: string | null;
  iconOnly: boolean;
  variant: 'default' | 'outline' | 'destructive' | 'ghost';
  icon: 'available' | 'downloading' | 'downloaded' | 'blocked' | 'error';
  disabled?: boolean;
} {
  switch (state.status) {
    case 'available':
      return {
        visible: true,
        tooltip: state.releaseName ?? `GFOS Build v${state.availableVersion ?? state.currentVersion} is available`,
        label: 'Update available',
        iconOnly: false,
        variant: 'outline',
        icon: 'available',
      };
    case 'downloading':
      return {
        visible: true,
        tooltip: `Downloading update${state.downloadPercent ? ` (${Math.round(state.downloadPercent)}%)` : ''}`,
        label: null,
        iconOnly: true,
        variant: 'ghost',
        icon: 'downloading',
        disabled: true,
      };
    case 'downloaded':
      return {
        visible: true,
        tooltip: `Restart to install ${state.releaseName ?? `GFOS Build v${state.availableVersion ?? state.currentVersion}`}`,
        label: 'Restart',
        iconOnly: false,
        variant: 'outline',
        icon: 'downloaded',
      };
    case 'apply_blocked_active_jobs':
      return {
        visible: true,
        tooltip: 'Update is ready, but active jobs must finish first',
        label: 'Jobs running',
        iconOnly: false,
        variant: 'outline',
        icon: 'blocked',
        disabled: true,
      };
    case 'error':
      return {
        visible: true,
        tooltip: state.error ?? 'Update error',
        label: null,
        iconOnly: true,
        variant: 'destructive',
        icon: 'error',
      };
    default:
      return {
        visible: false,
        tooltip: '',
        label: null,
        iconOnly: true,
        variant: 'outline',
        icon: 'available',
      };
  }
}

export function UpdateControl() {
  const { state, busyAction, checkForUpdates, downloadUpdate, applyUpdate } = useUpdateState();
  const isPendingDownload = busyAction === 'download' && state.status === 'available';
  const displayState: UpdateState = isPendingDownload
    ? {
        ...state,
        status: 'downloading',
      }
    : state;
  const copy = getStatusCopy(displayState);

  async function handleControlClick() {
    if (state.status === 'available') {
      await downloadUpdate();
      return;
    }

    if (state.status === 'downloaded') {
      await applyUpdate();
      return;
    }

    if (state.status === 'error') {
      await checkForUpdates();
    }
  }

  if (!copy.visible) {
    return null;
  }

  const icon =
    copy.icon === 'available' ? (
      <ArrowUpCircle size={14} />
    ) : copy.icon === 'downloading' ? (
      <Loader2 size={14} className="animate-spin" />
    ) : copy.icon === 'downloaded' ? (
      <CheckCircle2 size={14} />
    ) : copy.icon === 'blocked' ? (
      <AlertTriangle size={14} />
    ) : (
      <RefreshCw size={14} />
    );

  const buttonClass = cn(
    'shrink-0 shadow-none',
    copy.iconOnly ? 'w-9 min-w-9 px-0' : 'px-3.5',
    copy.variant === 'outline' &&
      displayState.status === 'available' &&
      'border-primary/35 bg-primary/10 text-primary hover:bg-primary/16 active:bg-primary/20',
    copy.variant === 'outline' &&
      displayState.status === 'downloaded' &&
      'border-primary/35 bg-primary/10 text-primary hover:bg-primary/16 active:bg-primary/20',
    copy.variant === 'outline' &&
      displayState.status === 'apply_blocked_active_jobs' &&
      'border-warning/30 bg-warning/10 text-warning hover:bg-warning/12 active:bg-warning/16',
    copy.variant === 'ghost' && 'text-muted-foreground hover:bg-accent hover:text-foreground',
  );

  return (
    <Tooltip content={copy.tooltip} side="bottom">
      <Button
        type="button"
        variant={copy.variant}
        size="sm"
        onClick={() => void handleControlClick()}
        className={buttonClass}
        disabled={copy.disabled || busyAction !== null}
        aria-label={copy.tooltip}
      >
        {icon}
        {copy.label ? <span>{copy.label}</span> : null}
      </Button>
    </Tooltip>
  );
}
