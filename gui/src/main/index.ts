import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { spawnSidecar, type SidecarHandle } from './sidecar';

let sidecar: SidecarHandle | null = null;

function createWindow(sidecarUrl: string): void {
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

  ipcMain.handle('get-sidecar-url', () => sidecarUrl);

  ipcMain.handle('open-directory', async () => {
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
    sidecar = await spawnSidecar();
    createWindow(`http://localhost:${sidecar.port}`);
  } catch (err) {
    console.error('Failed to start sidecar:', err);
    // In dev, create window anyway so we can see error
    if (process.env['NODE_ENV'] === 'development') {
      createWindow('http://localhost:3847');
    } else {
      app.quit();
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && sidecar) {
      createWindow(`http://localhost:${sidecar.port}`);
    }
  });
});

app.on('window-all-closed', () => {
  sidecar?.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => sidecar?.kill());
