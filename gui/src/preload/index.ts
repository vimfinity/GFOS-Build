import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type ElectronBridge } from '@gfos-build/shared';

const bridge: ElectronBridge = {
  getSidecarUrl: () => ipcRenderer.invoke(IPC.GET_SIDECAR_URL) as Promise<string>,
  openDirectory: () => ipcRenderer.invoke(IPC.OPEN_DIRECTORY) as Promise<string | null>,
  getAppInfo: () => ipcRenderer.invoke(IPC.GET_APP_INFO),
  getUpdateState: () => ipcRenderer.invoke(IPC.GET_UPDATE_STATE),
  checkForUpdates: () => ipcRenderer.invoke(IPC.CHECK_FOR_UPDATES),
  downloadUpdate: () => ipcRenderer.invoke(IPC.DOWNLOAD_UPDATE),
  applyUpdate: () => ipcRenderer.invoke(IPC.APPLY_UPDATE),
  onUpdateStateChanged: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: Awaited<ReturnType<ElectronBridge['getUpdateState']>>) => {
      listener(state);
    };
    ipcRenderer.on(IPC.UPDATE_STATE_CHANGED, wrapped);
    return () => ipcRenderer.removeListener(IPC.UPDATE_STATE_CHANGED, wrapped);
  },
};

contextBridge.exposeInMainWorld('electronAPI', bridge);
