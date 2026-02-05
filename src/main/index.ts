/**
 * Electron Main Process Entry Point
 */

import { app, BrowserWindow } from 'electron';
import { createWindow } from './window';
import { setupIpcHandlers } from './ipc';
import { processService } from './services/process.service';

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  processService.killAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  processService.killAll();
});
