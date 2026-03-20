import { useMemo } from 'react';
import { TagInput } from '@/components/ui/tag-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComboboxField } from '@/components/ui/combobox-field';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type {
  ExecutionMode,
  MavenMetadata,
  MavenModuleMetadata,
  MavenOptionKey,
  MavenProfileState,
  MavenSubmoduleBuildStrategy,
} from '@gfos-build/contracts';

export interface MavenCommandValue {
  modulePath: string;
  submoduleBuildStrategy: MavenSubmoduleBuildStrategy;
  goals: string[];
  optionKeys: MavenOptionKey[];
  profileStates: Record<string, MavenProfileState>;
  extraOptions: string[];
  javaVersion: string;
  executionMode: ExecutionMode;
}

interface MavenCommandFieldsProps {
  metadata?: MavenMetadata;
  value: MavenCommandValue;
  jdkVersions: string[];
  onChange: (nextValue: MavenCommandValue) => void;
}

export const MAVEN_LIFECYCLE_PHASES = [
  'validate',
  'initialize',
  'generate-sources',
  'process-sources',
  'generate-resources',
  'process-resources',
  'compile',
  'process-classes',
  'generate-test-sources',
  'process-test-sources',
  'generate-test-resources',
  'process-test-resources',
  'test-compile',
  'process-test-classes',
  'test',
  'prepare-package',
  'package',
  'pre-integration-test',
  'integration-test',
  'post-integration-test',
  'verify',
  'install',
  'deploy',
  'clean',
  'site',
] as const;

const MAVEN_GOAL_GROUPS: Array<{ label: string; goals: typeof MAVEN_LIFECYCLE_PHASES[number][] }> = [
  { label: 'Setup', goals: ['validate', 'initialize', 'clean'] },
  { label: 'Sources', goals: ['generate-sources', 'process-sources', 'generate-resources', 'process-resources', 'compile', 'process-classes'] },
  { label: 'Tests', goals: ['generate-test-sources', 'process-test-sources', 'generate-test-resources', 'process-test-resources', 'test-compile', 'process-test-classes', 'test'] },
  { label: 'Package', goals: ['prepare-package', 'package', 'verify', 'install'] },
  { label: 'Release', goals: ['pre-integration-test', 'integration-test', 'post-integration-test', 'deploy', 'site'] },
];

export const MAVEN_OPTIONS: Array<{ key: MavenOptionKey; label: string; flag: string }> = [
  { key: 'skipTests', label: 'Skip tests', flag: '-DskipTests' },
  { key: 'skipTestCompile', label: 'Skip test compile', flag: '-Dmaven.test.skip=true' },
  { key: 'updateSnapshots', label: 'Update snapshots', flag: '-U' },
  { key: 'offline', label: 'Offline', flag: '-o' },
  { key: 'quiet', label: 'Quiet', flag: '-q' },
  { key: 'debug', label: 'Debug', flag: '-X' },
  { key: 'errors', label: 'Errors', flag: '-e' },
  { key: 'failAtEnd', label: 'Fail at end', flag: '-fae' },
  { key: 'failNever', label: 'Fail never', flag: '-fn' },
];

const MAVEN_OPTION_GROUPS: Array<{ label: string; options: MavenOptionKey[] }> = [
  { label: 'Tests', options: ['skipTests', 'skipTestCompile'] },
  { label: 'Network', options: ['updateSnapshots', 'offline'] },
  { label: 'Logging', options: ['quiet', 'debug', 'errors'] },
  { label: 'Failure', options: ['failAtEnd', 'failNever'] },
];

export function getSuggestedJavaOverride(
  metadata: MavenMetadata | undefined,
  registeredJdkVersions: string[],
): string {
  const detectedVersion = metadata?.javaVersion;
  if (!detectedVersion) {
    return '';
  }
  return registeredJdkVersions.includes(detectedVersion) ? detectedVersion : '';
}

