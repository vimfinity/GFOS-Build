import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const toolchainRuleSchema = z
  .object({
    selector: z.string().min(1),
    javaHome: z.string().min(1).optional(),
    mavenExecutable: z.string().min(1).optional(),
  })
  .refine(rule => Boolean(rule.javaHome) || Boolean(rule.mavenExecutable), {
    message: 'Jede Toolchain-Regel benötigt javaHome oder mavenExecutable.',
  });

const configSchema = z.object({
  roots: z.array(z.string().min(1)).min(1).default(['.']),
  scan: z
    .object({
      maxDepth: z.number().int().min(0).max(12).default(4),
      includeHidden: z.boolean().default(false),
      cacheEnabled: z.boolean().default(false),
      cacheTtlSec: z.number().int().min(10).max(86400).default(300),
    })
    .default({ maxDepth: 4, includeHidden: false, cacheEnabled: false, cacheTtlSec: 300 }),
  build: z
    .object({
      goals: z.array(z.string().min(1)).min(1).default(['clean', 'install']),
      mavenExecutable: z.string().min(1).default('mvn'),
      javaHome: z.string().min(1).optional(),
      toolchains: z.array(toolchainRuleSchema).default([]),
      failFast: z.boolean().default(true),
      maxParallel: z.number().int().min(1).max(32).default(1),
    })
    .default({
      goals: ['clean', 'install'],
      mavenExecutable: 'mvn',
      toolchains: [],
      failFast: true,
      maxParallel: 1,
    }),
});

export type AppConfig = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG_PATH = 'gfos-build.config.json';

export async function loadConfig(configPath?: string): Promise<AppConfig> {
  const resolvedConfigPath = configPath
    ? path.resolve(configPath)
    : path.resolve(process.cwd(), DEFAULT_CONFIG_PATH);

  try {
    const fileContent = await fs.readFile(resolvedConfigPath, 'utf-8');
    const parsedJson = JSON.parse(fileContent) as unknown;
    return configSchema.parse(parsedJson);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return configSchema.parse({});
    }

    throw new Error(`Ungültige Konfiguration in ${resolvedConfigPath}: ${(error as Error).message}`);
  }
}
