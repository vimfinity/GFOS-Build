import { Dirent, promises as fs } from 'node:fs';
import path from 'node:path';

export interface FileSystem {
  readDir(targetPath: string): Promise<Dirent[]>;
  exists(targetPath: string): Promise<boolean>;
}

export class NodeFileSystem implements FileSystem {
  async readDir(targetPath: string): Promise<Dirent[]> {
    return fs.readdir(targetPath, { withFileTypes: true });
  }

  async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}

export function resolvePath(inputPath: string): string {
  return path.resolve(inputPath);
}
