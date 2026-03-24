import { createFileRoute, useBlocker } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, useRef } from 'react';
import { configQuery, useSaveConfig } from '@/api/queries';
import { pickDirectory, pickFile } from '@/api/bridge';
import { JdkRegistryFields, type JdkRegistryEntry } from '@/components/JdkRegistryFields';
import { MAVEN_OPTIONS } from '@/components/MavenCommandFields';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input, NumberField } from '@/components/ui/input';
import { TagInput } from '@/components/ui/tag-input';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Settings, Plus, Trash2, FolderOpen, Save, Loader2, CheckCircle2, AlertCircle, Database, Server, Wrench, Play } from 'lucide-react';
import type { JrebelAgentKind, MavenOptionKey, WildFlyCleanupPreset, WildFlyCleanupTarget, WildFlyEnvironmentConfig, WildFlyStartupPreset } from '@gfos-build/contracts';
import {
  getStoredThemePreference,
  setStoredThemePreference,
  type ThemePreference,
} from '@/lib/theme';
import { openOnboarding } from '@/lib/onboarding';

export const Route = createFileRoute('/settings/')({
  component: SettingsView,
});

interface KvEntry {
  key: string;
  value: string;
}

type SettingsErrorMap = Record<string, string>;

function getSettingsFieldId(path: string) {
  return `settings-field-${path.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeStringList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeWildFlyEnvironments(environments: Record<string, WildFlyEnvironmentConfig>) {
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

function validateSettings({
  wildflyEnvironments,
}: {
  wildflyEnvironments: Record<string, WildFlyEnvironmentConfig>;
}): SettingsErrorMap {
  const errors: SettingsErrorMap = {};

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

function deriveLocalStatePaths(configPath: string): {
  stateRoot: string | null;
  stateDbPath: string | null;
  cacheDir: string | null;
} {
  const match = configPath.match(/^(.*?)([\\/])config\2settings\.json$/i);
  if (!match) {
    return { stateRoot: null, stateDbPath: null, cacheDir: null };
  }

  const stateRoot = match[1] ?? null;
  const separator = match[2] ?? '\\';
  if (!stateRoot) {
    return { stateRoot: null, stateDbPath: null, cacheDir: null };
  }

  return {
    stateRoot,
    stateDbPath: `${stateRoot}${separator}data${separator}state.sqlite`,
    cacheDir: `${stateRoot}${separator}cache`,
  };
}

function createConfigPayload({
  mavenExec,
  mavenGoals,
  mavenOptionKeys,
  mavenExtraOptions,
  nodeExecutables,
  jdkEntries,
  rootEntries,
  includeHidden,
  excludePatterns,
  wildflyEnvironments,
}: {
  mavenExec: string;
  mavenGoals: string[];
  mavenOptionKeys: MavenOptionKey[];
  mavenExtraOptions: string[];
  nodeExecutables: { npm: string; pnpm: string; bun: string };
  jdkEntries: JdkRegistryEntry[];
  rootEntries: KvEntry[];
  includeHidden: boolean;
  excludePatterns: string[];
  wildflyEnvironments: Record<string, WildFlyEnvironmentConfig>;
}) {
  return {
    maven: {
      executable: mavenExec,
      defaultGoals: mavenGoals,
      defaultOptionKeys: mavenOptionKeys,
      defaultExtraOptions: mavenExtraOptions,
    },
    node: {
      executables: nodeExecutables,
    },
    jdkRegistry: Object.fromEntries(
      jdkEntries
        .filter((entry) => entry.version.trim())
        .map((entry) => [entry.version.trim(), entry.path]),
    ),
    roots: Object.fromEntries(
      rootEntries
        .filter((entry) => entry.key.trim())
        .map((entry) => [entry.key.trim(), entry.value]),
    ),
    scan: {
      includeHidden,
      exclude: excludePatterns,
    },
    wildfly: {
      environments: normalizeWildFlyEnvironments(wildflyEnvironments),
    },
  };
}

function SettingsView() {
  const canReopenOnboarding = import.meta.env.DEV;
  const queryClient = useQueryClient();
  const { data: configData, isLoading } = useQuery(configQuery);
  const saveConfig = useSaveConfig();

  const [mavenExec, setMavenExec] = useState('');
  const [mavenGoals, setMavenGoals] = useState<string[]>([]);
  const [mavenOptionKeys, setMavenOptionKeys] = useState<MavenOptionKey[]>([]);
  const [mavenExtraOptions, setMavenExtraOptions] = useState<string[]>([]);
  const [nodeExecutables, setNodeExecutables] = useState({ npm: 'npm', pnpm: 'pnpm', bun: 'bun' });
  const [jdkEntries, setJdkEntries] = useState<JdkRegistryEntry[]>([]);
  const [rootEntries, setRootEntries] = useState<KvEntry[]>([]);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [excludePatterns, setExcludePatterns] = useState<string[]>([]);
  const [wildflyEnvironments, setWildflyEnvironments] = useState<Record<string, WildFlyEnvironmentConfig>>({});
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [baselineSnapshot, setBaselineSnapshot] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSavingIndicator, setShowSavingIndicator] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [validationFocusKey, setValidationFocusKey] = useState<string | null>(null);
  const savingIndicatorTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!configData) return;
    const { config } = configData;
    const nextMavenExec = config.maven.executable;
    const nextMavenGoals = config.maven.defaultGoals;
    const nextMavenOptionKeys = config.maven.defaultOptionKeys;
    const nextMavenExtraOptions = config.maven.defaultExtraOptions;
    const nextNodeExecutables = config.node.executables;
    const nextJdkEntries = Object.entries(config.jdkRegistry).map(([key, value]) => ({
      version: key,
      path: value,
      source: 'manual' as const,
    }));
    const nextRootEntries = Object.entries(config.roots).map(([key, value]) => ({ key, value }));
    const nextIncludeHidden = config.scan.includeHidden;
    const nextExcludePatterns = config.scan.exclude;
    const nextWildflyEnvironments = config.wildfly.environments;

    setMavenExec(nextMavenExec);
    setMavenGoals(nextMavenGoals);
    setMavenOptionKeys(nextMavenOptionKeys);
    setMavenExtraOptions(nextMavenExtraOptions);
    setNodeExecutables(nextNodeExecutables);
    setJdkEntries(nextJdkEntries);
    setRootEntries(nextRootEntries);
    setIncludeHidden(nextIncludeHidden);
    setExcludePatterns(nextExcludePatterns);
    setWildflyEnvironments(nextWildflyEnvironments);
    setBaselineSnapshot(
      JSON.stringify(
        createConfigPayload({
          mavenExec: nextMavenExec,
          mavenGoals: nextMavenGoals,
          mavenOptionKeys: nextMavenOptionKeys,
          mavenExtraOptions: nextMavenExtraOptions,
          nodeExecutables: nextNodeExecutables,
          jdkEntries: nextJdkEntries,
          rootEntries: nextRootEntries,
          includeHidden: nextIncludeHidden,
          excludePatterns: nextExcludePatterns,
          wildflyEnvironments: nextWildflyEnvironments,
        }),
      ),
    );
    setThemePreference(getStoredThemePreference());
  }, [configData]);

  const currentPayload = useMemo(
    () =>
      createConfigPayload({
        mavenExec,
        mavenGoals,
        mavenOptionKeys,
        mavenExtraOptions,
        nodeExecutables,
        jdkEntries,
        rootEntries,
        includeHidden,
        excludePatterns,
        wildflyEnvironments,
      }),
    [
      mavenExec,
      mavenGoals,
      mavenOptionKeys,
      mavenExtraOptions,
      nodeExecutables,
      jdkEntries,
      rootEntries,
      includeHidden,
      excludePatterns,
      wildflyEnvironments,
    ],
  );
  const currentSnapshot = useMemo(() => JSON.stringify(currentPayload), [currentPayload]);
  const isDirty = baselineSnapshot !== '' && currentSnapshot !== baselineSnapshot;
  const validationErrors = useMemo(
    () =>
      validateSettings({
        wildflyEnvironments,
      }),
    [wildflyEnvironments],
  );
  const localStatePaths = useMemo(
    () => deriveLocalStatePaths(configData?.configPath ?? ''),
    [configData?.configPath],
  );
  const leaveBlocker = useBlocker({
    shouldBlockFn: () => isDirty && saveState !== 'saving',
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  });

  useEffect(() => {
    if ((saveState === 'saved' || saveState === 'error') && isDirty) {
      setSaveState('idle');
      setSaveError(null);
    }
  }, [isDirty, saveState]);

  useEffect(() => {
    if (!validationFocusKey) return;
    const target = document.getElementById(getSettingsFieldId(validationFocusKey));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if ('focus' in target && typeof target.focus === 'function') {
        target.focus();
      }
    }
    setValidationFocusKey(null);
  }, [validationFocusKey]);

  useEffect(() => {
    if (savingIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(savingIndicatorTimeoutRef.current);
      savingIndicatorTimeoutRef.current = null;
    }

    if (saveState === 'saving') {
      setShowSavingIndicator(false);
      savingIndicatorTimeoutRef.current = window.setTimeout(() => {
        setShowSavingIndicator(true);
      }, 180);
      return () => {
        if (savingIndicatorTimeoutRef.current !== null) {
          window.clearTimeout(savingIndicatorTimeoutRef.current);
          savingIndicatorTimeoutRef.current = null;
        }
      };
    }

    setShowSavingIndicator(false);
    return undefined;
  }, [saveState]);

  useEffect(() => {
    if (saveState !== 'saved' || isDirty) return;
    const timeout = window.setTimeout(() => {
      setSaveState('idle');
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [saveState, isDirty]);

  async function handleSave() {
    if (!isDirty) return true;
    if (Object.keys(validationErrors).length > 0) {
      const firstErrorKey = Object.keys(validationErrors)[0] ?? null;
      setShowValidationErrors(true);
      setSaveState('error');
      setSaveError('Fix the highlighted settings before saving.');
      setValidationFocusKey(firstErrorKey);
      return false;
    }
    setSaveState('saving');
    setSaveError(null);
    try {
      await saveConfig.mutateAsync(currentPayload);
      void queryClient.invalidateQueries({ queryKey: ['config'] });
      setBaselineSnapshot(currentSnapshot);
      setSaveState('saved');
      return true;
    } catch (error) {
      setSaveState('error');
      setSaveError(
        error instanceof Error
          ? error.message.replace(/^POST \/api\/config failed:\s*/, 'Save failed: ')
          : 'Save failed. Try again.',
      );
      return false;
    }
  }

  function addRoot() {
    setRootEntries((prev) => [...prev, { key: '', value: '' }]);
  }
  function removeRoot(index: number) {
    setRootEntries((prev) => prev.filter((_, i) => i !== index));
  }
  function updateRoot(index: number, field: 'key' | 'value', value: string) {
    setRootEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  }
  async function browseRoot(index: number) {
    const dir = await pickDirectory();
    if (dir) updateRoot(index, 'value', dir);
  }

  if (isLoading) {
    return (
      <div className="glass-card mx-auto flex w-full max-w-5xl items-center gap-3 rounded-[24px] border border-border px-5 py-4 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        Loading configuration...
      </div>
    );
  }

  const saveStatus =
    saveState === 'saving' && showSavingIndicator
      ? {
          tone: 'text-primary',
          icon: <Loader2 size={12} className="animate-spin" />,
          text: 'Applying changes...',
        }
      : saveState === 'error'
        ? {
            tone: 'text-destructive',
            icon: <AlertCircle size={12} />,
            text: saveError ?? 'Save failed. Try again.',
          }
      : saveState === 'saved' && !isDirty
        ? {
            tone: 'text-success',
            icon: <CheckCircle2 size={12} />,
            text: 'Changes applied',
          }
        : isDirty
          ? {
              tone: 'text-warning',
              icon: <div className="h-1.5 w-1.5 rounded-full bg-warning" />,
              text: 'Unsaved changes',
            }
          : null;

  return (
    <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-[1.6rem] font-semibold leading-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage local executables, roots, scan behavior, and appearance.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canReopenOnboarding ? (
              <Button variant="outline" onClick={openOnboarding}>
                Open onboarding
              </Button>
            ) : null}
            <Button
              variant="default"
              onClick={() => void handleSave()}
              disabled={saveState === 'saving' || !isDirty}
              className={cn(
                'min-w-[10.75rem] justify-center disabled:opacity-100',
                !isDirty && saveState !== 'saving'
                  ? 'bg-primary/16 text-primary shadow-none hover:bg-primary/16 active:bg-primary/16'
                  : undefined,
              )}
            >
              <Save size={14} />
              Save changes
            </Button>
          </div>
          <div
            className={cn(
              'flex min-h-4 items-center gap-1.5 text-[11px] leading-none transition-all duration-200',
              saveStatus ? `${saveStatus.tone} opacity-100` : 'opacity-0',
            )}
          >
            {saveStatus ? (
              <>
                {saveStatus.icon}
                <span>{saveStatus.text}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog
        open={leaveBlocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open && leaveBlocker.status === 'blocked') {
            leaveBlocker.reset();
          }
        }}
      >
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogTitle>Save changes before leaving?</DialogTitle>
          <DialogDescription>
            You have unsaved settings changes. Save them before navigating away, or discard them and continue.
          </DialogDescription>

          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (leaveBlocker.status === 'blocked') leaveBlocker.reset();
              }}
              disabled={saveState === 'saving'}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (leaveBlocker.status === 'blocked') leaveBlocker.proceed();
              }}
              disabled={saveState === 'saving'}
            >
              Discard changes
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                void (async () => {
                  const saved = await handleSave();
                  if (saved && leaveBlocker.status === 'blocked') {
                    leaveBlocker.proceed();
                  }
                })();
              }}
              disabled={saveState === 'saving'}
            >
              {saveState === 'saving' ? 'Saving…' : 'Save and continue'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-6">
        {showValidationErrors && Object.keys(validationErrors).length > 0 ? (
          <div className="rounded-[18px] border border-destructive/35 bg-destructive/8 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-destructive">Some settings still need attention</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  {Object.keys(validationErrors).length} invalid {Object.keys(validationErrors).length === 1 ? 'field' : 'fields'}.
                  {' '}The first issue is: {Object.values(validationErrors)[0]}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setValidationFocusKey(Object.keys(validationErrors)[0] ?? null)}
              >
                Jump to first issue
              </Button>
            </div>
          </div>
        ) : null}

        <section className="flex flex-col gap-3 rounded-[24px] border border-border/70 bg-secondary/10 p-4">
          <div className="border-b border-border/60 pb-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">App</p>
            <p className="mt-1 text-sm text-muted-foreground">Visual preferences and local storage locations for this installation.</p>
          </div>
          <div className="flex flex-col gap-4">
            <ConfigCard
              title="Appearance"
              description="Control how GFOS Build looks on this machine."
              icon={<Settings size={14} className="text-primary" />}
            >
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Theme
                </span>
                <div className="segmented-control w-fit">
                  {(['system', 'light', 'dark'] as const).map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      aria-pressed={themePreference === theme}
                      onClick={() => {
                        setThemePreference(theme);
                        setStoredThemePreference(theme);
                      }}
                      className={cn(
                        'segmented-control-button capitalize',
                        themePreference === theme && 'is-active',
                      )}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  `System` follows the operating system appearance. `Light` and `Dark` override it for this app only.
                </p>
              </div>
            </ConfigCard>

            <ConfigCard
              title="Local state"
              description="GFOS Build stores settings in JSON, durable run data in SQLite, and disposable scan data in cache folders."
              icon={<Database size={14} className="text-primary" />}
            >
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  State root: <span className="font-mono text-foreground">{localStatePaths.stateRoot ?? configData?.configPath}</span>
                </p>
                <p className="text-muted-foreground">
                  Settings file: <span className="font-mono text-foreground">{configData?.configPath}</span>
                </p>
                {localStatePaths.stateDbPath && (
                  <p className="text-muted-foreground">
                    State database: <span className="font-mono text-foreground">{localStatePaths.stateDbPath}</span>
                  </p>
                )}
                {localStatePaths.cacheDir && (
                  <p className="text-muted-foreground">
                    Cache directory: <span className="font-mono text-foreground">{localStatePaths.cacheDir}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Startup recovery offers reset or exit if local state cannot be loaded.
                </p>
              </div>
            </ConfigCard>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[24px] border border-border/70 bg-secondary/10 p-4">
          <div className="border-b border-border/60 pb-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Toolchains</p>
            <p className="mt-1 text-sm text-muted-foreground">Configure the Java, Maven, and Node executables GFOS Build uses when starting runs.</p>
          </div>
          <div className="flex flex-col gap-4">
            <ConfigCard
              title="JDK registry"
              description="Register local Java installations so GFOS Build can pin Maven runs via JAVA_HOME."
              icon={<Database size={14} className="text-primary" />}
            >
              <JdkRegistryFields
                entries={jdkEntries}
                onChange={setJdkEntries}
                emptyMessage="No JDK entries yet. Maven builds can still use the system Java, but detected project Java versions cannot be enforced until you register matching JDKs here."
              />
            </ConfigCard>

            <ConfigCard
              title="Maven"
              description="Preset Maven command settings used for new quick runs and Maven pipeline steps."
              icon={<Wrench size={14} className="text-primary" />}
            >
            <div className="flex flex-col gap-1.5">
              <Input
                id="maven-exec"
                label="Maven executable"
                placeholder="mvn"
                value={mavenExec}
                onChange={(e) => setMavenExec(e.target.value)}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Executable name or absolute path used when GFOS starts Maven builds.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <TagInput
                id="maven-goals"
                label="Default goals"
                value={mavenGoals}
                onChange={setMavenGoals}
                placeholder="e.g. clean"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Pre-filled Maven goals for new quick runs and Maven pipeline steps.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Default standard options
              </span>
              <div className="flex flex-wrap gap-2">
                {MAVEN_OPTIONS.map((option) => {
                  const active = mavenOptionKeys.includes(option.key);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() =>
                        setMavenOptionKeys((current) =>
                          current.includes(option.key)
                            ? current.filter((key) => key !== option.key)
                            : [...current, option.key],
                        )
                      }
                      className={cn(
                        'pill-control border transition-colors focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]',
                        active
                          ? 'border-primary/20 bg-primary/10 text-primary'
                          : 'border-border bg-card/70 text-muted-foreground hover:bg-accent/60 hover:text-foreground active:bg-accent/80',
                      )}
                    >
                      {option.flag}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                These toggles preselect common Maven flags like `-DskipTests` or `-U` for new Maven runs.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <TagInput
                id="maven-extra-options"
                label="Default extra options"
                value={mavenExtraOptions}
                onChange={setMavenExtraOptions}
                placeholder="e.g. -T4"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Optional extra Maven options appended to new runs by default. Type an option and press <kbd className="rounded border border-border px-1 font-mono text-[10px]">Enter</kbd> to add it.
              </p>
            </div>
            </ConfigCard>

            <ConfigCard
              title="Node Package Managers"
              description="Executable overrides used when GFOS Build starts npm, pnpm, or bun scripts."
              icon={<Play size={14} className="text-primary" />}
            >
            <div className="flex flex-col gap-1.5">
              <Input
                id="node-npm-exec"
                label="npm executable"
                placeholder="npm"
                value={nodeExecutables.npm}
                onChange={(e) => setNodeExecutables((current) => ({ ...current, npm: e.target.value }))}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Executable name or absolute path used when GFOS Build runs `npm run ...`.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Input
                id="node-pnpm-exec"
                label="pnpm executable"
                placeholder="pnpm"
                value={nodeExecutables.pnpm}
                onChange={(e) => setNodeExecutables((current) => ({ ...current, pnpm: e.target.value }))}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Executable name or absolute path used when GFOS Build runs `pnpm run ...`.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Input
                id="node-bun-exec"
                label="bun executable"
                placeholder="bun"
                value={nodeExecutables.bun}
                onChange={(e) => setNodeExecutables((current) => ({ ...current, bun: e.target.value }))}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Executable name or absolute path used when GFOS Build runs `bun run ...`.
              </p>
            </div>
            </ConfigCard>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[24px] border border-border/70 bg-secondary/10 p-4">
          <div className="border-b border-border/60 pb-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Discovery</p>
            <p className="mt-1 text-sm text-muted-foreground">Choose where GFOS Build looks for codebases and how aggressively those roots are scanned.</p>
          </div>
          <div className="flex flex-col gap-4">
            <ConfigCard
              title="Project roots"
              description="Choose which top-level folders GFOS scans for Maven and Node projects."
              icon={<FolderOpen size={14} className="text-primary" />}
            >
            {rootEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add root directories to scan for Maven and Node projects.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {rootEntries.map((entry, index) => (
                  <div key={index} className="rounded-[18px] border border-border bg-secondary/45 p-3">
                    <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)_auto_auto]">
                      <Input
                        placeholder="Name"
                        value={entry.key}
                        onChange={(e) => updateRoot(index, 'key', e.target.value)}
                      />
                      <Input
                        placeholder="C:\dev\projects"
                        value={entry.value}
                        onChange={(e) => updateRoot(index, 'value', e.target.value)}
                      />
                      <Tooltip content="Browse" side="bottom">
                        <Button variant="outline" size="icon" onClick={() => void browseRoot(index)} aria-label="Browse root path">
                          <FolderOpen size={14} />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Remove" side="bottom">
                        <Button variant="destructive" size="icon" onClick={() => removeRoot(index)} aria-label="Remove root entry">
                          <Trash2 size={14} />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={addRoot}>
              <Plus size={13} />
              Add root
            </Button>
            </ConfigCard>

            <ConfigCard
              title="Scan settings"
              description="Define what GFOS scans inside your configured roots and what it skips."
              icon={<Settings size={14} className="text-primary" />}
            >
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Include hidden directories
              </span>
              <div className="segmented-control w-fit">
                <button
                  type="button"
                  aria-pressed={includeHidden}
                  onClick={() => setIncludeHidden(true)}
                  className={cn(
                    'segmented-control-button',
                    includeHidden && 'is-active',
                  )}
                >
                  Yes
                </button>
                <button
                  type="button"
                  aria-pressed={!includeHidden}
                  onClick={() => setIncludeHidden(false)}
                  className={cn(
                    'segmented-control-button',
                    !includeHidden && 'is-active',
                  )}
                >
                  No
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Includes folders like `.git`, `.next`, or other hidden directories during project discovery.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <TagInput
                id="exclude-patterns"
                label="Exclude patterns"
                value={excludePatterns}
                onChange={setExcludePatterns}
                placeholder="e.g. target"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Directory names that should always be ignored while scanning project roots.
              </p>
            </div>
            </ConfigCard>
          </div>
        </section>

      </div>
    </div>
  );
}

function ConfigCard({
  title,
  description,
  icon,
  iconVariant = 'default',
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  iconVariant?: 'default' | 'accent';
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex items-start gap-2">
          <div
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              iconVariant === 'accent' ? 'icon-chip-accent' : 'icon-chip',
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1 max-w-[42rem] text-xs text-muted-foreground/75">
                {description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function SettingHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-muted-foreground/72">{children}</p>;
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
    if (directory) {
      onChange(directory);
    }
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
    if (filePath) {
      onChange(filePath);
    }
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

function WildFlySettingsEditor({
  value,
  errors,
  selectedName,
  onSelectedNameChange,
  onChange,
}: {
  value: Record<string, WildFlyEnvironmentConfig>;
  errors: SettingsErrorMap;
  selectedName: string | null;
  onSelectedNameChange: (name: string | null) => void;
  onChange: (value: Record<string, WildFlyEnvironmentConfig>) => void;
}) {
  const environmentEntries = Object.entries(value);
  const activeName = selectedName && value[selectedName] ? selectedName : environmentEntries[0]?.[0] ?? null;
  const activeEnvironment = activeName ? value[activeName] : null;
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (activeName !== selectedName) {
      onSelectedNameChange(activeName);
    }
  }, [activeName, selectedName, onSelectedNameChange]);

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
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Create one environment to store the local WildFly paths, standalone profiles, cleanup presets, and startup presets used by deployment workflows.
              </p>
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
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Environments</p>
                <p className="mt-1 text-xs text-muted-foreground">{environmentEntries.length} configured</p>
              </div>
              <Button variant="outline" size="sm" onClick={addEnvironment}>
                <Plus size={13} />
                Add
              </Button>
            </div>
            <div className="flex max-h-[42rem] flex-col gap-2 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
              {environmentEntries.map(([name, environment]) => {
                const isActive = name === activeName;
                return (
                  <div
                    key={name}
                    className={cn(
                      'rounded-[18px] border transition-colors',
                      isActive
                        ? 'border-primary/30 bg-primary/10'
                        : 'border-border bg-secondary/20 hover:bg-accent/40',
                    )}
                  >
                    <div className="flex items-start gap-2 p-2">
                      <button
                        type="button"
                        onClick={() => onSelectedNameChange(name)}
                        className="flex min-w-0 flex-1 flex-col px-2 py-1 text-left focus-visible:outline-none"
                      >
                        <div className="text-sm font-medium text-foreground">{name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{environment.baseDir || 'Base directory not set'}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
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
          <div className="flex flex-col gap-4 rounded-[22px] border border-border bg-secondary/18 p-4">
            <div className="flex items-start gap-3">
              <div>
                <p className="text-base font-semibold text-foreground">{activeName}</p>
                <p className="mt-1 text-sm text-muted-foreground">Edit the environment paths first, then add the profiles and presets used by deployment workflows.</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Input label="Environment name" defaultValue={activeName} onBlur={(event) => renameEnvironment(activeName, event.target.value)} />
              <DirectoryInput
                label="Default JAVA_HOME"
                placeholder="Optional environment-specific JAVA_HOME"
                value={activeEnvironment.javaHome ?? ''}
                onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, javaHome: next }))}
              />
              <div className="flex flex-col gap-1.5">
                <DirectoryInput
                  id={getSettingsFieldId(`wildfly.environments.${activeName}.homeDir`)}
                  label="WildFly home directory"
                  placeholder="C:\wildfly\wildfly-35"
                  value={activeEnvironment.homeDir}
                  error={errors[`wildfly.environments.${activeName}.homeDir`]}
                  onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, homeDir: next }))}
                />
                <SettingHint>Root directory of the WildFly installation. GFOS uses this to derive default `bin`, CLI, and startup script locations.</SettingHint>
              </div>
              <div className="flex flex-col gap-1.5">
                <DirectoryInput
                  id={getSettingsFieldId(`wildfly.environments.${activeName}.baseDir`)}
                  label="WildFly base directory"
                  placeholder="C:\wildfly\standalone-dev"
                  value={activeEnvironment.baseDir}
                  error={errors[`wildfly.environments.${activeName}.baseDir`]}
                  onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, baseDir: next }))}
                />
                <SettingHint>Server instance directory that contains runtime folders like `configuration`, `deployments`, `log`, and `tmp`.</SettingHint>
              </div>
              <DirectoryInput
                label="Configuration directory"
                placeholder="Optional override for configuration directory"
                value={activeEnvironment.configDir ?? ''}
                onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, configDir: next }))}
              />
              <DirectoryInput
                label="Deployments directory"
                placeholder="Optional override for deployments directory"
                value={activeEnvironment.deploymentsDir ?? ''}
                onChange={(next) => updateEnvironment(activeName, (env) => ({ ...env, deploymentsDir: next }))}
              />
              <div className="flex flex-col gap-1.5">
                <FilePathInput
                  id={getSettingsFieldId(`wildfly.environments.${activeName}.cliScript`)}
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
                  id={getSettingsFieldId(`wildfly.environments.${activeName}.startupScript`)}
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

void WildFlySettingsEditor;

function WildFlyStandaloneProfilesEditor({
  value,
  environmentName,
  errors,
  onChange,
}: {
  value: WildFlyEnvironmentConfig['standaloneProfiles'];
  environmentName: string;
  errors: SettingsErrorMap;
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
    <div className="flex flex-col gap-3 rounded-[20px] border border-border/70 bg-card/30 p-4">
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
          <div key={name} className="rounded-[18px] border border-border bg-secondary/20 p-4">
            <RecordEntryHeader title={name} subtitle={profile.serverConfigPath || 'Server config path not set'} onRemove={() => removeProfile(name)} />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Input label="Profile name" defaultValue={name} onBlur={(event) => renameProfile(name, event.target.value)} />
              <FilePathInput
                id={getSettingsFieldId(`wildfly.environments.${environmentName}.standaloneProfiles.${name}.serverConfigPath`)}
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
    <div className="flex flex-col gap-3 rounded-[20px] border border-border/70 bg-card/30 p-4">
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
          <div key={name} className="rounded-[18px] border border-border bg-secondary/20 p-4">
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
  onChange,
}: {
  value: WildFlyEnvironmentConfig['startupPresets'];
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
    <div className="flex flex-col gap-3 rounded-[20px] border border-border/70 bg-card/30 p-4">
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
          <div key={name} className="rounded-[18px] border border-border bg-secondary/20 p-4">
            <RecordEntryHeader
              title={name}
              subtitle={`${preset.programArgs.length} program args · ${preset.javaOpts.length} JVM opts`}
              onRemove={() => removePreset(name)}
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Input label="Preset name" defaultValue={name} onBlur={(event) => renamePreset(name, event.target.value)} />
              <Input
                label="JAVA_HOME override"
                placeholder="Optional JAVA_HOME for this preset"
                value={preset.javaHome ?? ''}
                onChange={(event) => updatePreset(name, (current) => ({ ...current, javaHome: event.target.value }))}
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
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-[16px] border border-border/70 bg-card/40 p-3">
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

              <div className="flex flex-col gap-2 rounded-[16px] border border-border/70 bg-card/40 p-3">
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
                  placeholder="C:\jrebel\lib\jrebel.jar"
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
