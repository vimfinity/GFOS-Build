import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import type { BuildStatus } from '../types/index.js';

const BASE_DIR = join(homedir(), '.gfos-build');
const HISTORY_FILE = join(BASE_DIR, 'jobs.json');

export interface PersistedJob {
  id: string;
  projectPath: string;
  name: string;
  status: BuildStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  jdkPath: string;
  mavenGoals: string[];
  command?: string;
  logFilePath?: string;
  exitCode?: number | null;
  error?: string;
  sequenceId?: string;
  sequenceIndex?: number;
  sequenceTotal?: number;
  progress: number;
}

export class JobHistoryService {
  constructor() {
    try {
      mkdirSync(BASE_DIR, { recursive: true });
    } catch {
      // ignore
    }
  }

  private static parseFileContent(text: string): PersistedJob[] {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed as PersistedJob[];
      }
    } catch {
      // ignore
    }
    return [];
  }

  getFilePath(): string {
    return HISTORY_FILE;
  }

  async load(): Promise<PersistedJob[]> {
    try {
      const text = await readFile(this.getFilePath(), 'utf-8');
      return JobHistoryService.parseFileContent(text);
    } catch {
      return [];
    }
  }

  private async saveAll(jobs: PersistedJob[]): Promise<void> {
    try {
      await writeFile(this.getFilePath(), JSON.stringify(jobs.slice(-100), null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  async append(job: PersistedJob): Promise<void> {
    try {
      const existing = await this.load();
      existing.push(job);
      await this.saveAll(existing);
    } catch {
      // ignore
    }
  }

  async clear(): Promise<void> {
    try {
      await writeFile(this.getFilePath(), '[]', 'utf-8');
    } catch {
      // ignore
    }
  }
}

let jobHistoryServiceInstance: JobHistoryService | null = null;

export function getJobHistoryService(): JobHistoryService {
  if (!jobHistoryServiceInstance) {
    jobHistoryServiceInstance = new JobHistoryService();
  }
  return jobHistoryServiceInstance;
}

export default JobHistoryService;
