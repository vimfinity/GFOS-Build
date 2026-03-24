import { createFileRoute, useBlocker } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { configQuery, useSaveConfig } from '@/api/queries';
import {
  WildFlyEnvironmentManager,
  normalizeWildFlyEnvironments,
  validateWildFlyEnvironments,
} from '@/components/WildFlyEnvironmentManager';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';
import type { WildFlyEnvironmentConfig } from '@gfos-build/contracts';

export const Route = createFileRoute('/deployments/')({
  component: DeploymentsView,
});

function DeploymentsView() {
  const queryClient = useQueryClient();
  const { data: configData, isLoading } = useQuery(configQuery);
  const saveConfig = useSaveConfig();

  const [wildflyEnvironments, setWildflyEnvironments] = useState<Record<string, WildFlyEnvironmentConfig>>({});
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [showSavingIndicator, setShowSavingIndicator] = useState(false);
  const savingIndicatorTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!configData) return;
    const nextEnvironments = configData.config.wildfly.environments;
    setWildflyEnvironments(nextEnvironments);
    setSelectedName((current) => (current && nextEnvironments[current] ? current : Object.keys(nextEnvironments)[0] ?? null));
    setBaselineSnapshot(JSON.stringify(normalizeWildFlyEnvironments(nextEnvironments)));
  }, [configData]);

  const normalizedEnvironments = useMemo(
    () => normalizeWildFlyEnvironments(wildflyEnvironments),
    [wildflyEnvironments],
  );
  const currentSnapshot = useMemo(() => JSON.stringify(normalizedEnvironments), [normalizedEnvironments]);
  const isDirty = baselineSnapshot !== '' && currentSnapshot !== baselineSnapshot;
  const validationErrors = useMemo(() => validateWildFlyEnvironments(wildflyEnvironments), [wildflyEnvironments]);
  const leaveBlocker = useBlocker({
    shouldBlockFn: () => isDirty && saveState !== 'saving',
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  });

  useEffect(() => {
    if (savingIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(savingIndicatorTimeoutRef.current);
      savingIndicatorTimeoutRef.current = null;
    }

    if (saveState === 'saving') {
      setShowSavingIndicator(false);
      savingIndicatorTimeoutRef.current = window.setTimeout(() => {
        setShowSavingIndicator(true);
      }, 180);
      return () => {
        if (savingIndicatorTimeoutRef.current !== null) {
          window.clearTimeout(savingIndicatorTimeoutRef.current);
          savingIndicatorTimeoutRef.current = null;
        }
      };
    }

    setShowSavingIndicator(false);
    return undefined;
  }, [saveState]);

  async function handleSave() {
    if (!isDirty || !configData) return true;
    if (Object.keys(validationErrors).length > 0) {
      setShowValidationErrors(true);
      setSaveState('error');
      setSaveError('Fix the highlighted deployment settings before saving.');
      return false;
    }

    setSaveState('saving');
    setSaveError(null);

    try {
      await saveConfig.mutateAsync({
        ...configData.config,
        wildfly: {
          environments: normalizedEnvironments,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['config'] });
      setBaselineSnapshot(currentSnapshot);
      setShowValidationErrors(false);
      setSaveState('saved');
      return true;
    } catch (error) {
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message.replace(/^POST \/api\/config failed:\s*/, 'Save failed: ') : 'Save failed. Try again.');
      return false;
    }
  }

  const saveStatus =
    saveState === 'saving' && showSavingIndicator
      ? {
          tone: 'text-primary',
          icon: <Loader2 size={12} className="animate-spin" />,
          text: 'Applying changes...',
        }
      : saveState === 'error'
        ? {
            tone: 'text-destructive',
            icon: <AlertCircle size={12} />,
            text: saveError ?? 'Save failed. Try again.',
          }
        : saveState === 'saved' && !isDirty
          ? {
              tone: 'text-success',
              icon: <CheckCircle2 size={12} />,
              text: 'Changes applied',
            }
          : isDirty
            ? {
                tone: 'text-warning',
                icon: <div className="h-1.5 w-1.5 rounded-full bg-warning" />,
                text: 'Unsaved changes',
              }
            : null;

  if (isLoading) {
    return (
      <div className="glass-card mx-auto flex w-full max-w-5xl items-center gap-3 rounded-[24px] border border-border px-5 py-4 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        Loading deployment environments...
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-[1.6rem] font-semibold leading-tight text-foreground">Deployments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage WildFly environments, standalone profiles, cleanup presets, and startup presets.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Button variant="default" onClick={() => void handleSave()} disabled={saveState === 'saving' || !isDirty} className={cn('min-w-[10.75rem] justify-center disabled:opacity-100', !isDirty && saveState !== 'saving' ? 'bg-primary/16 text-primary shadow-none hover:bg-primary/16 active:bg-primary/16' : undefined)}>
            <Save size={14} />
            Save deployments
          </Button>
          <div className={cn('flex min-h-4 items-center gap-1.5 text-[11px] leading-none transition-all duration-200', saveStatus ? `${saveStatus.tone} opacity-100` : 'opacity-0')}>
            {saveStatus ? (
              <>
                {saveStatus.icon}
                <span>{saveStatus.text}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <Dialog
        open={leaveBlocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open && leaveBlocker.status === 'blocked') {
            leaveBlocker.reset();
          }
        }}
      >
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogTitle>Save changes before leaving?</DialogTitle>
          <DialogDescription>
            You have unsaved deployment changes. Save them before navigating away, or discard them and continue.
          </DialogDescription>

          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (leaveBlocker.status === 'blocked') leaveBlocker.reset();
              }}
              disabled={saveState === 'saving'}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (leaveBlocker.status === 'blocked') leaveBlocker.proceed();
              }}
              disabled={saveState === 'saving'}
            >
              Leave without saving
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                void (async () => {
                  const saved = await handleSave();
                  if (saved && leaveBlocker.status === 'blocked') {
                    leaveBlocker.proceed();
                  }
                })();
              }}
              disabled={saveState === 'saving'}
            >
              Save and leave
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <WildFlyEnvironmentManager
        value={wildflyEnvironments}
        errors={showValidationErrors ? validationErrors : {}}
        selectedName={selectedName}
        onSelectedNameChange={setSelectedName}
        onChange={setWildflyEnvironments}
      />
    </div>
  );
}
