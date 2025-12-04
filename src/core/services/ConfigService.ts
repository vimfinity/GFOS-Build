/**
 * ConfigService
 * 
 * Handles configuration persistence to disk.
 * Uses Zod for schema validation to prevent crashes on corrupted config files.
 */

import { z } from 'zod';
import { homedir } from 'os';
import { join } from 'path';
import { useAppStore, type AppSettings } from '../store/useAppStore.js';

// ============================================================================
// Zod Schema
// ============================================================================

/**
 * Zod schema for AppSettings validation.
 */
export const AppSettingsSchema = z.object({
  /** Default Maven goals to run (e.g., 'clean install') */
  defaultMavenGoal: z.string().default('clean install'),
  /** Default JAVA_HOME path */
  defaultJavaHome: z.string().default(''),
  /** Default Maven home path */
  defaultMavenHome: z.string().default('C:\\dev\\maven\\mvn3'),
  /** Root path to scan for projects */
  scanRootPath: z.string().default('C:\\dev\\quellen'),
  /** Paths to scan for JDKs (semicolon-separated) */
  jdkScanPaths: z.string().default('C:\\dev\\java'),
  /** Maximum parallel builds */
  maxParallelBuilds: z.number().int().min(1).max(8).default(2),
  /** Skip tests by default */
  skipTestsByDefault: z.boolean().default(false),
  /** Offline mode for Maven */
  offlineMode: z.boolean().default(false),
  /** Enable thread count option (-T) */
  enableThreads: z.boolean().default(false),
  /** Thread count value (e.g., '1C' for one thread per core) */
  threadCount: z.string().default('1C'),
});

/**
 * Zod schema for the complete config file.
 */
export const ConfigFileSchema = z.object({
  version: z.number().default(1),
  settings: AppSettingsSchema,
  // Future: could add more sections like 'recentProjects', 'favorites', etc.
});

export type ConfigFile = z.infer<typeof ConfigFileSchema>;

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_SETTINGS: AppSettings = {
  defaultMavenGoal: 'clean install',
  defaultJavaHome: '',
  defaultMavenHome: 'C:\\dev\\maven\\mvn3',
  scanRootPath: 'C:\\dev\\quellen',
  jdkScanPaths: 'C:\\dev\\java',
  maxParallelBuilds: 2,
  skipTestsByDefault: false,
  offlineMode: false,
  enableThreads: false,
  threadCount: '1C',
};

const DEFAULT_CONFIG: ConfigFile = {
  version: 1,
  settings: DEFAULT_SETTINGS,
};

// ============================================================================
// ConfigService Class
// ============================================================================

/**
 * ConfigService - Manages configuration persistence.
 */
export class ConfigService {
  private configPath: string;
  private isMockMode: boolean;
  private mockConfig: ConfigFile | null = null;
  
  constructor(configFileName = '.gfos-build.json') {
    this.isMockMode = process.env.MOCK_MODE === 'true';
    this.configPath = join(homedir(), configFileName);
  }
  
  /**
   * Get the config file path.
   */
  getConfigPath(): string {
    return this.configPath;
  }
  
  /**
   * Load configuration from disk.
   * Returns default config if file doesn't exist or is invalid.
   */
  async load(): Promise<ConfigFile> {
    if (this.isMockMode) {
      return this.mockConfig || DEFAULT_CONFIG;
    }
    
    try {
      const file = Bun.file(this.configPath);
      const exists = await file.exists();
      
      if (!exists) {
        // No config file, use defaults
        return DEFAULT_CONFIG;
      }
      
      const content = await file.text();
      const json = JSON.parse(content);
      
      // Validate with Zod
      const result = ConfigFileSchema.safeParse(json);
      
      if (!result.success) {
        // Log validation errors but don't crash
        console.error('[ConfigService] Invalid config file, using defaults:', result.error.format());
        return DEFAULT_CONFIG;
      }
      
      return result.data;
    } catch (error) {
      // File read/parse error, use defaults
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ConfigService] Failed to load config: ${message}`);
      return DEFAULT_CONFIG;
    }
  }
  
  /**
   * Save configuration to disk.
   */
  async save(config: ConfigFile): Promise<boolean> {
    if (this.isMockMode) {
      this.mockConfig = config;
      return true;
    }
    
    try {
      // Validate before saving
      const result = ConfigFileSchema.safeParse(config);
      
      if (!result.success) {
        console.error('[ConfigService] Invalid config, not saving:', result.error.format());
        return false;
      }
      
      const content = JSON.stringify(result.data, null, 2);
      await Bun.write(this.configPath, content);
      
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ConfigService] Failed to save config: ${message}`);
      return false;
    }
  }
  
  /**
   * Save only the settings portion of the config.
   */
  async saveSettings(settings: Partial<AppSettings>): Promise<boolean> {
    const currentConfig = await this.load();
    
    const newConfig: ConfigFile = {
      ...currentConfig,
      settings: {
        ...currentConfig.settings,
        ...settings,
      },
    };
    
    return this.save(newConfig);
  }
  
  /**
   * Load settings and apply to the Zustand store.
   */
  async loadIntoStore(): Promise<void> {
    const config = await this.load();
    const store = useAppStore.getState();
    store.updateSettings(config.settings);
  }
  
  /**
   * Save current store settings to disk.
   */
  async saveFromStore(): Promise<boolean> {
    const store = useAppStore.getState();
    return this.saveSettings(store.settings);
  }
  
  /**
   * Reset configuration to defaults.
   */
  async reset(): Promise<boolean> {
    return this.save(DEFAULT_CONFIG);
  }
  
  /**
   * Delete the config file.
   */
  async delete(): Promise<boolean> {
    if (this.isMockMode) {
      this.mockConfig = null;
      return true;
    }
    
    try {
      const { unlink } = await import('fs/promises');
      await unlink(this.configPath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Check if config file exists.
   */
  async exists(): Promise<boolean> {
    if (this.isMockMode) {
      return this.mockConfig !== null;
    }
    
    try {
      const file = Bun.file(this.configPath);
      return await file.exists();
    } catch {
      return false;
    }
  }
  
  /**
   * Get default settings.
   */
  getDefaults(): AppSettings {
    return { ...DEFAULT_SETTINGS };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let configServiceInstance: ConfigService | null = null;

/**
 * Get the ConfigService singleton instance.
 */
export function getConfigService(): ConfigService {
  if (!configServiceInstance) {
    configServiceInstance = new ConfigService();
  }
  return configServiceInstance;
}

export default ConfigService;
