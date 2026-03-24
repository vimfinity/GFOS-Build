import type {
  BuildStep,
  MavenBuildStep,
  MavenOptionKey,
  MavenProfileState,
  NodeCommandType,
  PackageManager,
} from '@gfos-build/contracts';

const MAVEN_OPTION_FLAG_BY_KEY: Record<MavenOptionKey, string> = {
  skipTests: '-DskipTests',
  skipTestCompile: '-Dmaven.test.skip=true',
  updateSnapshots: '-U',
  offline: '-o',
  quiet: '-q',
  debug: '-X',
  errors: '-e',
  failAtEnd: '-fae',
  failNever: '-fn',
};

export function buildCommandString(step: BuildStep): string {
  switch (step.buildSystem) {
    case 'maven':
      return [step.mavenExecutable, ...buildMavenArgs(step)].join(' ');
    case 'wildfly':
      return step.command;
    case 'node':
      return buildNodeCommandString(step.packageManager ?? 'npm', step.commandType, step.args, step.script);
  }
}

export function buildMavenArgs(step: MavenBuildStep): string[] {
  const args = [...step.goals];

  for (const optionKey of step.optionKeys ?? []) {
    args.push(MAVEN_OPTION_FLAG_BY_KEY[optionKey]);
  }

  const profileArgValue = buildMavenProfileArgValue(step.profileStates ?? {});
  if (profileArgValue) {
    args.push('-P', profileArgValue);
  }

  if (step.modulePath && step.submoduleBuildStrategy !== 'submodule-dir') {
    args.push('-pl', step.modulePath);
  }

  args.push(...(step.extraOptions ?? []));
  return args;
}

export function buildMavenProfileArgValue(profileStates: Record<string, MavenProfileState>): string | undefined {
  const explicitProfiles = Object.entries(profileStates)
    .filter(([, state]) => state !== 'default')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([profileId, state]) => (state === 'disabled' ? `!${profileId}` : profileId));

  if (explicitProfiles.length === 0) {
    return undefined;
  }

  return explicitProfiles.join(',');
}

export function buildNodeCommandString(
  packageManager: PackageManager,
  commandType: NodeCommandType,
  args: string[] = [],
  script?: string,
): string {
  if (commandType === 'install') {
    return [packageManager, 'install', ...args].join(' ');
  }

  return [packageManager, 'run', script ?? '<script>', ...(args.length > 0 ? ['--', ...args] : [])].join(' ');
}
