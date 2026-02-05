/**
 * Home View / Terminal Dashboard
 * 
 * Neon-terminal inspired dashboard with system overview.
 */

import { useState, type ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  FolderGit2, 
  Coffee, 
  Activity, 
  CheckCircle2,
  ChevronRight,
  Zap,
  Terminal,
  GitBranch,
  ArrowUpRight
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
      {/* Header Section */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} className="text-[#22ffaa]" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-display">System Overview</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-zinc-100 uppercase tracking-wide">
            Dashboard
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Session Active</p>
          <p className="text-xs text-[#22ffaa] font-mono tabular-nums">{new Date().toLocaleDateString('de-DE')}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<FolderGit2 size={20} strokeWidth={1.5} />}
          label="Projekte"
          value={stats.projects}
          sublabel={`${stats.mavenProjects} maven`}
          accent="green"
          delay={0}
        />
        <StatCard
          icon={<Coffee size={20} strokeWidth={1.5} />}
          label="JDKs"
          value={stats.jdks}
          sublabel="verfügbar"
          accent="cyan"
          delay={1}
        />
        <StatCard
          icon={<Activity size={20} strokeWidth={1.5} />}
          label="Aktiv"
          value={stats.runningJobs}
          sublabel={`${stats.pendingJobs} queue`}
          accent="orange"
          delay={2}
        />
        <StatCard
          icon={<CheckCircle2 size={20} strokeWidth={1.5} />}
          label="Builds"
          value={stats.completedJobs}
          sublabel={`${stats.failedJobs} failed`}
          accent={stats.failedJobs > 0 ? 'red' : 'green'}
          delay={3}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-[#0c0c0e] border border-[#1a1a1f] animate-slide-up" style={{ animationDelay: '100ms' }}>
        <div className="px-5 py-3 border-b border-[#1a1a1f] flex items-center justify-between">
          <span className="text-[10px] text-[#22ffaa] uppercase tracking-[0.15em] font-display font-bold flex items-center gap-2">
            <Zap size={14} />
            Quick Actions
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            <QuickAction
              label="Neuer Build"
              description="Maven Projekt starten"
              shortcut="01"
              onClick={() => setScreen('PROJECTS')}
            />
            <QuickAction
              label="Prozesse"
              description="Build Queue anzeigen"
              shortcut="02"
              onClick={() => setScreen('JOBS')}
            />
            <QuickAction
              label="Konfiguration"
              description="System Settings"
              shortcut="03"
              onClick={() => setScreen('SETTINGS')}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Recent Projects */}
        <div className="bg-[#0c0c0e] border border-[#1a1a1f] animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="px-5 py-3 border-b border-[#1a1a1f] flex items-center justify-between">
            <span className="text-[10px] text-[#22ffaa] uppercase tracking-[0.15em] font-display font-bold flex items-center gap-2">
              <GitBranch size={14} />
              Maven Projekte
            </span>
            <button
              onClick={() => setScreen('PROJECTS')}
              className="text-[10px] text-zinc-500 hover:text-[#22ffaa] flex items-center gap-1 uppercase tracking-wider transition-colors group"
            >
              Alle 
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
          <div>
            {projects.filter((p) => p.hasPom).slice(0, 5).map((project, i) => (
              <ProjectListItem
                key={project.path}
                name={project.name}
                path={project.path}
                index={i}
                onClick={() => handleProjectClick(project.path)}
              />
            ))}
            {projects.filter((p) => p.hasPom).length === 0 && (
              <div className="px-5 py-10 text-center">
                <FolderGit2 size={24} className="mx-auto text-zinc-700 mb-3" />
                <p className="text-xs text-zinc-600">Keine Maven-Projekte gefunden</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-[#0c0c0e] border border-[#1a1a1f] animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="px-5 py-3 border-b border-[#1a1a1f] flex items-center justify-between">
            <span className="text-[10px] text-[#22ffaa] uppercase tracking-[0.15em] font-display font-bold flex items-center gap-2">
              <Activity size={14} />
              Letzte Prozesse
            </span>
            <button
              onClick={() => setScreen('JOBS')}
              className="text-[10px] text-zinc-500 hover:text-[#22ffaa] flex items-center gap-1 uppercase tracking-wider transition-colors group"
            >
              Alle 
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
          <div>
            {recentJobs.map((job, i) => (
              <JobListItem
                key={job.id}
                name={job.name}
                goals={job.mavenGoals.join(' ')}
                status={job.status}
                progress={job.progress}
                index={i}
              />
            ))}
            {recentJobs.length === 0 && (
              <div className="px-5 py-10 text-center">
                <Activity size={24} className="mx-auto text-zinc-700 mb-3" />
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
  icon: ReactNode;
  label: string;
  value: number;
  sublabel: string;
  accent: 'green' | 'cyan' | 'orange' | 'red';
  delay: number;
}

function StatCard({ icon, label, value, sublabel, accent, delay }: StatCardProps) {
  const [hovered, setHovered] = useState(false);
  
  const colors = {
    green: { 
      text: 'text-[#22ffaa]', 
      border: 'border-[#22ffaa]/30', 
      bg: 'bg-[#22ffaa]/5',
      glow: 'shadow-[0_0_20px_rgba(34,255,170,0.15)]'
    },
    cyan: { 
      text: 'text-[#00d4ff]', 
      border: 'border-[#00d4ff]/30', 
      bg: 'bg-[#00d4ff]/5',
      glow: 'shadow-[0_0_20px_rgba(0,212,255,0.15)]'
    },
    orange: { 
      text: 'text-[#ffaa00]', 
      border: 'border-[#ffaa00]/30', 
      bg: 'bg-[#ffaa00]/5',
      glow: 'shadow-[0_0_20px_rgba(255,170,0,0.15)]'
    },
    red: { 
      text: 'text-[#ff4477]', 
      border: 'border-[#ff4477]/30', 
      bg: 'bg-[#ff4477]/5',
      glow: 'shadow-[0_0_20px_rgba(255,68,119,0.15)]'
    },
  };

  const c = colors[accent];

  return (
    <div 
      className={`
        bg-[#0c0c0e] border border-[#1a1a1f] relative overflow-hidden
        transition-all duration-300 cursor-default animate-slide-up
        ${hovered ? `${c.border} ${c.glow}` : ''}
      `}
      style={{ animationDelay: `${delay * 50}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Corner accent */}
      <div className={`absolute top-0 right-0 w-8 h-8 ${c.bg} transition-all ${hovered ? 'w-12 h-12' : ''}`} />
      
      <div className="p-5 relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 border ${c.border} ${c.bg} ${c.text} transition-transform ${hovered ? 'scale-110' : ''}`}>
            {icon}
          </div>
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-display">
            {label}
          </span>
        </div>
        <div className="flex items-end justify-between">
          <p className={`text-3xl font-display font-bold text-zinc-100 tabular-nums transition-colors ${hovered ? c.text : ''}`}>
            {value}
          </p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{sublabel}</p>
        </div>
      </div>
    </div>
  );
}

interface QuickActionProps {
  label: string;
  description: string;
  shortcut: string;
  onClick: () => void;
}

function QuickAction({ label, description, shortcut, onClick }: QuickActionProps) {
  const [hovered, setHovered] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        p-4 border bg-[#0e0e11] text-left relative overflow-hidden
        transition-all duration-200 group
        ${hovered 
          ? 'border-[#22ffaa]/50 bg-[#22ffaa]/5' 
          : 'border-[#1a1a1f] hover:border-[#252528]'
        }
      `}
    >
      {/* Shortcut badge */}
      <span className={`
        absolute top-2 right-2 text-[9px] font-mono
        transition-colors
        ${hovered ? 'text-[#22ffaa]/60' : 'text-zinc-700'}
      `}>
        {shortcut}
      </span>
      
      {/* Label */}
      <p className={`
        text-sm font-medium uppercase tracking-wider mb-1
        transition-colors
        ${hovered ? 'text-[#22ffaa]' : 'text-zinc-300'}
      `}>
        {label}
      </p>
      
      {/* Description */}
      <p className="text-[10px] text-zinc-600">
        {description}
      </p>
      
      {/* Arrow indicator */}
      <ArrowUpRight 
        size={14} 
        className={`
          absolute bottom-3 right-3 transition-all
          ${hovered ? 'text-[#22ffaa] opacity-100 translate-x-0 translate-y-0' : 'text-zinc-700 opacity-0 translate-x-1 translate-y-1'}
        `}
      />
    </button>
  );
}

interface ProjectListItemProps {
  name: string;
  path: string;
  index: number;
  onClick: () => void;
}

function ProjectListItem({ name, path, index, onClick }: ProjectListItemProps) {
  const [hovered, setHovered] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        w-full flex items-center gap-3 px-5 py-3.5 text-left
        border-b border-[#1a1a1f] last:border-b-0
        transition-all duration-150
        ${hovered ? 'bg-[#151518]' : ''}
      `}
    >
      {/* Line indicator */}
      <div className={`
        w-[2px] h-6 bg-[#22ffaa] transition-all
        ${hovered ? 'opacity-100' : 'opacity-0'}
      `} />
      
      <span className={`
        text-[10px] font-mono w-5 tabular-nums transition-colors
        ${hovered ? 'text-zinc-500' : 'text-zinc-700'}
      `}>
        {String(index + 1).padStart(2, '0')}
      </span>
      
      <FolderGit2 
        size={16} 
        className={`transition-colors ${hovered ? 'text-[#22ffaa]' : 'text-zinc-600'}`}
      />
      
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate transition-colors ${hovered ? 'text-[#22ffaa]' : 'text-zinc-300'}`}>
          {name}
        </p>
        <p className="text-[10px] text-zinc-600 truncate font-mono">
          {path}
        </p>
      </div>
      
      <ChevronRight 
        size={14} 
        className={`
          transition-all
          ${hovered ? 'text-[#22ffaa] translate-x-0 opacity-100' : 'text-zinc-700 -translate-x-1 opacity-0'}
        `}
      />
    </button>
  );
}

interface JobListItemProps {
  name: string;
  goals: string;
  status: string;
  progress: number;
  index: number;
}

function JobListItem({ name, goals, status, progress }: JobListItemProps) {
  const config = {
    running: { color: 'bg-[#22ffaa]', pulse: true, text: 'text-[#22ffaa]' },
    success: { color: 'bg-[#22ffaa]', pulse: false, text: 'text-[#22ffaa]' },
    failed: { color: 'bg-[#ff4477]', pulse: false, text: 'text-[#ff4477]' },
    pending: { color: 'bg-[#ffaa00]', pulse: false, text: 'text-[#ffaa00]' },
    cancelled: { color: 'bg-zinc-600', pulse: false, text: 'text-zinc-600' },
  }[status] || { color: 'bg-zinc-600', pulse: false, text: 'text-zinc-600' };

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#1a1a1f] last:border-b-0 hover:bg-[#151518] transition-colors">
      {/* Status dot */}
      <div className={`w-2 h-2 ${config.color} ${config.pulse ? 'animate-pulse shadow-[0_0_8px_#22ffaa]' : ''}`} />
      
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-300 truncate">{name}</p>
        <p className="text-[10px] text-zinc-600 font-mono truncate">{goals}</p>
      </div>
      
      {status === 'running' && (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1 bg-[#1a1a1f] overflow-hidden">
            <div 
              className="h-full bg-[#22ffaa] transition-all shadow-[0_0_8px_#22ffaa]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-[#22ffaa] font-mono w-8 tabular-nums">{progress}%</span>
        </div>
      )}
    </div>
  );
}
