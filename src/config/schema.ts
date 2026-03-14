import { z } from 'zod';

const mavenStepConfigSchema = z
  .object({
    path: z.string().min(1),
    buildSystem: z.literal('maven').default('maven'),
    modulePath: z.string().min(1).optional(),
    goals: z.array(z.string().min(1)).optional(),
    optionKeys: z
      .array(z.enum(['skipTests', 'skipTestCompile', 'updateSnapshots', 'offline', 'quiet', 'debug', 'errors', 'failAtEnd', 'failNever']))
      .default([]),
    profileStates: z.record(z.enum(['default', 'enabled', 'disabled'])).default({}),
    extraOptions: z.array(z.string()).default([]),
    label: z.string().optional(),
    maven: z.string().optional(),
    javaVersion: z.string().optional(),
    executionMode: z.enum(['internal', 'external']).default('internal'),
  })
  .strict();

const nodeStepConfigSchemaBase = z
  .object({
    path: z.string().min(1),
    buildSystem: z.literal('node'),
    label: z.string().optional(),
    commandType: z.enum(['script', 'install']).default('script'),
    script: z.string().min(1).optional(),
    args: z.array(z.string()).default([]),
    executionMode: z.enum(['internal', 'external']).default('internal'),
  })
  .strict();

const nodeStepConfigSchema = nodeStepConfigSchemaBase
  .superRefine((step, ctx) => {
    if (step.commandType === 'script' && !step.script) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'script is required when commandType is "script"',
        path: ['script'],
      });
    }
  });

export const buildStepConfigSchema = z.union([mavenStepConfigSchema, nodeStepConfigSchema]);

export const pipelineConfigSchema = z.object({
  description: z.string().optional(),
  failFast: z.boolean().default(true),
  steps: z.array(buildStepConfigSchema).min(1),
});

export const configSchema = z
  .object({
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
        defaultOptionKeys: z
          .array(z.enum(['skipTests', 'skipTestCompile', 'updateSnapshots', 'offline', 'quiet', 'debug', 'errors', 'failAtEnd', 'failNever']))
          .default([]),
        defaultExtraOptions: z.array(z.string()).default([]),
      })
      .strict()
      .default({}),

    node: z
      .object({
        executables: z
          .object({
            npm: z.string().min(1).default('npm'),
            pnpm: z.string().min(1).default('pnpm'),
            bun: z.string().min(1).default('bun'),
          })
          .strict()
          .default({}),
      })
      .strict()
      .default({}),

    jdkRegistry: z
      .record(
        z.string().min(1),
        z.string().min(1),
      )
      .default({}),

    scan: z
      .object({
        includeHidden: z.boolean().default(false),
        exclude: z.array(z.string()).default([]),
      })
      .strict()
      .default({}),

    pipelines: z.record(z.string().min(1), pipelineConfigSchema).default({}),
  })
  .strict();

export type AppConfig = z.infer<typeof configSchema>;
export type BuildStepConfig = z.infer<typeof buildStepConfigSchema>;
export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;
