let electron = require("electron");
//#region ../../packages/contracts/dist/ipc.js
var IPC = {
	GET_HEALTH: "gfos:get-health",
	GET_CONFIG: "gfos:get-config",
	SAVE_CONFIG: "gfos:save-config",
	LIST_PIPELINES: "gfos:list-pipelines",
	CREATE_PIPELINE: "gfos:create-pipeline",
	UPDATE_PIPELINE: "gfos:update-pipeline",
	DELETE_PIPELINE: "gfos:delete-pipeline",
	RUN_PIPELINE: "gfos:run-pipeline",
	RUN_QUICK: "gfos:run-quick",
	CANCEL_JOB: "gfos:cancel-job",
	LIST_RUNS: "gfos:list-runs",
	GET_RUN_LOGS: "gfos:get-run-logs",
	GET_STATS: "gfos:get-stats",
	GET_SCAN: "gfos:get-scan",
	REFRESH_SCAN: "gfos:refresh-scan",
	INSPECT_PROJECT: "gfos:inspect-project",
	DETECT_JDKS: "gfos:detect-jdks",
	CLEAR_RUN_LOGS: "gfos:clear-run-logs",
	CLEAR_RUNS: "gfos:clear-runs",
	OPEN_DIRECTORY: "gfos:open-directory",
	GET_GIT_INFO: "gfos:get-git-info",
	GET_GIT_INFO_BATCH: "gfos:get-git-info-batch",
	RUN_SUBSCRIBE: "gfos:run-subscribe",
	RUN_UNSUBSCRIBE: "gfos:run-unsubscribe",
	RUN_EVENT: "gfos:run-event",
	GIT_HEAD_CHANGED: "gfos:git-head-changed"
};
//#endregion
//#region src/preload/index.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	getHealth: () => electron.ipcRenderer.invoke(IPC.GET_HEALTH),
	getConfig: () => electron.ipcRenderer.invoke(IPC.GET_CONFIG),
	saveConfig: (patch) => electron.ipcRenderer.invoke(IPC.SAVE_CONFIG, patch),
	listPipelines: () => electron.ipcRenderer.invoke(IPC.LIST_PIPELINES),
	createPipeline: (input) => electron.ipcRenderer.invoke(IPC.CREATE_PIPELINE, input),
	updatePipeline: (input) => electron.ipcRenderer.invoke(IPC.UPDATE_PIPELINE, input),
	deletePipeline: (name) => electron.ipcRenderer.invoke(IPC.DELETE_PIPELINE, name),
	runPipeline: (input) => electron.ipcRenderer.invoke(IPC.RUN_PIPELINE, input),
	runQuick: (input) => electron.ipcRenderer.invoke(IPC.RUN_QUICK, input),
	cancelJob: (jobId) => electron.ipcRenderer.invoke(IPC.CANCEL_JOB, jobId),
	listRuns: (opts) => electron.ipcRenderer.invoke(IPC.LIST_RUNS, opts),
	getRunLogs: (runId, opts) => electron.ipcRenderer.invoke(IPC.GET_RUN_LOGS, runId, opts),
	getStats: () => electron.ipcRenderer.invoke(IPC.GET_STATS),
	getScan: () => electron.ipcRenderer.invoke(IPC.GET_SCAN),
	refreshScan: () => electron.ipcRenderer.invoke(IPC.REFRESH_SCAN),
	inspectProject: (projectPath) => electron.ipcRenderer.invoke(IPC.INSPECT_PROJECT, projectPath),
	detectJdks: (baseDir) => electron.ipcRenderer.invoke(IPC.DETECT_JDKS, baseDir),
	clearRunLogs: () => electron.ipcRenderer.invoke(IPC.CLEAR_RUN_LOGS),
	clearRuns: () => electron.ipcRenderer.invoke(IPC.CLEAR_RUNS),
	openDirectory: () => electron.ipcRenderer.invoke(IPC.OPEN_DIRECTORY),
	getGitInfo: (projectPath) => electron.ipcRenderer.invoke(IPC.GET_GIT_INFO, projectPath),
	getGitInfoBatch: (paths) => electron.ipcRenderer.invoke(IPC.GET_GIT_INFO_BATCH, paths),
	onRunEvent: (jobId, listener) => {
		const wrapped = (_event, payload) => {
			if (payload.jobId === jobId) listener(payload);
		};
		electron.ipcRenderer.on(IPC.RUN_EVENT, wrapped);
		electron.ipcRenderer.send(IPC.RUN_SUBSCRIBE, jobId);
		return () => {
			electron.ipcRenderer.send(IPC.RUN_UNSUBSCRIBE, jobId);
			electron.ipcRenderer.removeListener(IPC.RUN_EVENT, wrapped);
		};
	},
	onGitHeadChanged: (listener) => {
		const wrapped = () => listener();
		electron.ipcRenderer.on(IPC.GIT_HEAD_CHANGED, wrapped);
		return () => electron.ipcRenderer.removeListener(IPC.GIT_HEAD_CHANGED, wrapped);
	}
});
//#endregion
