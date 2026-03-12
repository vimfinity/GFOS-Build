import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { scanQuery, configQuery, useRefreshScan, useAdHocBuild } from '@/api/queries';
import { useState, useMemo, useEffect } from 'react';
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
import { cn, formatDuration } from '@/lib/utils';
import type { Project } from '@shared/types';

export const Route = createFileRoute('/projects/')({
  component: ProjectsView,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type SysFilter = 'all' | 'maven' | 'npm';
type SortBy = 'name-asc' | 'name-desc' | 'path-asc' | 'sys';

interface GroupData {
  key: string;
  label: string;
  segment: string;
  projects: Project[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelativePath(project: Project, roots: Record<string, string>): string {
  const rootPath = roots[project.rootName];
  if (!rootPath) return project.path;
  const norm = project.path.replace(/\\/g, '/');
  const rootNorm = rootPath.replace(/\\/g, '/').replace(/\/$/, '');
  return norm.startsWith(rootNorm) ? norm.slice(rootNorm.length + 1) : project.path;
}

// ─── System badge ─────────────────────────────────────────────────────────────

function SystemBadge({ system }: { system: 'maven' | 'npm' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] px-1.5 py-0 rounded font-semibold shrink-0 leading-[18px]',
        system === 'maven'
          ? 'bg-primary/20 text-primary'
          : 'bg-emerald-500/20 text-emerald-400',
      )}
    >
      {system === 'maven' ? 'mvn' : 'npm'}
    </span>
  );
}

// ─── Ad-hoc build dialog ──────────────────────────────────────────────────────

function AdHocBuildDialog({
  project,
  onClose,
  onRun,
  isRunning,
}: {
  project: Project | null;
  onClose: () => void;
  onRun: (goals: string[], flags: string[], java?: string) => void;
  isRunning: boolean;
}) {
  const { data: configData } = useQuery(configQuery);

  const defaultGoals = useMemo(
    () => configData?.config.maven.defaultGoals.join(' ') ?? 'clean install',
    [configData],
  );
  const jdkVersions = useMemo(
    () => Object.keys(configData?.config.jdkRegistry ?? {}),
    [configData],
  );

  const [goals, setGoals] = useState(defaultGoals);
  const [flags, setFlags] = useState('');
  const [javaVersion, setJavaVersion] = useState('');

  useEffect(() => {
    if (project !== null) {
      setGoals(defaultGoals);
      setFlags('');
      setJavaVersion('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.path, defaultGoals]);

  function handleRun() {
    onRun(
      goals.split(/\s+/).filter(Boolean),
      flags.split(/\s+/).filter(Boolean),
      javaVersion.trim() || undefined,
    );
  }

  return (
    <Dialog open={project !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogTitle>Run build</DialogTitle>
        <DialogDescription>
          {project?.name ?? ''} — {project?.buildSystem === 'maven' ? 'Maven' : 'npm'}
        </DialogDescription>

        <div className="flex flex-col gap-4 mt-3">
          {project && (
            <div className="rounded-md bg-secondary/50 px-3 py-2 text-xs font-mono text-muted-foreground break-all">
              {project.path}
            </div>
          )}

          <Input
            label="Goals"
            placeholder="e.g. clean install"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
          />

          <Input
            label="Flags (optional)"
            placeholder="e.g. -DskipTests -T4"
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
          />

          {jdkVersions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Java version (optional)
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setJavaVersion('')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs border transition-colors',
                    javaVersion === ''
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80',
                  )}
                >
                  default
                </button>
                {jdkVersions.map((v) => (
                  <button
                    key={v}
                    onClick={() => setJavaVersion(v)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs border transition-colors',
                      javaVersion === v
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80',
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleRun} disabled={isRunning || !goals.trim()}>
            {isRunning ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Starting…
              </>
            ) : (
              <>
                <Play size={12} /> Run build
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Group header ─────────────────────────────────────────────────────────────

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
      className="flex items-center gap-1.5 w-full h-8 px-2 rounded-md hover:bg-accent/30 transition-colors text-left"
    >
      {isExpanded ? (
        <ChevronDown size={12} className="text-muted-foreground shrink-0" />
      ) : (
        <ChevronRight size={12} className="text-muted-foreground shrink-0" />
      )}
      <span className="text-sm font-medium text-foreground">{label}/</span>
      <span className="ml-0.5 text-xs text-muted-foreground tabular-nums">({count})</span>
    </button>
  );
}

// ─── Project row (grouped) ────────────────────────────────────────────────────

function ProjectRow({
  project,
  subPath,
  onBuild,
}: {
  project: Project;
  subPath: string;
  onBuild: (p: Project) => void;
}) {
  const isAggregator = project.maven?.isAggregator ?? false;
  const version = project.npm?.version;
  const javaVersion = project.maven?.javaVersion;

  return (
    <div className="flex items-center h-9 gap-2.5 pl-8 pr-2 rounded-md hover:bg-accent/20 transition-colors group/row">
      {/* Status dot */}
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          isAggregator ? 'bg-muted-foreground/40' : 'bg-success',
        )}
        title={isAggregator ? 'Maven aggregator — parent POM, no build artifact' : 'Buildable module'}
      />

      {/* Name */}
      <span className="font-medium text-sm text-foreground shrink-0 truncate max-w-[220px]">
        {project.name}
      </span>

      {/* Sub-path breadcrumb */}
      {subPath ? (
        <span className="text-xs text-muted-foreground font-mono truncate flex-1 min-w-0">
          {subPath}
        </span>
      ) : (
        <div className="flex-1" />
      )}

      {/* System badge */}
      <SystemBadge system={project.buildSystem} />

      {/* Version */}
      {version && (
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          v{version}
        </span>
      )}

      {/* Java version */}
      {javaVersion && (
        <span className="text-xs text-muted-foreground shrink-0">Java {javaVersion}</span>
      )}

      {/* Build button — appears on row hover */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity"
        onClick={() => onBuild(project)}
        title="Run build"
      >
        <Play size={11} />
      </Button>
    </div>
  );
}

// ─── Project row (flat search results) ───────────────────────────────────────

function FlatProjectRow({
  project,
  roots,
  onBuild,
}: {
  project: Project;
  roots: Record<string, string>;
  onBuild: (p: Project) => void;
}) {
  const relPath = getRelativePath(project, roots);
  const isAggregator = project.maven?.isAggregator ?? false;
  const version = project.npm?.version;
  const javaVersion = project.maven?.javaVersion;

  return (
    <div className="flex items-center h-9 gap-2.5 px-2 rounded-md hover:bg-accent/20 transition-colors group/row">
      {/* Status dot */}
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          isAggregator ? 'bg-muted-foreground/40' : 'bg-success',
        )}
        title={isAggregator ? 'Maven aggregator — parent POM, no build artifact' : 'Buildable module'}
      />

      {/* Name */}
      <span className="font-medium text-sm text-foreground shrink-0 truncate max-w-[220px]">
        {project.name}
      </span>

      {/* Full relative path */}
      <span className="text-xs text-muted-foreground font-mono truncate flex-1 min-w-0">
        {relPath}
      </span>

      {/* System badge */}
      <SystemBadge system={project.buildSystem} />

      {/* Version */}
      {version && (
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          v{version}
        </span>
      )}

      {/* Java version */}
      {javaVersion && (
        <span className="text-xs text-muted-foreground shrink-0">Java {javaVersion}</span>
      )}

      {/* Build button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity"
        onClick={() => onBuild(project)}
        title="Run build"
      >
        <Play size={11} />
      </Button>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

function ProjectsView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: scanData, isLoading, isError } = useQuery(scanQuery);
  const { data: configData } = useQuery(configQuery);
  const refreshScan = useRefreshScan();
  const adHocBuild = useAdHocBuild();

  const [search, setSearch] = useState('');
  const [sysFilter, setSysFilter] = useState<SysFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name-asc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [buildTarget, setBuildTarget] = useState<Project | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const projects = scanData?.projects ?? [];
  const roots = configData?.config.roots ?? {};

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (sysFilter !== 'all' && p.buildSystem !== sysFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.path.toLowerCase().includes(q) ||
          (p.maven?.artifactId ?? '').toLowerCase().includes(q) ||
          p.rootName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, sysFilter, search]);

  // ── Sorted list ───────────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case 'name-asc':  return arr.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc': return arr.sort((a, b) => b.name.localeCompare(a.name));
      case 'path-asc':  return arr.sort((a, b) => {
        const ra = getRelativePath(a, roots);
        const rb = getRelativePath(b, roots);
        return ra.localeCompare(rb);
      });
      case 'sys': return arr.sort((a, b) =>
        a.buildSystem.localeCompare(b.buildSystem) || a.name.localeCompare(b.name));
      default: return arr;
    }
  }, [filtered, sortBy, roots]);

  // ── Groups (one level: first path segment) ────────────────────────────────

  const groups = useMemo((): GroupData[] => {
    const multipleRoots = new Set(sorted.map((p) => p.rootName)).size > 1;
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
      group.projects.sort((a, b) => {
        const ra = getRelativePath(a, roots);
        const rb = getRelativePath(b, roots);
        return ra.localeCompare(rb);
      });
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [sorted, roots]);

  const allGroupKeys = useMemo(() => groups.map((g) => g.key), [groups]);

  // ── Handlers ──────────────────────────────────────────────────────────────

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
    try {
      await refreshScan.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: ['scan'] });
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleBuildRun(goals: string[], flags: string[], java?: string) {
    if (!buildTarget) return;
    try {
      const { jobId } = await adHocBuild.mutateAsync({
        path: buildTarget.path,
        goals,
        flags: flags.length > 0 ? flags : undefined,
        java,
      });
      setBuildTarget(null);
      void navigate({ to: '/builds/$jobId', params: { jobId } });
    } catch {
      // keep dialog open on error
    }
  }

  const isSearchActive = search.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 flex flex-col gap-4 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <FolderSearch size={18} className="text-primary mt-0.5 shrink-0" />
          <div>
            <h1 className="text-lg font-semibold text-foreground leading-tight">Projects</h1>
            {!isLoading && !isError && scanData && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
                {scanData.fromCache && <span className="opacity-70"> · from cache</span>}
                {scanData.durationMs != null && (
                  <span className="opacity-70"> · {formatDuration(scanData.durationMs)}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing || isLoading}
          className="shrink-0"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 size={24} className="animate-spin text-primary/50" />
          <p className="text-sm">Scanning projects…</p>
        </div>
      )}

      {/* ── Error ── */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <AlertCircle size={28} className="text-destructive/60" />
          <p className="text-sm text-destructive">Failed to scan projects</p>
          <Button variant="outline" size="sm" onClick={() => void handleRefresh()}>
            <RefreshCw size={13} /> Try again
          </Button>
        </div>
      )}

      {/* ── Main content (data loaded, no error) ── */}
      {!isLoading && !isError && (
        <>
          {/* Filters row — only when there are projects */}
          {projects.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter projects…"
                  className="h-9 w-64 rounded-md border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Build system segmented control */}
              <div className="flex rounded-md border border-border overflow-hidden h-9">
                {(['all', 'maven', 'npm'] as const).map((sys) => (
                  <button
                    key={sys}
                    onClick={() => setSysFilter(sys)}
                    className={cn(
                      'px-3 text-xs font-medium transition-colors border-r border-border last:border-r-0',
                      sysFilter === sys
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                    )}
                  >
                    {sys === 'all' ? 'All' : sys === 'maven' ? 'Maven' : 'npm'}
                  </button>
                ))}
              </div>

              {/* Sort control */}
              <div className="flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-border text-xs text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
                <ArrowUpDown size={11} className="shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="bg-transparent text-xs text-muted-foreground focus:outline-none cursor-pointer"
                >
                  <option value="name-asc">Name A→Z</option>
                  <option value="name-desc">Name Z→A</option>
                  <option value="path-asc">Path A→Z</option>
                  <option value="sys">Build system</option>
                </select>
              </div>

              {/* Expand / Collapse all — only in grouped mode */}
              {!isSearchActive && groups.length > 0 && (
                <div className="flex items-center rounded-md border border-border overflow-hidden h-9 ml-auto">
                  <button
                    onClick={collapseAll}
                    title="Collapse all groups"
                    className="flex items-center gap-1 px-2.5 h-full text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border-r border-border"
                  >
                    <ChevronsUp size={12} />
                    Collapse
                  </button>
                  <button
                    onClick={expandAll}
                    title="Expand all groups"
                    className="flex items-center gap-1 px-2.5 h-full text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                  >
                    <ChevronsDown size={12} />
                    Expand
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Empty: no roots ── */}
          {projects.length === 0 &&
            configData &&
            Object.keys(configData.config.roots).length === 0 && (
              <div className="flex flex-col items-center gap-2 py-24 text-muted-foreground">
                <FolderSearch size={28} className="text-border" />
                <p className="text-sm font-medium">No project roots configured</p>
                <p className="text-xs text-center max-w-xs">
                  Configure project roots in Settings to get started
                </p>
              </div>
            )}

          {/* ── Empty: roots exist but no projects ── */}
          {projects.length === 0 &&
            configData &&
            Object.keys(configData.config.roots).length > 0 && (
              <div className="flex flex-col items-center gap-2 py-24 text-muted-foreground">
                <AlertCircle size={28} className="text-border" />
                <p className="text-sm font-medium">No projects found</p>
                <p className="text-xs text-center max-w-xs">
                  No <code className="font-mono">pom.xml</code> or{' '}
                  <code className="font-mono">package.json</code> found within{' '}
                  {configData.config.scan.maxDepth} levels deep
                </p>
                <Button variant="outline" size="sm" onClick={() => void handleRefresh()}>
                  <RefreshCw size={13} /> Scan now
                </Button>
              </div>
            )}

          {/* ── Empty: config not loaded yet ── */}
          {projects.length === 0 && !configData && (
            <div className="flex flex-col items-center gap-2 py-24 text-muted-foreground">
              <AlertCircle size={28} className="text-border" />
              <p className="text-sm">No projects found</p>
            </div>
          )}

          {/* ── Project list ── */}
          {projects.length > 0 && (
            <>
              {/* No filter results */}
              {sorted.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-24 text-muted-foreground">
                  <Search size={28} className="text-border" />
                  <p className="text-sm">
                    No projects match &ldquo;{search}&rdquo;
                  </p>
                  <button
                    onClick={() => { setSearch(''); setSysFilter('all'); }}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : isSearchActive ? (
                /* ── Flat list (search mode) ── */
                <div className="flex flex-col">
                  <p className="text-xs text-muted-foreground px-2 mb-1">
                    {sorted.length} result{sorted.length !== 1 ? 's' : ''}
                  </p>
                  {sorted.map((project) => (
                    <FlatProjectRow
                      key={project.path}
                      project={project}
                      roots={roots}
                      onBuild={setBuildTarget}
                    />
                  ))}
                </div>
              ) : (
                /* ── Grouped list ── */
                <div className="flex flex-col gap-0.5">
                  {groups.map((group) => {
                    const isExpanded = expanded.has(group.key);
                    return (
                      <div key={group.key}>
                        <GroupHeader
                          label={group.label}
                          count={group.projects.length}
                          isExpanded={isExpanded}
                          onToggle={() => toggleGroup(group.key)}
                        />
                        {isExpanded && (
                          <div className="ml-3 border-l border-border/40 mt-0.5 mb-1">
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
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Ad-hoc build dialog ── */}
      <AdHocBuildDialog
        project={buildTarget}
        onClose={() => setBuildTarget(null)}
        onRun={(goals, flags, java) => void handleBuildRun(goals, flags, java)}
        isRunning={adHocBuild.isPending}
      />
    </div>
  );
}
