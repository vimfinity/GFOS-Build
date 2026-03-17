import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, useRef } from 'react';
import { configQuery, useSaveConfig } from '@/api/queries';
import { pickDirectory } from '@/api/bridge';
import { JdkRegistryFields, type JdkRegistryEntry } from '@/components/JdkRegistryFields';
import { MAVEN_OPTIONS } from '@/components/MavenCommandFields';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TagInput } from '@/components/ui/tag-input';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Settings, Plus, Trash2, FolderOpen, Save, Loader2, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import type { MavenOptionKey } from '@gfos-build/contracts';
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
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [baselineSnapshot, setBaselineSnapshot] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSavingIndicator, setShowSavingIndicator] = useState(false);
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

    setMavenExec(nextMavenExec);
    setMavenGoals(nextMavenGoals);
    setMavenOptionKeys(nextMavenOptionKeys);
    setMavenExtraOptions(nextMavenExtraOptions);
    setNodeExecutables(nextNodeExecutables);
    setJdkEntries(nextJdkEntries);
    setRootEntries(nextRootEntries);
    setIncludeHidden(nextIncludeHidden);
    setExcludePatterns(nextExcludePatterns);
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
    ],
  );
  const currentSnapshot = useMemo(() => JSON.stringify(currentPayload), [currentPayload]);
  const isDirty = baselineSnapshot !== '' && currentSnapshot !== baselineSnapshot;
  const localStatePaths = useMemo(
    () => deriveLocalStatePaths(configData?.configPath ?? ''),
    [configData?.configPath],
  );

  useEffect(() => {
    if ((saveState === 'saved' || saveState === 'error') && isDirty) {
      setSaveState('idle');
      setSaveError(null);
    }
  }, [isDirty, saveState]);

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
    if (!isDirty) return;
    setSaveState('saving');
    setSaveError(null);
    try {
      await saveConfig.mutateAsync(currentPayload);
      void queryClient.invalidateQueries({ queryKey: ['config'] });
      setBaselineSnapshot(currentSnapshot);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setSaveError(
        error instanceof Error
          ? error.message.replace(/^POST \/api\/config failed:\s*/, 'Save failed: ')
          : 'Save failed. Try again.',
      );
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title text-[1.6rem] font-semibold leading-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage local executables, roots, scan behavior, and appearance.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
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

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-5">
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
            title="Maven"
            description="Preset Maven command settings used for new quick runs and Maven pipeline steps."
            icon={<Settings size={14} className="text-primary" />}
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
            icon={<Settings size={14} className="text-primary" />}
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

        <div className="flex flex-col gap-5">
          <ConfigCard
            title="Local state"
            description="GFOS Build now runs as a fully local desktop app. Settings live in JSON, durable run data in SQLite, and disposable scan/browser data in cache folders."
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

          <ConfigCard
            title="JDK registry"
            description="Register local Java installations so GFOS Build can pin Maven runs via JAVA_HOME."
            icon={<Settings size={14} className="text-primary" />}
          >
            <JdkRegistryFields
              entries={jdkEntries}
              onChange={setJdkEntries}
              emptyMessage="No JDK entries yet. Maven builds can still use the system Java, but detected project Java versions cannot be enforced until you register matching JDKs here."
            />
          </ConfigCard>

          <ConfigCard
            title="Project roots"
            description="Choose which top-level folders GFOS scans for Maven and Node projects."
            icon={<Settings size={14} className="text-primary" />}
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
                        placeholder="C:\\dev\\projects"
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
        </div>
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
