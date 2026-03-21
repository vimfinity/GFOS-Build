import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Project } from '@gfos-build/domain';

const SCAN_CACHE_VERSION = 2;

interface ValidationEntry {
  path: string;
  mtimeMs: number | null;
}

interface ScanCacheRecord {
  version: number;
  createdAt: string;
  projects: Project[];
  validationEntries: ValidationEntry[];
}

export interface ScanCacheStore {
  get(key: string, ttlMs: number): { projects: Project[]; scannedAt: string } | null;
  set(key: string, projects: Project[], validationPaths: string[], scannedAt: string): void;
  clear(): void;
}

export class FileScanCacheStore implements ScanCacheStore {
  constructor(private readonly cacheDir: string) {}

  get(key: string, ttlMs: number): { projects: Project[]; scannedAt: string } | null {
    const filePath = this.getEntryPath(key);
    try {
      const stats = statSync(filePath);
      if (Date.now() - stats.mtimeMs > ttlMs) {
        rmSync(filePath, { force: true });
        return null;
      }

      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as ScanCacheRecord;
      if (
        parsed.version !== SCAN_CACHE_VERSION ||
        !Array.isArray(parsed.projects) ||
        !Array.isArray(parsed.validationEntries) ||
        !this.isValidationSnapshotCurrent(parsed.validationEntries)
      ) {
        rmSync(filePath, { force: true });
        return null;
      }
      return { projects: parsed.projects, scannedAt: parsed.createdAt };
    } catch {
      return null;
    }
  }

  set(key: string, projects: Project[], validationPaths: string[], scannedAt: string): void {
    mkdirSync(this.cacheDir, { recursive: true });
    const record: ScanCacheRecord = {
      version: SCAN_CACHE_VERSION,
      createdAt: scannedAt,
      projects,
      validationEntries: this.captureValidationEntries(validationPaths),
    };
    writeFileSync(this.getEntryPath(key), `${JSON.stringify(record)}\n`, 'utf8');
  }

  clear(): void {
    rmSync(this.cacheDir, { recursive: true, force: true });
  }

  prune(maxAgeMs: number): void {
    try {
      const entries = readdirSync(this.cacheDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filePath = path.join(this.cacheDir, entry.name);
        try {
          const stats = statSync(filePath);
          if (Date.now() - stats.mtimeMs > maxAgeMs) {
            rmSync(filePath, { force: true });
          }
        } catch {
          // Disposable cache: ignore broken entries.
        }
      }
    } catch {
      // Cache directory does not need to exist.
    }
  }

  private getEntryPath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  private captureValidationEntries(validationPaths: string[]): ValidationEntry[] {
    const entries: ValidationEntry[] = [];
    for (const trackedPath of [...new Set(validationPaths)]) {
      entries.push({
        path: trackedPath,
        mtimeMs: this.tryGetMtimeMs(trackedPath),
      });
    }
    return entries;
  }

  private isValidationSnapshotCurrent(validationEntries: ValidationEntry[]): boolean {
    for (const entry of validationEntries) {
      if (this.tryGetMtimeMs(entry.path) !== entry.mtimeMs) {
        return false;
      }
    }
    return true;
  }

  private tryGetMtimeMs(targetPath: string): number | null {
    try {
      return statSync(targetPath).mtimeMs;
    } catch {
      return null;
    }
  }
}
