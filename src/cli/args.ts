import { z } from 'zod';
import { ErrorCode } from '../core/errors.js';

const argsSchema = z.object({
  command: z.enum(['scan', 'build', 'pipeline']),
  pipelineAction: z.enum(['lint', 'plan', 'run']).optional(),
  pipelinePath: z.string().min(1).optional(),
  roots: z.array(z.string().min(1)),
  modules: z.array(z.string().min(1)),
  includeModules: z.array(z.string().min(1)),
  excludeModules: z.array(z.string().min(1)),
  explainSelection: z.boolean().optional(),
  buildScope: z.enum(['root-only', 'explicit-modules', 'auto']).optional(),
  maxDepth: z.number().int().min(0).max(12).optional(),
  includeHidden: z.boolean().optional(),
  useScanCache: z.boolean().optional(),
  scanCacheTtlSec: z.number().int().min(10).max(86400).optional(),
  discoverProfiles: z.boolean().optional(),
  profileFilter: z.string().min(1).optional(),
  goals: z.array(z.string()).min(1).optional(),
  mavenExecutable: z.string().min(1).optional(),
  javaHome: z.string().min(1).optional(),
  failFast: z.boolean().optional(),
  maxParallel: z.number().int().min(1).max(32).optional(),
  verbose: z.boolean().optional(),
  planOnly: z.boolean().optional(),
  configPath: z.string().min(1).optional(),
  outputJson: z.boolean(),
});

export type CliArgs = z.infer<typeof argsSchema>;

export class CliUsageError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

function isFlag(value: string): boolean {
  return value.startsWith('--');
}

function parseGoals(value: string): string[] {
  return value
    .split(' ')
    .map(goal => goal.trim())
    .filter(Boolean);
}

function parseCommand(rawArgs: string[]): {
  command: CliArgs['command'];
  pipelineAction?: CliArgs['pipelineAction'];
  options: string[];
} {
  if (rawArgs.length === 0) {
    return { command: 'scan', options: [] };
  }

  const rootCommand = rawArgs[0];

  if (rootCommand === 'scan') {
    return { command: 'scan', options: rawArgs.slice(1) };
  }

  if (rootCommand === 'build') {
    return { command: 'build', options: rawArgs.slice(1) };
  }

  if (rootCommand === 'pipeline') {
    const action = rawArgs[1];
    if (action !== 'lint' && action !== 'plan' && action !== 'run') {
      throw new CliUsageError(
        'USAGE_INVALID_PIPELINE_ACTION',
        `Ungültige Pipeline-Aktion: ${action ?? '<leer>'}. Erlaubt sind: lint | plan | run.`
      );
    }

    return {
      command: 'pipeline',
      pipelineAction: action,
      options: rawArgs.slice(2),
    };
  }

  throw new CliUsageError(
    'USAGE_INVALID_COMMAND',
    `Unbekannter Befehl: ${rootCommand}. Erlaubt sind: scan | build | pipeline.`
  );
}

export function parseArgs(rawArgs: string[]): CliArgs {
  const commandInfo = parseCommand(rawArgs);

  const parsed: Omit<CliArgs, 'command'> = {
    pipelineAction: commandInfo.pipelineAction,
    roots: [],
    modules: [],
    includeModules: [],
    excludeModules: [],
    outputJson: false,
  };

  for (let i = 0; i < commandInfo.options.length; i += 1) {
    const current = commandInfo.options[i];

    if (current === '--root') {
      const value = commandInfo.options[i + 1];
      if (value && !isFlag(value)) {
        parsed.roots.push(value);
        i += 1;
      }
    } else if (current === '--module') {
      const value = commandInfo.options[i + 1];
      if (value && !isFlag(value)) {
        parsed.modules.push(value);
        i += 1;
      }
    } else if (current === '--include-module') {
      const value = commandInfo.options[i + 1];
      if (value && !isFlag(value)) {
        parsed.includeModules.push(value);
        i += 1;
      }
    } else if (current === '--exclude-module') {
      const value = commandInfo.options[i + 1];
      if (value && !isFlag(value)) {
        parsed.excludeModules.push(value);
        i += 1;
      }
    } else if (current === '--explain-selection') {
      parsed.explainSelection = true;
    } else if (current === '--scope') {
      const value = commandInfo.options[i + 1];
      if (value && !isFlag(value)) {
        parsed.buildScope = value as CliArgs['buildScope'];
        i += 1;
      }
    } else if (current === '--pipeline') {
      const value = commandInfo.options[i + 1];
      if (value && !isFlag(value)) {
        parsed.pipelinePath = value;
        i += 1;
      }
    } else if (current === '--max-depth') {
      const value = Number.parseInt(commandInfo.options[i + 1] ?? '', 10);
      if (!Number.isNaN(value)) {
        parsed.maxDepth = value;
      }
      i += 1;
    } else if (current === '--include-hidden') {
      parsed.includeHidden = true;
    } else if (current === '--scan-cache') {
      parsed.useScanCache = true;
    } else if (current === '--scan-cache-ttl-sec') {
      const value = Number.parseInt(commandInfo.options[i + 1] ?? '', 10);
      if (!Number.isNaN(value)) {
        parsed.scanCacheTtlSec = value;
      }
      i += 1;
    } else if (current === '--profiles') {
      parsed.discoverProfiles = true;
    } else if (current === '--profile-filter') {
      const value = commandInfo.options[i + 1];
      if (value && !isFlag(value)) {
        parsed.profileFilter = value;
        i += 1;
      }
    } else if (current === '--goals') {
      const value = commandInfo.options[i + 1];
      if (value && !isFlag(value)) {
        parsed.goals = parseGoals(value);
        i += 1;
      }
    } else if (current === '--mvn') {
      const value = commandInfo.options[i + 1];
      if (value && !isFlag(value)) {
        parsed.mavenExecutable = value;
      }
      i += 1;
    } else if (current === '--java-home') {
      const value = commandInfo.options[i + 1];
      if (value && !isFlag(value)) {
        parsed.javaHome = value;
      }
      i += 1;
    } else if (current === '--no-fail-fast') {
      parsed.failFast = false;
    } else if (current === '--max-parallel') {
      const value = Number.parseInt(commandInfo.options[i + 1] ?? '', 10);
      if (!Number.isNaN(value)) {
        parsed.maxParallel = value;
      }
      i += 1;
    } else if (current === '--verbose') {
      parsed.verbose = true;
    } else if (current === '--plan') {
      parsed.planOnly = true;
    } else if (current === '--config') {
      const value = commandInfo.options[i + 1];
      if (value && !isFlag(value)) {
        parsed.configPath = value;
      }
      i += 1;
    } else if (current === '--json') {
      parsed.outputJson = true;
    }
  }

  return argsSchema.parse({ command: commandInfo.command, ...parsed });
}
