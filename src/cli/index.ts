#!/usr/bin/env node
import { createApplication } from '../application/app.js';
import { RunSummary } from '../core/types.js';
import { parseArgs } from './args.js';

function printHelp(): void {
  console.log(`GFOS Build Foundation CLI

Usage:
  gfos-build scan [options]
  gfos-build build [options]

Core options:
  --root <path>          One root path (repeatable)
  --max-depth <n>        Maximum traversal depth
  --include-hidden       Include hidden folders
  --config <path>        Config file path (default: gfos-build.config.json)
  --json                 Output machine-readable JSON

Build options:
  --goals "clean install"
  --mvn <command>
  --no-fail-fast

Examples:
  gfos-build scan --root "J:/dev/quellen" --root "J:/dev/legacy" --max-depth 4
  gfos-build build --root "J:/dev/quellen" --goals "clean verify" --mvn mvn`);
}

function printTextSummary(command: 'scan' | 'build', summary: RunSummary): void {
  if (summary.discovered.length === 0) {
    console.log('Keine buildbaren Maven-Repositories gefunden.');
    return;
  }

  console.log(`Gefundene Repositories (${summary.discovered.length}):`);
  for (const repository of summary.discovered) {
    console.log(`- ${repository.name}: ${repository.path}`);
  }

  if (command === 'scan') {
    return;
  }

  console.log('\nBuild-Ergebnisse:');
  for (const result of summary.buildResults) {
    const status = result.exitCode === 0 ? 'OK' : 'FEHLER';
    console.log(`- ${result.repository.name}: ${status} (${Math.round(result.durationMs / 1000)}s)`);
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const cliArgs = parseArgs(process.argv.slice(2));
  const application = createApplication();

  const summary = await application.run(
    {
      command: cliArgs.command,
      roots: cliArgs.roots,
      maxDepth: cliArgs.maxDepth,
      includeHidden: cliArgs.includeHidden,
      goals: cliArgs.goals,
      mavenExecutable: cliArgs.mavenExecutable,
      failFast: cliArgs.failFast,
      configPath: cliArgs.configPath,
    }
  );

  if (cliArgs.outputJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printTextSummary(cliArgs.command, summary);
  }

  const failedBuild = summary.buildResults.find(result => result.exitCode !== 0);
  if (failedBuild) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Unerwarteter Fehler:', error);
  process.exitCode = 1;
});
