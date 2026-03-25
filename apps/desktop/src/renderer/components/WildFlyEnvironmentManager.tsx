import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { configQuery } from '@/api/queries';
import { pickDirectory, pickFile } from '@/api/bridge';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Button } from '@/components/ui/button';
import { Input, NumberField } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { FolderOpen, Play, Plus, Server, Trash2, Wrench } from 'lucide-react';
import type {
  JrebelAgentKind,
  WildFlyCleanupPreset,
  WildFlyCleanupTarget,
  WildFlyEnvironmentConfig,
  WildFlyStartupPreset,
} from '@gfos-build/contracts';

export type WildFlyValidationErrors = Record<string, string>;

function getWildFlyFieldId(path: string) {
  return `wildfly-field-${path.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeStringList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function normalizeWildFlyEnvironments(environments: Record<string, WildFlyEnvironmentConfig>) {
  return Object.fromEntries(
    Object.entries(environments).map(([name, environment]) => [
      name,
      {
        homeDir: environment.homeDir.trim(),
        baseDir: environment.baseDir.trim(),
        configDir: normalizeOptionalText(environment.configDir),
        deploymentsDir: normalizeOptionalText(environment.deploymentsDir),
        cliScript: normalizeOptionalText(environment.cliScript),
        startupScript: normalizeOptionalText(environment.startupScript),
        javaHome: normalizeOptionalText(environment.javaHome),
        standaloneProfiles: Object.fromEntries(
          Object.entries(environment.standaloneProfiles).map(([profileName, profile]) => [
            profileName,
            {
              serverConfigPath: profile.serverConfigPath.trim(),
              materializeToStandaloneXml: Boolean(profile.materializeToStandaloneXml),
            },
          ]),
        ),
        cleanupPresets: Object.fromEntries(
          Object.entries(environment.cleanupPresets).map(([presetName, preset]) => [
            presetName,
            {
              removePreviousDeployment: preset.removePreviousDeployment,
              removeMarkerFiles: preset.removeMarkerFiles,
              clearBaseSubdirs: preset.clearBaseSubdirs,
              extraRelativePaths: normalizeStringList(preset.extraRelativePaths),
            },
          ]),
        ),
        startupPresets: Object.fromEntries(
          Object.entries(environment.startupPresets).map(([presetName, preset]) => [
            presetName,
            {
              javaHome: normalizeOptionalText(preset.javaHome),
              javaOpts: normalizeStringList(preset.javaOpts),
              programArgs: normalizeStringList(preset.programArgs),
              debugEnabled: preset.debugEnabled,
              debugHost: preset.debugHost.trim() || '127.0.0.1',
              debugPort: preset.debugPort,
              debugSuspend: preset.debugSuspend,
              jrebelEnabled: preset.jrebelEnabled,
              jrebelAgentKind: preset.jrebelAgentKind,
              jrebelAgentPath: normalizeOptionalText(preset.jrebelAgentPath),
              jrebelArgs: normalizeStringList(preset.jrebelArgs),
            },
          ]),
        ),
      } satisfies WildFlyEnvironmentConfig,
    ]),
  );
}

export function validateWildFlyEnvironments(wildflyEnvironments: Record<string, WildFlyEnvironmentConfig>): WildFlyValidationErrors {
  const errors: WildFlyValidationErrors = {};

  for (const [environmentName, environment] of Object.entries(wildflyEnvironments)) {
    if (!environment.homeDir.trim()) {
      errors[`wildfly.environments.${environmentName}.homeDir`] = 'WildFly home directory is required.';
    }
    if (!environment.baseDir.trim()) {
      errors[`wildfly.environments.${environmentName}.baseDir`] = 'WildFly base directory is required.';
    }

    for (const [profileName, profile] of Object.entries(environment.standaloneProfiles)) {
      if (!profile.serverConfigPath.trim()) {
        errors[`wildfly.environments.${environmentName}.standaloneProfiles.${profileName}.serverConfigPath`] =
          'Server config path is required.';
      }
    }
  }

  return errors;
}

const WILDFLY_CLEANUP_TARGETS: WildFlyCleanupTarget[] = ['tmp', 'log', 'data', 'data/content'];

function createEmptyWildFlyEnvironment(): WildFlyEnvironmentConfig {
  return {
    homeDir: '',
    baseDir: '',
    configDir: '',
    deploymentsDir: '',
    cliScript: '',
    startupScript: '',
    javaHome: '',
    standaloneProfiles: {},
    cleanupPresets: {},
    startupPresets: {},
  };
}

function createEmptyCleanupPreset(): WildFlyCleanupPreset {
  return {
    removePreviousDeployment: true,
    removeMarkerFiles: true,
    clearBaseSubdirs: [],
    extraRelativePaths: [],
  };
}

function createEmptyStartupPreset(): WildFlyStartupPreset {
  return {
    javaHome: '',
    javaOpts: [],
    programArgs: [],
    debugEnabled: false,
    debugHost: '127.0.0.1',
    debugPort: 8787,
    debugSuspend: false,
    jrebelEnabled: false,
    jrebelAgentKind: 'javaagent',
    jrebelAgentPath: '',
    jrebelArgs: [],
  };
}

function SettingHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-muted-foreground/72">{children}</p>;
}

function BooleanChoice({
  value,
  onChange,
  trueLabel = 'Yes',
  falseLabel = 'No',
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return (
    <div className="segmented-control w-fit">
      <button type="button" aria-pressed={value} onClick={() => onChange(true)} className={cn('segmented-control-button', value && 'is-active')}>
        {trueLabel}
      </button>
      <button type="button" aria-pressed={!value} onClick={() => onChange(false)} className={cn('segmented-control-button', !value && 'is-active')}>
        {falseLabel}
      </button>
    </div>
  );
}

function DirectoryInput({
  id,
  label,
  value,
  placeholder,
  error,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  async function handleBrowse() {
    const directory = await pickDirectory();
    if (directory) onChange(directory);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input id={id} placeholder={placeholder} value={value} error={error} onChange={(event) => onChange(event.target.value)} />
        <Tooltip content="Browse directory" side="bottom">
          <Button variant="outline" size="icon" onClick={() => void handleBrowse()} aria-label={`Browse ${label}`}>
            <FolderOpen size={14} />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

function FilePathInput({
  id,
  label,
  value,
  placeholder,
  error,
  pickerTitle,
  pickerFilters,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  pickerTitle?: string;
  pickerFilters?: Array<{ name: string; extensions: string[] }>;
  onChange: (value: string) => void;
}) {
  async function handleBrowse() {
    const filePath = await pickFile({ title: pickerTitle, filters: pickerFilters });
    if (filePath) onChange(filePath);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input id={id} placeholder={placeholder} value={value} error={error} onChange={(event) => onChange(event.target.value)} />
        <Tooltip content="Browse file" side="bottom">
          <Button variant="outline" size="icon" onClick={() => void handleBrowse()} aria-label={`Browse ${label}`}>
            <FolderOpen size={14} />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

function JavaHomeField({
  label,
  value,
  placeholder,
  jdkRegistry,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  jdkRegistry: Record<string, string>;
  onChange: (value: string) => void;
  }) {
    const registryEntries = useMemo(
      () =>
        Object.entries(jdkRegistry)
          .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
        .map(([version, path]) => ({
          version,
          path,
          })),
      [jdkRegistry],
    );
    const selectedEntry = registryEntries.find((entry) => entry.path === value);
    const selectValue = selectedEntry?.path ?? '__system__';
    const hasRegisteredJdks = registryEntries.length > 0;
  
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</label>
        <Select
          value={selectValue}
          onValueChange={(nextValue) => {
            const resolvedValue = String(nextValue ?? '__system__');
            onChange(resolvedValue === '__system__' ? '' : resolvedValue);
          }}
        >
          <SelectTrigger disabled={!hasRegisteredJdks}>
            <SelectValue placeholder={placeholder}>
              {() => {
                if (!hasRegisteredJdks) {
                  return 'No JDKs registered';
                }
                if (selectValue === '__system__') {
                  return 'No override';
                }
                return selectedEntry ? `Java ${selectedEntry.version}` : placeholder;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__system__">No override</SelectItem>
            {registryEntries.map((entry) => (
              <SelectItem key={entry.path} value={entry.path}>
                {`Java ${entry.version}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasRegisteredJdks ? (
          <SettingHint>Select a registered JDK from Settings. WildFly startup uses the stored JAVA_HOME path directly.</SettingHint>
        ) : (
          <SettingHint>No JDKs are registered. Add JDK installations in Settings before configuring a JAVA_HOME override here.</SettingHint>
        )}
      </div>
    );
  }

