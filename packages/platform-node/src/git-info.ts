import { exec, execSync } from 'node:child_process';
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
  getInfo(path: string): GitInfo {
    let branch: string | null = null;
    try {
      branch =
        execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: path,
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
        cwd: path,
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
    // Resolve git roots with concurrency limit (avoid spawning too many child processes)
    const rootEntries = await mapConcurrent(paths, MAX_CONCURRENCY, async (p) => {
      try {
        return { path: p, root: await gitExec('git rev-parse --show-toplevel', p) };
      } catch {
        return { path: p, root: null };
      }
    });

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
