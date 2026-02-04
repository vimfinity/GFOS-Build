/**
 * Home View / Terminal Dashboard - Premium Edition
 * 
 * Neon-terminal dashboard with sophisticated animations and micro-interactions.
 */

import { motion, AnimatePresence, Variants } from 'framer-motion';
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
  Sparkles,
  Gauge
} from 'lucide-react';

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

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
    <motion.div 
      className="space-y-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Section */}
      <motion.div 
        className="flex items-end justify-between mb-6"
        variants={itemVariants}
      >
        <div>
          <motion.div 
            className="flex items-center gap-2 mb-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <Terminal size={14} className="text-neon-green" />
            </motion.div>
            <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-display">System Overview</span>
          </motion.div>
          <motion.h1 
            className="font-display text-2xl font-bold text-zinc-100 uppercase tracking-wide"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Dashboard
          </motion.h1>
        </div>
        <motion.div 
          className="text-right"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Session Active</p>
          <motion.p 
            className="text-xs text-neon-green font-mono"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {new Date().toLocaleDateString('de-DE')}
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div 
        className="grid grid-cols-4 gap-4"
        variants={containerVariants}
      >
        <StatCard
          icon={<FolderGit2 size={20} strokeWidth={1.5} />}
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
      </motion.div>

      {/* Quick Actions */}
      <motion.div 
        className="card overflow-hidden"
        variants={itemVariants}
      >
        <div className="card-header">
          <span className="card-title flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Zap size={14} className="text-neon-orange" />
            </motion.div>
            Quick Actions
          </span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-3">
            <QuickAction
              label="Neuer Build"
              shortcut="01"
              onClick={() => setScreen('PROJECTS')}
              icon={<Sparkles size={16} />}
              delay={0}
            />
            <QuickAction
              label="Prozesse"
              shortcut="02"
              onClick={() => setScreen('JOBS')}
              icon={<Activity size={16} />}
              delay={0.1}
            />
            <QuickAction
              label="Konfiguration"
              shortcut="03"
              onClick={() => setScreen('SETTINGS')}
              icon={<Gauge size={16} />}
              delay={0.2}
            />
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        {/* Recent Projects */}
        <motion.div className="card overflow-hidden" variants={itemVariants}>
          <div className="card-header">
            <span className="card-title flex items-center gap-2">
              <GitBranch size={14} />
              Maven Projekte
            </span>
            <motion.button
              onClick={() => setScreen('PROJECTS')}
              className="text-[10px] text-zinc-500 hover:text-neon-green flex items-center gap-1 uppercase tracking-wider transition-colors"
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.95 }}
            >
              Alle <ChevronRight size={12} />
            </motion.button>
          </div>
          <div className="card-body p-0">
            <AnimatePresence>
              {projects.filter((p) => p.hasPom).slice(0, 5).map((project, i) => (
                <motion.button
                  key={project.path}
                  onClick={() => handleProjectClick(project.path)}
                  className="w-full flex items-center gap-3 px-4 py-3 
                             hover:bg-terminal-mid/80 text-left group
                             border-b border-terminal-border/50 last:border-b-0
                             relative overflow-hidden"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ x: 4, backgroundColor: "rgba(0, 255, 136, 0.03)" }}
                  whileTap={{ scale: 0.99 }}
                >
                  {/* Hover glow effect */}
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  
                  <span className="text-[10px] text-zinc-700 font-mono w-5 relative z-10">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <motion.div
                    className="relative z-10"
                    whileHover={{ rotate: 15 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <FolderGit2 size={16} className="text-zinc-600 group-hover:text-neon-green transition-colors" />
                  </motion.div>
                  <div className="flex-1 min-w-0 relative z-10">
                    <p className="text-sm text-zinc-300 group-hover:text-neon-green truncate transition-colors">
                      {project.name}
                    </p>
                    <p className="text-[10px] text-zinc-600 truncate font-mono">
                      {project.path}
                    </p>
                  </div>
                  <motion.div
                    className="relative z-10"
                    initial={{ x: -5, opacity: 0 }}
                    whileHover={{ x: 0, opacity: 1 }}
                  >
                    <ChevronRight size={14} className="text-neon-green" />
                  </motion.div>
                </motion.button>
              ))}
            </AnimatePresence>
            {projects.filter((p) => p.hasPom).length === 0 && (
              <motion.div 
                className="px-4 py-8 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="text-xs text-zinc-600">Keine Maven-Projekte gefunden</p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Recent Jobs */}
        <motion.div className="card overflow-hidden" variants={itemVariants}>
          <div className="card-header">
            <span className="card-title flex items-center gap-2">
              <Activity size={14} />
              Letzte Prozesse
            </span>
            <motion.button
              onClick={() => setScreen('JOBS')}
              className="text-[10px] text-zinc-500 hover:text-neon-green flex items-center gap-1 uppercase tracking-wider transition-colors"
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.95 }}
            >
              Alle <ChevronRight size={12} />
            </motion.button>
          </div>
          <div className="card-body p-0">
            <AnimatePresence>
              {recentJobs.map((job, i) => (
                <motion.div
                  key={job.id}
                  className="flex items-center gap-3 px-4 py-3 
                             border-b border-terminal-border/50 last:border-b-0
                             hover:bg-terminal-mid/50 transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
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
                      <div className="w-16 h-1.5 bg-terminal-mid overflow-hidden relative">
                        <motion.div 
                          className="absolute inset-y-0 left-0 bg-neon-green"
                          initial={{ width: 0 }}
                          animate={{ width: `${job.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                        {/* Animated shimmer */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                      <motion.span 
                        className="text-[10px] text-neon-green font-mono w-8 tabular-nums"
                        key={job.progress}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                      >
                        {job.progress}%
                      </motion.span>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {recentJobs.length === 0 && (
              <motion.div 
                className="px-4 py-8 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="text-xs text-zinc-600">Noch keine Builds ausgeführt</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
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
    green: {
      border: 'border-neon-green/30 hover:border-neon-green/60',
      bg: 'bg-neon-green/5',
      text: 'text-neon-green',
      glow: 'rgba(0, 255, 136, 0.15)',
    },
    cyan: {
      border: 'border-neon-cyan/30 hover:border-neon-cyan/60',
      bg: 'bg-neon-cyan/5',
      text: 'text-neon-cyan',
      glow: 'rgba(0, 229, 255, 0.15)',
    },
    orange: {
      border: 'border-neon-orange/30 hover:border-neon-orange/60',
      bg: 'bg-neon-orange/5',
      text: 'text-neon-orange',
      glow: 'rgba(255, 149, 0, 0.15)',
    },
    red: {
      border: 'border-neon-red/30 hover:border-neon-red/60',
      bg: 'bg-neon-red/5',
      text: 'text-neon-red',
      glow: 'rgba(255, 51, 102, 0.15)',
    },
  };

  const colors = accentColors[accent];

  return (
    <motion.div 
      className={`card group cursor-pointer transition-all duration-300 ${colors.border}`}
      variants={itemVariants}
      whileHover={{ 
        scale: 1.03, 
        y: -4,
        boxShadow: `0 10px 40px -10px ${colors.glow}`,
      }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="p-4 relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-current opacity-5" />
        </div>
        
        <div className="flex items-start justify-between mb-3 relative z-10">
          <motion.div 
            className={`p-2.5 border ${colors.border} ${colors.bg} ${colors.text}`}
            whileHover={{ rotate: 5, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {icon}
          </motion.div>
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-display">
            {label}
          </span>
        </div>
        <div className="flex items-end justify-between relative z-10">
          <motion.p 
            className="text-3xl font-display font-bold text-zinc-100"
            key={value}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            {value}
          </motion.p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{sublabel}</p>
        </div>
      </div>
    </motion.div>
  );
}

interface QuickActionProps {
  label: string;
  shortcut: string;
  onClick: () => void;
  icon: React.ReactNode;
  delay: number;
}

function QuickAction({ label, shortcut, onClick, icon, delay }: QuickActionProps) {
  return (
    <motion.button
      onClick={onClick}
      className="p-4 border border-terminal-border bg-terminal-mid/50
                 hover:border-neon-green/50 hover:bg-neon-green/5
                 transition-colors text-left group relative overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Hover effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-neon-green/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
      />
      
      {/* Corner accent */}
      <motion.div
        className="absolute top-0 right-0 w-0 h-0 border-t-[20px] border-r-[20px] border-t-neon-green/20 border-r-transparent opacity-0 group-hover:opacity-100 transition-opacity"
      />
      
      <span className="absolute top-2 right-2 text-[9px] text-zinc-700 font-mono group-hover:text-neon-green/60 transition-colors">
        {shortcut}
      </span>
      
      <div className="relative z-10 flex items-center gap-2">
        <motion.span 
          className="text-zinc-600 group-hover:text-neon-green transition-colors"
          whileHover={{ rotate: 15, scale: 1.1 }}
        >
          {icon}
        </motion.span>
        <p className="text-xs text-zinc-400 group-hover:text-neon-green transition-colors uppercase tracking-wider">
          {label}
        </p>
      </div>
    </motion.button>
  );
}

function JobStatusIndicator({ status }: { status: string }) {
  const config = {
    running: { color: 'bg-neon-green', glow: 'shadow-[0_0_10px_rgba(0,255,136,0.5)]', pulse: true },
    success: { color: 'bg-neon-green', glow: '', pulse: false },
    failed: { color: 'bg-neon-red', glow: 'shadow-[0_0_8px_rgba(255,51,102,0.5)]', pulse: false },
    pending: { color: 'bg-neon-orange', glow: '', pulse: true },
    cancelled: { color: 'bg-zinc-600', glow: '', pulse: false },
  }[status] || { color: 'bg-zinc-600', glow: '', pulse: false };

  return (
    <motion.div 
      className={`w-2 h-2 ${config.color} ${config.glow}`}
      animate={config.pulse ? { 
        scale: [1, 1.3, 1],
        opacity: [1, 0.7, 1],
      } : {}}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  );
}
