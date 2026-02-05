/**
 * IPC handler registration for main process.
 */

import { ipcMain, dialog, shell, app } from 'electron';
import { configService } from './services/config.service';
import { storageService } from './services/storage.service';
import { workspaceService } from './services/workspace.service';
import { buildService } from './services/build.service';
import { getMainWindow } from './window';
import type { AppSettings, BuildJob, Pipeline } from '../shared/types';

export function setupIpcHandlers(): void {
  // Config
  ipcMain.handle('config:load', () => configService.load());
  ipcMain.handle('config:save', (_event, config: AppSettings) =>
    configService.save(config)
  );

  // Jobs persistence
  ipcMain.handle('jobs:load', () => storageService.loadJobs());
  ipcMain.handle('jobs:save', (_event, jobs: BuildJob[]) =>
    storageService.saveJobs(jobs)
  );

  // Pipelines
  ipcMain.handle('pipelines:load', () => storageService.loadPipelines());
  ipcMain.handle('pipelines:save', (_event, pipelines: Pipeline[]) =>
    storageService.savePipelines(pipelines)
  );

  // Scanning
  ipcMain.handle('scan:projects', async (_event, rootPath: string) => {
    const window = getMainWindow();
    window?.webContents.send('scan:status', 'Scanning projects...');
    const projects = await workspaceService.scanProjects(rootPath);
    window?.webContents.send('scan:status', null);
    return projects;
  });

  ipcMain.handle('scan:jdks', async (_event, scanPaths: string) => {
    const window = getMainWindow();
    window?.webContents.send('scan:status', 'Scanning JDKs...');
    const jdks = await workspaceService.scanJDKs(scanPaths);
    window?.webContents.send('scan:status', null);
    return jdks;
  });

  ipcMain.handle('scan:modules', (_event, pomPath: string) =>
    workspaceService.scanModules(pomPath)
  );

  ipcMain.handle('scan:profiles', (_event, pomPath: string) =>
    workspaceService.scanProfiles(pomPath)
  );

  // Build execution
  ipcMain.handle('build:start', async (_event, job: BuildJob) => {
    const window = getMainWindow();
    if (window) {
      buildService.execute(job, window);
    }
    return true;
  });

  ipcMain.handle('build:cancel', (_event, jobId: string) =>
    buildService.cancel(jobId)
  );

  // File dialogs
  ipcMain.handle('dialog:selectFolder', async () => {
    const window = getMainWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Shell operations
  ipcMain.handle('shell:openPath', (_event, filePath: string) => {
    shell.openPath(filePath);
  });

  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    shell.openExternal(url);
  });

  // App info
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPath', (_event, name: string) =>
    app.getPath(name as Parameters<typeof app.getPath>[0])
  );
}
