import fs from 'node:fs/promises';
import path from 'node:path';

export interface DirEntry {
  name: string;
  isDirectory(): boolean;
}

export interface FileSystem {
  exists(p: string): Promise<boolean>;
  readDir(p: string): Promise<DirEntry[]>;
  readFile(p: string): Promise<string>;
  writeFile(p: string, content: string): Promise<void>;
  mkdir(p: string, options?: { recursive: boolean }): Promise<void>;
}

export class NodeFileSystem implements FileSystem {
  async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  async readDir(p: string): Promise<DirEntry[]> {
    return fs.readdir(p, { withFileTypes: true });
  }

  async readFile(p: string): Promise<string> {
    return fs.readFile(p, 'utf-8');
  }

  async writeFile(p: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, 'utf-8');
  }

  async mkdir(p: string, options?: { recursive: boolean }): Promise<void> {
    await fs.mkdir(p, options);
  }
}
