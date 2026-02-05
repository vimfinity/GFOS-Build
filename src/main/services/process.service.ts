/**
 * ProcessService - Child process lifecycle management.
 */

import { ChildProcess } from 'child_process';

interface ManagedProcess {
  id: string;
  process: ChildProcess;
  startedAt: Date;
}

class ProcessService {
  private processes = new Map<string, ManagedProcess>();

  register(id: string, childProcess: ChildProcess): void {
    this.processes.set(id, {
      id,
      process: childProcess,
      startedAt: new Date(),
    });
  }

  unregister(id: string): void {
    this.processes.delete(id);
  }

  kill(id: string): boolean {
    const managed = this.processes.get(id);
    if (managed) {
      managed.process.kill('SIGTERM');
      this.processes.delete(id);
      return true;
    }
    return false;
  }

  killAll(): void {
    for (const [, managed] of this.processes) {
      try {
        managed.process.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }
    }
    this.processes.clear();
  }

  get activeCount(): number {
    return this.processes.size;
  }
}

export const processService = new ProcessService();
