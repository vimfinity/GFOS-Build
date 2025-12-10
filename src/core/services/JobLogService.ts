import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { appendFile, readFile, writeFile } from 'fs/promises';

const BASE_DIR = join(homedir(), '.gfos-build');
const LOG_DIR = join(BASE_DIR, 'logs');

/**
 * Responsible for managing persistent log files for build jobs.
 */
export class JobLogService {
  constructor() {
    try {
      mkdirSync(LOG_DIR, { recursive: true });
    } catch {
      // ignore
    }
  }

  /** Returns the absolute log file path for a job. */
  getLogPath(jobId: string): string {
    return join(LOG_DIR, `${jobId}.log`);
  }

  /** Resets the log file for a job. */
  async reset(jobId: string): Promise<void> {
    const path = this.getLogPath(jobId);
    try {
      await writeFile(path, '', 'utf-8');
    } catch {
      // Ignore write errors
    }
  }

  /** Appends a single log line to the job's log file. */
  async append(jobId: string, line: string): Promise<void> {
    const path = this.getLogPath(jobId);
    try {
      await appendFile(path, `${line}\n`, 'utf-8');
    } catch {
      // Ignore append errors to avoid breaking the build stream
    }
  }

  /** Overwrite the job log file with a full set of lines. */
  async write(jobId: string, lines: string[]): Promise<void> {
    const path = this.getLogPath(jobId);
    try {
      const payload = lines.join('\n') + (lines.length > 0 ? '\n' : '');
      await writeFile(path, payload, 'utf-8');
    } catch {
      // Ignore write errors
    }
  }

  /** Reads the entire log file for a job. */
  async read(jobId: string): Promise<string[]> {
    const path = this.getLogPath(jobId);
    try {
      const text = await readFile(path, 'utf-8');
      const lines = text.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      return lines;
    } catch {
      return [];
    }
  }
}

let jobLogServiceInstance: JobLogService | null = null;

export function getJobLogService(): JobLogService {
  if (!jobLogServiceInstance) {
    jobLogServiceInstance = new JobLogService();
  }
  return jobLogServiceInstance;
}

export default JobLogService;
