import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { RunCommand, RunMode, RunReport } from '../core/types.js';

function getHistoryDir(): string {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ?? process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'GFOS-Build', 'runs');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches', 'gfos-build', 'runs');
  }

  const xdg = process.env.XDG_CACHE_HOME;
  return path.join(xdg ?? path.join(os.homedir(), '.cache'), 'gfos-build', 'runs');
}

export interface RunHistory {
  assignRunId(): string;
  write(report: RunReport): Promise<void>;
  findLatest(command: RunCommand, mode: RunMode, excludeRunId: string): Promise<RunReport | null>;
}

export class NodeRunHistory implements RunHistory {
  private readonly dir = getHistoryDir();

  assignRunId(): string {
    return randomUUID();
  }

  async write(report: RunReport): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const fileName = `${report.startedAt.replace(/[:.]/g, '-')}-${report.runId}.json`;
    await fs.writeFile(path.join(this.dir, fileName), JSON.stringify(report), 'utf-8');
  }

  async findLatest(command: RunCommand, mode: RunMode, excludeRunId: string): Promise<RunReport | null> {
    try {
      const entries = (await fs.readdir(this.dir)).filter(name => name.endsWith('.json')).sort().reverse();
      for (const entry of entries) {
        const content = await fs.readFile(path.join(this.dir, entry), 'utf-8');
        const parsed = JSON.parse(content) as RunReport;
        if (parsed.runId === excludeRunId) {
          continue;
        }
        if (parsed.command === command && parsed.mode === mode) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}
