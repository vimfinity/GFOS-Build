import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import path from 'node:path';
import { IPC } from '@gfos-build/shared';
import { startServer, type ServerHandle } from './server';
import { createUpdaterService, type UpdaterService } from './updater';

const APP_NAME = 'GFOS Build';
const APP_USER_MODEL_ID = 'com.gfos.gfos-build';
const SMOKE_TEST_EXIT_DELAY_MS = 250;
const isSmokeTest = process.argv.includes('--smoke-test') || process.env['GFOS_BUILD_SMOKE_TEST'] === '1';

let server: ServerHandle | null = null;
let mainWindow: BrowserWindow | null = null;
let fatalExitStarted = false;
let updater: UpdaterService | null = null;

app.setName(APP_NAME);
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

function getServerUrl(): string {
  if (!server) {
    throw new Error('Desktop sidecar server is not running.');
  }
  return `http://localhost:${server.port}`;
}

function closeServer(): void {
  try {
    server?.close();
    server?.db.close();
  } finally {
    server = null;
  }
}

function fatalExit(title: string, error: unknown): never {
  const message = formatFatalError(error);
  console.error(`${title}:`, error);

  if (fatalExitStarted) {
    process.exit(1);
  }
  fatalExitStarted = true;

  try {
    closeServer();
  } catch (closeError) {
    console.error('Failed to close server during fatal exit:', closeError);
  }

  if (app.isReady()) {
    if (!isSmokeTest) {
      dialog.showErrorBox(title, message);
    }
    app.exit(1);
  }

  process.exit(1);
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
  const win = new BrowserWindow({
    title: APP_NAME,
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#1d2f32',
    icon: path.join(__dirname, '../../../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = win;

  win.once('ready-to-show', () => {
    if (!isSmokeTest) {
      win.show();
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
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

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.GET_SIDECAR_URL, () => getServerUrl());
  ipcMain.handle(IPC.GET_APP_INFO, () => updater?.getAppInfo());
  ipcMain.handle(IPC.GET_UPDATE_STATE, () => updater?.getState());
  ipcMain.handle(IPC.CHECK_FOR_UPDATES, () => updater?.checkForUpdates());
  ipcMain.handle(IPC.DOWNLOAD_UPDATE, () => updater?.downloadUpdate());
  ipcMain.handle(IPC.APPLY_UPDATE, () => updater?.applyUpdate());

  ipcMain.handle(IPC.OPEN_DIRECTORY, async () => {
    const ownerWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined;
    const options: OpenDialogOptions = {
      properties: ['openDirectory'],
      title: 'Select workspace root',
    };
    const result = ownerWindow ? await dialog.showOpenDialog(ownerWindow, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
}

process.on('uncaughtException', (error) => {
  fatalExit('A JavaScript error occurred in the main process', error);
});

process.on('unhandledRejection', (reason) => {
  fatalExit('An unhandled promise rejection occurred in the main process', reason);
});

app.whenReady().then(async () => {
  try {
    registerIpcHandlers();
    server = await startServer();
    updater = createUpdaterService({
      getActiveJobCount: () => server?.getActiveJobCount() ?? 0,
      sendState: (state) => {
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send(IPC.UPDATE_STATE_CHANGED, state);
        }
      },
    });
    createWindow();
    void updater.checkForUpdates().catch((error) => {
      console.error('Automatic update check failed:', error);
    });
  } catch (error) {
    fatalExit('Failed to start desktop app', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && server) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  updater?.dispose();
  updater = null;
  closeServer();
});
