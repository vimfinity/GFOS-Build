#!/usr/bin/env node
import { createApplication } from '../application/app.js';
import { PipelineStageReport, RunReport } from '../core/types.js';
import { CliUsageError, parseArgs } from './args.js';

function printHelp(): void {
  console.log(`GFOS Build Foundation CLI

Usage:
  gfos-build scan [options]
  gfos-build build [options]
  gfos-build pipeline <plan|run> [options]

Core options:
  --root <path>          One root path (repeatable)
  --max-depth <n>        Maximum traversal depth
  --include-hidden       Include hidden folders
  --scan-cache           Enable persisted discovery cache
  --scan-cache-ttl-sec   Discovery cache TTL in seconds
  --profiles             Discover Maven profiles across modules
  --profile-filter <q>   Optional profile id filter
  --config <path>        Config file path (default: gfos-build.config.json)
  --json                 Output machine-readable JSON

Build options:
  --goals "clean install"
  --mvn <command>
  --no-fail-fast
  --max-parallel <n>     Parallel builds per plan/stage (1..32)
  --plan                 Only create build plan (no Maven execution)
  --verbose              Forward Maven output to stderr (default: on for text, off for --json)
  --scope <mode>         root-only | explicit-modules | auto
  --module <selector>    Repeatable selector for explicit-modules
  --include-module <q>   Include filter for selected modules
  --exclude-module <q>   Exclude filter for selected modules

Pipeline options:
  --pipeline <path>      Pipeline definition JSON

Examples:
  gfos-build scan --root "J:/dev/quellen" --profiles --profile-filter dev --json
  gfos-build build --root "J:/dev/quellen/2025/web" --scope root-only --plan --json
  gfos-build build --root "J:/dev/quellen" --scope explicit-modules --module shared --include-module web --exclude-module legacy
  gfos-build pipeline plan --root "J:/dev/quellen" --pipeline ./pipeline.json --json
  gfos-build pipeline run --root "J:/dev/quellen" --pipeline ./pipeline.json --json`);
}

function printPipelineStages(stages: PipelineStageReport[]): void {
  for (const stage of stages) {
    console.log(
      `- Stage ${stage.stageName}: ${stage.plan.repositories.length} Modul(e), ${stage.plan.strategy}, maxParallel=${stage.plan.maxParallel}`
    );
    if (stage.buildResults.length > 0) {
      for (const result of stage.buildResults) {
        const status = result.exitCode === 0 ? 'OK' : 'FEHLER';
        console.log(`  - ${result.repository.name}: ${status} (${Math.round(result.durationMs / 1000)}s)`);
      }
    }
  }
}

function printTextSummary(report: RunReport): void {
  if (report.discovered.length === 0) {
    console.log('Keine buildbaren Maven-Repositories gefunden.');
    return;
  }

  console.log(`Gefundene Module (${report.discovered.length}):`);
  for (const repository of report.discovered) {
    const marker = repository.parentPath ? 'sub' : 'root';
    console.log(`- [${marker}] ${repository.name}: ${repository.path}`);
  }

  if (report.profileScan.enabled) {
    console.log(`\nGefundene Maven-Profile (${report.profileScan.profiles.length}):`);
    for (const profile of report.profileScan.profiles) {
      console.log(`- ${profile.id}: ${profile.modulePath}`);
    }
  }

  if (report.command === 'scan') {
    return;
  }

  if (report.command === 'pipeline') {
    console.log(`\nPipeline (${report.pipeline?.action ?? 'plan'}):`);
    printPipelineStages(report.pipeline?.stages ?? []);
    return;
  }

  if (report.mode === 'build-plan') {
    console.log(
      `\nBuild-Plan (keine Ausführung, ${report.buildPlan?.strategy ?? 'sequential'}, maxParallel=${report.buildPlan?.maxParallel ?? 1}):`
    );
    for (const repository of report.buildPlan?.repositories ?? []) {
      console.log(`- ${repository.name}: ${repository.path}`);
    }
    return;
  }

  console.log('\nBuild-Ergebnisse:');
  for (const result of report.buildResults) {
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

  const report = await application.run({
    command: cliArgs.command,
    pipelineAction: cliArgs.pipelineAction,
    pipelinePath: cliArgs.pipelinePath,
    roots: cliArgs.roots,
    maxDepth: cliArgs.maxDepth,
    includeHidden: cliArgs.includeHidden,
    goals: cliArgs.goals,
    mavenExecutable: cliArgs.mavenExecutable,
    failFast: cliArgs.failFast,
    maxParallel: cliArgs.maxParallel,
    useScanCache: cliArgs.useScanCache,
    scanCacheTtlSec: cliArgs.scanCacheTtlSec,
    discoverProfiles: cliArgs.discoverProfiles,
    profileFilter: cliArgs.profileFilter,
    verbose: cliArgs.verbose ?? !cliArgs.outputJson,
    planOnly: cliArgs.planOnly,
    buildScope: cliArgs.buildScope,
    modules: cliArgs.modules,
    includeModules: cliArgs.includeModules,
    excludeModules: cliArgs.excludeModules,
    configPath: cliArgs.configPath,
  });

  if (cliArgs.outputJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextSummary(report);
  }

  const failedBuild = report.buildResults.find(result => result.exitCode !== 0);
  if (failedBuild) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  if (error instanceof CliUsageError) {
    console.error(error.message);
    console.error('Nutze --help für eine vollständige Übersicht.');
    process.exitCode = 2;
    return;
  }

  console.error('Unerwarteter Fehler:', error);
  process.exitCode = 1;
});
