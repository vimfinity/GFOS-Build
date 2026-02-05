/**
 * GFOS Build Dashboard
 * 
 * Unified design combining:
 * - Design 3's liquid glass background & glass-morphism
 * - Design 2's stats-river with flowing connectors
 * - Design 1's clean professional approach
 * 
 * Using official GFOS branding and logos.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FolderGit2, Coffee, CheckCircle2, XCircle, 
  Play, Settings, Clock, ChevronRight, GitBranch,
  LayoutGrid, Search, Bell
} from 'lucide-react';
import { projects, buildJobs, stats, jdks } from './data/mockData';
import './Dashboard.css';

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState('overview');

  return (
    <div className="gfos-page">
      {/* Liquid Glass Background */}
      <div className="gfos-bg">
        <div className="gfos-bg-base" />
        <div className="gfos-liquid gfos-liquid-1" />
        <div className="gfos-liquid gfos-liquid-2" />
        <div className="gfos-liquid gfos-liquid-3" />
        <div className="gfos-glass-noise" />
      </div>

      <div className="gfos-container">
        {/* Glass Header */}
        <motion.header 
          className="gfos-header"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="gfos-logo">
            <img src="/GFOS_Logo.svg" alt="GFOS" className="gfos-logo-icon" />
            <div className="gfos-logo-text">
              <span className="gfos-logo-primary">GFOS</span>
              <span className="gfos-logo-secondary">Build</span>
            </div>
          </div>

          <nav className="gfos-nav">
            <NavTab 
              icon={<LayoutGrid size={18} />} 
              label="Overview" 
              active={activeNav === 'overview'}
              onClick={() => setActiveNav('overview')}
            />
            <NavTab 
              icon={<FolderGit2 size={18} />} 
              label="Projects"
              badge={stats.mavenProjects}
              active={activeNav === 'projects'}
              onClick={() => setActiveNav('projects')}
            />
            <NavTab 
              icon={<Play size={18} />} 
              label="Builds" 
              active={activeNav === 'builds'}
              onClick={() => setActiveNav('builds')}
            />
            <NavTab 
              icon={<Coffee size={18} />} 
              label="JDKs"
              badge={stats.jdkCount}
              active={activeNav === 'jdks'}
              onClick={() => setActiveNav('jdks')}
            />
          </nav>

          <div className="gfos-header-actions">
            <div className="gfos-search">
              <Search size={18} />
              <input type="text" placeholder="Search..." />
            </div>
            <button className="gfos-icon-btn">
              <Bell size={20} />
            </button>
            <button className="gfos-icon-btn">
              <Settings size={20} />
            </button>
          </div>
        </motion.header>

        {/* Main Content */}
        <main className="gfos-main">
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
                <span>{stats.activeBuilds} Active</span>
              </div>
              <h1>Build Dashboard</h1>
              <p>Manage <strong>{stats.mavenProjects}</strong> Maven projects across <strong>{stats.jdkCount}</strong> JDK versions</p>
            </div>
            <motion.button 
              className="gfos-primary-btn"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play size={20} />
              <span>Start Build</span>
            </motion.button>
          </motion.section>

          {/* Stats River (from Design 2) */}
          <motion.section 
            className="gfos-stats-river"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            <FlowingStat 
              icon={<FolderGit2 size={22} />}
              value={stats.mavenProjects}
              label="Projects"
            />
            <div className="gfos-stat-connector" />
            <FlowingStat 
              icon={<Coffee size={22} />}
              value={stats.jdkCount}
              label="JDK Versions"
            />
            <div className="gfos-stat-connector" />
            <FlowingStat 
              icon={<CheckCircle2 size={22} />}
              value={stats.successfulBuilds}
              label="Successful"
              variant="success"
            />
            <div className="gfos-stat-connector" />
            <FlowingStat 
              icon={<XCircle size={22} />}
              value={stats.failedBuilds}
              label="Failed"
              variant="error"
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
                <h2>Recent Projects</h2>
                <button className="gfos-text-btn">View all</button>
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
                    <button className="gfos-action-btn">
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
                  <h2>Active Builds</h2>
                  <span className="gfos-badge">{buildJobs.filter(j => j.status === 'running').length}</span>
                </div>

                <div className="gfos-builds-list">
                  {buildJobs.filter(j => j.status === 'running' || j.status === 'pending').slice(0, 4).map((job, i) => (
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
                        <div className="gfos-progress-ring">
                          <svg viewBox="0 0 36 36">
                            <circle
                              className="gfos-ring-bg"
                              cx="18" cy="18" r="15.9"
                            />
                            <circle
                              className="gfos-ring-progress"
                              cx="18" cy="18" r="15.9"
                              strokeDasharray={`${job.progress}, 100`}
                            />
                          </svg>
                          <span>{job.progress}%</span>
                        </div>
                      ) : (
                        <span className="gfos-build-time">
                          <Clock size={12} />
                          {job.startTime}
                        </span>
                      )}
                      <button className="gfos-chevron-btn">
                        <ChevronRight size={18} />
                      </button>
                    </motion.div>
                  ))}
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
                  <h2>JDK Versions</h2>
                </div>

                <div className="gfos-jdks-grid">
                  {jdks.slice(0, 4).map((jdk, i) => (
                    <motion.div 
                      key={jdk.id} 
                      className="gfos-jdk-card"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.55 + i * 0.05 }}
                    >
                      <Coffee size={18} />
                      <div className="gfos-jdk-info">
                        <span className="gfos-jdk-version">{jdk.version}</span>
                        <span className="gfos-jdk-vendor">{jdk.vendor}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* Navigation Tab Component */
function NavTab({ 
  icon, 
  label, 
  badge, 
  active, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  badge?: number; 
  active?: boolean; 
  onClick: () => void;
}) {
  return (
    <button 
      className={`gfos-nav-tab ${active ? 'gfos-nav-active' : ''}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && <span className="gfos-nav-badge">{badge}</span>}
    </button>
  );
}

/* Flowing Stat Component (from Design 2) */
function FlowingStat({ 
  icon, 
  value, 
  label, 
  variant 
}: { 
  icon: React.ReactNode; 
  value: number; 
  label: string; 
  variant?: 'success' | 'error';
}) {
  return (
    <motion.div 
      className={`gfos-flowing-stat ${variant ? `gfos-stat-${variant}` : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="gfos-stat-icon">{icon}</div>
      <span className="gfos-stat-value">{value}</span>
      <span className="gfos-stat-label">{label}</span>
    </motion.div>
  );
}

/* Status Indicator Component */
function StatusIndicator({ status, size = 'default' }: { status: string; size?: 'default' | 'small' }) {
  const colors: Record<string, string> = {
    success: '#10b981',
    failed: '#ef4444',
    running: '#007d8f',
    pending: '#94a3b8',
  };
  
  return (
    <div 
      className={`gfos-status ${size === 'small' ? 'gfos-status-sm' : ''} ${status === 'running' ? 'gfos-status-pulse' : ''}`}
      style={{ '--status-color': colors[status] || colors.pending } as React.CSSProperties}
    />
  );
}
