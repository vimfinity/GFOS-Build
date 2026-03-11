import type { BuildEvent, ScanEvent, BuildStep, RunResult, Project } from '../core/types.js';

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const RED = `${ESC}31m`;
const GREEN = `${ESC}32m`;
const YELLOW = `${ESC}33m`;
const CYAN = `${ESC}36m`;

const SEPARATOR = '\u2500'.repeat(70);

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function renderBuildEvent(event: BuildEvent, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(event) + '\n');
    return;
  }

  switch (event.type) {
    case 'step:start':
      renderStepStart(event.step, event.index, event.total, event.pipelineName);
      break;
    case 'step:output':
      process.stdout.write(event.line + '\n');
      break;
    case 'step:done':
      renderStepDone(event.step, event.exitCode, event.durationMs, event.success);
      break;
    case 'run:done':
      renderRunDone(event.result);
      break;
  }
}

function renderStepStart(step: BuildStep, index: number, total: number, pipelineName?: string): void {
  console.log('');
  console.log(`${BOLD}[ ${index + 1}/${total} ]  ${step.label}${RESET}`);
  console.log(`${DIM}         ${step.path}${RESET}`);
  console.log(`${DIM}         ${step.mavenExecutable} ${[...step.goals, ...step.flags].join(' ')}${RESET}`);
  if (step.javaHome) {
    console.log(`${DIM}         Java ${step.javaVersion ?? '?'} (${step.javaHome})${RESET}`);
  }
  if (pipelineName) {
    // pipeline context shown in header
  }
  console.log(SEPARATOR);
}

function renderStepDone(step: BuildStep, exitCode: number, durationMs: number, success: boolean): void {
  console.log(SEPARATOR);
  if (success) {
    console.log(`${GREEN}${BOLD}\u2713  ${step.label}   SUCCESS   ${formatDuration(durationMs)}${RESET}`);
  } else {
    console.log(`${RED}${BOLD}\u2717  ${step.label}   FAILED (exit ${exitCode})   ${formatDuration(durationMs)}${RESET}`);
  }
}

function renderRunDone(result: RunResult): void {
  console.log('');
  if (result.success) {
    console.log(`${GREEN}${BOLD}Build completed successfully   ${formatDuration(result.durationMs)}${RESET}`);
  } else {
    const total = result.results.length + (result.stoppedAt !== undefined ? 1 : 0);
    console.log(`${RED}${BOLD}Build failed at step ${(result.stoppedAt ?? 0) + 1} of ${total}   ${formatDuration(result.durationMs)}${RESET}`);
  }
}

export function renderPipelineDone(pipelineName: string, result: RunResult, total: number): void {
  console.log('');
  if (result.success) {
    console.log(`${GREEN}${BOLD}Pipeline ${pipelineName}  \u2713  SUCCESS   ${formatDuration(result.durationMs)}${RESET}`);
  } else {
    console.log(`${RED}${BOLD}Pipeline ${pipelineName}  \u2717  FAILED at step ${(result.stoppedAt ?? 0) + 1} of ${total}${RESET}`);
    console.log(`${YELLOW}Resume:   gfos-build pipeline run ${pipelineName} --from ${(result.stoppedAt ?? 0) + 1}${RESET}`);
    console.log(`${YELLOW}Or:       gfos-build pipeline run ${pipelineName} --continue${RESET}`);
  }
}

export function renderScanEvent(event: ScanEvent, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(event) + '\n');
    return;
  }

  if (event.type === 'scan:done') {
    const cached = event.fromCache ? ` ${DIM}(from cache)${RESET}` : '';
    console.log(
      `\nFound ${BOLD}${event.projects.length}${RESET} project(s) in ${formatDuration(event.durationMs)}${cached}`,
    );
  }
}

export function renderProject(project: Project): void {
  const maven = project.maven;
  const type = maven?.isAggregator ? 'aggregator' : maven?.packaging ?? '?';
  const java = maven?.javaVersion ? `  Java ${maven.javaVersion}` : '';
  const mvnNote = maven?.hasMvnConfig ? `  ${YELLOW}\u26A0 .mvn/maven.config${RESET}` : '';
  console.log(`  ${BOLD}${project.name}${RESET}  ${DIM}${project.path}${RESET}`);
  console.log(`    ${CYAN}${type}${RESET}${java}${mvnNote}`);
}

export function renderDryRunStep(step: BuildStep, index: number, total: number, pomExists: boolean): void {
  const pomStatus = pomExists ? `${GREEN}found \u2713${RESET}` : `${RED}MISSING \u2717${RESET}`;
  console.log(`  ${BOLD}Step ${index + 1}/${total}  ${step.label}${RESET}`);
  console.log(`    Path:       ${step.path}`);
  console.log(`    pom.xml:    ${pomStatus}`);
  console.log(`    Command:    ${step.mavenExecutable} ${[...step.goals, ...step.flags].join(' ')}`);
  if (step.javaHome) {
    console.log(`    Java:       ${step.javaVersion ?? '?'}  \u2192  ${step.javaHome}`);
  }
  console.log('');
}
