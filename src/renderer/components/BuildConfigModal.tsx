/**
 * Build Configuration Modal
 * Allows users to configure build settings before starting
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Play, Coffee, FolderTree, Terminal, 
  Settings2, ChevronDown, Loader2
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Project } from '../store/useAppStore';
import { api } from '../api';

interface BuildConfigModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onStartBuild: (config: BuildConfig) => void;
}

export interface BuildConfig {
  projectId: string;
  modulePath?: string;
  goals: string;
  jdkId: string;
  skipTests: boolean;
  offline: boolean;
  profiles: string[];
}

interface MavenModule {
  artifactId: string;
  relativePath: string;
  displayName: string;
  depth: number;
}

export function BuildConfigModal({ 
  isOpen, 
  project, 
  onClose, 
  onStartBuild 
}: BuildConfigModalProps) {
  const { jdks, settings } = useAppStore();
  
  // Form state
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [goals, setGoals] = useState(settings.defaultGoals || 'clean install');
  const [selectedJdk, setSelectedJdk] = useState<string>('');
  const [skipTests, setSkipTests] = useState(false);
  const [offline, setOffline] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  
  // Data loading state
  const [modules, setModules] = useState<MavenModule[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Reset form when project changes
  useEffect(() => {
    if (project && isOpen) {
      setSelectedModule('');
      setGoals(project.mavenGoals || settings.defaultGoals || 'clean install');
      setSkipTests(false);
      setOffline(false);
      setSelectedProfiles([]);
      
      // Find default JDK
      const defaultJdk = jdks.find(j => j.isDefault);
      setSelectedJdk(defaultJdk?.id || jdks[0]?.id || '');
      
      // Load modules and profiles
      loadProjectData(project);
    }
  }, [project, isOpen]);

  const loadProjectData = async (proj: Project) => {
    // Load modules
    setIsLoadingModules(true);
    try {
      const projectModules = await api.scanModules(`${proj.path}/pom.xml`);
      setModules(projectModules || []);
    } catch (err) {
      console.error('Failed to load modules:', err);
      setModules([]);
    }
    setIsLoadingModules(false);

    // Load profiles
    setIsLoadingProfiles(true);
    try {
      const projectProfiles = await api.scanProfiles(`${proj.path}/pom.xml`);
      setProfiles(projectProfiles || []);
    } catch (err) {
      console.error('Failed to load profiles:', err);
      setProfiles([]);
    }
    setIsLoadingProfiles(false);
  };

  const handleSubmit = () => {
    if (!project) return;
    
    onStartBuild({
      projectId: project.id,
      modulePath: selectedModule || undefined,
      goals,
      jdkId: selectedJdk,
      skipTests,
      offline,
      profiles: selectedProfiles,
    });
    onClose();
  };

  const toggleProfile = (profile: string) => {
    setSelectedProfiles(prev => 
      prev.includes(profile) 
        ? prev.filter(p => p !== profile)
        : [...prev, profile]
    );
  };

  if (!isOpen || !project) return null;

  return (
    <AnimatePresence>
      <div className="gfos-dialog-overlay" onClick={onClose}>
        <motion.div 
          className="gfos-build-config-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="gfos-modal-header">
            <div className="gfos-modal-title">
              <Play size={20} />
              <h2>Build konfigurieren</h2>
            </div>
            <button className="gfos-icon-btn-sm" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Project Info */}
          <div className="gfos-modal-project-info">
            <span className="gfos-project-name">{project.name}</span>
            <code className="gfos-project-path">{project.path}</code>
          </div>

          {/* Form */}
          <div className="gfos-modal-form">
            {/* Module Selection */}
            <div className="gfos-form-group">
              <label>
                <FolderTree size={16} />
                Modul
              </label>
              <div className="gfos-select-wrapper">
                {isLoadingModules ? (
                  <div className="gfos-loading-input">
                    <Loader2 size={16} className="gfos-spin" />
                    <span>Module laden...</span>
                  </div>
                ) : (
                  <select 
                    className="gfos-select"
                    value={selectedModule}
                    onChange={(e) => setSelectedModule(e.target.value)}
                  >
                    <option value="">Root (Gesamtes Projekt)</option>
                    {modules.map((mod) => (
                      <option key={mod.relativePath} value={mod.relativePath}>
                        {'  '.repeat(mod.depth)}{mod.displayName}
                      </option>
                    ))}
                  </select>
                )}
                <ChevronDown size={16} className="gfos-select-icon" />
              </div>
            </div>

            {/* Goals */}
            <div className="gfos-form-group">
              <label>
                <Terminal size={16} />
                Maven Goals
              </label>
              <input
                type="text"
                className="gfos-input"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="clean install"
              />
              <span className="gfos-input-hint">
                z.B. clean install, package, deploy
              </span>
            </div>

            {/* JDK Selection */}
            <div className="gfos-form-group">
              <label>
                <Coffee size={16} />
                JDK
              </label>
              <div className="gfos-select-wrapper">
                <select 
                  className="gfos-select"
                  value={selectedJdk}
                  onChange={(e) => setSelectedJdk(e.target.value)}
                >
                  {jdks.length === 0 ? (
                    <option value="">Keine JDKs gefunden</option>
                  ) : (
                    jdks.map((jdk) => (
                      <option key={jdk.id} value={jdk.id}>
                        Java {jdk.version} ({jdk.vendor})
                        {jdk.isDefault ? ' - Standard' : ''}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown size={16} className="gfos-select-icon" />
              </div>
            </div>

            {/* Profiles */}
            {profiles.length > 0 && (
              <div className="gfos-form-group">
                <label>
                  <Settings2 size={16} />
                  Profile
                </label>
                <div className="gfos-profile-tags">
                  {isLoadingProfiles ? (
                    <div className="gfos-loading-input">
                      <Loader2 size={16} className="gfos-spin" />
                      <span>Profile laden...</span>
                    </div>
                  ) : (
                    profiles.map((profile) => (
                      <button
                        key={profile}
                        className={`gfos-profile-tag ${selectedProfiles.includes(profile) ? 'gfos-profile-active' : ''}`}
                        onClick={() => toggleProfile(profile)}
                      >
                        {profile}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Options */}
            <div className="gfos-form-group">
              <label>Optionen</label>
              <div className="gfos-option-toggles">
                <label className="gfos-toggle-option">
                  <input
                    type="checkbox"
                    checked={skipTests}
                    onChange={(e) => setSkipTests(e.target.checked)}
                  />
                  <span>Tests überspringen (-DskipTests)</span>
                </label>
                <label className="gfos-toggle-option">
                  <input
                    type="checkbox"
                    checked={offline}
                    onChange={(e) => setOffline(e.target.checked)}
                  />
                  <span>Offline-Modus (-o)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="gfos-modal-actions">
            <button className="gfos-secondary-btn" onClick={onClose}>
              Abbrechen
            </button>
            <button 
              className="gfos-primary-btn" 
              onClick={handleSubmit}
              disabled={!goals.trim()}
            >
              <Play size={18} />
              <span>Build starten</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
