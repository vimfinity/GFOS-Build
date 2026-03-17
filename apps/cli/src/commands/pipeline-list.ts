import type { AppRuntime } from '@gfos-build/platform-node';
import { buildCommandString } from '@gfos-build/domain';
import type { BuildStep } from '@gfos-build/domain';

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const CYAN = `${ESC}36m`;

export function runPipelineList(runtime: AppRuntime, json: boolean): void {
  const pipelines = runtime.listPipelines();

  if (json) {
    process.stdout.write(JSON.stringify(pipelines, null, 2) + '\n');
    return;
  }

  if (pipelines.length === 0) {
    console.log('No pipelines configured yet.');
    return;
  }

  console.log(`\n${pipelines.length} pipeline(s) configured:\n`);

  for (const pipeline of pipelines) {

    const desc = pipeline.description ? `  ${DIM}\u00B7  ${pipeline.description}${RESET}` : '';
    console.log(`  ${BOLD}${pipeline.name}${RESET}${desc}`);

    for (let i = 0; i < pipeline.steps.length; i++) {
      const step = toBuildStep(pipeline.steps[i]!);
      const isLast = i === pipeline.steps.length - 1;
      const prefix = isLast ? '\u2514\u2500' : '\u251C\u2500';
      const gutter = isLast ? '  ' : '\u2502 ';

      console.log(`  ${prefix} ${CYAN}${i + 1}${RESET}  ${BOLD}${step.label}${RESET}   ${DIM}${step.path}${RESET}`);
      console.log(`  ${gutter}      ${DIM}${buildCommandString(step)}${RESET}`);

      if (step.buildSystem === 'maven' && step.javaHome) {
        console.log(`  ${gutter}      ${DIM}Java ${step.javaVersion ?? '?'} (${step.javaHome})${RESET}`);
      }
    }

    console.log('');
  }
}

function toBuildStep(step: NonNullable<ReturnType<AppRuntime['listPipelines']>[number]>['steps'][number]): BuildStep {
  if (step.buildSystem === 'node') {
    return {
      path: step.path,
      label: step.label,
      buildSystem: 'node',
      commandType: step.commandType ?? 'script',
      script: step.script,
      args: step.args ?? [],
      executionMode: step.executionMode ?? 'internal',
      packageManager: step.packageManager,
      nodeExecutables: { npm: 'npm', pnpm: 'pnpm', bun: 'bun' },
    };
  }

  return {
    path: step.path,
    label: step.label,
    buildSystem: 'maven',
    modulePath: step.modulePath,
    goals: step.goals ?? [],
    optionKeys: step.optionKeys ?? [],
    profileStates: step.profileStates ?? {},
    extraOptions: step.extraOptions ?? [],
    executionMode: step.executionMode ?? 'internal',
    mavenExecutable: step.mavenExecutable ?? 'mvn',
    javaVersion: step.javaVersion,
    javaHome: step.javaHome,
  };
}
