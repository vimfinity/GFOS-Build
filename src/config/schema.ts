import { z } from 'zod';

export const buildStepConfigSchema = z.object({
  path: z.string().min(1),
  buildSystem: z.enum(['maven', 'npm']).default('maven'),
  goals: z.array(z.string().min(1)).optional(),
  flags: z.array(z.string()).optional(),
  label: z.string().optional(),
  maven: z.string().optional(), // override mvn executable for this step
  javaVersion: z.string().optional(), // e.g. "17" — forces JAVA_HOME override
  npmScript: z.string().optional(),
});

export const pipelineConfigSchema = z.object({
  description: z.string().optional(),
  failFast: z.boolean().default(true),
  steps: z.array(buildStepConfigSchema).min(1),
});

export const configSchema = z.object({
  roots: z
    .record(
      z
        .string()
        .min(2, 'Root names must be at least 2 characters (single characters are drive letters)'),
      z.string().min(1),
    )
    .default({}),

  maven: z
    .object({
      executable: z.string().min(1).default('mvn'),
      defaultGoals: z.array(z.string().min(1)).default(['clean', 'install']),
      defaultFlags: z.array(z.string()).default([]),
    })
    .default({}),

  npm: z
    .object({
      executable: z.string().min(1).default('npm'),
      defaultBuildScript: z.string().min(1).default('build'),
      defaultInstallArgs: z.array(z.string()).default([]),
    })
    .default({}),

  jdkRegistry: z
    .record(
      z.string().min(1), // java version string, e.g. "17" or "21"
      z.string().min(1), // absolute path to JDK root
    )
    .default({}),

  scan: z
    .object({
      maxDepth: z.number().int().min(1).max(20).default(4),
      includeHidden: z.boolean().default(false),
      exclude: z.array(z.string()).default([]), // directory names to skip (performance only)
    })
    .default({}),

  pipelines: z.record(z.string().min(1), pipelineConfigSchema).default({}),
});

export type AppConfig = z.infer<typeof configSchema>;
export type BuildStepConfig = z.infer<typeof buildStepConfigSchema>;
export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;
