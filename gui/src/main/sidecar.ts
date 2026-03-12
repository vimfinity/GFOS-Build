import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { app } from 'electron';

export interface SidecarHandle {
  port: number;
  kill: () => void;
}

export async function spawnSidecar(): Promise<SidecarHandle> {
  // In packaged mode: spawn the self-contained Bun binary bundled in resources.
  // In dev mode: spawn bun directly with the compiled server bundle.
  //
  // We never use ELECTRON_RUN_AS_NODE because Electron's Node.js ABI differs
  // from the ABI that better-sqlite3 (a native addon) was compiled against.
  let spawnCmd: string;
  let spawnArgs: string[];

  if (app.isPackaged) {
    const binName = process.platform === 'win32' ? 'gfos-build.exe' : 'gfos-build';
    spawnCmd = path.join(process.resourcesPath, binName);
    spawnArgs = ['serve', '--port', '0'];
  } else {
    spawnCmd = 'bun';
    spawnArgs = [
      path.join(app.getAppPath(), '..', 'dist', 'server', 'index.mjs'),
      'serve',
      '--port',
      '0',
    ];
  }

  return new Promise((resolve, reject) => {
    let proc: ChildProcess;
    try {
      proc = spawn(spawnCmd, spawnArgs, {
        env: process.env,
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
