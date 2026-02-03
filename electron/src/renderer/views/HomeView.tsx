/**
 * Home View / Dashboard
 * 
 * Shows overview with stats and quick actions.
 */

import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  FolderGit2, 
  Coffee, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ArrowRight,
  Zap
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
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<FolderGit2 size={24} />}
          label="Projekte"
          value={stats.projects}
          sublabel={`${stats.mavenProjects} mit Maven`}
          color="blue"
        />
        <StatCard
          icon={<Coffee size={24} />}
          label="JDKs"
          value={stats.jdks}
          sublabel="verfügbar"
          color="orange"
        />
        <StatCard
          icon={<Play size={24} />}
          label="Aktive Builds"
          value={stats.runningJobs}
          sublabel={`${stats.pendingJobs} wartend`}
          color="yellow"
        />
        <StatCard
          icon={<CheckCircle2 size={24} />}
          label="Erfolgreich"
          value={stats.completedJobs}
          sublabel={`${stats.failedJobs} fehlgeschlagen`}
          color="green"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Zap size={20} className="text-yellow-400" />
          Schnellaktionen
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <QuickAction
            label="Projekt auswählen"
            description="Maven-Projekt für Build wählen"
            onClick={() => setScreen('PROJECTS')}
          />
          <QuickAction
            label="Jobs anzeigen"
            description="Laufende und vergangene Builds"
            onClick={() => setScreen('JOBS')}
          />
          <QuickAction
            label="Einstellungen"
            description="Pfade und Optionen konfigurieren"
            onClick={() => setScreen('SETTINGS')}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Maven-Projekte</h3>
            <button
              onClick={() => setScreen('PROJECTS')}
              className="text-sm text-gfos-400 hover:text-gfos-300 flex items-center gap-1"
            >
              Alle anzeigen <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {projects.filter((p) => p.hasPom).slice(0, 5).map((project) => (
              <button
                key={project.path}
                onClick={() => handleProjectClick(project.path)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-left"
              >
                <FolderGit2 size={18} className="text-gfos-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{project.name}</p>
                  <p className="text-xs text-slate-400 truncate">{project.path}</p>
                </div>
                <ArrowRight size={16} className="text-slate-500" />
              </button>
            ))}
            {projects.filter((p) => p.hasPom).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">
                Keine Maven-Projekte gefunden
              </p>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Letzte Builds</h3>
            <button
              onClick={() => setScreen('JOBS')}
              className="text-sm text-gfos-400 hover:text-gfos-300 flex items-center gap-1"
            >
              Alle anzeigen <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50"
              >
                <JobStatusIcon status={job.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{job.name}</p>
                  <p className="text-xs text-slate-400">
                    {job.mavenGoals.join(' ')}
                  </p>
                </div>
                {job.status === 'running' && (
                  <div className="text-xs text-yellow-400">{job.progress}%</div>
                )}
              </div>
            ))}
            {recentJobs.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">
                Noch keine Builds ausgeführt
              </p>
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
  color: 'blue' | 'orange' | 'yellow' | 'green';
}

function StatCard({ icon, label, value, sublabel, color }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-700',
    orange: 'from-orange-500 to-orange-700',
    yellow: 'from-yellow-500 to-yellow-700',
    green: 'from-green-500 to-green-700',
  };

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          <p className="text-xs text-slate-500 mt-1">{sublabel}</p>
        </div>
        <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]} text-white`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

interface QuickActionProps {
  label: string;
  description: string;
  onClick: () => void;
}

function QuickAction({ label, description, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-gfos-500 transition-all text-left group"
    >
      <p className="font-medium text-white group-hover:text-gfos-400 transition-colors">
        {label}
      </p>
      <p className="text-sm text-slate-400 mt-1">{description}</p>
    </button>
  );
}

function JobStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Clock size={18} className="text-yellow-400 animate-pulse" />;
    case 'success':
      return <CheckCircle2 size={18} className="text-green-400" />;
    case 'failed':
      return <XCircle size={18} className="text-red-400" />;
    case 'pending':
      return <Clock size={18} className="text-slate-400" />;
    default:
      return <Clock size={18} className="text-slate-400" />;
  }
}
