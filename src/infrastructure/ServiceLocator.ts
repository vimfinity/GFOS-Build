/**
 * Service Locator / Factory for File System
 * 
 * Provides the appropriate IFileSystem implementation based on environment.
 * Returns MockFileSystem when MOCK_MODE=true, otherwise BunFileSystem.
 */

import type { IFileSystem } from '../core/types/filesystem';
import { BunFileSystem } from './BunFileSystem';
import { MockFileSystem } from './MockFileSystem';

/**
 * Singleton instances for file system implementations.
 */
let fileSystemInstance: IFileSystem | null = null;

/**
 * Checks if mock mode is enabled.
 */
export function isMockMode(): boolean {
  return process.env.MOCK_MODE === 'true';
}

/**
 * Gets the appropriate file system implementation.
 * Uses singleton pattern to ensure only one instance exists.
 * 
 * @returns IFileSystem implementation based on environment.
 */
export function getFileSystem(): IFileSystem {
  if (!fileSystemInstance) {
    fileSystemInstance = isMockMode() ? new MockFileSystem() : new BunFileSystem();
  }
  return fileSystemInstance;
}

/**
 * Resets the file system instance.
 * Useful for testing or when switching modes.
 */
export function resetFileSystem(): void {
  fileSystemInstance = null;
}

/**
 * Creates a new file system instance (non-singleton).
 * Useful when you need a fresh instance with custom data.
 * 
 * @param forceMock - Force mock mode regardless of environment.
 * @returns New IFileSystem implementation.
 */
export function createFileSystem(forceMock?: boolean): IFileSystem {
  const useMock = forceMock !== undefined ? forceMock : isMockMode();
  return useMock ? new MockFileSystem() : new BunFileSystem();
}

/**
 * Service Locator class for dependency injection pattern.
 * Provides centralized access to services throughout the application.
 */
export class ServiceLocator {
  private static services: Map<string, unknown> = new Map();

  /**
   * Registers a service with the locator.
   */
  static register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }

  /**
   * Gets a service from the locator.
   */
  static get<T>(key: string): T | undefined {
    return this.services.get(key) as T | undefined;
  }

  /**
   * Checks if a service is registered.
   */
  static has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * Clears all registered services.
   */
  static clear(): void {
    this.services.clear();
  }

  /**
   * Initializes default services.
   */
  static initialize(): void {
    // Register file system
    if (!this.has('fileSystem')) {
      this.register('fileSystem', getFileSystem());
    }
  }

  /**
   * Gets the file system service.
   */
  static getFileSystem(): IFileSystem {
    if (!this.has('fileSystem')) {
      this.register('fileSystem', getFileSystem());
    }
    return this.get<IFileSystem>('fileSystem')!;
  }
}

// Export service keys as constants
export const SERVICE_KEYS = {
  FILE_SYSTEM: 'fileSystem',
} as const;
