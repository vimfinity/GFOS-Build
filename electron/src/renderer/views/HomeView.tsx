/**
 * Home View / Terminal Dashboard
 * 
 * Neon-terminal inspired dashboard with system overview.
 */

import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  FolderCode, 
  Coffee, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronRight,
  Zap,
  Terminal,
  GitBranch
} from 'lucide-react';

export function HomeView() {
  const projects = useAppStore((state) => state.projects);
  const jdks = useAppStore((state) => state.jdks);
  const jobs = useAppStore((state) => state.jobs);
  const setScreen = useAppStore((state) => state.setScreen);
  const selectProject = useAppStore((state) => state.selectProject);

  const stats = {
    projects: projects.length,
    mavenProjects: projects.filter((p) => p.hasPom).length,
    jdks: jdks.length,
    runningJobs: jobs.filter((j) => j.status === 'running').length,
    pendingJobs: jobs.filter((j) => j.status === 'pending').length,
    completedJobs: jobs.filter((j) => j.status === 'success').length,
    failedJobs: jobs.filter((j) => j.status === 'failed').length,
  };

  const recentJobs = [...jobs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const handleProjectClick = (projectPath: string) => {
    selectProject(projectPath);
    setScreen('PROJECT_DETAIL');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Section */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Terminal size={14} className="text-neon-green" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-display">System Overview</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-zinc-100 uppercase tracking-wide">
            Dashboard
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Session Active</p>
          <p className="text-xs text-neon-green font-mono">{new Date().toLocaleDateString('de-DE')}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<FolderCode size={20} strokeWidth={1.5} />}
          label="Projekte"
          value={stats.projects}
          sublabel={`${stats.mavenProjects} maven`}
          accent="green"
        />
        <StatCard
          icon={<Coffee size={20} strokeWidth={1.5} />}
          label="JDKs"
          value={stats.jdks}
          sublabel="verfügbar"
          accent="cyan"
        />
        <StatCard
          icon={<Activity size={20} strokeWidth={1.5} />}
          label="Aktiv"
          value={stats.runningJobs}
          sublabel={`${stats.pendingJobs} queue`}
          accent="orange"
        />
        <StatCard
          icon={<CheckCircle2 size={20} strokeWidth={1.5} />}
          label="Builds"
          value={stats.completedJobs}
          sublabel={`${stats.failedJobs} failed`}
          accent={stats.failedJobs > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <span className="card-title flex items-center gap-2">
            <Zap size={14} />
            Quick Actions
          </span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-3">
            <QuickAction
              label="Neuer Build"
              shortcut="01"
              onClick={() => setScreen('PROJECTS')}
            />
            <QuickAction
              label="Prozesse"
              shortcut="02"
              onClick={() => setScreen('JOBS')}
            />
            <QuickAction
              label="Konfiguration"
              shortcut="03"
              onClick={() => setScreen('SETTINGS')}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Recent Projects */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2">
              <GitBranch size={14} />
              Maven Projekte
            </span>
            <button
              onClick={() => setScreen('PROJECTS')}
              className="text-[10px] text-zinc-500 hover:text-neon-green flex items-center gap-1 uppercase tracking-wider transition-colors"
            >
              Alle <ChevronRight size={12} />
            </button>
          </div>
          <div className="card-body p-0">
            {projects.filter((p) => p.hasPom).slice(0, 5).map((project, i) => (
              <button
                key={project.path}
                onClick={() => handleProjectClick(project.path)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 
                  hover:bg-terminal-mid transition-colors text-left group
                  border-b border-terminal-border last:border-b-0
                  animate-slide-up stagger-${i + 1}
                `}
              >
                <span className="text-[10px] text-zinc-700 font-mono w-5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <FolderCode size={16} className="text-zinc-600 group-hover:text-neon-green transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 group-hover:text-neon-green truncate transition-colors">
                    {project.name}
                  </p>
                  <p className="text-[10px] text-zinc-600 truncate font-mono">
                    {project.path}
                  </p>
                </div>
                <ChevronRight size={14} className="text-zinc-700 group-hover:text-neon-green transition-colors" />
              </button>
            ))}
            {projects.filter((p) => p.hasPom).length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-zinc-600">Keine Maven-Projekte gefunden</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2">
              <Activity size={14} />
              Letzte Prozesse
            </span>
            <button
              onClick={() => setScreen('JOBS')}
              className="text-[10px] text-zinc-500 hover:text-neon-green flex items-center gap-1 uppercase tracking-wider transition-colors"
            >
              Alle <ChevronRight size={12} />
            </button>
          </div>
          <div className="card-body p-0">
            {recentJobs.map((job, i) => (
              <div
                key={job.id}
                className={`
                  flex items-center gap-3 px-4 py-3 
                  border-b border-terminal-border last:border-b-0
                  animate-slide-up stagger-${i + 1}
                `}
              >
                <JobStatusIndicator status={job.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{job.name}</p>
                  <p className="text-[10px] text-zinc-600 font-mono">
                    {job.mavenGoals.join(' ')}
                  </p>
                </div>
                {job.status === 'running' && (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-terminal-mid overflow-hidden">
                      <div 
                        className="h-full bg-neon-green transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-neon-green font-mono w-8">{job.progress}%</span>
                  </div>
                )}
              </div>
            ))}
            {recentJobs.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-zinc-600">Noch keine Builds ausgeführt</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  sublabel: string;
  accent: 'green' | 'cyan' | 'orange' | 'red';
}

function StatCard({ icon, label, value, sublabel, accent }: StatCardProps) {
  const accentColors = {
    green: 'text-neon-green border-neon-green/30 bg-neon-green/5',
    cyan: 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5',
    orange: 'text-neon-orange border-neon-orange/30 bg-neon-orange/5',
    red: 'text-neon-red border-neon-red/30 bg-neon-red/5',
  };

  return (
    <div className="card group hover:border-neon-green/50 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 border ${accentColors[accent]}`}>
            {icon}
          </div>
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-display">
            {label}
          </span>
        </div>
        <div className="flex items-end justify-between">
          <p className="text-3xl font-display font-bold text-zinc-100">{value}</p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{sublabel}</p>
        </div>
      </div>
    </div>
  );
}

interface QuickActionProps {
  label: string;
  shortcut: string;
  onClick: () => void;
}

function QuickAction({ label, shortcut, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="
        p-4 border border-terminal-border bg-terminal-mid
        hover:border-neon-green hover:bg-neon-green/5
        transition-all text-left group relative
      "
    >
      <span className="absolute top-2 right-2 text-[9px] text-zinc-700 font-mono">
        {shortcut}
      </span>
      <p className="text-xs text-zinc-400 group-hover:text-neon-green transition-colors uppercase tracking-wider">
        {label}
      </p>
    </button>
  );
}

function JobStatusIndicator({ status }: { status: string }) {
  const config = {
    running: { color: 'bg-neon-green', pulse: true },
    success: { color: 'bg-neon-green', pulse: false },
    failed: { color: 'bg-neon-red', pulse: false },
    pending: { color: 'bg-neon-orange', pulse: false },
    cancelled: { color: 'bg-zinc-600', pulse: false },
  }[status] || { color: 'bg-zinc-600', pulse: false };

  return (
    <div className={`w-2 h-2 ${config.color} ${config.pulse ? 'animate-pulse-neon' : ''}`} />
  );
}
