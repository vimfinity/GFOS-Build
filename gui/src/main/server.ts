import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { loadConfig } from '@server/config/loader';
import { getDbPath, getConfigPath } from '@server/config/paths';
import { configSchema } from '@server/config/schema';
import { NodeFileSystem } from '@server/infrastructure/file-system';
import { NodeProcessRunner } from '@server/infrastructure/process-runner';
import { RepositoryScanner } from '@server/core/repository-scanner';
import { BuildExecutor } from '@server/core/build-executor';
import { NpmExecutor } from '@server/core/npm-executor';
import { CachedScanner } from '@server/application/scanner';
import { BuildRunner } from '@server/application/build-runner';
import { PipelineRunner } from '@server/application/pipeline-runner';
import { runServe } from '@server/cli/commands/serve';
import { NodeDatabase } from './database';

export interface ServerHandle {
  port: number;
  db: NodeDatabase;
  close: () => void;
}

export async function startServer(): Promise<ServerHandle> {
  const configResult = loadConfig(undefined);
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
  const npmExecutor = new NpmExecutor(processRunner);
  const buildRunner = new BuildRunner(executor, npmExecutor, fileSystem);
  const pipelineRunner = new PipelineRunner(buildRunner, db);

  const { port, close } = await runServe({
    port: 0,
    config,
    configPath,
    db,
    scanner,
    buildRunner,
    pipelineRunner,
    fs: fileSystem,
  });

  return { port, db, close };
}
