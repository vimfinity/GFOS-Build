import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { IPC } from '@gfos-build/shared';
import { startServer, type ServerHandle } from './server';

const APP_NAME = 'GFOS Build';
const APP_USER_MODEL_ID = 'com.gfos.gfos-build';

let server: ServerHandle | null = null;
let fatalExitStarted = false;

app.setName(APP_NAME);
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
    server?.close();
    server?.db.close();
  } catch (closeError) {
    console.error('Failed to close server during fatal exit:', closeError);
  }

  if (app.isReady()) {
    dialog.showErrorBox(title, message);
    app.exit(1);
  }

  process.exit(1);
}

function createWindow(serverUrl: string): void {
  const win = new BrowserWindow({
    title: APP_NAME,
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1d2f32',
    icon: path.join(__dirname, '../../../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // sandbox:false needed for ipcRenderer in preload
    },
  });

  ipcMain.handle(IPC.GET_SIDECAR_URL, () => serverUrl);

  ipcMain.handle(IPC.OPEN_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select workspace root',
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    const rendererUrl = new URL('/#/', process.env['ELECTRON_RENDERER_URL']).toString();
    void win.loadURL(rendererUrl);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: '/' });
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
    server = await startServer();
    createWindow(`http://localhost:${server.port}`);
  } catch (err) {
    fatalExit('Failed to start desktop app', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && server) {
      createWindow(`http://localhost:${server.port}`);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  server?.close();
  server?.db.close();
});
