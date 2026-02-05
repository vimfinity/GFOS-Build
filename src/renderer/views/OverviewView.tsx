/**
 * Overview View - Dashboard Home
 */

import { motion } from 'framer-motion';
import { 
  FolderGit2, Coffee, CheckCircle2, XCircle, 
  Play, Clock, ChevronRight, GitBranch
} from 'lucide-react';
import { useAppStore, useStats } from '../store/useAppStore';
import { StatusIndicator, FlowingStat, ProgressRing } from '../components/shared';

export default function OverviewView() {
  const { 
    projects, 
    buildJobs, 
    jdks, 
    setActiveView, 
    startBuild 
  } = useAppStore();
  const stats = useStats();

  return (
    <>
      {/* Hero Card */}
      <motion.section 
        className="relative bg-gradient-to-br from-petrol-500 to-petrol-700 rounded-3xl p-8 text-white overflow-hidden"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm mb-4">
            <span className="w-2 h-2 bg-success-400 rounded-full animate-pulse" />
            <span>{stats.activeBuilds} Aktiv</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Build Dashboard</h1>
          <p className="text-petrol-100">Verwalte <strong>{stats.mavenProjects}</strong> Maven-Projekte mit <strong>{stats.jdkCount}</strong> JDK-Versionen</p>
        </div>
        <motion.button 
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-white text-petrol-600 font-medium rounded-xl hover:bg-petrol-50 transition-colors"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveView('projects')}
        >
          <Play size={20} />
          <span>Build starten</span>
        </motion.button>
      </motion.section>

      {/* Stats River */}
      <motion.section 
        className="flex items-center gap-2 py-6 overflow-x-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.25 }}
      >
        <FlowingStat 
          icon={<FolderGit2 size={22} />}
          value={stats.mavenProjects}
          label="Projekte"
          onClick={() => setActiveView('projects')}
        />
        <div className="w-8 h-0.5 bg-light-300 dark:bg-dark-600 rounded-full" />
        <FlowingStat 
          icon={<Coffee size={22} />}
          value={stats.jdkCount}
          label="JDK Versionen"
          onClick={() => setActiveView('jdks')}
        />
        <div className="w-8 h-0.5 bg-light-300 dark:bg-dark-600 rounded-full" />
        <FlowingStat 
          icon={<CheckCircle2 size={22} />}
          value={stats.successfulBuilds}
          label="Erfolgreich"
          variant="success"
          onClick={() => setActiveView('builds')}
        />
        <div className="w-8 h-0.5 bg-light-300 dark:bg-dark-600 rounded-full" />
        <FlowingStat 
          icon={<XCircle size={22} />}
          value={stats.failedBuilds}
          label="Fehlgeschlagen"
          variant="error"
          onClick={() => setActiveView('builds')}
        />
      </motion.section>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects Panel */}
        <motion.section 
          className="lg:col-span-2 bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-white/10 shadow-[0_8px_32px_rgba(0,125,143,0.08)] p-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark-500 dark:text-light-100">Aktuelle Projekte</h2>
            <button className="text-sm text-petrol-500 hover:text-petrol-600 font-medium" onClick={() => setActiveView('projects')}>
              Alle anzeigen
            </button>
          </div>

          <div className="space-y-3">
            {projects.slice(0, 5).map((project, i) => (
              <motion.div 
                key={project.id} 
                className="flex items-center gap-4 p-4 bg-light-50 dark:bg-dark-700/50 rounded-xl hover:bg-light-100 dark:hover:bg-dark-700 transition-colors cursor-pointer"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.05 }}
                whileHover={{ y: -3 }}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-petrol-100 dark:bg-petrol-900/30 text-petrol-500">
                  <FolderGit2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-dark-500 dark:text-light-100 truncate">{project.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-dark-300 dark:text-light-400 mt-0.5">
                    <span className="flex items-center gap-1"><GitBranch size={12} />{project.branch}</span>
                    <span className="flex items-center gap-1"><Coffee size={12} />{project.jdk}</span>
                  </div>
                </div>
                {project.lastBuild && (
                  <StatusIndicator status={project.lastBuild.status} />
                )}
                <button 
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-petrol-500 hover:bg-petrol-100 dark:hover:bg-petrol-900/30 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    startBuild(project.id);
                  }}
                >
                  <Play size={16} />
                </button>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Builds Panel */}
          <motion.section 
            className="bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-white/10 shadow-[0_8px_32px_rgba(0,125,143,0.08)] p-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-dark-500 dark:text-light-100">Aktive Builds</h2>
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-medium bg-petrol-100 dark:bg-petrol-900/30 text-petrol-600 dark:text-petrol-400 rounded-full">{stats.activeBuilds}</span>
            </div>

            <div className="space-y-3">
              {buildJobs
                .filter(j => j.status === 'running' || j.status === 'pending')
                .slice(0, 4)
                .map((job, i) => (
                  <motion.div 
                    key={job.id} 
                    className="flex items-center gap-3 p-3 bg-light-50 dark:bg-dark-700/50 rounded-lg"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
                  >
                    <StatusIndicator status={job.status} size="small" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-dark-500 dark:text-light-100 truncate">{job.projectName}</h4>
                      <span className="text-xs text-dark-300 dark:text-light-400">{job.goals}</span>
                    </div>
                    {job.status === 'running' ? (
                      <ProgressRing progress={job.progress} />
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-dark-300 dark:text-light-400">
                        <Clock size={12} />
                        {job.startTime}
                      </span>
                    )}
                    <button 
                      className="flex items-center justify-center w-6 h-6 text-dark-300 hover:text-petrol-500 transition-colors"
                      onClick={() => setActiveView('builds')}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </motion.div>
                ))}
              
              {stats.activeBuilds === 0 && stats.queuedBuilds === 0 && (
                <div className="py-8 text-center text-dark-300 dark:text-light-400">
                  <p>Keine aktiven Builds</p>
                </div>
              )}
            </div>
          </motion.section>

          {/* JDKs Panel */}
          <motion.section 
            className="bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-white/10 shadow-[0_8px_32px_rgba(0,125,143,0.08)] p-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-dark-500 dark:text-light-100">JDK Versionen</h2>
              <button className="text-sm text-petrol-500 hover:text-petrol-600 font-medium" onClick={() => setActiveView('jdks')}>
                Verwalten
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {jdks.slice(0, 4).map((jdk, i) => (
                <motion.div 
                  key={jdk.id} 
                  className={`flex items-center gap-3 p-3 rounded-lg ${jdk.isDefault ? 'bg-petrol-50 dark:bg-petrol-900/20 ring-1 ring-petrol-200 dark:ring-petrol-800' : 'bg-light-50 dark:bg-dark-700/50'}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.55 + i * 0.05 }}
                >
                  <Coffee size={18} className={jdk.isDefault ? 'text-petrol-500' : 'text-dark-300'} />
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-dark-500 dark:text-light-100">{jdk.version}</span>
                    <span className="block text-xs text-dark-300 dark:text-light-400 truncate">{jdk.vendor}</span>
                  </div>
                  {jdk.isDefault && <span className="text-xs font-medium text-petrol-500">Standard</span>}
                </motion.div>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </>
  );
}
