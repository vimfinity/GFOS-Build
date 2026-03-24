import { app, BrowserWindow, dialog, ipcMain, type IpcMainEvent, type OpenDialogOptions } from 'electron';
import path from 'node:path';
import { IPC } from '@gfos-build/contracts';
import {
  AppRuntime,
  StateCompatibilityError,
  getDefaultStateRootDir,
  getSessionDataDir,
  resetLocalState,
} from '@gfos-build/platform-node';

const APP_NAME = 'GFOS Build';
const APP_USER_MODEL_ID = 'com.gfos.gfos-build';
const SMOKE_TEST_EXIT_DELAY_MS = 250;
const isSmokeTest = process.argv.includes('--smoke-test') || process.env['GFOS_BUILD_SMOKE_TEST'] === '1';
const stateRootDir = getDefaultStateRootDir();

let mainWindow: BrowserWindow | null = null;
let runtime: AppRuntime | null = null;
let fatalExitStarted = false;
const runSubscriptions = new Map<string, () => void>();

app.setName(APP_NAME);
app.setPath('userData', stateRootDir);
app.setPath('sessionData', getSessionDataDir(stateRootDir));

if (isSmokeTest) {
  app.disableHardwareAcceleration();
}
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

function formatFatalError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

function fatalExit(title: string, error: unknown): never {
  const message = formatFatalError(error);
  console.error(`${title}:`, error);

  if (fatalExitStarted) {
    process.exit(1);
  }
  fatalExitStarted = true;

  try {
    runtime?.close();
    runtime = null;
  } catch (closeError) {
    console.error('Failed to close runtime during fatal exit:', closeError);
  }

  if (app.isReady()) {
    if (!isSmokeTest) {
      dialog.showErrorBox(title, message);
    }
    app.exit(1);
  }

  process.exit(1);
}

async function handleInvalidLocalState(error: StateCompatibilityError): Promise<void> {
  const message = 'Local app state is invalid or incompatible with this version.';
  if (isSmokeTest) {
    throw error;
  }

  const choice = dialog.showMessageBoxSync({
    type: 'error',
    title: APP_NAME,
    message,
    detail: error.message,
    buttons: ['Reset local data', 'Exit'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });

  if (choice === 0) {
    resetLocalState(stateRootDir);
    app.relaunch();
  }

  app.exit(choice === 0 ? 0 : 1);
}

async function runSmokeTest(win: BrowserWindow): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, SMOKE_TEST_EXIT_DELAY_MS));

  const result = (await win.webContents.executeJavaScript(
    `(() => ({
      title: document.title,
      hash: window.location.hash,
      rootChildren: document.getElementById('root')?.childElementCount ?? 0,
      bodyText: document.body.innerText.slice(0, 200)
    }))()`,
    true,
  )) as {
    title: string;
    hash: string;
    rootChildren: number;
    bodyText: string;
  };

  if (result.title !== APP_NAME) {
    throw new Error(`Smoke test failed: expected title "${APP_NAME}" but received "${result.title}".`);
  }

  if (result.hash !== '#/') {
    throw new Error(`Smoke test failed: expected hash "#/" but received "${result.hash}".`);
  }

  if (result.rootChildren === 0) {
    throw new Error('Smoke test failed: renderer root is empty.');
  }

  if (/not found/i.test(result.bodyText)) {
    throw new Error(`Smoke test failed: renderer body contains "Not Found": ${result.bodyText}`);
  }

  app.exit(0);
}

