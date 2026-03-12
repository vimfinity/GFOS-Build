import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { IPC } from '@gfos-build/shared';
import { startServer, type ServerHandle } from './server';

let server: ServerHandle | null = null;

function createWindow(serverUrl: string): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1d2f32',
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
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  try {
    server = await startServer();
    createWindow(`http://localhost:${server.port}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    app.quit();
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
