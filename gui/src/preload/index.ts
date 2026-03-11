import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getSidecarUrl: (): Promise<string> =>
    ipcRenderer.invoke('get-sidecar-url') as Promise<string>,
  openDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('open-directory') as Promise<string | null>,
});

declare global {
  interface Window {
    electronAPI: {
      getSidecarUrl: () => Promise<string>;
      openDirectory: () => Promise<string | null>;
    };
  }
}
