import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { loadConfig } from '@server/config/loader';
import { getDbPath, getConfigPath } from '@server/config/paths';
import { configSchema } from '@server/config/schema';
import { NodeFileSystem } from '@server/infrastructure/file-system';
import { NodeProcessRunner } from '@server/infrastructure/process-runner';
import { RepositoryScanner } from '@server/core/repository-scanner';
import { BuildExecutor } from '@server/core/build-executor';
import { NodeExecutor } from '@server/core/node-executor';
import { CachedScanner } from '@server/application/scanner';
import { BuildRunner } from '@server/application/build-runner';
import { PipelineRunner } from '@server/application/pipeline-runner';
import { runServe } from '@server/cli/commands/serve';
import { NodeDatabase } from './database';

export interface ServerHandle {
  port: number;
  db: NodeDatabase;
  close: () => void;
  getActiveJobCount: () => number;
}

export async function startServer(version: string): Promise<ServerHandle> {
  let configResult: ReturnType<typeof loadConfig>;
  let configError: string | undefined;
  try {
    configResult = loadConfig(undefined);
  } catch (error) {
    configResult = { found: false };
    configError = error instanceof Error ? error.message : String(error);
  }
  let config: ReturnType<typeof configSchema.parse>;
  let configPath: string;

  if (configResult.found) {
    config = configResult.config;
    configPath = configResult.configPath;
  } else {
    configPath = getConfigPath();
    mkdirSync(nodePath.dirname(configPath), { recursive: true });
    config = configSchema.parse({});
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  }

  const fileSystem = new NodeFileSystem();
  const processRunner = new NodeProcessRunner();
  const db = new NodeDatabase(getDbPath());
  const scanner = new CachedScanner(new RepositoryScanner(fileSystem), db);
  const executor = new BuildExecutor(processRunner);
  const nodeExecutor = new NodeExecutor(processRunner);
  const buildRunner = new BuildRunner(executor, nodeExecutor, fileSystem);
  const pipelineRunner = new PipelineRunner(buildRunner, db);

  const { port, close, getActiveJobCount } = await runServe({
    port: 0,
    version,
    config,
    configPath,
    configError,
    db,
    scanner,
    buildRunner,
    pipelineRunner,
    fs: fileSystem,
  });

  return { port, db, close, getActiveJobCount };
}
