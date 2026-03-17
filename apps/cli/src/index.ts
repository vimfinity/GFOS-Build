#!/usr/bin/env node

import { createRequire } from 'node:module';
import { parseArgs } from './args.js';
import { loadConfig, AppRuntime } from '@gfos-build/platform-node';
import { runConfigInit } from './commands/config-init.js';
import { runConfigShow } from './commands/config-show.js';
import { runScan } from './commands/scan.js';
import { runBuild } from './commands/build.js';
import { runPipelineRun } from './commands/pipeline-run.js';
import { runPipelineList } from './commands/pipeline-list.js';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../../package.json') as { version: string };

const HELP_TEXT = `
gfos-build v${VERSION} — build orchestration CLI

Usage:
  gfos-build build <path> [options]          Run a single Maven build
  gfos-build pipeline run <name> [options]   Execute a saved pipeline
  gfos-build pipeline list                   List configured pipelines
  gfos-build scan [path] [options]           Discover Maven and Node projects
  gfos-build config init                     Setup wizard
  gfos-build config show                     Print current settings
  gfos-build version                         Show version
  gfos-build help [command]                  Show help

Global options:
  --config <path>   Override settings file location
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

  const runtime = new AppRuntime({
    version: VERSION,
    settingsPath: global.config,
  });

  try {
    const configResult = loadConfig(global.config);

    if (command.name === 'config:show') {
      runConfigShow(configResult.config, configResult.configPath, global.json);
      return;
    }

    const config = configResult.config;

    switch (command.name) {
      case 'scan':
        await runScan(runtime, config, {
          path: command.path,
          noCache: command.noCache,
          json: global.json,
        });
        break;

      case 'build': {
        const success = await runBuild(runtime, config, {
          path: command.path,
          goals: command.goals,
          flags: command.flags,
          maven: command.maven,
          java: command.java,
          dryRun: command.dryRun,
          json: global.json,
        });
        if (!success) {
          process.exitCode = 1;
        }
        break;
      }

      case 'pipeline:run': {
        const success = await runPipelineRun(runtime, {
          pipelineName: command.pipelineName,
          from: command.from,
          continue: command.continue,
          dryRun: command.dryRun,
          json: global.json,
        });
        if (!success) {
          process.exitCode = 1;
        }
        break;
      }

      case 'pipeline:list':
        runPipelineList(runtime, global.json);
        break;
    }
  } finally {
    runtime.close();
  }
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
