import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { scanQuery, configQuery, useRefreshScan, useQuickRun } from '@/api/queries';
import { waitForJobCompletion } from '@/api/run-events';
import { useState, useMemo, useEffect, useDeferredValue } from 'react';
import {
  FolderSearch,
  RefreshCw,
  Search,
  Play,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Loader2,
  ChevronsDown,
  ChevronsUp,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MavenCommandFields, getSuggestedJavaOverride, type MavenCommandValue } from '@/components/MavenCommandFields';
import { ComboboxField } from '@/components/ui/combobox-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchField } from '@/components/ui/search-field';
import { Tooltip } from '@/components/ui/tooltip';
import { getNodeScriptChoices, getNodeScriptComboboxOptions } from '@/lib/node-script-options';
import { cn } from '@/lib/utils';
import { useGitInfo, useGitInfoBatch } from '@/api/queries';
import { BranchBadge } from '@/components/BranchBadge';
import type { ExecutionMode, MavenOptionKey, MavenProfileState, MavenSubmoduleBuildStrategy, NodeCommandType, Project } from '@gfos-build/contracts';

export const Route = createFileRoute('/projects/')({
  component: ProjectsView,
});

type SysFilter = 'all' | 'maven' | 'node';
type SortBy = 'name-asc' | 'name-desc' | 'path-asc' | 'sys';

interface GroupData {
  key: string;
  label: string;
  segment: string;
  projects: Project[];
}

function getRelativePath(project: Project, roots: Record<string, string>): string {
  const rootPath = roots[project.rootName];
  if (!rootPath) return project.path;
  const norm = project.path.replace(/\\/g, '/');
  const rootNorm = rootPath.replace(/\\/g, '/').replace(/\/$/, '');
  return norm.startsWith(rootNorm) ? norm.slice(rootNorm.length + 1) : project.path;
}

function SystemBadge({ system }: { system: 'maven' | 'node' }) {
  return (
    <span
      className={cn(
        'pill-meta',
        system === 'maven'
          ? 'bg-primary/10 text-primary'
          : 'bg-success/10 text-success',
      )}
    >
      {system === 'maven' ? 'Maven' : 'Node'}
    </span>
  );
}

