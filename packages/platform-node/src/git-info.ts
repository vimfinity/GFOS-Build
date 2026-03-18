import { execSync } from 'node:child_process';
import type { GitInfo, GitInfoReader } from '@gfos-build/application';

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
      return { branch: null, isDirty: false };
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
}
