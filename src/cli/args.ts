import { z } from 'zod';

const argsSchema = z.object({
  command: z.enum(['scan', 'build', 'pipeline']),
  pipelineAction: z.enum(['plan', 'run']).optional(),
  pipelinePath: z.string().min(1).optional(),
  roots: z.array(z.string().min(1)),
  modules: z.array(z.string().min(1)),
  includeModules: z.array(z.string().min(1)),
  excludeModules: z.array(z.string().min(1)),
  buildScope: z.enum(['root-only', 'explicit-modules', 'auto']).optional(),
  maxDepth: z.number().int().min(0).max(12).optional(),
  includeHidden: z.boolean().optional(),
  useScanCache: z.boolean().optional(),
  scanCacheTtlSec: z.number().int().min(10).max(86400).optional(),
  discoverProfiles: z.boolean().optional(),
  profileFilter: z.string().min(1).optional(),
  goals: z.array(z.string()).min(1).optional(),
  mavenExecutable: z.string().min(1).optional(),
  failFast: z.boolean().optional(),
  maxParallel: z.number().int().min(1).max(32).optional(),
  planOnly: z.boolean().optional(),
  configPath: z.string().min(1).optional(),
  outputJson: z.boolean(),
});

export type CliArgs = z.infer<typeof argsSchema>;

function isFlag(value: string): boolean {
  return value.startsWith('--');
}

function parseGoals(value: string): string[] {
  return value
    .split(' ')
    .map(goal => goal.trim())
    .filter(Boolean);
}

export function parseArgs(rawArgs: string[]): CliArgs {
  let command: CliArgs['command'] = 'scan';
  let options: string[] = [];
  let pipelineAction: CliArgs['pipelineAction'];

  if (rawArgs[0] === 'pipeline') {
    command = 'pipeline';
    pipelineAction = rawArgs[1] === 'run' ? 'run' : 'plan';
    options = rawArgs.slice(2);
  } else {
    command = rawArgs[0] === 'build' ? 'build' : 'scan';
    options = rawArgs.slice(1);
  }

  const parsed: Omit<CliArgs, 'command'> = {
    pipelineAction,
    roots: [],
    modules: [],
    includeModules: [],
    excludeModules: [],
    outputJson: false,
  };

  for (let i = 0; i < options.length; i += 1) {
    const current = options[i];

    if (current === '--root') {
      const value = options[i + 1];
      if (value && !isFlag(value)) {
        parsed.roots.push(value);
        i += 1;
      }
    } else if (current === '--module') {
      const value = options[i + 1];
      if (value && !isFlag(value)) {
        parsed.modules.push(value);
        i += 1;
      }
    } else if (current === '--include-module') {
      const value = options[i + 1];
      if (value && !isFlag(value)) {
        parsed.includeModules.push(value);
        i += 1;
      }
    } else if (current === '--exclude-module') {
      const value = options[i + 1];
      if (value && !isFlag(value)) {
        parsed.excludeModules.push(value);
        i += 1;
      }
    } else if (current === '--scope') {
      const value = options[i + 1];
      if (value && !isFlag(value)) {
        parsed.buildScope = value as CliArgs['buildScope'];
        i += 1;
      }
    } else if (current === '--pipeline') {
      const value = options[i + 1];
      if (value && !isFlag(value)) {
        parsed.pipelinePath = value;
        i += 1;
      }
    } else if (current === '--max-depth') {
      const value = Number.parseInt(options[i + 1] ?? '', 10);
      if (!Number.isNaN(value)) {
        parsed.maxDepth = value;
      }
      i += 1;
    } else if (current === '--include-hidden') {
      parsed.includeHidden = true;
    } else if (current === '--scan-cache') {
      parsed.useScanCache = true;
    } else if (current === '--scan-cache-ttl-sec') {
      const value = Number.parseInt(options[i + 1] ?? '', 10);
      if (!Number.isNaN(value)) {
        parsed.scanCacheTtlSec = value;
      }
      i += 1;
    } else if (current === '--profiles') {
      parsed.discoverProfiles = true;
    } else if (current === '--profile-filter') {
      const value = options[i + 1];
      if (value && !isFlag(value)) {
        parsed.profileFilter = value;
        i += 1;
      }
    } else if (current === '--goals') {
      const value = options[i + 1];
      if (value && !isFlag(value)) {
        parsed.goals = parseGoals(value);
        i += 1;
      }
    } else if (current === '--mvn') {
      const value = options[i + 1];
      if (value && !isFlag(value)) {
        parsed.mavenExecutable = value;
      }
      i += 1;
    } else if (current === '--no-fail-fast') {
      parsed.failFast = false;
    } else if (current === '--max-parallel') {
      const value = Number.parseInt(options[i + 1] ?? '', 10);
      if (!Number.isNaN(value)) {
        parsed.maxParallel = value;
      }
      i += 1;
    } else if (current === '--plan') {
      parsed.planOnly = true;
    } else if (current === '--config') {
      const value = options[i + 1];
      if (value && !isFlag(value)) {
        parsed.configPath = value;
      }
      i += 1;
    } else if (current === '--json') {
      parsed.outputJson = true;
    }
  }

  return argsSchema.parse({ command, ...parsed });
}
