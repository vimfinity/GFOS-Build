import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type ElectronBridge } from '@gfos-build/contracts';

const bridge: ElectronBridge = {
  getHealth: () => ipcRenderer.invoke(IPC.GET_HEALTH),
  getConfig: () => ipcRenderer.invoke(IPC.GET_CONFIG),
  saveConfig: (patch) => ipcRenderer.invoke(IPC.SAVE_CONFIG, patch),
  listPipelines: () => ipcRenderer.invoke(IPC.LIST_PIPELINES),
  createPipeline: (input) => ipcRenderer.invoke(IPC.CREATE_PIPELINE, input),
  updatePipeline: (input) => ipcRenderer.invoke(IPC.UPDATE_PIPELINE, input),
  deletePipeline: (name) => ipcRenderer.invoke(IPC.DELETE_PIPELINE, name),
  runPipeline: (input) => ipcRenderer.invoke(IPC.RUN_PIPELINE, input),
  runQuick: (input) => ipcRenderer.invoke(IPC.RUN_QUICK, input),
  cancelJob: (jobId) => ipcRenderer.invoke(IPC.CANCEL_JOB, jobId),
  listRuns: (opts) => ipcRenderer.invoke(IPC.LIST_RUNS, opts),
  getRunLogs: (runId, opts) => ipcRenderer.invoke(IPC.GET_RUN_LOGS, runId, opts),
  getStats: () => ipcRenderer.invoke(IPC.GET_STATS),
  getScan: () => ipcRenderer.invoke(IPC.GET_SCAN),
  refreshScan: () => ipcRenderer.invoke(IPC.REFRESH_SCAN),
  inspectProject: (projectPath) => ipcRenderer.invoke(IPC.INSPECT_PROJECT, projectPath),
  inspectDeploymentProject: (projectPath) => ipcRenderer.invoke(IPC.INSPECT_DEPLOYMENT_PROJECT, projectPath),
  previewDeploymentPlan: (input) => ipcRenderer.invoke(IPC.PREVIEW_DEPLOYMENT_PLAN, input),
  detectJdks: (baseDir) => ipcRenderer.invoke(IPC.DETECT_JDKS, baseDir),
  clearRunLogs: () => ipcRenderer.invoke(IPC.CLEAR_RUN_LOGS),
  clearRuns: () => ipcRenderer.invoke(IPC.CLEAR_RUNS),
  openDirectory: () => ipcRenderer.invoke(IPC.OPEN_DIRECTORY),
  openFile: (opts) => ipcRenderer.invoke(IPC.OPEN_FILE, opts),
  getGitInfo: (projectPath) => ipcRenderer.invoke(IPC.GET_GIT_INFO, projectPath),
  getGitInfoBatch: (paths) => ipcRenderer.invoke(IPC.GET_GIT_INFO_BATCH, paths),
  onRunEvent: (jobId, listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => {
      if (payload.jobId === jobId) {
        listener(payload);
      }
    };
    ipcRenderer.on(IPC.RUN_EVENT, wrapped);
    ipcRenderer.send(IPC.RUN_SUBSCRIBE, jobId);
    return () => {
      ipcRenderer.send(IPC.RUN_UNSUBSCRIBE, jobId);
      ipcRenderer.removeListener(IPC.RUN_EVENT, wrapped);
    };
  },
  onGitHeadChanged: (listener) => {
    const wrapped = () => listener();
    ipcRenderer.on(IPC.GIT_HEAD_CHANGED, wrapped);
    return () => ipcRenderer.removeListener(IPC.GIT_HEAD_CHANGED, wrapped);
  },
};

contextBridge.exposeInMainWorld('electronAPI', bridge);
