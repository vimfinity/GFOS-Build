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
        className="gfos-hero"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <div className="gfos-hero-content">
          <div className="gfos-hero-badge">
            <span className="gfos-pulse" />
            <span>{stats.activeBuilds} Aktiv</span>
          </div>
          <h1>Build Dashboard</h1>
          <p>Verwalte <strong>{stats.mavenProjects}</strong> Maven-Projekte mit <strong>{stats.jdkCount}</strong> JDK-Versionen</p>
        </div>
        <motion.button 
          className="gfos-primary-btn"
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
        className="gfos-stats-river"
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
        <div className="gfos-stat-connector" />
        <FlowingStat 
          icon={<Coffee size={22} />}
          value={stats.jdkCount}
          label="JDK Versionen"
          onClick={() => setActiveView('jdks')}
        />
        <div className="gfos-stat-connector" />
        <FlowingStat 
          icon={<CheckCircle2 size={22} />}
          value={stats.successfulBuilds}
          label="Erfolgreich"
          variant="success"
          onClick={() => setActiveView('builds')}
        />
        <div className="gfos-stat-connector" />
        <FlowingStat 
          icon={<XCircle size={22} />}
          value={stats.failedBuilds}
          label="Fehlgeschlagen"
          variant="error"
          onClick={() => setActiveView('builds')}
        />
      </motion.section>

      {/* Content Grid */}
      <div className="gfos-content-grid">
        {/* Projects Panel */}
        <motion.section 
          className="gfos-glass-panel gfos-projects-panel"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <div className="gfos-panel-header">
            <h2>Aktuelle Projekte</h2>
            <button className="gfos-text-btn" onClick={() => setActiveView('projects')}>
              Alle anzeigen
            </button>
          </div>

          <div className="gfos-projects-list">
            {projects.slice(0, 5).map((project, i) => (
              <motion.div 
                key={project.id} 
                className="gfos-project-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.05 }}
                whileHover={{ y: -3 }}
              >
                <div className="gfos-project-icon">
                  <FolderGit2 size={20} />
                </div>
                <div className="gfos-project-info">
                  <h3>{project.name}</h3>
                  <div className="gfos-project-meta">
                    <span><GitBranch size={12} />{project.branch}</span>
                    <span><Coffee size={12} />{project.jdk}</span>
                  </div>
                </div>
                {project.lastBuild && (
                  <StatusIndicator status={project.lastBuild.status} />
                )}
                <button 
                  className="gfos-action-btn"
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
        <div className="gfos-right-column">
          {/* Builds Panel */}
          <motion.section 
            className="gfos-glass-panel gfos-builds-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="gfos-panel-header">
              <h2>Aktive Builds</h2>
              <span className="gfos-badge">{stats.activeBuilds}</span>
            </div>

            <div className="gfos-builds-list">
              {buildJobs
                .filter(j => j.status === 'running' || j.status === 'pending')
                .slice(0, 4)
                .map((job, i) => (
                  <motion.div 
                    key={job.id} 
                    className="gfos-build-item"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
                  >
                    <StatusIndicator status={job.status} size="small" />
                    <div className="gfos-build-info">
                      <h4>{job.projectName}</h4>
                      <span>{job.goals}</span>
                    </div>
                    {job.status === 'running' ? (
                      <ProgressRing progress={job.progress} />
                    ) : (
                      <span className="gfos-build-time">
                        <Clock size={12} />
                        {job.startTime}
                      </span>
                    )}
                    <button 
                      className="gfos-chevron-btn"
                      onClick={() => setActiveView('builds')}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </motion.div>
                ))}
              
              {stats.activeBuilds === 0 && stats.queuedBuilds === 0 && (
                <div className="gfos-empty-small">
                  <p>Keine aktiven Builds</p>
                </div>
              )}
            </div>
          </motion.section>

          {/* JDKs Panel */}
          <motion.section 
            className="gfos-glass-panel gfos-jdks-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="gfos-panel-header">
              <h2>JDK Versionen</h2>
              <button className="gfos-text-btn" onClick={() => setActiveView('jdks')}>
                Verwalten
              </button>
            </div>

            <div className="gfos-jdks-grid">
              {jdks.slice(0, 4).map((jdk, i) => (
                <motion.div 
                  key={jdk.id} 
                  className={`gfos-jdk-card ${jdk.isDefault ? 'gfos-jdk-default' : ''}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.55 + i * 0.05 }}
                >
                  <Coffee size={18} />
                  <div className="gfos-jdk-info">
                    <span className="gfos-jdk-version">{jdk.version}</span>
                    <span className="gfos-jdk-vendor">{jdk.vendor}</span>
                  </div>
                  {jdk.isDefault && <span className="gfos-jdk-badge">Standard</span>}
                </motion.div>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </>
  );
}
