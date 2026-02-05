/**
 * ConfigService - Settings persistence with JSON file storage.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { CONFIG_FILE, DEFAULT_SETTINGS } from '../../shared/constants';
import type { AppSettings } from '../../shared/types';

class ConfigService {
  private configPath: string = '';
  private cached: AppSettings | null = null;

  private getPath(): string {
    if (!this.configPath) {
      this.configPath = path.join(app.getPath('userData'), CONFIG_FILE);
    }
    return this.configPath;
  }

  async load(): Promise<AppSettings> {
    if (this.cached) return this.cached;

    const defaults: AppSettings = { ...DEFAULT_SETTINGS };

    try {
      const configPath = this.getPath();
      if (await fs.pathExists(configPath)) {
        const data = await fs.readJson(configPath);
        const merged = { ...defaults, ...data };
        this.cached = merged;
        return merged;
      }
    } catch (error) {
      console.error('[ConfigService] Failed to load config:', error);
    }

    this.cached = defaults;
    return defaults;
  }

  async save(config: AppSettings): Promise<void> {
    await fs.writeJson(this.getPath(), config, { spaces: 2 });
    this.cached = config;
  }

  invalidateCache(): void {
    this.cached = null;
  }
}

export const configService = new ConfigService();
