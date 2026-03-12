import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type ElectronBridge } from '@gfos-build/shared';

const bridge: ElectronBridge = {
  getSidecarUrl: () => ipcRenderer.invoke(IPC.GET_SIDECAR_URL) as Promise<string>,
  openDirectory: () => ipcRenderer.invoke(IPC.OPEN_DIRECTORY) as Promise<string | null>,
};

contextBridge.exposeInMainWorld('electronAPI', bridge);
