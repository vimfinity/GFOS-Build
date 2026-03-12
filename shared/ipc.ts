// IPC channel names used by both the Electron main process and the preload script.
// Defining them here prevents typos and keeps the contract in one place.

export const IPC = {
  GET_SIDECAR_URL: 'get-sidecar-url',
  OPEN_DIRECTORY: 'open-directory',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

// The interface exposed to the renderer via contextBridge.
// Used by preload/index.ts (implementation) and renderer/env.d.ts (Window type).
export interface ElectronBridge {
  getSidecarUrl: () => Promise<string>;
  openDirectory: () => Promise<string | null>;
}
