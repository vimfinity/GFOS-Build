import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const configSchema = z.object({
  roots: z.array(z.string().min(1)).min(1).default(['.']),
  scan: z
    .object({
      maxDepth: z.number().int().min(0).max(12).default(4),
      includeHidden: z.boolean().default(false),
    })
    .default({ maxDepth: 4, includeHidden: false }),
  build: z
    .object({
      goals: z.array(z.string().min(1)).min(1).default(['clean', 'install']),
      mavenExecutable: z.string().min(1).default('mvn'),
      failFast: z.boolean().default(true),
    })
    .default({ goals: ['clean', 'install'], mavenExecutable: 'mvn', failFast: true }),
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
