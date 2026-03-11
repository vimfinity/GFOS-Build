import type { AppConfig } from '../../config/schema.js';
import type { CachedScanner } from '../../application/scanner.js';
import { resolveStepPath } from '../../config/resolver.js';
import { renderScanEvent, renderProject } from '../renderer.js';

export interface ScanCommandOptions {
  path?: string;
  depth?: number;
  noCache: boolean;
  json: boolean;
}

export async function runScan(
  scanner: CachedScanner,
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
    maxDepth: options.depth ?? config.scan.maxDepth,
    includeHidden: config.scan.includeHidden,
    exclude: config.scan.exclude,
  };

  for await (const event of scanner.scan(scanOptions, undefined, options.noCache)) {
    if (options.json) {
      renderScanEvent(event, true);
    } else if (event.type === 'repo:found') {
      renderProject(event.project);
    } else {
      renderScanEvent(event, false);
    }
  }
}
