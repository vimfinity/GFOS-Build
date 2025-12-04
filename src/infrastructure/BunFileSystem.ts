/**
 * BunFileSystem - Real File System Implementation
 * 
 * Uses native Bun/Node fs APIs for actual file system operations.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import fg from 'fast-glob';
import type { IFileSystem, FileStats } from '../core/types/filesystem';
import type { DirectoryEntry, ScanResult } from '../core/types';

/**
 * Real file system implementation using Bun/Node APIs.
 */
export class BunFileSystem implements IFileSystem {
  async scanDirectory(dirPath: string): Promise<ScanResult> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      const directoryEntries: DirectoryEntry[] = entries.map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }));

      return {
        entries: directoryEntries,
        path: dirPath,
      };
    } catch (error) {
      // Return empty result on error (e.g., permission denied)
      return {
        entries: [],
        path: dirPath,
      };
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  async findFiles(basePath: string, pattern: string): Promise<string[]> {
    try {
      // Normalize path for fast-glob (requires forward slashes)
      const normalizedBase = basePath.replace(/\\/g, '/');
      const fullPattern = `${normalizedBase}/${pattern}`;
      
      const files = await fg(fullPattern, {
        absolute: true,
        onlyFiles: false,
        dot: true,
        followSymbolicLinks: false,
        suppressErrors: true,
      });

      return files;
    } catch {
      return [];
    }
  }

  async stat(filePath: string): Promise<FileStats | null> {
    try {
      const stats = await fs.stat(filePath);
      return {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modifiedTime: stats.mtime,
        createdTime: stats.birthtime,
      };
    } catch {
      return null;
    }
  }
}
