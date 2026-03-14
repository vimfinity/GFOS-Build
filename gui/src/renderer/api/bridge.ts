import type { AppInfo, UpdateState } from '@gfos-build/shared';

// Central point for accessing Electron bridge APIs in the renderer.
// Components import from here instead of touching window.electronAPI directly.

export async function pickDirectory(): Promise<string | null> {
  return window.electronAPI?.openDirectory() ?? null;
}

export async function getAppInfo(): Promise<AppInfo> {
  if (!window.electronAPI) {
    return { version: 'dev', distribution: 'portable', channel: 'alpha' };
  }
  return window.electronAPI.getAppInfo();
}

export async function getUpdateState(): Promise<UpdateState> {
  if (!window.electronAPI) {
    return {
      status: 'idle',
      currentVersion: 'dev',
      distribution: 'portable',
      channel: 'alpha',
    };
  }
  return window.electronAPI.getUpdateState();
}

export async function checkForUpdates(): Promise<UpdateState> {
  return window.electronAPI?.checkForUpdates() ?? getUpdateState();
}

export async function downloadUpdate(): Promise<UpdateState> {
  return window.electronAPI?.downloadUpdate() ?? getUpdateState();
}

export async function applyUpdate(): Promise<UpdateState> {
  return window.electronAPI?.applyUpdate() ?? getUpdateState();
}

export function subscribeToUpdateState(listener: (state: UpdateState) => void): () => void {
  return window.electronAPI?.onUpdateStateChanged(listener) ?? (() => undefined);
}
