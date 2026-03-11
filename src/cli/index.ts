#!/usr/bin/env node

import { parseArgs } from './args.js';
import { loadConfig } from '../config/loader.js';
import { getDbPath, getConfigPath } from '../config/paths.js';
import { NodeFileSystem } from '../infrastructure/file-system.js';
import { NodeProcessRunner } from '../infrastructure/process-runner.js';
import { AppDatabase } from '../infrastructure/database.js';
import { RepositoryScanner } from '../core/repository-scanner.js';
import { BuildExecutor } from '../core/build-executor.js';
import { NpmExecutor } from '../core/npm-executor.js';
import { CachedScanner } from '../application/scanner.js';
import { BuildRunner } from '../application/build-runner.js';
import { PipelineRunner } from '../application/pipeline-runner.js';
import { runConfigInit } from './commands/config-init.js';
import { runConfigShow } from './commands/config-show.js';
import { runScan } from './commands/scan.js';
import { runBuild } from './commands/build.js';
import { runPipelineRun } from './commands/pipeline-run.js';
import { runPipelineList } from './commands/pipeline-list.js';
import { runServe } from './commands/serve.js';
import { configSchema } from '../config/schema.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

const VERSION = '1.0.0';

const HELP_TEXT = `
gfos-build v${VERSION} — Maven build orchestration CLI

Usage:
  gfos-build build <path> [options]          Run a single Maven build
  gfos-build pipeline run <name> [options]   Execute a saved pipeline
  gfos-build pipeline list                   List configured pipelines
  gfos-build scan [path] [options]           Discover Maven projects
  gfos-build config init                     Setup wizard
  gfos-build config show                     Print current config
  gfos-build version                         Show version
  gfos-build help [command]                  Show help

Global options:
  --config <path>   Override config file location
  --json            Emit output as newline-delimited JSON

build options:
  --goals <str>     Maven goals (e.g. "clean install")
  --flags <str>     Maven flags (e.g. "-DskipTests -T 2C")
  --maven <exec>    Override mvn executable
  --java <version>  Override JAVA_HOME via configured jdkRegistry
  --dry-run         Print command without executing

pipeline run options:
  --from <id>       Start from step (1-based index or label)
  --continue        Resume from last failed step
  --dry-run         Print steps without executing

scan options:
  --depth <n>       Override maxDepth
  --no-cache        Force fresh scan
`;

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);
  const { command, global } = parsed;

  if (command.name === 'help') {
    console.log(HELP_TEXT);
    return;
  }

  if (command.name === 'version') {
    console.log(`gfos-build v${VERSION}`);
    return;
  }

  if (command.name === 'config:init') {
    await runConfigInit();
    return;
  }

  // All other commands require a config
  const configResult = loadConfig(global.config);

  // Serve can start without a config — creates defaults so the GUI onboarding works
  if (command.name === 'serve') {
    let config: import('../config/schema.js').AppConfig;
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
    const db = new AppDatabase(getDbPath());
    try {
      const scanner = new CachedScanner(new RepositoryScanner(fileSystem), db);
      const executor = new BuildExecutor(processRunner);
      const npmExecutor = new NpmExecutor(processRunner);
      const buildRunner = new BuildRunner(executor, npmExecutor, fileSystem);
      const pipelineRunner = new PipelineRunner(buildRunner, db);
      await runServe({ port: command.port, config, configPath, db, scanner, buildRunner, pipelineRunner, fs: fileSystem });
    } finally {
      db.close();
    }
    return;
  }

  if (!configResult.found) {
    console.log('No config file found.\n');
    console.log('Run "gfos-build config init" to create one.');
    await runConfigInit();
    return;
  }

  const { config, configPath } = configResult;

  if (command.name === 'config:show') {
    runConfigShow(config, configPath);
    return;
  }

  // Commands that need infrastructure
  const fileSystem = new NodeFileSystem();
  const processRunner = new NodeProcessRunner();
  const db = new AppDatabase(getDbPath());

  try {
    const scanner = new CachedScanner(new RepositoryScanner(fileSystem), db);
    const executor = new BuildExecutor(processRunner);
    const npmExecutor = new NpmExecutor(processRunner);
    const buildRunner = new BuildRunner(executor, npmExecutor, fileSystem);
    const pipelineRunner = new PipelineRunner(buildRunner, db);

    switch (command.name) {
      case 'scan':
        await runScan(scanner, config, {
          path: command.path,
          depth: command.depth,
          noCache: command.noCache,
          json: global.json,
        });
        break;

      case 'build': {
        const success = await runBuild(buildRunner, db, fileSystem, config, {
          path: command.path,
          goals: command.goals,
          flags: command.flags,
          maven: command.maven,
          java: command.java,
          dryRun: command.dryRun,
          json: global.json,
        });
        if (!success) process.exitCode = 1;
        break;
      }

      case 'pipeline:run': {
        const success = await runPipelineRun(pipelineRunner, fileSystem, config, {
          pipelineName: command.pipelineName,
          from: command.from,
          continue: command.continue,
          dryRun: command.dryRun,
          json: global.json,
        });
        if (!success) process.exitCode = 1;
        break;
      }

      case 'pipeline:list':
        runPipelineList(config, global.json);
        break;
    }
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