export function MavenCommandFields({ metadata, value, jdkVersions, onChange }: MavenCommandFieldsProps) {
  const moduleOptions = metadata?.modules ?? [];
  const profileOptions = metadata?.profiles ?? [];
  const detectedJavaVersion = metadata?.javaVersion;
  const hasDetectedJavaMatch = Boolean(
    detectedJavaVersion && jdkVersions.includes(detectedJavaVersion),
  );

  function update<K extends keyof MavenCommandValue>(key: K, nextValue: MavenCommandValue[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  function toggleOption(optionKey: MavenOptionKey) {
    update(
      'optionKeys',
      value.optionKeys.includes(optionKey)
        ? value.optionKeys.filter((current) => current !== optionKey)
        : [...value.optionKeys, optionKey],
    );
  }

  function toggleGoal(goal: string) {
    update(
      'goals',
      value.goals.includes(goal)
        ? value.goals.filter((current) => current !== goal)
        : [...value.goals, goal],
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {metadata && (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetadataBadge label="Packaging" value={metadata.packaging} />
          <MetadataBadge label="Detected Java" value={metadata.javaVersion ?? 'n/a'} />
          <MetadataBadge label=".mvn config" value={metadata.hasMvnConfig ? 'present' : 'none'} />
        </div>
      )}

      {detectedJavaVersion && (
        <div
          className={cn(
            'rounded-[16px] border px-4 py-3 text-xs leading-relaxed',
            hasDetectedJavaMatch
              ? 'border-success/20 bg-success/8 text-muted-foreground'
              : 'border-warning/20 bg-warning/8 text-warning',
          )}
        >
          {hasDetectedJavaMatch ? (
            <>
              Detected Java <span className="font-mono text-foreground">{detectedJavaVersion}</span> has a matching registered JDK.
              {' '}
              GFOS Build can pin this build via <span className="font-mono">JAVA_HOME</span>.
            </>
          ) : (
            <>
              Detected Java <span className="font-mono">{detectedJavaVersion}</span> in this Maven project, but no matching JDK is registered.
              {' '}
              GFOS Build can still run Maven with the system Java, but it cannot guarantee that Java version until you add it to the JDK registry.
            </>
          )}
        </div>
      )}

      {metadata && moduleOptions.length > 0 && (
        <ModulePicker
          modules={moduleOptions}
          value={value.modulePath}
          strategy={value.submoduleBuildStrategy}
          onChange={(nextModulePath) => update('modulePath', nextModulePath)}
          onStrategyChange={(nextStrategy) => update('submoduleBuildStrategy', nextStrategy)}
        />
      )}

      <div className="flex flex-col gap-2">
        <TagInput
          label="Goals"
          value={value.goals}
          onChange={(nextGoals) => update('goals', nextGoals)}
          placeholder="e.g. clean"
        />
        <div className="rounded-[18px] border border-border/80 bg-card/30 px-3 py-2.5">
          {MAVEN_GOAL_GROUPS.map((group) => (
            <div
              key={group.label}
              className="grid gap-2 border-b border-border/60 py-2 last:border-b-0 last:pb-0 first:pt-0 sm:grid-cols-[5.25rem_minmax(0,1fr)]"
            >
              <div className="pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                {group.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.goals.map((phase) => (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => toggleGoal(phase)}
                    className={cn(
                      'pill-control pill-control-compact border transition-colors focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
                      value.goals.includes(phase)
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border bg-card/70 text-muted-foreground hover:bg-accent/60 hover:text-foreground active:bg-accent/80',
                    )}
                  >
                    {phase}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Standard options
        </label>
        <div className="rounded-[18px] border border-border/80 bg-card/30 px-3 py-2.5">
          {MAVEN_OPTION_GROUPS.map((group) => (
            <div
              key={group.label}
              className="grid gap-2 border-b border-border/60 py-2 last:border-b-0 last:pb-0 first:pt-0 sm:grid-cols-[5.25rem_minmax(0,1fr)]"
            >
              <span className="pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                {group.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((optionKey) => {
                  const option = MAVEN_OPTIONS.find((candidate) => candidate.key === optionKey)!;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => toggleOption(option.key)}
                      className={cn(
                        'pill-control pill-control-compact border transition-colors focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
                      value.optionKeys.includes(option.key)
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border bg-card/70 text-muted-foreground hover:bg-accent/60 hover:text-foreground active:bg-accent/80',
                      )}
                    >
                      {option.flag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {profileOptions.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Profiles
          </label>
          <div className="rounded-[18px] border border-border/80 bg-card/30 px-3 py-2.5">
            {profileOptions.map((profile) => {
              const currentState = value.profileStates[profile.id] ?? 'default';
              return (
                <div
                  key={`${profile.id}:${profile.sourceModulePath}`}
                  className="grid gap-2 border-b border-border/60 py-2 last:border-b-0 last:pb-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_10rem]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{profile.id}</span>
                      {profile.activeByDefault && (
                        <span className="pill-meta rounded-full bg-warning/10 text-warning">default-on</span>
                      )}
                    </div>
                    {profile.sourceModulePath && (
                      <div className="mt-1 truncate text-[11px] font-mono text-muted-foreground">
                        {profile.sourceModulePath}
                      </div>
                    )}
                  </div>
                  <div className="profile-state-switch self-start sm:self-center">
                    {([
                      { value: 'default', label: 'Auto' },
                      { value: 'enabled', label: 'On' },
                      { value: 'disabled', label: 'Off' },
                    ] as const).map((state) => (
                      <button
                        key={state.value}
                        type="button"
                        aria-pressed={currentState === state.value}
                        onClick={() =>
                          update('profileStates', {
                            ...value.profileStates,
                            [profile.id]: state.value,
                          })
                        }
                        className={cn(
                          'profile-state-switch-button',
                          `is-${state.value}`,
                          currentState === state.value && 'is-active',
                        )}
                      >
                        {state.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <TagInput
            label="Extra options"
            value={value.extraOptions}
            onChange={(nextOptions) => update('extraOptions', nextOptions)}
            placeholder="e.g. -T4"
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground/72">
            Type an option and press <kbd className="rounded border border-border px-1 font-mono text-[10px]">Enter</kbd> to add it.
          </p>
        </div>

        {jdkVersions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              JAVA_HOME override
            </label>
            <Select value={value.javaVersion} onValueChange={(nextValue) => update('javaVersion', String(nextValue ?? ''))}>
              <SelectTrigger>
                <SelectValue placeholder="System default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">System default</SelectItem>
                {jdkVersions.map((version) => (
                  <SelectItem key={version} value={version}>
                    Java {version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-relaxed text-muted-foreground/72">
              Only registered JDKs can be used to set <span className="font-mono">JAVA_HOME</span> for a Maven run.
            </p>
          </div>
        ) : null}

        <div className={cn('flex flex-col gap-2', jdkVersions.length === 0 && 'lg:col-span-2')}>
          <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Execution mode
          </label>
          <div className="segmented-control w-fit">
            {(['internal', 'external'] as const).map((mode) => {
              const button = (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={value.executionMode === mode}
                  onClick={() => update('executionMode', mode)}
                  className={cn('segmented-control-button', value.executionMode === mode && 'is-active')}
                >
                  {mode === 'internal' ? 'In app' : 'External terminal'}
                </button>
              );

              return mode === 'external' ? (
                <Tooltip
                  key={mode}
                  content="Fire-and-forget. GFOS Build launches a new terminal window and continues immediately."
                  side="top"
                >
                  {button}
                </Tooltip>
              ) : button;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetadataBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-border bg-secondary/60 px-4 py-3 text-xs text-muted-foreground">
      {label}: <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

function ModulePicker({
  modules,
  value,
  strategy,
  onChange,
  onStrategyChange,
}: {
  modules: MavenModuleMetadata[];
  value: string;
  strategy: MavenSubmoduleBuildStrategy;
  onChange: (nextValue: string) => void;
  onStrategyChange: (nextStrategy: MavenSubmoduleBuildStrategy) => void;
}) {
  const options = useMemo(
    () => [
      {
        value: '',
        label: 'Project root',
        description: 'Run from the broader Maven project',
        keywords: ['root', 'project'],
      },
      ...modules.map((moduleEntry) => ({
        value: moduleEntry.relativePath,
        label: moduleEntry.relativePath,
        description: moduleEntry.id,
        keywords: [moduleEntry.id, moduleEntry.name, moduleEntry.relativePath],
      })),
    ],
    [modules],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Submodule
      </label>
      <ComboboxField
        value={value}
        options={options}
        onValueChange={onChange}
        placeholder="Search a module or leave empty for the full project"
        emptyText="No matching modules"
      />
      {value ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onStrategyChange('root-pl')}
              className={cn(
                'pill-control pill-control-compact border transition-colors focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
                strategy === 'root-pl'
                  ? 'border-primary/20 bg-primary/10 text-primary'
                  : 'border-border bg-card/70 text-muted-foreground hover:bg-accent/60 hover:text-foreground active:bg-accent/80',
              )}
            >
              Root with <span className="font-mono">-pl</span>
            </button>
            <button
              type="button"
              onClick={() => onStrategyChange('submodule-dir')}
              className={cn(
                'pill-control pill-control-compact border transition-colors focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
                strategy === 'submodule-dir'
                  ? 'border-primary/20 bg-primary/10 text-primary'
                  : 'border-border bg-card/70 text-muted-foreground hover:bg-accent/60 hover:text-foreground active:bg-accent/80',
              )}
            >
              Submodule directory
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground/72">
            {strategy === 'submodule-dir'
              ? <>Maven runs directly inside <span className="font-mono">{value}</span>.</>
              : <>Maven runs from the project root with <span className="font-mono">-pl {value}</span>.</>}
          </p>
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground/72">
          Select a submodule to scope the build.
        </p>
      )}
    </div>
  );
}
