import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getSidecarUrl: (): Promise<string> =>
    ipcRenderer.invoke('get-sidecar-url') as Promise<string>,
});

declare global {
  interface Window {
    electronAPI: {
      getSidecarUrl: () => Promise<string>;
    };
  }
}