function createWindow(): BrowserWindow {
  const windowIconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.ico')
    : path.resolve(__dirname, '../../../../assets/icon.ico');

  const win = new BrowserWindow({
    title: APP_NAME,
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#1d2f32',
    icon: windowIconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const senderId = win.webContents.id;

  mainWindow = win;

  win.once('ready-to-show', () => {
    if (!isSmokeTest && !win.isDestroyed()) {
      win.show();
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
    clearSubscriptionsForSender(senderId);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      fatalExit(
        'Failed to load desktop UI',
        new Error(`${errorDescription} (${errorCode}) while loading ${validatedURL}`),
      );
    }
  });

  win.webContents.once('did-finish-load', () => {
    if (isSmokeTest) {
      void runSmokeTest(win).catch((error) => {
        fatalExit('Desktop smoke test failed', error);
      });
    }
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    const rendererUrl = new URL('/#/', process.env['ELECTRON_RENDERER_URL']).toString();
    void win.loadURL(rendererUrl);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: '/' });
  }

  return win;
}

function getRuntime(): AppRuntime {
  if (!runtime) {
    throw new Error('Application runtime is not available.');
  }
  return runtime;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.GET_HEALTH, () => getRuntime().getHealth());
  ipcMain.handle(IPC.GET_CONFIG, () => getRuntime().getConfig());
  ipcMain.handle(IPC.SAVE_CONFIG, (_event, patch: Record<string, unknown>) => getRuntime().saveConfig(patch));
  ipcMain.handle(IPC.LIST_PIPELINES, () => getRuntime().listPipelines());
  ipcMain.handle(IPC.CREATE_PIPELINE, (_event, input: { name: string; pipeline: unknown }) => getRuntime().createPipeline(input));
  ipcMain.handle(IPC.UPDATE_PIPELINE, (_event, input: { name: string; pipeline: unknown }) => getRuntime().updatePipeline(input));
  ipcMain.handle(IPC.DELETE_PIPELINE, (_event, name: string) => getRuntime().deletePipeline(name));
  ipcMain.handle(IPC.RUN_PIPELINE, (_event, input: { name: string; from?: string }) => getRuntime().runPipeline(input));
  ipcMain.handle(IPC.LIST_DEPLOYMENT_WORKFLOWS, () => getRuntime().listDeploymentWorkflows());
  ipcMain.handle(IPC.CREATE_DEPLOYMENT_WORKFLOW, (_event, input: { name: string; workflow: unknown }) => getRuntime().createDeploymentWorkflow(input));
  ipcMain.handle(IPC.UPDATE_DEPLOYMENT_WORKFLOW, (_event, input: { name: string; workflow: unknown }) => getRuntime().updateDeploymentWorkflow(input));
  ipcMain.handle(IPC.DELETE_DEPLOYMENT_WORKFLOW, (_event, name: string) => getRuntime().deleteDeploymentWorkflow(name));
  ipcMain.handle(IPC.GET_DEPLOYMENT_WORKFLOW, (_event, name: string) => getRuntime().getDeploymentWorkflowDefinition(name));
  ipcMain.handle(IPC.RUN_DEPLOYMENT_WORKFLOW, (_event, input: { name: string }) => getRuntime().runDeploymentWorkflow(input));
  ipcMain.handle(IPC.RUN_QUICK, (_event, input: Record<string, unknown>) => getRuntime().runQuick(input));
  ipcMain.handle(IPC.CANCEL_JOB, (_event, jobId: string) => getRuntime().cancelJob(jobId));
  ipcMain.handle(IPC.LIST_RUNS, (_event, opts?: { pipeline?: string; limit?: number }) => getRuntime().listRuns(opts));
  ipcMain.handle(IPC.GET_RUN_LOGS, (_event, runId: number, opts?: { limit?: number; beforeSeq?: number }) => getRuntime().getRunLogs(runId, opts));
  ipcMain.handle(IPC.GET_STATS, () => getRuntime().getStats());
  ipcMain.handle(IPC.GET_SCAN, () => getRuntime().getScan());
  ipcMain.handle(IPC.REFRESH_SCAN, () => getRuntime().refreshScan());
  ipcMain.handle(IPC.INSPECT_PROJECT, (_event, projectPath: string) => getRuntime().inspectProject(projectPath));
  ipcMain.handle(IPC.INSPECT_DEPLOYMENT_PROJECT, (_event, projectPath: string) => getRuntime().inspectDeploymentProject(projectPath));
  ipcMain.handle(IPC.PREVIEW_DEPLOYMENT_PLAN, (_event, input: Record<string, unknown>) => getRuntime().previewDeploymentPlan(input));
  ipcMain.handle(IPC.DETECT_JDKS, (_event, baseDir: string) => getRuntime().detectJdks(baseDir));
  ipcMain.handle(IPC.CLEAR_RUN_LOGS, () => getRuntime().clearRunLogs());
  ipcMain.handle(IPC.CLEAR_RUNS, () => getRuntime().clearRuns());
  ipcMain.handle(IPC.GET_GIT_INFO, (_event, projectPath: string) => getRuntime().getGitInfo(projectPath));
  ipcMain.handle(IPC.GET_GIT_INFO_BATCH, (_event, paths: string[]) => getRuntime().getGitInfoBatch(paths));

  ipcMain.handle(IPC.OPEN_DIRECTORY, async () => {
    const ownerWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined;
    const options: OpenDialogOptions = {
      properties: ['openDirectory'],
      title: 'Select workspace root',
    };
    const result = ownerWindow ? await dialog.showOpenDialog(ownerWindow, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle(IPC.OPEN_FILE, async (_event, input?: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
    const ownerWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined;
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      title: input?.title ?? 'Select file',
      filters: input?.filters,
    };
    const result = ownerWindow ? await dialog.showOpenDialog(ownerWindow, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.on(IPC.RUN_SUBSCRIBE, (event: IpcMainEvent, jobId: string) => {
    clearSubscription(event.sender.id, jobId);
    const unsubscribe = getRuntime().subscribeRun(jobId, (payload) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC.RUN_EVENT, payload);
      }
    });
    runSubscriptions.set(makeSubscriptionKey(event.sender.id, jobId), unsubscribe);
  });

  ipcMain.on(IPC.RUN_UNSUBSCRIBE, (event: IpcMainEvent, jobId: string) => {
    clearSubscription(event.sender.id, jobId);
  });
}

function makeSubscriptionKey(senderId: number, jobId: string): string {
  return `${senderId}:${jobId}`;
}

function clearSubscription(senderId: number, jobId: string): void {
  const key = makeSubscriptionKey(senderId, jobId);
  const unsubscribe = runSubscriptions.get(key);
  if (unsubscribe) {
    unsubscribe();
    runSubscriptions.delete(key);
  }
}

function clearSubscriptionsForSender(senderId: number): void {
  for (const key of [...runSubscriptions.keys()]) {
    if (key.startsWith(`${senderId}:`)) {
      runSubscriptions.get(key)?.();
      runSubscriptions.delete(key);
    }
  }
}

process.on('uncaughtException', (error) => {
  fatalExit('A JavaScript error occurred in the main process', error);
});

process.on('unhandledRejection', (reason) => {
  fatalExit('An unhandled promise rejection occurred in the main process', reason);
});

app.whenReady().then(async () => {
  try {
    runtime = new AppRuntime({
      version: app.getVersion(),
      stateRootDir,
    });
  } catch (error) {
    if (error instanceof StateCompatibilityError) {
      await handleInvalidLocalState(error);
      return;
    }
    fatalExit('Failed to start desktop app', error);
  }

  registerIpcHandlers();
  createWindow();

  getRuntime().watchGitHeads(() => {
    if (mainWindow && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send(IPC.GIT_HEAD_CHANGED);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((error) => {
  fatalExit('Failed to start desktop app', error);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  runtime?.close();
  runtime = null;
});
