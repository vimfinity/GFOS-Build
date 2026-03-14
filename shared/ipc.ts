// IPC channel names used by both the Electron main process and the preload script.
// Defining them here prevents typos and keeps the contract in one place.

export const IPC = {
  GET_SIDECAR_URL: 'get-sidecar-url',
  OPEN_DIRECTORY: 'open-directory',
  GET_APP_INFO: 'get-app-info',
  GET_UPDATE_STATE: 'get-update-state',
  CHECK_FOR_UPDATES: 'check-for-updates',
  DOWNLOAD_UPDATE: 'download-update',
  APPLY_UPDATE: 'apply-update',
  UPDATE_STATE_CHANGED: 'update-state-changed',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

// The interface exposed to the renderer via contextBridge.
// Used by preload/index.ts (implementation) and renderer/env.d.ts (Window type).
export interface ElectronBridge {
  getSidecarUrl: () => Promise<string>;
  openDirectory: () => Promise<string | null>;
  getAppInfo: () => Promise<import('./update.js').AppInfo>;
  getUpdateState: () => Promise<import('./update.js').UpdateState>;
  checkForUpdates: () => Promise<import('./update.js').UpdateState>;
  downloadUpdate: () => Promise<import('./update.js').UpdateState>;
  applyUpdate: () => Promise<import('./update.js').UpdateState>;
  onUpdateStateChanged: (
    listener: (state: import('./update.js').UpdateState) => void,
  ) => () => void;
}
