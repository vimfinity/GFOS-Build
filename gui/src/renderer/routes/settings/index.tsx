import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { configQuery, useSaveConfig } from '@/api/queries';
import { pickDirectory } from '@/api/bridge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TagInput } from '@/components/ui/tag-input';
import { cn } from '@/lib/utils';
import { Settings, Plus, Trash2, FolderOpen, Save, Loader2 } from 'lucide-react';

export const Route = createFileRoute('/settings/')({
  component: SettingsView,
});

interface KvEntry {
  key: string;
  value: string;
}

function SettingsView() {
  const queryClient = useQueryClient();
  const { data: configData, isLoading } = useQuery(configQuery);
  const saveConfig = useSaveConfig();

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
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!configData) return;
    const { config } = configData;
    setMavenExec(config.maven.executable);
    setMavenGoals(config.maven.defaultGoals);
    setMavenFlags(config.maven.defaultFlags);
    setNpmExec(config.npm.executable);
    setNpmScript(config.npm.defaultBuildScript);
    setJdkEntries(Object.entries(config.jdkRegistry).map(([key, value]) => ({ key, value })));
    setRootEntries(Object.entries(config.roots).map(([key, value]) => ({ key, value })));
    setMaxDepth(config.scan.maxDepth);
    setIncludeHidden(config.scan.includeHidden);
    setExcludePatterns(config.scan.exclude);
  }, [configData]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveConfig.mutateAsync({
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
          jdkEntries.filter((e) => e.key).map((e) => [e.key, e.value]),
        ),
        roots: Object.fromEntries(
          rootEntries.filter((e) => e.key).map((e) => [e.key, e.value]),
        ),
        scan: {
          maxDepth,
          includeHidden,
          exclude: excludePatterns,
        },
      });
      void queryClient.invalidateQueries({ queryKey: ['config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  // --- JDK helpers ---
  function addJdk() {
    setJdkEntries((prev) => [...prev, { key: '', value: '' }]);
  }
  function removeJdk(idx: number) {
    setJdkEntries((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateJdk(idx: number, field: 'key' | 'value', val: string) {
    setJdkEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: val } : e)));
  }
  async function browseJdk(idx: number) {
    const dir = await pickDirectory();
    if (dir) updateJdk(idx, 'value', dir);
  }

  // --- Root helpers ---
  function addRoot() {
    setRootEntries((prev) => [...prev, { key: '', value: '' }]);
  }
  function removeRoot(idx: number) {
    setRootEntries((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateRoot(idx: number, field: 'key' | 'value', val: string) {
    setRootEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: val } : e)));
  }
  async function browseRoot(idx: number) {
    const dir = await pickDirectory();
    if (dir) updateRoot(idx, 'value', dir);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground text-sm">
        <Loader2 size={14} className="animate-spin" />
        <span>Loading configuration…</span>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={18} className="text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Settings</h1>
            {configData && (
              <p className="text-[11px] font-mono text-muted-foreground mt-0.5 break-all">
                {configData.configPath}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {saved && (
            <span className="text-xs text-success font-medium">Saved!</span>
          )}
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Maven */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Maven</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            id="maven-exec"
            label="Maven Executable"
            placeholder="mvn"
            value={mavenExec}
            onChange={(e) => setMavenExec(e.target.value)}
          />
          <TagInput
            id="maven-goals"
            label="Default Goals"
            value={mavenGoals}
            onChange={setMavenGoals}
            placeholder="e.g. clean"
          />
          <TagInput
            id="maven-flags"
            label="Default Flags"
            value={mavenFlags}
            onChange={setMavenFlags}
            placeholder="e.g. -T4"
          />
        </CardContent>
      </Card>

      {/* npm */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">npm</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            id="npm-exec"
            label="Executable"
            placeholder="npm"
            value={npmExec}
            onChange={(e) => setNpmExec(e.target.value)}
          />
          <Input
            id="npm-script"
            label="Default Build Script"
            placeholder="build"
            value={npmScript}
            onChange={(e) => setNpmScript(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* JDK Registry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">JDK Registry</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {jdkEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No JDK entries. Add one to enable Java version selection.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {jdkEntries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="e.g. 17"
                    value={entry.key}
                    onChange={(e) => updateJdk(idx, 'key', e.target.value)}
                    className="w-24 shrink-0"
                  />
                  <Input
                    placeholder="/path/to/jdk"
                    value={entry.value}
                    onChange={(e) => updateJdk(idx, 'value', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    title="Browse for directory"
                    onClick={() => void browseJdk(idx)}
                  >
                    <FolderOpen size={14} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    title="Remove entry"
                    onClick={() => removeJdk(idx)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div>
            <Button variant="outline" size="sm" onClick={addJdk}>
              <Plus size={13} /> Add JDK
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Project Roots */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Project Roots</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rootEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No project roots configured. Add a root directory to scan for Maven and npm projects.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {rootEntries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Name"
                    value={entry.key}
                    onChange={(e) => updateRoot(idx, 'key', e.target.value)}
                    className="w-32 shrink-0"
                  />
                  <Input
                    placeholder="/path/to/root"
                    value={entry.value}
                    onChange={(e) => updateRoot(idx, 'value', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    title="Browse for directory"
                    onClick={() => void browseRoot(idx)}
                  >
                    <FolderOpen size={14} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    title="Remove entry"
                    onClick={() => removeRoot(idx)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div>
            <Button variant="outline" size="sm" onClick={addRoot}>
              <Plus size={13} /> Add Root
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scan Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Scan Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            id="max-depth"
            type="number"
            label="Max Depth"
            min={1}
            max={10}
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
            className="w-24"
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Include Hidden</span>
            <div className="flex rounded-md border border-input overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => setIncludeHidden(true)}
                className={cn(
                  'h-8 px-4 text-xs font-medium transition-colors',
                  includeHidden
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setIncludeHidden(false)}
                className={cn(
                  'h-8 px-4 text-xs font-medium border-l border-input transition-colors',
                  !includeHidden
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                No
              </button>
            </div>
          </div>

          <TagInput
            id="exclude-patterns"
            label="Exclude Patterns"
            value={excludePatterns}
            onChange={setExcludePatterns}
            placeholder="e.g. target"
          />
        </CardContent>
      </Card>
    </div>
  );
}