function RecordEntryHeader({
  title,
  subtitle,
  onRemove,
}: {
  title: string;
  subtitle?: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <Tooltip content="Remove" side="bottom">
        <Button variant="destructive" size="icon" onClick={onRemove} aria-label={`Remove ${title}`}>
          <Trash2 size={14} />
        </Button>
      </Tooltip>
    </div>
  );
}

export function WildFlyEnvironmentManager({
  value,
  errors,
  selectedName,
  onSelectedNameChange,
  onChange,
  emptyDescription = 'Create one environment to store the local WildFly paths, standalone profiles, cleanup presets, and startup presets used by deployment flows.',
  editorDescription = 'Edit the environment paths first, then add the profiles and presets used by deployment flows.',
}: {
  value: Record<string, WildFlyEnvironmentConfig>;
  errors: WildFlyValidationErrors;
  selectedName: string | null;
  onSelectedNameChange: (name: string | null) => void;
  onChange: (value: Record<string, WildFlyEnvironmentConfig>) => void;
  emptyDescription?: string;
  editorDescription?: string;
}) {
  const { data: configData } = useQuery(configQuery);
  const jdkRegistry = useMemo(() => configData?.config.jdkRegistry ?? {}, [configData]);
  const environmentEntries = Object.entries(value);
  const activeName = selectedName && value[selectedName] ? selectedName : environmentEntries[0]?.[0] ?? null;
  const activeEnvironment = activeName ? value[activeName] : null;
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (activeName !== selectedName) {
      onSelectedNameChange(activeName);
    }
  }, [activeName, onSelectedNameChange, selectedName]);

  function addEnvironment() {
    const baseName = 'local-wildfly';
    let nextName = baseName;
    let index = 2;
    while (value[nextName]) nextName = `${baseName}-${index++}`;
    onChange({ ...value, [nextName]: createEmptyWildFlyEnvironment() });
    onSelectedNameChange(nextName);
  }

  function removeEnvironment(name: string) {
    const next = { ...value };
    delete next[name];
    onChange(next);
    if (selectedName === name) {
      onSelectedNameChange(Object.keys(next)[0] ?? null);
    }
  }

  function renameEnvironment(previousName: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === previousName || value[trimmed]) return;
    const next: Record<string, WildFlyEnvironmentConfig> = {};
    for (const [name, config] of Object.entries(value)) {
      next[name === previousName ? trimmed : name] = config;
    }
    onChange(next);
    if (selectedName === previousName) {
      onSelectedNameChange(trimmed);
    }
  }

  function updateEnvironment(name: string, updater: (environment: WildFlyEnvironmentConfig) => WildFlyEnvironmentConfig) {
    onChange({
      ...value,
      [name]: updater(value[name]!),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {environmentEntries.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-border bg-secondary/16 px-5 py-8">
          <div className="flex max-w-[36rem] flex-col gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-card/35">
              <Server size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[-0.02em] text-foreground">No WildFly environments yet</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{emptyDescription}</p>
            </div>
            <div>
              <Button variant="default" onClick={addEnvironment}>
                <Plus size={13} />
                Add environment
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Environments</p>
                <p className="mt-1 text-xs text-muted-foreground">{environmentEntries.length} configured</p>
              </div>
              <Button variant="outline" size="sm" onClick={addEnvironment}>
                <Plus size={13} />
                Add environment
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {environmentEntries.map(([name, environment]) => {
                const isActive = name === activeName;
                return (
                  <div
                    key={name}
                    className={cn(
                      'rounded-[18px] border transition-colors',
                      isActive
                        ? 'border-primary/35 bg-primary/10 shadow-[inset_0_0_0_1px_rgba(0,196,255,0.08)]'
                        : 'border-border/80 bg-card/20 hover:bg-accent/30',
                    )}
                  >
                    <div className="flex items-start gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => onSelectedNameChange(name)}
                        className="flex min-w-0 flex-1 flex-col text-left focus-visible:outline-none"
                      >
                        <div className="text-sm font-medium text-foreground">{name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{environment.baseDir || 'Base directory not set'}</div>
                        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          <span className="rounded-full border border-border/70 px-2 py-0.5">{Object.keys(environment.standaloneProfiles).length} profiles</span>
                          <span className="rounded-full border border-border/70 px-2 py-0.5">{Object.keys(environment.cleanupPresets).length} cleanup</span>
                          <span className="rounded-full border border-border/70 px-2 py-0.5">{Object.keys(environment.startupPresets).length} startup</span>
                        </div>
                      </button>
                      <Tooltip content="Delete environment" side="bottom">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(name)}
                          aria-label={`Delete ${name}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {activeEnvironment && activeName ? (
            <div className="flex flex-col gap-6 border-t border-border/60 pt-6">
              <div className="flex items-start gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">{activeName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{editorDescription}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Input label="Environment name" defaultValue={activeName} onBlur={(event) => renameEnvironment(activeName, event.target.value)} />
                <JavaHomeField
                  label="Default JAVA_HOME"
                  placeholder={Object.keys(jdkRegistry).length > 0 ? 'Select a registered JDK' : 'Optional environment-specific JAVA_HOME'}
                  value={activeEnvironment.javaHome ?? ''}
                  jdkRegistry={jdkRegistry}
                  onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, javaHome: next }))}
                />
                <div className="flex flex-col gap-1.5">
                  <DirectoryInput
                    id={getWildFlyFieldId(`wildfly.environments.${activeName}.homeDir`)}
                    label="WildFly home directory"
                    placeholder="C:\\wildfly\\wildfly-35"
                    value={activeEnvironment.homeDir}
                    error={errors[`wildfly.environments.${activeName}.homeDir`]}
                    onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, homeDir: next }))}
                  />
                  <SettingHint>WildFly installation directory. GFOS Build uses this to resolve the default `bin`, CLI, and startup script locations.</SettingHint>
                </div>
                <div className="flex flex-col gap-1.5">
                  <DirectoryInput
                    id={getWildFlyFieldId(`wildfly.environments.${activeName}.baseDir`)}
                    label="WildFly base directory"
                    placeholder="C:\\wildfly\\standalone-dev"
                    value={activeEnvironment.baseDir}
                    error={errors[`wildfly.environments.${activeName}.baseDir`]}
                    onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, baseDir: next }))}
                  />
                  <SettingHint>Server instance directory. In many local setups this is the same as the home directory, but it can also point to a separate instance. `configuration`, `deployments`, `log`, and `tmp` usually live here.</SettingHint>
                </div>
                <div className="flex flex-col gap-1.5">
                  <DirectoryInput
                    label="Configuration directory"
                    placeholder="Usually <baseDir>\\configuration"
                    value={activeEnvironment.configDir ?? ''}
                    onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, configDir: next }))}
                  />
                  <SettingHint>Usually lives directly under the base directory. Only override this if your setup differs.</SettingHint>
                </div>
                <div className="flex flex-col gap-1.5">
                  <DirectoryInput
                    label="Deployments directory"
                    placeholder="Usually <baseDir>\\deployments"
                    value={activeEnvironment.deploymentsDir ?? ''}
                    onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, deploymentsDir: next }))}
                  />
                  <SettingHint>Usually lives directly under the base directory. Override it only when deployments are redirected elsewhere.</SettingHint>
                </div>
                <div className="flex flex-col gap-1.5">
                  <FilePathInput
                    id={getWildFlyFieldId(`wildfly.environments.${activeName}.cliScript`)}
                    label="CLI script"
                    placeholder="Optional override for jboss-cli.bat/sh"
                    value={activeEnvironment.cliScript ?? ''}
                    pickerTitle="Select WildFly CLI script"
                    pickerFilters={[
                      { name: 'Scripts', extensions: ['bat', 'cmd', 'sh'] },
                      { name: 'All files', extensions: ['*'] },
                    ]}
                    onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, cliScript: next }))}
                  />
                  <SettingHint>Optional path to `jboss-cli.bat` or `jboss-cli.sh` when it is not under the default WildFly `bin` directory.</SettingHint>
                </div>
                <div className="flex flex-col gap-1.5">
                  <FilePathInput
                    id={getWildFlyFieldId(`wildfly.environments.${activeName}.startupScript`)}
                    label="Startup script"
                    placeholder="Optional override for standalone.bat/sh"
                    value={activeEnvironment.startupScript ?? ''}
                    pickerTitle="Select WildFly startup script"
                    pickerFilters={[
                      { name: 'Scripts', extensions: ['bat', 'cmd', 'sh'] },
                      { name: 'All files', extensions: ['*'] },
                    ]}
                    onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, startupScript: next }))}
                  />
                  <SettingHint>Optional path to the WildFly startup script when the server should not use the default `standalone.bat` or `standalone.sh` location.</SettingHint>
                </div>
              </div>

              <WildFlyStandaloneProfilesEditor
                value={activeEnvironment.standaloneProfiles}
                environmentName={activeName}
                errors={errors}
                onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, standaloneProfiles: next }))}
              />

              <WildFlyCleanupPresetsEditor
                value={activeEnvironment.cleanupPresets}
                onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, cleanupPresets: next }))}
              />

              <WildFlyStartupPresetsEditor
                value={activeEnvironment.startupPresets}
                jdkRegistry={jdkRegistry}
                onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, startupPresets: next }))}
              />
            </div>
          ) : null}
        </div>
      )}
      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteTarget ? `Delete "${deleteTarget}"?` : 'Delete environment?'}
        description="This WildFly environment and all of its standalone profiles, cleanup presets, and startup presets will be permanently removed."
        confirmLabel="Delete environment"
        confirmVariant="destructive"
        onConfirm={() => {
          if (!deleteTarget) return;
          removeEnvironment(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function WildFlyStandaloneProfilesEditor({
  value,
  environmentName,
  errors,
  onChange,
}: {
  value: WildFlyEnvironmentConfig['standaloneProfiles'];
  environmentName: string;
  errors: WildFlyValidationErrors;
  onChange: (value: WildFlyEnvironmentConfig['standaloneProfiles']) => void;
}) {
  function addProfile() {
    const baseName = 'local-dev';
    let nextName = baseName;
    let index = 2;
    while (value[nextName]) nextName = `${baseName}-${index++}`;
    onChange({
      ...value,
      [nextName]: {
        serverConfigPath: '',
        materializeToStandaloneXml: false,
      },
    });
  }

  function renameProfile(previousName: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === previousName || value[trimmed]) return;
    const next: typeof value = {};
    for (const [name, config] of Object.entries(value)) {
      next[name === previousName ? trimmed : name] = config;
    }
    onChange(next);
  }

  function removeProfile(name: string) {
    const next = { ...value };
    delete next[name];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Standalone profiles</p>
          <p className="mt-1 text-xs text-muted-foreground">Named server configurations used by deployment startup.</p>
        </div>
        <Button variant="outline" size="sm" onClick={addProfile}>
          <Plus size={13} />
          Add profile
        </Button>
      </div>

      {Object.keys(value).length === 0 ? (
        <p className="text-sm text-muted-foreground">No standalone profiles yet.</p>
      ) : (
        Object.entries(value).map(([name, profile]) => (
          <div key={name} className="rounded-[16px] border border-border/70 bg-card/20 p-4">
            <RecordEntryHeader title={name} subtitle={profile.serverConfigPath || 'Server config path not set'} onRemove={() => removeProfile(name)} />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Input label="Profile name" defaultValue={name} onBlur={(event) => renameProfile(name, event.target.value)} />
              <FilePathInput
                id={getWildFlyFieldId(`wildfly.environments.${environmentName}.standaloneProfiles.${name}.serverConfigPath`)}
                label="Server config path"
                placeholder="standalone-local.xml"
                value={profile.serverConfigPath}
                error={errors[`wildfly.environments.${environmentName}.standaloneProfiles.${name}.serverConfigPath`]}
                pickerTitle="Select WildFly standalone configuration"
                pickerFilters={[
                  { name: 'XML files', extensions: ['xml'] },
                  { name: 'All files', extensions: ['*'] },
                ]}
                onChange={(next) => onChange({ ...value, [name]: { ...profile, serverConfigPath: next } })}
              />
            </div>
            <SettingHint>Select the standalone XML file for this profile. This is usually a full WildFly configuration such as `standalone.xml` or `standalone-local.xml`.</SettingHint>
            <div className="mt-4 flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Materialize to standalone.xml</span>
              <BooleanChoice
                value={Boolean(profile.materializeToStandaloneXml)}
                onChange={(next) => onChange({ ...value, [name]: { ...profile, materializeToStandaloneXml: next } })}
              />
              <SettingHint>Copies this profile file to `standalone.xml` before startup. Leave this off when WildFly can be started directly with `--server-config`.</SettingHint>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function WildFlyCleanupPresetsEditor({
  value,
  onChange,
}: {
  value: WildFlyEnvironmentConfig['cleanupPresets'];
  onChange: (value: WildFlyEnvironmentConfig['cleanupPresets']) => void;
}) {
  function addPreset() {
    const baseName = 'standard-clean';
    let nextName = baseName;
    let index = 2;
    while (value[nextName]) nextName = `${baseName}-${index++}`;
    onChange({ ...value, [nextName]: createEmptyCleanupPreset() });
  }

  function renamePreset(previousName: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === previousName || value[trimmed]) return;
    const next: typeof value = {};
    for (const [name, config] of Object.entries(value)) {
      next[name === previousName ? trimmed : name] = config;
    }
    onChange(next);
  }

  function removePreset(name: string) {
    const next = { ...value };
    delete next[name];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Cleanup presets</p>
          <p className="mt-1 text-xs text-muted-foreground">Reusable cleanup rules applied before a deployment.</p>
        </div>
        <Button variant="outline" size="sm" onClick={addPreset}>
          <Plus size={13} />
          Add preset
        </Button>
      </div>

      {Object.keys(value).length === 0 ? (
        <p className="text-sm text-muted-foreground">No cleanup presets yet.</p>
      ) : (
        Object.entries(value).map(([name, preset]) => (
          <div key={name} className="rounded-[16px] border border-border/70 bg-card/20 p-4">
            <RecordEntryHeader
              title={name}
              subtitle={`${preset.clearBaseSubdirs.length} base folders · ${preset.extraRelativePaths.length} extra paths`}
              onRemove={() => removePreset(name)}
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Input label="Preset name" defaultValue={name} onBlur={(event) => renamePreset(name, event.target.value)} />
              <TagInput
                label="Extra relative paths"
                value={preset.extraRelativePaths}
                onChange={(next) => onChange({ ...value, [name]: { ...preset, extraRelativePaths: next } })}
                placeholder="e.g. data/tmp"
              />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Remove previous deployment</span>
                <BooleanChoice
                  value={preset.removePreviousDeployment}
                  onChange={(next) => onChange({ ...value, [name]: { ...preset, removePreviousDeployment: next } })}
                />
                <SettingHint>Deletes the previously deployed archive from the `deployments` directory before copying the new artifact.</SettingHint>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Remove marker files</span>
                <BooleanChoice
                  value={preset.removeMarkerFiles}
                  onChange={(next) => onChange({ ...value, [name]: { ...preset, removeMarkerFiles: next } })}
                />
                <SettingHint>Deletes scanner marker files such as `.deployed`, `.failed`, or `.dodeploy` alongside the deployment artifact.</SettingHint>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Clear base subdirectories</span>
              <div className="flex flex-wrap gap-2">
                {WILDFLY_CLEANUP_TARGETS.map((target) => {
                  const active = preset.clearBaseSubdirs.includes(target);
                  return (
                    <button
                      key={target}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...value,
                          [name]: {
                            ...preset,
                            clearBaseSubdirs: active
                              ? preset.clearBaseSubdirs.filter((entry) => entry !== target)
                              : [...preset.clearBaseSubdirs, target],
                          },
                        })
                      }
                      className={cn(
                        'pill-control border transition-colors focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
                        active
                          ? 'border-primary/20 bg-primary/10 text-primary'
                          : 'border-border bg-card/70 text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                      )}
                    >
                      {target}
                    </button>
                  );
                })}
              </div>
              <SettingHint>Clears selected folders under the WildFly base directory before deployment. Use this carefully because `data` and `tmp` may contain runtime state.</SettingHint>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function WildFlyStartupPresetsEditor({
  value,
  jdkRegistry,
  onChange,
}: {
  value: WildFlyEnvironmentConfig['startupPresets'];
  jdkRegistry: Record<string, string>;
  onChange: (value: WildFlyEnvironmentConfig['startupPresets']) => void;
}) {
  function addPreset() {
    const baseName = 'local-startup';
    let nextName = baseName;
    let index = 2;
    while (value[nextName]) nextName = `${baseName}-${index++}`;
    onChange({ ...value, [nextName]: createEmptyStartupPreset() });
  }

  function renamePreset(previousName: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === previousName || value[trimmed]) return;
    const next: typeof value = {};
    for (const [name, config] of Object.entries(value)) {
      next[name === previousName ? trimmed : name] = config;
    }
    onChange(next);
  }

  function removePreset(name: string) {
    const next = { ...value };
    delete next[name];
    onChange(next);
  }

  function updatePreset(name: string, updater: (preset: WildFlyStartupPreset) => WildFlyStartupPreset) {
    onChange({ ...value, [name]: updater(value[name]!) });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Startup presets</p>
          <p className="mt-1 text-xs text-muted-foreground">Reusable startup arguments, debug, and JRebel defaults.</p>
        </div>
        <Button variant="outline" size="sm" onClick={addPreset}>
          <Plus size={13} />
          Add preset
        </Button>
      </div>

      {Object.keys(value).length === 0 ? (
        <p className="text-sm text-muted-foreground">No startup presets yet.</p>
      ) : (
        Object.entries(value).map(([name, preset]) => (
          <div key={name} className="rounded-[16px] border border-border/70 bg-card/20 p-4">
            <RecordEntryHeader
              title={name}
              subtitle={`${preset.programArgs.length} program args · ${preset.javaOpts.length} JVM opts`}
              onRemove={() => removePreset(name)}
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Input label="Preset name" defaultValue={name} onBlur={(event) => renamePreset(name, event.target.value)} />
              <JavaHomeField
                label="JAVA_HOME override"
                placeholder={Object.keys(jdkRegistry).length > 0 ? 'Select a registered JDK' : 'Optional JAVA_HOME for this preset'}
                value={preset.javaHome ?? ''}
                jdkRegistry={jdkRegistry}
                onChange={(next) => updatePreset(name, (current) => ({ ...current, javaHome: next }))}
              />
              <TagInput
                label="JAVA_OPTS"
                value={preset.javaOpts}
                onChange={(next) => updatePreset(name, (current) => ({ ...current, javaOpts: next }))}
                placeholder="-Xmx2g"
              />
              <TagInput
                label="Program arguments"
                value={preset.programArgs}
                onChange={(next) => updatePreset(name, (current) => ({ ...current, programArgs: next }))}
                placeholder="--admin-only"
              />
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
                <div className="flex items-center gap-2">
                  <Wrench size={14} className="text-primary" />
                  <p className="text-sm font-medium text-foreground">Debug</p>
                </div>
                <BooleanChoice
                  value={preset.debugEnabled}
                  onChange={(next) => updatePreset(name, (current) => ({ ...current, debugEnabled: next }))}
                  trueLabel="Enabled"
                  falseLabel="Disabled"
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <Input
                    label="Host"
                    placeholder="127.0.0.1"
                    value={preset.debugHost}
                    onChange={(event) => updatePreset(name, (current) => ({ ...current, debugHost: event.target.value }))}
                  />
                  <NumberField
                    label="Port"
                    value={preset.debugPort}
                    onChange={(next) => updatePreset(name, (current) => ({ ...current, debugPort: next }))}
                    min={1}
                    max={65535}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Suspend on startup</span>
                  <BooleanChoice
                    value={preset.debugSuspend}
                    onChange={(next) => updatePreset(name, (current) => ({ ...current, debugSuspend: next }))}
                  />
                  <SettingHint>Keeps the JVM waiting for a debugger before the server continues booting. Useful when you need to debug startup code.</SettingHint>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
                <div className="flex items-center gap-2">
                  <Play size={14} className="text-primary" />
                  <p className="text-sm font-medium text-foreground">JRebel</p>
                </div>
                <BooleanChoice
                  value={preset.jrebelEnabled}
                  onChange={(next) => updatePreset(name, (current) => ({ ...current, jrebelEnabled: next }))}
                  trueLabel="Enabled"
                  falseLabel="Disabled"
                />
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Agent kind</span>
                  <div className="segmented-control w-fit">
                    {(['javaagent', 'agentpath'] as JrebelAgentKind[]).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        aria-pressed={preset.jrebelAgentKind === kind}
                        onClick={() => updatePreset(name, (current) => ({ ...current, jrebelAgentKind: kind }))}
                        className={cn('segmented-control-button', preset.jrebelAgentKind === kind && 'is-active')}
                      >
                        {kind}
                      </button>
                    ))}
                  </div>
                  <SettingHint>`javaagent` is the common JAR-based startup mode. `agentpath` is only needed for setups that explicitly require the native agent format.</SettingHint>
                </div>
                <Input
                  label="Agent path"
                  placeholder="C:\\jrebel\\lib\\jrebel.jar"
                  value={preset.jrebelAgentPath ?? ''}
                  onChange={(event) => updatePreset(name, (current) => ({ ...current, jrebelAgentPath: event.target.value }))}
                />
                <TagInput
                  label="Agent arguments"
                  value={preset.jrebelArgs}
                  onChange={(next) => updatePreset(name, (current) => ({ ...current, jrebelArgs: next }))}
                  placeholder="-Drebel.remoting_plugin=true"
                />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
