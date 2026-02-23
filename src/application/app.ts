import { BuildService } from '../core/build-service.js';
import { RepositoryScanner } from '../core/repository-scanner.js';
import { RunReport } from '../core/types.js';
import { NodeFileSystem } from '../infrastructure/file-system.js';
import { NodeProcessRunner } from '../infrastructure/process-runner.js';
import { NodeDiscoveryCache } from '../infrastructure/discovery-cache.js';
import { NodeRunHistory, NoopRunHistory } from '../infrastructure/run-history.js';
import { runCommand, RunCommandInput } from './orchestrator.js';

export interface Application {
  run(input: RunCommandInput): Promise<RunReport>;
}

export function createApplication(): Application {
  const scanner = new RepositoryScanner(new NodeFileSystem());
  const buildService = new BuildService(new NodeProcessRunner());
  const cache = new NodeDiscoveryCache();
  const history = process.env.GFOS_DISABLE_RUN_HISTORY === '1' ? new NoopRunHistory() : new NodeRunHistory();

  return {
    run(input: RunCommandInput): Promise<RunReport> {
      return runCommand(input, scanner, buildService, cache, history);
    },
  };
}
