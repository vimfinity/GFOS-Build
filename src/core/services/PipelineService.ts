import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import type { SelectedModuleData } from '../types/index.js';

const BASE_DIR = join(homedir(), '.gfos-build');
const FILE_PATH = join(BASE_DIR, 'pipelines.json');
const MAX_ENTRIES = 100;

export interface PipelineStepOptions {
  goals: string[];
  profiles: string[];
  skipTests: boolean;
  offline: boolean;
  batchMode: boolean;
  threads: string;
  updateSnapshots: boolean;
  alsoMake: boolean;
  alsoMakeDependents: boolean;
  showErrors: boolean;
  customArgs: string;
  sequential: boolean;
}

export interface PipelineStep {
  id: string;
  projectPath: string;
  projectName: string;
  jdkPath: string;
  jdkVersion: string;
  selectedModules: SelectedModuleData[];
  options: PipelineStepOptions;
}

export interface PipelineDefinition {
  id: string;
  name: string;
  createdAt: string;
  steps: PipelineStep[];
}

/**
 * Manages pipeline persistence on disk.
 */
export class PipelineService {
  constructor() {
    try {
      mkdirSync(BASE_DIR, { recursive: true });
    } catch {
      // ignore
    }
  }

  async loadAll(): Promise<PipelineDefinition[]> {
    try {
      const text = await readFile(FILE_PATH, 'utf-8');
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed as PipelineDefinition[];
      }
    } catch {
      // ignore
    }
    return [];
  }

  private async saveAll(pipelines: PipelineDefinition[]): Promise<void> {
    try {
      const trimmed = pipelines.slice(0, MAX_ENTRIES);
      await writeFile(FILE_PATH, JSON.stringify(trimmed, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  async save(pipeline: PipelineDefinition): Promise<void> {
    const existing = await this.loadAll();
    const filtered = existing.filter((item) => item.id !== pipeline.id);
    const next = [pipeline, ...filtered];
    await this.saveAll(next);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.loadAll();
    const filtered = existing.filter((item) => item.id !== id);
    await this.saveAll(filtered);
  }
}

let pipelineServiceInstance: PipelineService | null = null;

export function getPipelineService(): PipelineService {
  if (!pipelineServiceInstance) {
    pipelineServiceInstance = new PipelineService();
  }
  return pipelineServiceInstance;
}

export default PipelineService;
