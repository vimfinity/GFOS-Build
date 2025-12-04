/**
 * CacheService
 * 
 * Handles caching of scanned data (repositories, JDKs, modules) to disk.
 * This allows faster startup times by loading cached data instead of rescanning.
 * 
 * Cache is invalidated based on:
 * - Max age (configurable, default 24 hours)
 * - Explicit invalidation (user request)
 * - Config changes (scan paths)
 */

import { z } from 'zod';
import { homedir } from 'os';
import { join } from 'path';
import type { DiscoveredProject, MavenModule } from './WorkspaceScanner.js';
import type { JDK } from '../types/index.js';

// ============================================================================
// Zod Schemas
// ============================================================================

const DiscoveredProjectSchema = z.object({
  name: z.string(),
  path: z.string(),
  hasMaven: z.boolean(),
  hasGit: z.boolean(),
});

const JDKSchema = z.object({
  version: z.string(),
  vendor: z.string().optional(),
  jdkHome: z.string(),
  majorVersion: z.number(),
});

const MavenModuleCacheSchema = z.object({
  pomPath: z.string(),
  projectPath: z.string(),
  artifactId: z.string(),
  groupId: z.string().optional(),
  version: z.string().optional(),
  packaging: z.string().optional(),
  javaVersion: z.string().optional(),
  parentArtifactId: z.string().optional(),
  isRoot: z.boolean(),
});

const ProjectCacheSchema = z.object({
  modules: z.array(MavenModuleCacheSchema),
  profiles: z.array(z.string()),
  cachedAt: z.number(),
});

const CacheFileSchema = z.object({
  version: z.number().default(1),
  cachedAt: z.number(),
  scanRootPath: z.string(),
  jdkScanPaths: z.string(),
  repositories: z.array(DiscoveredProjectSchema),
  jdks: z.array(JDKSchema),
  // Per-project cache for modules and profiles
  projectCache: z.record(z.string(), ProjectCacheSchema).default({}),
});

export type CacheFile = z.infer<typeof CacheFileSchema>;
export type ProjectCache = z.infer<typeof ProjectCacheSchema>;

// ============================================================================
// Constants
// ============================================================================

const CACHE_FILE_NAME = 'gfos-cache.json';
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const PROJECT_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for project-specific cache

// ============================================================================
// CacheService Class
// ============================================================================

export class CacheService {
  private cacheDir: string;
  private cacheFilePath: string;
  private maxAgeMs: number;
  
  constructor(maxAgeMs: number = DEFAULT_MAX_AGE_MS) {
    this.cacheDir = join(homedir(), '.gfos-build');
    this.cacheFilePath = join(this.cacheDir, CACHE_FILE_NAME);
    this.maxAgeMs = maxAgeMs;
  }
  
  /**
   * Load cached data from disk.
   * Returns null if cache doesn't exist, is invalid, or is expired.
   */
  async loadCache(
    currentScanRootPath: string,
    currentJdkScanPaths: string
  ): Promise<CacheFile | null> {
    try {
      const file = Bun.file(this.cacheFilePath);
      
      if (!await file.exists()) {
        return null;
      }
      
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validated = CacheFileSchema.parse(parsed);
      
      // Check if cache is expired (main cache)
      const age = Date.now() - validated.cachedAt;
      if (age > this.maxAgeMs) {
        return null;
      }
      
      // Check if scan paths have changed - if so, invalidate repos/jdks but keep project cache
      if (
        validated.scanRootPath !== currentScanRootPath ||
        validated.jdkScanPaths !== currentJdkScanPaths
      ) {
        // Return only the project cache, clear repos/jdks
        return {
          ...validated,
          repositories: [],
          jdks: [],
          cachedAt: 0, // Mark as needs refresh
        };
      }
      
      return validated;
    } catch {
      // Cache is corrupted or doesn't exist
      return null;
    }
  }
  
  /**
   * Save data to cache.
   */
  async saveCache(
    scanRootPath: string,
    jdkScanPaths: string,
    repositories: DiscoveredProject[],
    jdks: JDK[],
    existingProjectCache?: Record<string, ProjectCache>
  ): Promise<void> {
    try {
      // Ensure cache directory exists
      await Bun.write(join(this.cacheDir, '.keep'), '');
      
      const cache: CacheFile = {
        version: 1,
        cachedAt: Date.now(),
        scanRootPath,
        jdkScanPaths,
        repositories,
        jdks,
        projectCache: existingProjectCache || {},
      };
      
      await Bun.write(this.cacheFilePath, JSON.stringify(cache, null, 2));
    } catch (error) {
      // Ignore cache write errors - caching is optional
      console.error('Failed to write cache:', error);
    }
  }
  
  /**
   * Load cached modules and profiles for a specific project.
   */
  async loadProjectCache(projectPath: string): Promise<ProjectCache | null> {
    try {
      const file = Bun.file(this.cacheFilePath);
      
      if (!await file.exists()) {
        return null;
      }
      
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validated = CacheFileSchema.parse(parsed);
      
      const projectCache = validated.projectCache[projectPath];
      if (!projectCache) {
        return null;
      }
      
      // Check if project cache is expired
      const age = Date.now() - projectCache.cachedAt;
      if (age > PROJECT_CACHE_MAX_AGE_MS) {
        return null;
      }
      
      return projectCache;
    } catch {
      return null;
    }
  }
  
  /**
   * Save modules and profiles cache for a specific project.
   */
  async saveProjectCache(
    projectPath: string,
    modules: MavenModule[],
    profiles: string[]
  ): Promise<void> {
    try {
      let existingCache: CacheFile | null = null;
      
      const file = Bun.file(this.cacheFilePath);
      if (await file.exists()) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          existingCache = CacheFileSchema.parse(parsed);
        } catch {
          // Ignore parse errors
        }
      }
      
      const newProjectCache: ProjectCache = {
        modules,
        profiles,
        cachedAt: Date.now(),
      };
      
      if (existingCache) {
        existingCache.projectCache[projectPath] = newProjectCache;
        await Bun.write(this.cacheFilePath, JSON.stringify(existingCache, null, 2));
      }
    } catch {
      // Ignore cache write errors
    }
  }
  
  /**
   * Clear all cached data.
   */
  async clearCache(): Promise<void> {
    try {
      const file = Bun.file(this.cacheFilePath);
      if (await file.exists()) {
        await Bun.write(this.cacheFilePath, '{}');
      }
    } catch {
      // Ignore errors
    }
  }
  
  /**
   * Clear cached data for a specific project.
   */
  async clearProjectCache(projectPath: string): Promise<void> {
    try {
      const file = Bun.file(this.cacheFilePath);
      if (!await file.exists()) return;
      
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validated = CacheFileSchema.parse(parsed);
      
      delete validated.projectCache[projectPath];
      
      await Bun.write(this.cacheFilePath, JSON.stringify(validated, null, 2));
    } catch {
      // Ignore errors
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let cacheServiceInstance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}

export default CacheService;
