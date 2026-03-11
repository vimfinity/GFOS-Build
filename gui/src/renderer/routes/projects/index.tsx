import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { scanQuery, configQuery, useRefreshScan, useAdHocBuild } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SkeletonCard } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { FolderSearch, RefreshCw, Play, Package, Loader2, AlertCircle } from 'lucide-react';
import type { Project } from '@shared/types';

export const Route = createFileRoute('/projects/')({
  component: ProjectsView,
});

function BuildSystemBadge({ system }: { system: 'maven' | 'npm' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold shrink-0',
        system === 'maven'
          ? 'bg-primary/20 text-primary border border-primary/30'
          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      )}
    >
      {system === 'maven' ? 'M' : 'N'}
    </span>
  );
}

interface AdHocBuildDialogProps {
  project: Project | null;
  defaultGoals: string;
  jdkVersions: string[];
  onClose: () => void;
  onRun: (goals: string[], flags: string[], java?: string) => void;
  isRunning: boolean;
}

function AdHocBuildDialog({
  project,
  defaultGoals,
  jdkVersions,
  onClose,
  onRun,
  isRunning,
}: AdHocBuildDialogProps) {
  const [goals, setGoals] = useState(defaultGoals);
  const [flags, setFlags] = useState('');
  const [javaVersion, setJavaVersion] = useState('');

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
              <label className="text-xs font-medium text-muted-foreground">Java version (optional)</label>
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
                        : 'border-border text-muted-foreground hover:text-foreground',
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
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleRun} disabled={isRunning || !goals.trim()}>
            {isRunning ? <><Loader2 size={12} className="animate-spin" /> Starting…</> : <><Play size={12} /> Run build</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({ project, onBuild }: { project: Project; onBuild: (p: Project) => void }) {
  return (
    <Card className="hover:border-border/80 transition-colors duration-150">
      <CardContent className="p-4 flex flex-col gap-2.5">
        <div className="flex items-start gap-2.5">
          <BuildSystemBadge system={project.buildSystem} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-tight truncate">{project.name}</h3>
            <span className="text-[10px] font-mono text-muted-foreground/70 truncate block mt-0.5">
              {project.rootName}:{project.path.split(project.rootName).pop()?.replace(/^[/\\]/, '') ?? project.path}
            </span>
          </div>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5">
          {project.maven?.artifactId && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground border border-border">
              {project.maven.artifactId}
            </span>
          )}
          {project.maven?.javaVersion && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">
              Java {project.maven.javaVersion}
            </span>
          )}
          {project.npm?.version && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground border border-border">
              v{project.npm.version}
            </span>
          )}
          {project.npm?.isAngular && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/25">
              Angular {project.npm.angularVersion ?? ''}
            </span>
          )}
          {project.maven?.isAggregator && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground border border-border">
              aggregator
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="self-start h-7 px-2.5 text-xs mt-0.5"
          onClick={() => onBuild(project)}
        >
          <Play size={11} /> Build
        </Button>
      </CardContent>
    </Card>
  );
}

function ProjectsView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: scanData, isLoading } = useQuery(scanQuery);
  const { data: configData } = useQuery(configQuery);
  const refreshScan = useRefreshScan();
  const adHocBuild = useAdHocBuild();

  const [rootFilter, setRootFilter] = useState('');
  const [systemFilter, setSystemFilter] = useState<'' | 'maven' | 'npm'>('');
  const [buildTarget, setBuildTarget] = useState<Project | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const projects = scanData?.projects ?? [];

  const roots = [...new Set(projects.map((p) => p.rootName))].sort();

  const filtered = projects.filter((p) => {
    if (rootFilter && p.rootName !== rootFilter) return false;
    if (systemFilter && p.buildSystem !== systemFilter) return false;
    return true;
  });

  const defaultGoals = configData?.config.maven.defaultGoals.join(' ') ?? 'clean install';
  const jdkVersions = Object.keys(configData?.config.jdkRegistry ?? {});

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

  return (
    <div className="p-6 flex flex-col gap-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderSearch size={18} className="text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Projects</h1>
            <p className="text-xs text-muted-foreground">
              {projects.length > 0
                ? `${projects.length} project${projects.length !== 1 ? 's' : ''} found${scanData?.fromCache ? ' (cached)' : ''}`
                : isLoading
                ? 'Scanning…'
                : 'No projects found'}
              {scanData?.durationMs != null && (
                <span className="ml-1 opacity-60">· {scanData.durationMs}ms</span>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing}
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      {projects.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Root filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setRootFilter('')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs border transition-colors',
                rootFilter === ''
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80',
              )}
            >
              All roots
            </button>
            {roots.map((r) => (
              <button
                key={r}
                onClick={() => setRootFilter(rootFilter === r ? '' : r)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs border transition-colors',
                  rootFilter === r
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80',
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-border" />

          {/* Build system filter */}
          {(['', 'maven', 'npm'] as const).map((sys) => (
            <button
              key={sys ?? 'all'}
              onClick={() => setSystemFilter(sys)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs border transition-colors',
                systemFilter === sys
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80',
              )}
            >
              {sys === '' ? 'All' : sys === 'maven' ? 'Maven' : 'npm'}
            </button>
          ))}

          {filtered.length !== projects.length && (
            <span className="text-xs text-muted-foreground ml-1">
              {filtered.length} shown
            </span>
          )}
        </div>
      )}

      {/* Project grid */}
      {isLoading ? (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          {projects.length === 0 ? (
            <>
              <AlertCircle size={32} className="text-border" />
              <p className="text-sm">No projects found in configured roots.</p>
              <p className="text-xs">Make sure roots are set up in settings, then click Refresh.</p>
            </>
          ) : (
            <>
              <Package size={32} className="text-border" />
              <p className="text-sm">No projects match the current filters.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.path} project={p} onBuild={setBuildTarget} />
          ))}
        </div>
      )}

      {/* Ad-hoc build dialog */}
      <AdHocBuildDialog
        project={buildTarget}
        defaultGoals={defaultGoals}
        jdkVersions={jdkVersions}
        onClose={() => setBuildTarget(null)}
        onRun={(goals, flags, java) => void handleBuildRun(goals, flags, java)}
        isRunning={adHocBuild.isPending}
      />
    </div>
  );
}
