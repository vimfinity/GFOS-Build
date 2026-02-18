import { BuildService } from '../core/build-service.js';
import { RepositoryScanner } from '../core/repository-scanner.js';
import { RunSummary } from '../core/types.js';
import { NodeFileSystem } from '../infrastructure/file-system.js';
import { NodeProcessRunner } from '../infrastructure/process-runner.js';
import { runCommand, RunCommandInput } from './orchestrator.js';

export interface Application {
  run(input: RunCommandInput): Promise<RunSummary>;
}

export function createApplication(): Application {
  const scanner = new RepositoryScanner(new NodeFileSystem());
  const buildService = new BuildService(new NodeProcessRunner());

  return {
    run(input: RunCommandInput): Promise<RunSummary> {
      return runCommand(input, scanner, buildService);
    },
  };
}
