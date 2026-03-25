export interface DirEntry {
  name: string;
  isDirectory(): boolean;
}

export interface FileSystem {
  exists(path: string): Promise<boolean>;
  readDir(path: string): Promise<DirEntry[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string, options?: { recursive: boolean }): Promise<void>;
  copyFile?(from: string, to: string): Promise<void>;
  rm?(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
}
