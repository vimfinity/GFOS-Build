import { useEffect, useState } from 'react';
import type { UpdateState } from '@gfos-build/shared';
import {
  applyUpdate,
  checkForUpdates,
  downloadUpdate,
  getUpdateState,
  subscribeToUpdateState,
} from './bridge';

const FALLBACK_STATE: UpdateState = {
  status: 'idle',
  currentVersion: 'dev',
  distribution: 'portable',
  channel: 'alpha',
};

export function useUpdateState() {
  const [state, setState] = useState<UpdateState>(FALLBACK_STATE);
  const [busyAction, setBusyAction] = useState<'check' | 'download' | 'apply' | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getUpdateState().then((next) => {
      if (!cancelled) setState(next);
    });

    const unsubscribe = subscribeToUpdateState((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function runAction(action: 'check' | 'download' | 'apply') {
    setBusyAction(action);
    try {
      const next =
        action === 'check'
          ? await checkForUpdates()
          : action === 'download'
            ? await downloadUpdate()
            : await applyUpdate();
      setState(next);
      return next;
    } finally {
      setBusyAction(null);
    }
  }

  return {
    state,
    busyAction,
    checkForUpdates: () => runAction('check'),
    downloadUpdate: () => runAction('download'),
    applyUpdate: () => runAction('apply'),
  };
}
