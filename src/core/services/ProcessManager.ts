/**
 * ProcessManager
 * 
 * Manages spawned child processes (Maven builds) and ensures
 * graceful cleanup on application exit.
 */

import type { Subprocess } from 'bun';

// ============================================================================
// Types
// ============================================================================

interface ManagedProcess {
  id: string;
  process: Subprocess;
  command: string;
  startedAt: Date;
}

// ============================================================================
// ProcessManager Singleton
// ============================================================================

class ProcessManager {
  private processes: Map<string, ManagedProcess> = new Map();
  private isShuttingDown = false;
  
  constructor() {
    this.setupSignalHandlers();
  }
  
  /**
   * Register a spawned process for tracking.
   */
  register(id: string, process: Subprocess, command: string): void {
    this.processes.set(id, {
      id,
      process,
      command,
      startedAt: new Date(),
    });
  }
  
  /**
   * Unregister a process (when it completes naturally).
   */
  unregister(id: string): void {
    this.processes.delete(id);
  }
  
  /**
   * Get count of active processes.
   */
  getActiveCount(): number {
    return this.processes.size;
  }
  
  /**
   * Kill a specific process.
   */
  kill(id: string): boolean {
    const managed = this.processes.get(id);
    if (managed) {
      try {
        managed.process.kill();
        this.processes.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  
  /**
   * Kill all managed processes.
   */
  async killAll(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    const count = this.processes.size;
    if (count === 0) return;
    
    console.log(`\n[GFOS-Build] Terminating ${count} running process(es)...`);
    
    const killPromises: Promise<void>[] = [];
    
    for (const [id, managed] of this.processes) {
      killPromises.push(
        new Promise<void>((resolve) => {
          try {
            managed.process.kill('SIGTERM');
            
            // Give process 2 seconds to terminate gracefully
            const timeout = setTimeout(() => {
              try {
                managed.process.kill('SIGKILL');
              } catch {
                // Process already dead
              }
              resolve();
            }, 2000);
            
            // If process exits before timeout, clear it
            managed.process.exited.then(() => {
              clearTimeout(timeout);
              resolve();
            }).catch(() => {
              clearTimeout(timeout);
              resolve();
            });
          } catch {
            resolve();
          }
        })
      );
    }
    
    await Promise.all(killPromises);
    this.processes.clear();
    console.log('[GFOS-Build] All processes terminated.');
  }
  
  /**
   * Setup signal handlers for graceful shutdown.
   */
  private setupSignalHandlers(): void {
    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      await this.killAll();
      process.exit(0);
    });
    
    // Handle termination signal
    process.on('SIGTERM', async () => {
      await this.killAll();
      process.exit(0);
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('[GFOS-Build] Uncaught exception:', error);
      await this.killAll();
      process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason) => {
      console.error('[GFOS-Build] Unhandled rejection:', reason);
      await this.killAll();
      process.exit(1);
    });
    
    // Handle exit
    process.on('exit', () => {
      // Synchronous cleanup - can't await here
      for (const [, managed] of this.processes) {
        try {
          managed.process.kill('SIGKILL');
        } catch {
          // Best effort
        }
      }
    });
  }
  
  /**
   * Check if shutdown is in progress.
   */
  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const processManager = new ProcessManager();

export default processManager;
