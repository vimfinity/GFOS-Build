import type { AppConfig } from '../../config/schema.js';
import { resolvePipeline } from '../../config/resolver.js';
import { buildCommandString } from '../../core/build-command.js';

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const CYAN = `${ESC}36m`;

export function runPipelineList(config: AppConfig, json: boolean): void {
  const names = Object.keys(config.pipelines);

  if (json) {
    const pipelines = names.map((name) => {
      const pc = config.pipelines[name]!;
      const pipeline = resolvePipeline(name, pc, config);
      return pipeline;
    });
    process.stdout.write(JSON.stringify(pipelines, null, 2) + '\n');
    return;
  }

  if (names.length === 0) {
    console.log('No pipelines configured. Edit your config to add them.');
    return;
  }

  console.log(`\n${names.length} pipeline(s) configured:\n`);

  for (const name of names) {
    const pc = config.pipelines[name]!;
    const pipeline = resolvePipeline(name, pc, config);

    const desc = pipeline.description ? `  ${DIM}\u00B7  ${pipeline.description}${RESET}` : '';
    console.log(`  ${BOLD}${pipeline.name}${RESET}${desc}`);

    for (let i = 0; i < pipeline.steps.length; i++) {
      const step = pipeline.steps[i]!;
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
