/**
 * StorageService - Generic JSON persistence for jobs and pipelines.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { JOBS_FILE, PIPELINES_FILE } from '../../shared/constants';
import type { BuildJob, Pipeline } from '../../shared/types';

class StorageService {
  private getFilePath(filename: string): string {
    return path.join(app.getPath('userData'), filename);
  }

  async loadJobs(): Promise<BuildJob[]> {
    try {
      const filePath = this.getFilePath(JOBS_FILE);
      if (await fs.pathExists(filePath)) {
        const data = await fs.readJson(filePath);
        return data.map((job: Record<string, unknown>) => ({
          ...job,
          createdAt: new Date(job.createdAt as string),
          startedAt: job.startedAt
            ? new Date(job.startedAt as string)
            : undefined,
          completedAt: job.completedAt
            ? new Date(job.completedAt as string)
            : undefined,
        }));
      }
    } catch (error) {
      console.error('[StorageService] Failed to load jobs:', error);
    }
    return [];
  }

  async saveJobs(jobs: BuildJob[]): Promise<void> {
    const filePath = this.getFilePath(JOBS_FILE);
    const jobsToSave = jobs.filter(
      (j) => j.status !== 'running' && j.status !== 'pending'
    );
    await fs.writeJson(filePath, jobsToSave, { spaces: 2 });
  }

  async loadPipelines(): Promise<Pipeline[]> {
    try {
      const filePath = this.getFilePath(PIPELINES_FILE);
      if (await fs.pathExists(filePath)) {
        const data = await fs.readJson(filePath);
        return data.map((p: Record<string, unknown>) => ({
          ...p,
          createdAt: new Date(p.createdAt as string),
          lastRun: p.lastRun ? new Date(p.lastRun as string) : undefined,
        }));
      }
    } catch (error) {
      console.error('[StorageService] Failed to load pipelines:', error);
    }
    return [];
  }

  async savePipelines(pipelines: Pipeline[]): Promise<void> {
    const filePath = this.getFilePath(PIPELINES_FILE);
    await fs.writeJson(filePath, pipelines, { spaces: 2 });
  }
}

export const storageService = new StorageService();
