import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, useRef } from 'react';
import { configQuery, useSaveConfig } from '@/api/queries';
import { useUpdateState } from '@/api/update';
import { pickDirectory } from '@/api/bridge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input, NumberField } from '@/components/ui/input';
import { TagInput } from '@/components/ui/tag-input';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, formatDate } from '@/lib/utils';
import { Settings, Plus, Trash2, FolderOpen, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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

function createConfigPayload({
  mavenExec,
  mavenGoals,
  mavenFlags,
  npmExec,
  npmScript,
  jdkEntries,
  rootEntries,
  maxDepth,
  includeHidden,
  excludePatterns,
}: {
  mavenExec: string;
  mavenGoals: string[];
  mavenFlags: string[];
  npmExec: string;
  npmScript: string;
  jdkEntries: KvEntry[];
  rootEntries: KvEntry[];
  maxDepth: number;
  includeHidden: boolean;
  excludePatterns: string[];
}) {
  return {
    maven: {
      executable: mavenExec,
      defaultGoals: mavenGoals,
      defaultFlags: mavenFlags,
    },
    npm: {
      executable: npmExec,
      defaultBuildScript: npmScript,
      defaultInstallArgs: [],
    },
    jdkRegistry: Object.fromEntries(
      jdkEntries
        .filter((entry) => entry.key.trim())
        .map((entry) => [entry.key.trim(), entry.value]),
    ),
    roots: Object.fromEntries(
      rootEntries
        .filter((entry) => entry.key.trim())
        .map((entry) => [entry.key.trim(), entry.value]),
    ),
    scan: {
      maxDepth,
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
  const { state: updateState, busyAction, checkForUpdates, downloadUpdate, applyUpdate } = useUpdateState();

  const [mavenExec, setMavenExec] = useState('');
  const [mavenGoals, setMavenGoals] = useState<string[]>([]);
  const [mavenFlags, setMavenFlags] = useState<string[]>([]);
  const [npmExec, setNpmExec] = useState('');
  const [npmScript, setNpmScript] = useState('');
  const [jdkEntries, setJdkEntries] = useState<KvEntry[]>([]);
  const [rootEntries, setRootEntries] = useState<KvEntry[]>([]);
  const [maxDepth, setMaxDepth] = useState(4);
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
    const nextMavenFlags = config.maven.defaultFlags;
    const nextNpmExec = config.npm.executable;
    const nextNpmScript = config.npm.defaultBuildScript;
    const nextJdkEntries = Object.entries(config.jdkRegistry).map(([key, value]) => ({ key, value }));
    const nextRootEntries = Object.entries(config.roots).map(([key, value]) => ({ key, value }));
    const nextMaxDepth = config.scan.maxDepth;
    const nextIncludeHidden = config.scan.includeHidden;
    const nextExcludePatterns = config.scan.exclude;

    setMavenExec(nextMavenExec);
    setMavenGoals(nextMavenGoals);
    setMavenFlags(nextMavenFlags);
    setNpmExec(nextNpmExec);
    setNpmScript(nextNpmScript);
    setJdkEntries(nextJdkEntries);
    setRootEntries(nextRootEntries);
    setMaxDepth(nextMaxDepth);
    setIncludeHidden(nextIncludeHidden);
    setExcludePatterns(nextExcludePatterns);
    setBaselineSnapshot(
      JSON.stringify(
        createConfigPayload({
          mavenExec: nextMavenExec,
          mavenGoals: nextMavenGoals,
          mavenFlags: nextMavenFlags,
          npmExec: nextNpmExec,
          npmScript: nextNpmScript,
          jdkEntries: nextJdkEntries,
          rootEntries: nextRootEntries,
          maxDepth: nextMaxDepth,
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
        mavenFlags,
        npmExec,
        npmScript,
        jdkEntries,
        rootEntries,
        maxDepth,
        includeHidden,
        excludePatterns,
      }),
    [
      mavenExec,
      mavenGoals,
      mavenFlags,
      npmExec,
      npmScript,
      jdkEntries,
      rootEntries,
      maxDepth,
      includeHidden,
      excludePatterns,
    ],
  );
  const currentSnapshot = useMemo(() => JSON.stringify(currentPayload), [currentPayload]);
  const isDirty = baselineSnapshot !== '' && currentSnapshot !== baselineSnapshot;

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

  function addJdk() {
    setJdkEntries((prev) => [...prev, { key: '', value: '' }]);
  }
  function removeJdk(index: number) {
    setJdkEntries((prev) => prev.filter((_, i) => i !== index));
  }
  function updateJdk(index: number, field: 'key' | 'value', value: string) {
    setJdkEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  }
  async function browseJdk(index: number) {
    const dir = await pickDirectory();
    if (dir) updateJdk(index, 'value', dir);
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
            description="Default Maven command settings used for scans, ad-hoc runs, and pipeline steps."
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
                Pre-filled Maven goals for new ad-hoc runs and Maven pipeline steps.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <TagInput
                id="maven-flags"
                label="Default flags"
                value={mavenFlags}
                onChange={setMavenFlags}
                placeholder="e.g. -T4"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Optional flags appended to Maven commands by default.
              </p>
            </div>
          </ConfigCard>

          <ConfigCard
            title="npm"
            description="Default npm command settings used for ad-hoc runs and npm pipeline steps."
            icon={<Settings size={14} className="text-primary" />}
          >
            <div className="flex flex-col gap-1.5">
              <Input
                id="npm-exec"
                label="Executable"
                placeholder="npm"
                value={npmExec}
                onChange={(e) => setNpmExec(e.target.value)}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Executable name or absolute path used when GFOS starts npm commands.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Input
                id="npm-script"
                label="Default build script"
                placeholder="build"
                value={npmScript}
                onChange={(e) => setNpmScript(e.target.value)}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Default script name for new npm runs, for example `build` or `dist`.
              </p>
            </div>
          </ConfigCard>

          <ConfigCard
            title="Scan settings"
            description="Define how deeply GFOS scans your configured roots and what it skips."
            icon={<Settings size={14} className="text-primary" />}
          >
            <div className="flex flex-col gap-1.5">
              <NumberField
                id="max-depth"
                label="Max depth"
                min={1}
                max={10}
                value={maxDepth}
                onChange={setMaxDepth}
                className="max-w-32"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/72">
                Maximum folder depth scanned below each configured root before search stops.
              </p>
            </div>

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
            title="Updates"
            description="Managed installs can update in place. Portable builds stay manual but can still point to the latest release."
            icon={<Settings size={14} className="text-primary" />}
          >
            <div className="space-y-1">
              <p className="text-sm text-foreground">
                Version <span className="font-medium">v{updateState.currentVersion}</span>
              </p>
              <p className="text-sm text-muted-foreground capitalize">
                {updateState.distribution} install · channel {updateState.channel}
              </p>
              {updateState.lastCheckedAt ? (
                <p className="text-xs text-muted-foreground">
                  Last checked {formatDate(updateState.lastCheckedAt)}
                </p>
              ) : null}
              {updateState.availableVersion ? (
                <p className="text-sm text-muted-foreground">
                  Latest available: <span className="font-medium text-foreground">v{updateState.availableVersion}</span>
                </p>
              ) : null}
              {updateState.error ? <p className="text-sm text-destructive">{updateState.error}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void checkForUpdates()} disabled={busyAction !== null}>
                {busyAction === 'check' ? <Loader2 size={13} className="animate-spin" /> : null}
                Check now
              </Button>
              {updateState.status === 'available' ? (
                <Button size="sm" onClick={() => void downloadUpdate()} disabled={busyAction !== null}>
                  {busyAction === 'download' ? <Loader2 size={13} className="animate-spin" /> : null}
                  {updateState.distribution === 'managed' ? 'Download update' : 'Download latest ZIP'}
                </Button>
              ) : null}
              {(updateState.status === 'downloaded' || updateState.status === 'apply_blocked_active_jobs') ? (
                <Button
                  size="sm"
                  onClick={() => void applyUpdate()}
                  disabled={busyAction !== null || updateState.status === 'apply_blocked_active_jobs'}
                >
                  {busyAction === 'apply' ? <Loader2 size={13} className="animate-spin" /> : null}
                  Restart to update
                </Button>
              ) : null}
            </div>
          </ConfigCard>

          <ConfigCard
            title="JDK registry"
            description="Register local Java installations so Maven runs can target a specific version."
            icon={<Settings size={14} className="text-primary" />}
          >
            {jdkEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No JDK entries yet. Add one to enable Java version selection.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {jdkEntries.map((entry, index) => (
                  <div key={index} className="rounded-[18px] border border-border bg-secondary/45 p-3">
                    <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_auto_auto]">
                      <Input
                        placeholder="e.g. 17"
                        value={entry.key}
                        onChange={(e) => updateJdk(index, 'key', e.target.value)}
                      />
                      <Input
                        placeholder="C:\\Program Files\\Java\\jdk-17"
                        value={entry.value}
                        onChange={(e) => updateJdk(index, 'value', e.target.value)}
                      />
                      <Tooltip content="Browse" side="bottom">
                        <Button variant="outline" size="icon" onClick={() => void browseJdk(index)} aria-label="Browse JDK path">
                          <FolderOpen size={14} />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Remove" side="bottom">
                        <Button variant="destructive" size="icon" onClick={() => removeJdk(index)} aria-label="Remove JDK entry">
                          <Trash2 size={14} />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={addJdk}>
              <Plus size={13} />
              Add JDK
            </Button>
          </ConfigCard>

          <ConfigCard
            title="Project roots"
            description="Choose which top-level folders GFOS scans for Maven and npm projects."
            icon={<Settings size={14} className="text-primary" />}
          >
            {rootEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add root directories to scan for Maven and npm projects.
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
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex items-start gap-2">
          <div className="icon-chip mt-0.5 flex h-9 w-9 items-center justify-center rounded-full">{icon}</div>
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