function QuickRunDialog({
  project,
  onClose,
  onRun,
  isRunning,
}: {
  project: Project | null;
  onClose: () => void;
  onRun: (payload: {
    buildSystem: 'maven' | 'node';
    modulePath?: string;
    submoduleBuildStrategy?: MavenSubmoduleBuildStrategy;
    goals?: string[];
    optionKeys?: MavenOptionKey[];
    profileStates?: Record<string, MavenProfileState>;
    extraOptions?: string[];
    java?: string;
    commandType?: NodeCommandType;
    script?: string;
    args?: string[];
    executionMode?: ExecutionMode;
  }) => void;
  isRunning: boolean;
}) {
  const { data: configData } = useQuery(configQuery);
  const { data: gitInfo } = useGitInfo(project?.path ?? '');

  const defaultGoals = useMemo(
    () => configData?.config.maven.defaultGoals ?? ['clean', 'install'],
    [configData],
  );
  const defaultOptionKeys = useMemo(
    () => configData?.config.maven.defaultOptionKeys ?? [],
    [configData],
  );
  const defaultExtraOptions = useMemo(
    () => configData?.config.maven.defaultExtraOptions ?? [],
    [configData],
  );
  const jdkVersions = useMemo(
    () => Object.keys(configData?.config.jdkRegistry ?? {}),
    [configData],
  );

  const [mavenCommand, setMavenCommand] = useState<MavenCommandValue>({
    modulePath: '',
    submoduleBuildStrategy: 'root-pl',
    goals: defaultGoals,
    optionKeys: defaultOptionKeys,
    profileStates: {},
    extraOptions: defaultExtraOptions,
    javaVersion: '',
    executionMode: 'internal',
  });
  const [commandType, setCommandType] = useState<NodeCommandType>('script');
  const [script, setScript] = useState('');
  const [nodeArgs, setNodeArgs] = useState('');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('internal');
  const nodeScripts = useMemo(
    () => getNodeScriptChoices(project?.node?.scripts),
    [project],
  );
  const packageManager = project?.node?.packageManager ?? 'npm';

  useEffect(() => {
    if (project !== null) {
      setMavenCommand({
        modulePath: '',
        submoduleBuildStrategy: 'root-pl',
        goals: defaultGoals,
        optionKeys: defaultOptionKeys,
        profileStates: Object.fromEntries(
          (project.maven?.profiles ?? []).map((profile) => [profile.id, 'default']),
        ),
        extraOptions: defaultExtraOptions,
        javaVersion: getSuggestedJavaOverride(project.maven, jdkVersions),
        executionMode: 'internal',
      });
      setCommandType('script');
      setScript(nodeScripts[0]?.name ?? '');
      setNodeArgs('');
      setExecutionMode('internal');
    }
  }, [project, defaultExtraOptions, defaultGoals, defaultOptionKeys, nodeScripts, jdkVersions]);

  function handleRun() {
    if (!project) return;
    if (project.buildSystem === 'node') {
      onRun({
        buildSystem: 'node',
        commandType,
        script,
        args: nodeArgs.split(/\s+/).filter(Boolean),
        executionMode,
      });
      return;
    }
    onRun({
      buildSystem: 'maven',
      modulePath: mavenCommand.modulePath || undefined,
      submoduleBuildStrategy: mavenCommand.modulePath ? mavenCommand.submoduleBuildStrategy : undefined,
      goals: mavenCommand.goals,
      optionKeys: mavenCommand.optionKeys,
      profileStates: mavenCommand.profileStates,
      extraOptions: mavenCommand.extraOptions,
      java: mavenCommand.javaVersion.trim() || undefined,
      executionMode: mavenCommand.executionMode,
    });
  }

  const commandPreview = project
    ? project.buildSystem === 'node'
      ? commandType === 'install'
        ? [packageManager, 'install', ...(nodeArgs.trim() ? [nodeArgs.trim()] : [])].join(' ')
        : [packageManager, 'run', script || '<script>', ...(nodeArgs.trim() ? ['--', nodeArgs.trim()] : [])].join(' ')
      : buildMavenPreview(mavenCommand)
    : '';
  const canRunNode =
    project?.buildSystem !== 'node' || commandType === 'install' || script.trim().length > 0;

  return (
    <Dialog open={project !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl">
        <DialogTitle className="pr-10">Run build</DialogTitle>
        <DialogDescription>
          {project?.name ?? ''} · {project?.buildSystem === 'maven' ? 'Maven' : 'Node'}
        </DialogDescription>

        <div className="mt-5 grid gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.95fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4 lg:h-full">
            {project?.buildSystem === 'maven' && (
              <MavenCommandFields
                metadata={project.maven}
                value={mavenCommand}
                onChange={setMavenCommand}
                jdkVersions={jdkVersions}
              />
            )}

            {project?.buildSystem === 'node' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Command
                  </label>
                  <div className="segmented-control w-fit">
                    {([
                      { value: 'script', label: 'Run script' },
                      { value: 'install', label: 'Install deps' },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={commandType === option.value}
                        onClick={() => setCommandType(option.value)}
                        className={cn('segmented-control-button', commandType === option.value && 'is-active')}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Execution mode
                  </label>
                  <div className="segmented-control w-fit">
                    {(['internal', 'external'] as const).map((mode) => {
                      const button = (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={executionMode === mode}
                          onClick={() => setExecutionMode(mode)}
                          className={cn('segmented-control-button', executionMode === mode && 'is-active')}
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

                {commandType === 'script' && nodeScripts.length > 0 ? (
                  <>
                    <div className="lg:col-span-2">
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Script
                        </label>
                        <ComboboxField
                          value={script}
                          options={getNodeScriptComboboxOptions(project.node?.scripts)}
                          onValueChange={setScript}
                          placeholder="Select a script"
                          emptyText="No matching scripts"
                        />
                      </div>
                    </div>
                    <div className="lg:col-span-2">
                      <Input
                        label="Optional args"
                        placeholder="e.g. --host 0.0.0.0"
                        value={nodeArgs}
                        onChange={(e) => setNodeArgs(e.target.value)}
                      />
                    </div>
                  </>
                ) : commandType === 'script' ? (
                  <div className="rounded-[18px] border border-warning/20 bg-warning/8 px-4 py-3 text-sm text-warning lg:col-span-2">
                    No scripts were found in this package.json. Add a script before running this project.
                  </div>
                ) : (
                  <div className="lg:col-span-2">
                    <Input
                      label="Install args"
                      placeholder="e.g. --frozen-lockfile"
                      value={nodeArgs}
                      onChange={(e) => setNodeArgs(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {project && (
              <div className="rounded-[18px] border border-border bg-secondary/60 px-4 py-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/72">
                    Project
                  </span>
                  <BranchBadge branch={gitInfo?.branch ?? null} isDirty={gitInfo?.isDirty} />
                </div>
                <div className="mt-2 font-mono text-[12px] leading-relaxed break-all text-foreground/92">
                  {project.path}
                </div>
              </div>
            )}

            {project?.buildSystem === 'node' && (
              <div className="rounded-[18px] border border-border bg-secondary/60 px-4 py-3 text-xs text-muted-foreground">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/72">
                  Environment
                </span>
                <div className="mt-2">
                  Detected package manager:{' '}
                  <span className="font-mono text-foreground">{packageManager}</span>
                </div>
              </div>
            )}

            {project && (
              <div className="flex min-h-0 flex-1 flex-col rounded-[18px] border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/72">
                  Command preview
                </span>
                <div className="mt-2 font-mono text-[12px] leading-relaxed break-words text-foreground/92">
                  {commandPreview}
                </div>
                {project.buildSystem === 'maven' && project.maven?.hasMvnConfig && (
                  <div className="mt-2 text-[11px] text-muted-foreground/72">
                    Inherits `.mvn/maven.config` from the project root.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleRun} disabled={isRunning || (project?.buildSystem === 'maven' ? mavenCommand.goals.length === 0 : !canRunNode)}>
            {isRunning ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Starting
              </>
            ) : (
              <>
                <Play size={12} />
                Run build
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GroupHeader({
  label,
  count,
  isExpanded,
  onToggle,
}: {
  label: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]"
    >
      {isExpanded ? (
        <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight size={13} className="shrink-0 text-muted-foreground" />
      )}
      <span className="text-sm font-medium text-foreground">{label}/</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </button>
  );
}

function ProjectRow({
  project,
  subPath,
  onBuild,
  gitInfo,
  disabled = false,
}: {
  project: Project;
  subPath: string;
  onBuild: (project: Project) => void;
  gitInfo?: { branch: string | null; isDirty?: boolean };
  disabled?: boolean;
}) {
  const isAggregator = project.maven?.isAggregator ?? false;
  const version = project.node?.version;
  const javaVersion = project.maven?.javaVersion;

  return (
    <div className="group/row flex items-center gap-3 rounded-[18px] px-4 py-3 transition-colors hover:bg-accent/55">
      <Tooltip content={isAggregator ? 'Maven aggregator' : 'Buildable module'} side="bottom">
        <span
          className={cn(
            'h-2 w-2 rounded-full shrink-0',
            isAggregator ? 'bg-muted-foreground/40' : 'bg-success',
          )}
        />
      </Tooltip>
      <span className="max-w-[220px] shrink-0 truncate text-sm font-medium text-foreground">
        {project.name}
      </span>
      {subPath ? (
        <span className="min-w-0 flex-1 truncate text-xs font-mono text-muted-foreground">
          {subPath}
        </span>
      ) : (
        <div className="flex-1" />
      )}
      <SystemBadge system={project.buildSystem} />
      <BranchBadge branch={gitInfo?.branch ?? null} isDirty={gitInfo?.isDirty} />
      {project.node?.packageManager && (
        <span className="text-xs uppercase text-muted-foreground">{project.node.packageManager}</span>
      )}
      {version && <span className="text-xs text-muted-foreground">v{version}</span>}
      {javaVersion && <span className="text-xs text-muted-foreground">Java {javaVersion}</span>}
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => onBuild(project)}
        disabled={disabled}
      >
        <Play size={11} />
        Run
      </Button>
    </div>
  );
}

function FlatProjectRow({
  project,
  roots,
  onBuild,
  gitInfo,
  disabled = false,
}: {
  project: Project;
  roots: Record<string, string>;
  onBuild: (project: Project) => void;
  gitInfo?: { branch: string | null; isDirty?: boolean };
  disabled?: boolean;
}) {
  const relPath = getRelativePath(project, roots);
  const isAggregator = project.maven?.isAggregator ?? false;
  const version = project.node?.version;
  const javaVersion = project.maven?.javaVersion;

  return (
    <div className="group/row flex items-center gap-3 rounded-[18px] px-4 py-3 transition-colors hover:bg-accent/55">
      <span
        className={cn(
          'h-2 w-2 rounded-full shrink-0',
          isAggregator ? 'bg-muted-foreground/40' : 'bg-success',
        )}
      />
      <span className="max-w-[220px] shrink-0 truncate text-sm font-medium text-foreground">
        {project.name}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-mono text-muted-foreground">
        {relPath}
      </span>
      <SystemBadge system={project.buildSystem} />
      <BranchBadge branch={gitInfo?.branch ?? null} isDirty={gitInfo?.isDirty} />
      {project.node?.packageManager && (
        <span className="text-xs uppercase text-muted-foreground">{project.node.packageManager}</span>
      )}
      {version && <span className="text-xs text-muted-foreground">v{version}</span>}
      {javaVersion && <span className="text-xs text-muted-foreground">Java {javaVersion}</span>}
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => onBuild(project)}
        disabled={disabled}
      >
        <Play size={11} />
        Run
      </Button>
    </div>
  );
}

function ProjectsView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: scanData, isLoading, isError } = useQuery(scanQuery);
  const { data: configData } = useQuery(configQuery);
  const refreshScan = useRefreshScan();
  const quickRun = useQuickRun();

  const [search, setSearch] = useState('');
  const [sysFilter, setSysFilter] = useState<SysFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name-asc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [buildTarget, setBuildTarget] = useState<Project | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const projects = useMemo(() => scanData?.projects ?? [], [scanData]);
  const roots = useMemo(() => configData?.config.roots ?? {}, [configData]);

  const uniqueProjectPaths = useMemo(() => [...new Set(projects.map((p) => p.path))], [projects]);
  const { data: rawGitInfoMap } = useGitInfoBatch(uniqueProjectPaths);
  const gitInfoMap = useDeferredValue(rawGitInfoMap);

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      if (sysFilter !== 'all' && project.buildSystem !== sysFilter) return false;
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        return (
          project.name.toLowerCase().includes(query) ||
          project.path.toLowerCase().includes(query) ||
          (project.maven?.artifactId ?? '').toLowerCase().includes(query) ||
          (project.node?.name ?? '').toLowerCase().includes(query) ||
          project.rootName.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [projects, sysFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case 'name-asc':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return list.sort((a, b) => b.name.localeCompare(a.name));
      case 'path-asc':
        return list.sort((a, b) => getRelativePath(a, roots).localeCompare(getRelativePath(b, roots)));
      case 'sys':
        return list.sort((a, b) => a.buildSystem.localeCompare(b.buildSystem) || a.name.localeCompare(b.name));
      default:
        return list;
    }
  }, [filtered, sortBy, roots]);

  const groups = useMemo((): GroupData[] => {
    const multipleRoots = new Set(sorted.map((project) => project.rootName)).size > 1;
    const map = new Map<string, GroupData>();

    for (const project of sorted) {
      const relPath = getRelativePath(project, roots);
      const firstSegment = relPath.split('/')[0] ?? project.name;
      const key = `${project.rootName}/${firstSegment}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          label: multipleRoots ? `${project.rootName}: ${firstSegment}` : firstSegment,
          segment: firstSegment,
          projects: [],
        });
      }

      map.get(key)!.projects.push(project);
    }

    for (const group of map.values()) {
      group.projects.sort((a, b) => getRelativePath(a, roots).localeCompare(getRelativePath(b, roots)));
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [sorted, roots]);

  const allGroupKeys = useMemo(() => groups.map((group) => group.key), [groups]);

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(allGroupKeys));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const { jobId } = await refreshScan.mutateAsync();
      await waitForJobCompletion(jobId);
      await queryClient.invalidateQueries({ queryKey: ['scan'] });
      await queryClient.invalidateQueries({ queryKey: ['git-info'] });
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Refresh scan failed.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleBuildRun(payload: {
    buildSystem: 'maven' | 'node';
    modulePath?: string;
    submoduleBuildStrategy?: MavenSubmoduleBuildStrategy;
    goals?: string[];
    optionKeys?: MavenOptionKey[];
    profileStates?: Record<string, MavenProfileState>;
    extraOptions?: string[];
    java?: string;
    commandType?: NodeCommandType;
    script?: string;
    args?: string[];
    executionMode?: ExecutionMode;
  }) {
    if (!buildTarget) return;
    try {
      const { jobId } = await quickRun.mutateAsync({
        path: buildTarget.path,
        buildSystem: payload.buildSystem,
        modulePath: payload.modulePath,
        submoduleBuildStrategy: payload.submoduleBuildStrategy,
        goals: payload.goals,
        optionKeys: payload.optionKeys,
        profileStates: payload.profileStates,
        extraOptions: payload.extraOptions,
        java: payload.java,
        commandType: payload.commandType,
        script: payload.script,
        args: payload.args,
        executionMode: payload.executionMode,
      });
      setBuildTarget(null);
      void navigate({ to: '/builds/$jobId', params: { jobId } });
    } catch {
      // Keep dialog open on error.
    }
  }

  const isSearchActive = search.trim().length > 0;
  const canToggleGroups = !isSearchActive && groups.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title text-[1.6rem] font-semibold leading-tight text-foreground">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse scanned Maven and Node codebases and launch Quick Runs.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh scan
        </Button>
      </div>

      {isLoading && (
        <div className="glass-card flex flex-col items-center gap-4 rounded-[24px] border border-border px-8 py-16 text-center">
          <Loader2 size={26} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Scanning projects...</p>
        </div>
      )}

      {isError && !isLoading && (
        <div className="glass-card flex flex-col items-center gap-4 rounded-[24px] border border-border px-8 py-16 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle size={28} className="text-destructive" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Failed to scan projects</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The desktop runtime could not return a project inventory.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleRefresh()}>
            <RefreshCw size={13} />
            Try again
          </Button>
        </div>
      )}

      {refreshError && !isError && (
        <div className="glass-card flex items-center gap-3 rounded-[24px] border border-destructive/20 px-5 py-4 text-sm">
          <AlertCircle size={16} className="shrink-0 text-destructive" />
          <span className="text-destructive">{refreshError}</span>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {projects.length > 0 && (
            <div className="glass-card flex flex-wrap items-center gap-3 rounded-[24px] border border-border p-4">
              <SearchField value={search} onChange={setSearch} placeholder="Filter projects..." />

              <div className="segmented-control">
                {(['all', 'maven', 'node'] as const).map((system) => (
                  <button
                    key={system}
                    aria-pressed={sysFilter === system}
                    onClick={() => setSysFilter(system)}
                    className={cn(
                      'segmented-control-button',
                      sysFilter === system && 'is-active',
                    )}
                  >
                    {system === 'all' ? 'All' : system === 'maven' ? 'Maven' : 'Node'}
                  </button>
                ))}
              </div>

              <div className="field-shell field-shell-pill field-shell-soft">
                <ArrowUpDown size={12} />
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as SortBy)}
                >
                  <SelectTrigger className="h-auto min-h-0 border-0 bg-transparent px-0 py-0 shadow-none hover:bg-transparent focus-visible:border-0 focus-visible:shadow-none">
                    <SelectValue className="text-xs text-muted-foreground" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="name-asc">Name A-Z</SelectItem>
                    <SelectItem value="name-desc">Name Z-A</SelectItem>
                    <SelectItem value="path-asc">Path A-Z</SelectItem>
                    <SelectItem value="sys">Build system</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="ml-auto flex min-w-[190px] items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={collapseAll} disabled={!canToggleGroups}>
                    <ChevronsUp size={12} />
                    Collapse
                  </Button>
                  <Button variant="ghost" size="sm" onClick={expandAll} disabled={!canToggleGroups}>
                    <ChevronsDown size={12} />
                    Expand
                  </Button>
              </div>
            </div>
          )}

          {projects.length === 0 && configData && Object.keys(configData.config.roots).length === 0 && (
            <EmptyState
              icon={<FolderSearch size={28} className="text-primary" />}
              title="No project roots configured"
              description="Configure project roots in Settings before scanning for Maven or Node projects."
            />
          )}

          {projects.length === 0 && configData && Object.keys(configData.config.roots).length > 0 && (
            <EmptyState
              icon={<AlertCircle size={28} className="text-primary" />}
              title="No projects found"
              description="No pom.xml or package.json files were found under the configured roots."
              action={
                <Button variant="outline" size="sm" onClick={() => void handleRefresh()}>
                  <RefreshCw size={13} />
                  Scan now
                </Button>
              }
            />
          )}

          {projects.length === 0 && !configData && (
            <EmptyState
              icon={<AlertCircle size={28} className="text-primary" />}
              title="No projects found"
              description="Configuration data is still loading."
            />
          )}

          {projects.length > 0 && (
            <>
              {sorted.length === 0 ? (
                <EmptyState
                  icon={<Search size={24} className="text-primary" />}
                  title={`No projects match "${search}"`}
                  description="Try removing the search term or build system filter."
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setSysFilter('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : isSearchActive ? (
                <div className="glass-card rounded-[24px] border border-border p-3">
                  <p className="px-3 pb-2 text-xs text-muted-foreground">
                    {sorted.length} result{sorted.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-col gap-1">
                    {sorted.map((project) => (
                      <FlatProjectRow
                        key={project.path}
                        project={project}
                        roots={roots}
                        onBuild={setBuildTarget}
                        gitInfo={gitInfoMap?.[project.path]}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="glass-card rounded-[24px] border border-border p-3">
                  <div className="flex flex-col gap-1">
                    {groups.map((group) => {
                      const isExpanded = expanded.has(group.key);
                      return (
                        <div key={group.key} className="rounded-[20px] border border-transparent">
                          <GroupHeader
                            label={group.label}
                            count={group.projects.length}
                            isExpanded={isExpanded}
                            onToggle={() => toggleGroup(group.key)}
                          />
                          {isExpanded && (
                            <div className="ml-4 flex flex-col gap-1 border-l border-border/80 py-1 pl-3">
                              {group.projects.map((project) => {
                                const relPath = getRelativePath(project, roots);
                                const subPath = relPath.startsWith(group.segment + '/')
                                  ? relPath.slice(group.segment.length + 1)
                                  : relPath === group.segment
                                    ? ''
                                    : relPath;
                                return (
                                  <ProjectRow
                                    key={project.path}
                                    project={project}
                                    subPath={subPath}
                                    onBuild={setBuildTarget}
                                    gitInfo={gitInfoMap?.[project.path]}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <QuickRunDialog
        project={buildTarget}
        onClose={() => setBuildTarget(null)}
        onRun={(payload) => void handleBuildRun(payload)}
        isRunning={quickRun.isPending}
      />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-4 rounded-[24px] border border-border px-8 py-16 text-center">
      <div className="icon-chip flex h-14 w-14 items-center justify-center rounded-full">{icon}</div>
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

const MAVEN_OPTION_FLAGS: Record<MavenOptionKey, string> = {
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

function buildMavenPreview(command: MavenCommandValue): string {
  const explicitProfiles = Object.entries(command.profileStates)
    .filter(([, state]) => state !== 'default')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([profileId, state]) => (state === 'disabled' ? `!${profileId}` : profileId));

  const useSubmoduleDir = command.modulePath && command.submoduleBuildStrategy === 'submodule-dir';
  const prefix = useSubmoduleDir ? `cd ${command.modulePath} && ` : '';

  return prefix + [
    'mvn',
    ...command.goals,
    ...command.optionKeys.map((optionKey) => MAVEN_OPTION_FLAGS[optionKey]),
    ...(explicitProfiles.length > 0 ? ['-P', explicitProfiles.join(',')] : []),
    ...(!useSubmoduleDir && command.modulePath ? ['-pl', command.modulePath] : []),
    ...command.extraOptions,
  ].join(' ');
}
