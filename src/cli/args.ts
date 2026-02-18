import { z } from 'zod';

const argsSchema = z.object({
  command: z.enum(['scan', 'build']),
  roots: z.array(z.string().min(1)),
  maxDepth: z.number().int().min(0).max(12).optional(),
  includeHidden: z.boolean().optional(),
  goals: z.array(z.string()).min(1).optional(),
  mavenExecutable: z.string().min(1).optional(),
  failFast: z.boolean().optional(),
  configPath: z.string().min(1).optional(),
  outputJson: z.boolean(),
});

export type CliArgs = z.infer<typeof argsSchema>;

function isFlag(value: string): boolean {
  return value.startsWith('--');
}

export function parseArgs(rawArgs: string[]): CliArgs {
  const command = rawArgs[0] === 'build' ? 'build' : 'scan';
  const options = rawArgs.slice(1);

  const parsed: Omit<CliArgs, 'command'> = {
    roots: [],
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
    } else if (current === '--max-depth') {
      const value = Number.parseInt(options[i + 1] ?? '', 10);
      if (!Number.isNaN(value)) {
        parsed.maxDepth = value;
      }
      i += 1;
    } else if (current === '--include-hidden') {
      parsed.includeHidden = true;
    } else if (current === '--goals') {
      const value = options[i + 1];
      if (value && !isFlag(value)) {
        parsed.goals = value
          .split(' ')
          .map(goal => goal.trim())
          .filter(Boolean);
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
