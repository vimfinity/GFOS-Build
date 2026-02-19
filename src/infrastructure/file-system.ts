import { Dirent, promises as fs } from 'node:fs';
import path from 'node:path';

export interface FileSystem {
  readDir(targetPath: string): Promise<Dirent[]>;
  exists(targetPath: string): Promise<boolean>;
  readFile(targetPath: string): Promise<string>;
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

  async readFile(targetPath: string): Promise<string> {
    return fs.readFile(targetPath, 'utf-8');
  }
}

export function resolvePath(inputPath: string): string {
  return path.resolve(inputPath);
}
