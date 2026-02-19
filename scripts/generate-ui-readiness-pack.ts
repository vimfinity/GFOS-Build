import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApplication } from '../src/application/app.js';
import { RunReport } from '../src/core/types.js';

function createWorkspace(): { root: string; mavenMockPath: string; pipelinePath: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'gfos-ui-pack-'));

  mkdirSync(path.join(root, '2025', 'web', 'module-a'), { recursive: true });
  mkdirSync(path.join(root, '2025', 'shared'), { recursive: true });

  writeFileSync(
    path.join(root, '2025', 'web', 'pom.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<project><modelVersion>4.0.0</modelVersion><profiles><profile><id>dev-ui</id></profile></profiles></project>`
  );
  writeFileSync(path.join(root, '2025', 'web', 'module-a', 'pom.xml'), '<project><modelVersion>4.0.0</modelVersion></project>');
  writeFileSync(path.join(root, '2025', 'shared', 'pom.xml'), '<project><modelVersion>4.0.0</modelVersion></project>');

  const mavenMockPath = path.join(root, 'mvn-mock.sh');
  writeFileSync(
    mavenMockPath,
    '#!/usr/bin/env bash\nset -euo pipefail\necho "[mock-mvn] $PWD :: $*" 1>&2\nexit 0\n'
  );
  chmodSync(mavenMockPath, 0o755);

  const pipelinePath = path.join(root, 'pipeline.json');
  writeFileSync(
    pipelinePath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        name: 'ui-pack-demo',
        mavenExecutable: mavenMockPath,
        stages: [
          { name: 'shared', scope: 'explicit-modules', modules: ['shared'], goals: ['clean', 'install'] },
          { name: 'web', scope: 'root-only', goals: ['verify'], maxParallel: 2 },
        ],
      },
      null,
      2
    )
  );

  return { root, mavenMockPath, pipelinePath };
}

function sanitize(report: RunReport): RunReport {
  return {
    ...report,
    startedAt: '<redacted>',
    finishedAt: '<redacted>',
    durationMs: 0,
    events: report.events.map(event => ({ ...event, timestamp: '<redacted>' })),
    buildResults: report.buildResults.map(result => ({ ...result, durationMs: 0 })),
  };
}

function writeReport(fileName: string, report: RunReport): void {
  const outputPath = path.join('assets', 'ui-readiness', fileName);
  writeFileSync(outputPath, JSON.stringify(sanitize(report), null, 2));
}

async function main() {
  const { root, mavenMockPath, pipelinePath } = createWorkspace();
  const app = createApplication();

  try {
    const scanReport = await app.run({
      command: 'scan',
      roots: [root],
      maxDepth: 6,
      includeHidden: false,
      discoverProfiles: true,
    });

    const buildPlanReport = await app.run({
      command: 'build',
      roots: [root],
      maxDepth: 6,
      includeHidden: false,
      buildScope: 'root-only',
      planOnly: true,
      goals: ['clean', 'verify'],
      mavenExecutable: mavenMockPath,
      maxParallel: 2,
    });

    const buildRunReport = await app.run({
      command: 'build',
      roots: [root],
      maxDepth: 6,
      includeHidden: false,
      buildScope: 'root-only',
      goals: ['clean', 'verify'],
      mavenExecutable: mavenMockPath,
      maxParallel: 2,
    });

    const pipelinePlanReport = await app.run({
      command: 'pipeline',
      pipelineAction: 'plan',
      roots: [root],
      maxDepth: 6,
      includeHidden: false,
      pipelinePath,
    });

    const pipelineRunReport = await app.run({
      command: 'pipeline',
      pipelineAction: 'run',
      roots: [root],
      maxDepth: 6,
      includeHidden: false,
      pipelinePath,
    });

    writeReport('scan.report.json', scanReport);
    writeReport('build-plan.report.json', buildPlanReport);
    writeReport('build-run.report.json', buildRunReport);
    writeReport('pipeline-plan.report.json', pipelinePlanReport);
    writeReport('pipeline-run.report.json', pipelineRunReport);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
