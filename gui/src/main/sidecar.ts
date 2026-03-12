import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { app } from 'electron';

export interface SidecarHandle {
  port: number;
  kill: () => void;
}

export async function spawnSidecar(): Promise<SidecarHandle> {
  // In packaged mode the compiled server bundle lives in resources/server/.
  // In dev mode it lives at the repo root dist/server/.
  const serverScript = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'index.mjs')
    : path.join(app.getAppPath(), '..', 'dist', 'server', 'index.mjs');

  return new Promise((resolve, reject) => {
    let proc: ChildProcess;
    try {
      // ELECTRON_RUN_AS_NODE makes the Electron binary behave as plain Node.js.
      // No separate Bun runtime needed in the distribution.
      proc = spawn(process.execPath, [serverScript, 'serve', '--port', '0'], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (err) {
      reject(new Error(`Failed to spawn sidecar: ${String(err)}`));
      return;
    }

    const rl = readline.createInterface({ input: proc.stdout! });
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error('Sidecar startup timeout (15s)'));
    }, 15_000);

    rl.on('line', (line) => {
      const match = /^READY:(\d+)$/.exec(line.trim());
      if (match) {
        clearTimeout(timeout);
        rl.close();
        resolve({ port: parseInt(match[1]!, 10), kill: () => proc.kill() });
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[sidecar] ${data.toString()}`);
    });

    proc.on('error', (err) => { clearTimeout(timeout); reject(err); });
    proc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout);
        reject(new Error(`Sidecar exited early with code ${code}`));
      }
    });
  });
}
