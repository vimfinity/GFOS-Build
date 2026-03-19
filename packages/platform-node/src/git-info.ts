import { watch as fsWatch } from 'node:fs';
import { exec, execSync } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { GitInfo, GitInfoReader } from '@gfos-build/application';

const execAsync = promisify(exec);
const GIT_OPTS = { timeout: 3000, encoding: 'utf8' as const };
const NULL_INFO: GitInfo = { branch: null, isDirty: false };
const MAX_CONCURRENCY = 4;

async function gitExec(cmd: string, cwd: string): Promise<string> {
  const { stdout } = await execAsync(cmd, { ...GIT_OPTS, cwd });
  return stdout.trim();
}

async function resolveGitInfo(cwd: string): Promise<GitInfo> {
  let branch: string | null = null;
  try {
    branch = (await gitExec('git rev-parse --abbrev-ref HEAD', cwd)) || null;
  } catch {
    return NULL_INFO;
  }

  let isDirty = false;
  try {
    const status = await gitExec('git status --porcelain', cwd);
    isDirty = status.length > 0;
  } catch {
    // non-fatal
  }

  return { branch, isDirty };
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export class NodeGitInfoReader implements GitInfoReader {
  // Cache path -> git root so repeated getBatch() calls skip root-resolution.
  private readonly gitRootCache = new Map<string, string | null>();

  // fs.watch state for .git/HEAD change detection.
  private headChangeCallback: (() => void) | null = null;
  private readonly watchedRoots = new Set<string>();
  private readonly headWatchers: ReturnType<typeof fsWatch>[] = [];

  private async resolveGitRoot(p: string): Promise<string | null> {
    if (this.gitRootCache.has(p)) return this.gitRootCache.get(p) ?? null;
    try {
      const root = await gitExec('git rev-parse --show-toplevel', p);
      this.gitRootCache.set(p, root);
      this.tryWatchRoot(root);
      return root;
    } catch {
      this.gitRootCache.set(p, null);
      return null;
    }
  }

  private tryWatchRoot(root: string): void {
    if (!this.headChangeCallback || this.watchedRoots.has(root)) return;
    this.watchedRoots.add(root);
    try {
      const headFile = path.join(root, '.git', 'HEAD');
      const w = fsWatch(headFile, { persistent: false }, () => this.headChangeCallback?.());
      this.headWatchers.push(w);
    } catch {
      // HEAD file not watchable (permission, unusual repo layout) — ignore.
    }
  }

  /**
   * Start watching .git/HEAD for every known (and future) git root.
   * Events are debounced (250 ms) so multiple rapid fs.watch firings from a
   * single `git checkout` coalesce into one callback — preventing redundant
   * IPC sends and git process spawns.
   * Returns a cleanup that cancels the pending debounce and stops all watchers.
   */
  watchHeads(onChange: () => void): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onChange();
      }, 250);
    };

    this.headChangeCallback = debounced;
    // Watch roots already in the cache (from a getBatch() call before this).
    for (const root of this.gitRootCache.values()) {
      if (root) this.tryWatchRoot(root);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      this.close();
    };
  }

  close(): void {
    this.headChangeCallback = null;
    for (const w of this.headWatchers) {
      try { w.close(); } catch { /* already closed */ }
    }
    this.headWatchers.length = 0;
    this.watchedRoots.clear();
  }

  getInfo(p: string): GitInfo {
    let branch: string | null = null;
    try {
      branch =
        execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: p,
          encoding: 'utf8',
          timeout: 3000,
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() || null;
    } catch {
      return NULL_INFO;
    }

    let isDirty = false;
    try {
      const status = execSync('git status --porcelain', {
        cwd: p,
        encoding: 'utf8',
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      isDirty = status.trim().length > 0;
    } catch {
      // non-fatal — dirty state is best-effort
    }

    return { branch, isDirty };
  }

  async getBatch(paths: string[]): Promise<Record<string, GitInfo>> {
    // Resolve git roots — instance cache means repeat calls skip this step.
    const rootEntries = await mapConcurrent(paths, MAX_CONCURRENCY, async (p) => ({
      path: p,
      root: await this.resolveGitRoot(p),
    }));

    // Group paths by git root
    const byRoot = new Map<string, string[]>();
    const results: Record<string, GitInfo> = {};

    for (const { path: p, root } of rootEntries) {
      if (!root) {
        results[p] = NULL_INFO;
        continue;
      }
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root)!.push(p);
    }

    // Resolve branch + dirty for each unique root with concurrency limit
    const rootGroups = [...byRoot.entries()];
    await mapConcurrent(rootGroups, MAX_CONCURRENCY, async ([, rootPaths]) => {
      const info = await resolveGitInfo(rootPaths[0]!);
      for (const p of rootPaths) {
        results[p] = info;
      }
    });

    return results;
  }
}
