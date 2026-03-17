import type { AppRuntime, AppConfig } from '@gfos-build/platform-node';
import { resolveStepPath } from '@gfos-build/platform-node';
import { renderScanEvent, renderProject } from '../renderer.js';

export interface ScanCommandOptions {
  path?: string;
  noCache: boolean;
  json: boolean;
}

export async function runScan(
  runtime: AppRuntime,
  config: AppConfig,
  options: ScanCommandOptions,
): Promise<void> {
  let roots: Record<string, string>;

  if (options.path) {
    const resolvedPath = resolveStepPath(options.path, config.roots);
    roots = { adhoc: resolvedPath };
  } else {
    roots = Object.fromEntries(
      Object.entries(config.roots).map(([name, p]) => [name, resolveStepPath(`${name}:`, config.roots).replace(/[/\\]$/, '') || p]),
    );
    // Actually just use roots directly since they are already absolute paths
    roots = config.roots;
  }

  const scanOptions = {
    roots,
    includeHidden: config.scan.includeHidden,
    exclude: config.scan.exclude,
  };

  for await (const event of runtime.scanProjects({ ...scanOptions, noCache: options.noCache })) {
    if (options.json) {
      renderScanEvent(event, true);
    } else if (event.type === 'repo:found') {
      renderProject(event.project);
    } else {
      renderScanEvent(event, false);
    }
  }
}
