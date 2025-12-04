/**
 * File System Interface and Types
 * 
 * Abstraction layer for file system operations to enable mocking.
 */

import type { DirectoryEntry, ScanResult } from './index';

/**
 * File system interface for abstraction.
 * Allows swapping between real and mock implementations.
 */
export interface IFileSystem {
  /**
   * Scans a directory and returns its contents.
   * @param path - The absolute path to scan.
   * @returns Promise resolving to scan result with directory entries.
   */
  scanDirectory(path: string): Promise<ScanResult>;

  /**
   * Checks if a file or directory exists.
   * @param path - The absolute path to check.
   * @returns Promise resolving to true if exists, false otherwise.
   */
  exists(path: string): Promise<boolean>;

  /**
   * Reads the contents of a file.
   * @param path - The absolute path to the file.
   * @returns Promise resolving to the file contents as string.
   */
  readFile(path: string): Promise<string>;

  /**
   * Recursively finds files matching a pattern.
   * @param basePath - The base directory to search from.
   * @param pattern - Glob pattern to match (e.g., '**\/.git', '**\/pom.xml').
   * @returns Promise resolving to array of matching paths.
   */
  findFiles(basePath: string, pattern: string): Promise<string[]>;

  /**
   * Gets file or directory stats.
   * @param path - The absolute path.
   * @returns Promise resolving to stats or null if not found.
   */
  stat(path: string): Promise<FileStats | null>;
}

/**
 * File statistics.
 */
export interface FileStats {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  modifiedTime: Date;
  createdTime: Date;
}
