import { z } from 'zod';

const mavenStepConfigSchema = z
  .object({
    path: z.string().min(1),
    buildSystem: z.literal('maven').default('maven'),
    mode: z.enum(['build', 'deploy']).default('build'),
    modulePath: z.string().min(1).optional(),
    submoduleBuildStrategy: z.enum(['root-pl', 'submodule-dir']).optional(),
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
    deploymentWorkflowName: z.string().min(1).optional(),
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

const deploymentWorkflowConfigSchema = z
  .object({
    description: z.string().optional(),
    projectPath: z.string().min(1),
    build: z
      .object({
        modulePath: z.string().min(1).optional(),
        submoduleBuildStrategy: z.enum(['root-pl', 'submodule-dir']).default('root-pl'),
        goals: z.array(z.string().min(1)).default(['clean', 'install']),
        optionKeys: z
          .array(z.enum(['skipTests', 'skipTestCompile', 'updateSnapshots', 'offline', 'quiet', 'debug', 'errors', 'failAtEnd', 'failNever']))
          .default([]),
        profileStates: z.record(z.enum(['default', 'enabled', 'disabled'])).default({}),
        extraOptions: z.array(z.string()).default([]),
        javaVersion: z.string().optional(),
      })
      .strict(),
    artifactSelector: z
      .object({
        kind: z.enum(['auto', 'module', 'explicit-file']),
        modulePath: z.string().min(1).optional(),
        packaging: z.enum(['ear', 'war', 'rar', 'jar']).optional(),
        fileName: z.string().min(1).optional(),
      })
      .strict(),
    environmentName: z.string().min(1),
    standaloneProfileName: z.string().min(1),
    cleanupPresetName: z.string().min(1).optional(),
    startupPresetName: z.string().min(1).optional(),
    deployMode: z.enum(['filesystem-scanner', 'management-cli']).optional(),
    startServer: z.boolean().default(true),
  })
  .strict();

const standaloneProfileConfigSchema = z
  .object({
    serverConfigPath: z.string().min(1),
    materializeToStandaloneXml: z.boolean().default(false),
  })
  .strict();

const cleanupPresetConfigSchema = z
  .object({
    removePreviousDeployment: z.boolean().default(true),
    removeMarkerFiles: z.boolean().default(true),
    clearBaseSubdirs: z.array(z.enum(['tmp', 'log', 'data', 'data/content'])).default([]),
    extraRelativePaths: z.array(z.string().min(1)).default([]),
  })
  .strict();

const startupPresetConfigSchema = z
  .object({
    javaHome: z.string().min(1).optional(),
    javaOpts: z.array(z.string()).default([]),
    programArgs: z.array(z.string()).default([]),
    debugEnabled: z.boolean().default(false),
    debugHost: z.string().min(1).default('127.0.0.1'),
    debugPort: z.number().int().positive().default(8787),
    debugSuspend: z.boolean().default(false),
    jrebelEnabled: z.boolean().default(false),
    jrebelAgentKind: z.enum(['agentpath', 'javaagent']).default('javaagent'),
    jrebelAgentPath: z.string().min(1).optional(),
    jrebelArgs: z.array(z.string()).default([]),
  })
  .strict();

const wildflyEnvironmentConfigSchema = z
  .object({
    homeDir: z.string().min(1),
    baseDir: z.string().min(1),
    configDir: z.string().min(1).optional(),
    deploymentsDir: z.string().min(1).optional(),
    cliScript: z.string().min(1).optional(),
    startupScript: z.string().min(1).optional(),
    javaHome: z.string().min(1).optional(),
    standaloneProfiles: z.record(standaloneProfileConfigSchema).default({}),
    cleanupPresets: z.record(cleanupPresetConfigSchema).default({}),
    startupPresets: z.record(startupPresetConfigSchema).default({}),
  })
  .strict();

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

    wildfly: z
      .object({
        environments: z.record(wildflyEnvironmentConfigSchema).default({}),
      })
      .strict()
      .default({}),
  })
  .strict();

export type AppConfig = z.infer<typeof configSchema>;
export type BuildStepConfig = z.infer<typeof buildStepConfigSchema>;
export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;
export type DeploymentWorkflowConfig = z.infer<typeof deploymentWorkflowConfigSchema>;
export { deploymentWorkflowConfigSchema };
