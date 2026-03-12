import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { app } from 'electron';
import { SIDECAR_READY_PREFIX } from '@gfos-build/shared';

export interface SidecarHandle {
  port: number;
  kill: () => void;
}

export async function spawnSidecar(): Promise<SidecarHandle> {
  let spawnCmd: string;
  let spawnArgs: string[];
  let spawnEnv: NodeJS.ProcessEnv;

  if (app.isPackaged) {
    const binName = process.platform === 'win32' ? 'gfos-build.exe' : 'gfos-build';
    spawnCmd = path.join(process.resourcesPath, binName);
    spawnArgs = ['serve', '--port', '0'];
    spawnEnv = process.env;
  } else {
    // Dev: spawn bun directly so better-sqlite3 runs under the same runtime
    // that compiled it (Bun ABI), avoiding NODE_MODULE_VERSION mismatches.
    const serverEntry = path.join(app.getAppPath(), '..', 'src', 'cli', 'index.ts');
    spawnCmd = process.platform === 'win32' ? 'bun.exe' : 'bun';
    spawnArgs = ['run', serverEntry, 'serve', '--port', '0'];
    spawnEnv = process.env;
  }

  return new Promise((resolve, reject) => {
    let proc: ChildProcess;
    try {
      proc = spawn(spawnCmd, spawnArgs, {
        env: spawnEnv,
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
      const trimmed = line.trim();
      if (trimmed.startsWith(SIDECAR_READY_PREFIX)) {
        const port = parseInt(trimmed.slice(SIDECAR_READY_PREFIX.length), 10);
        clearTimeout(timeout);
        rl.close();
        resolve({ port, kill: () => proc.kill() });
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
