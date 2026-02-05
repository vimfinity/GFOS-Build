/**
 * Build Configuration Modal - Tailwind v4
 * Allows users to configure build settings including profile activation/deactivation
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Play, Coffee, FolderTree, Terminal, 
  Settings2, ChevronDown, Loader2, Search, Check, Minus
} from 'lucide-react';
import Fuse from 'fuse.js';
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
  updateSnapshots: boolean;
  forceUpdate: boolean;
  debug: boolean;
  quiet: boolean;
  threads?: string;
  profiles: string[];
  disabledProfiles: string[]; // Profiles to explicitly disable with !
}

interface MavenModule {
  artifactId: string;
  relativePath: string;
  displayName: string;
  depth: number;
}

interface ProfileState {
  name: string;
  state: 'inactive' | 'active' | 'disabled'; // inactive = not set, active = -P profile, disabled = -P !profile
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
  const [moduleSearch, setModuleSearch] = useState('');
  const [goals, setGoals] = useState(settings.defaultGoals || 'clean install');
  const [selectedJdk, setSelectedJdk] = useState<string>('');
  const [skipTests, setSkipTests] = useState(false);
  const [offline, setOffline] = useState(false);
  const [updateSnapshots, setUpdateSnapshots] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [debug, setDebug] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [threads, setThreads] = useState<string>('');
  const [profileStates, setProfileStates] = useState<ProfileState[]>([]);
  
  // Data loading state
  const [modules, setModules] = useState<MavenModule[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Fuzzy search for modules
  const modulesFuse = useMemo(() => new Fuse(modules, {
    keys: ['artifactId', 'displayName', 'relativePath'],
    threshold: 0.4,
  }), [modules]);

  const filteredModules = useMemo(() => {
    if (!moduleSearch.trim()) return modules;
    return modulesFuse.search(moduleSearch).map(r => r.item);
  }, [moduleSearch, modules, modulesFuse]);

  // Reset form when project changes
  useEffect(() => {
    if (project && isOpen) {
      setSelectedModule('');
      setModuleSearch('');
      setGoals(project.mavenGoals || settings.defaultGoals || 'clean install');
      setSkipTests(false);
      setOffline(false);
      setUpdateSnapshots(false);
      setForceUpdate(false);
      setDebug(false);
      setQuiet(false);
      setThreads('');
      setProfileStates([]);
      
      // Find default JDK
      const defaultJdk = jdks.find(j => j.isDefault);
      setSelectedJdk(defaultJdk?.id || jdks[0]?.id || '');
      
      // Load modules and profiles
      loadProjectData(project);
    }
  }, [project, isOpen, jdks, settings.defaultGoals]);

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
      // Initialize profile states
      setProfileStates((projectProfiles || []).map(name => ({ name, state: 'inactive' })));
    } catch (err) {
      console.error('Failed to load profiles:', err);
      setProfiles([]);
      setProfileStates([]);
    }
    setIsLoadingProfiles(false);
  };

  const handleSubmit = () => {
    if (!project) return;
    
    const activeProfiles = profileStates.filter(p => p.state === 'active').map(p => p.name);
    const disabledProfiles = profileStates.filter(p => p.state === 'disabled').map(p => p.name);
    
    onStartBuild({
      projectId: project.id,
      modulePath: selectedModule || undefined,
      goals,
      jdkId: selectedJdk,
      skipTests,
      offline,
      updateSnapshots,
      forceUpdate,
      debug,
      quiet,
      threads: threads || undefined,
      profiles: activeProfiles,
      disabledProfiles,
    });
    onClose();
  };

  const cycleProfileState = useCallback((profileName: string) => {
    setProfileStates(prev => prev.map(p => {
      if (p.name !== profileName) return p;
      // Cycle: inactive -> active -> disabled -> inactive
      const nextState = p.state === 'inactive' ? 'active' : p.state === 'active' ? 'disabled' : 'inactive';
      return { ...p, state: nextState };
    }));
  }, []);

  // Generate the Maven command preview
  const commandPreview = useMemo(() => {
    const parts = ['mvn'];
    parts.push(...goals.split(' ').filter(Boolean));
    
    if (selectedModule) parts.push('-pl', selectedModule, '-am');
    if (skipTests) parts.push('-DskipTests');
    if (offline) parts.push('-o');
    if (updateSnapshots) parts.push('-U');
    if (forceUpdate) parts.push('-fae');
    if (debug) parts.push('-X');
    if (quiet) parts.push('-q');
    if (threads) parts.push('-T', threads);
    
    const activeProfiles = profileStates.filter(p => p.state === 'active').map(p => p.name);
    const disabledProfiles = profileStates.filter(p => p.state === 'disabled').map(p => `!${p.name}`);
    const allProfiles = [...activeProfiles, ...disabledProfiles];
    if (allProfiles.length > 0) {
      parts.push('-P', allProfiles.join(','));
    }
    
    return parts.join(' ');
  }, [goals, selectedModule, skipTests, offline, updateSnapshots, forceUpdate, debug, quiet, threads, profileStates]);

  if (!isOpen || !project) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-dark-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div 
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-light-300 dark:border-dark-600">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-petrol-50 dark:bg-petrol-900/30 text-petrol-500">
                <Play size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-dark-500 dark:text-light-100">Build konfigurieren</h2>
                <p className="text-sm text-dark-300 dark:text-light-400">{project.name}</p>
              </div>
            </div>
            <button 
              className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:bg-light-200 dark:hover:bg-dark-700 transition-colors"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Module Selection with Fuzzy Search */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-dark-500 dark:text-light-100">
                <FolderTree size={16} />
                Modul
              </label>
              <div className="relative">
                {isLoadingModules ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-light-100 dark:bg-dark-700 rounded-xl text-dark-300">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Module laden...</span>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-300" />
                      <input
                        type="text"
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 placeholder:text-dark-300 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                        value={moduleSearch}
                        onChange={(e) => setModuleSearch(e.target.value)}
                        placeholder="Modul suchen..."
                      />
                    </div>
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-light-300 dark:border-dark-600">
                      <div 
                        className={`px-4 py-2.5 cursor-pointer transition-colors ${
                          !selectedModule ? 'bg-petrol-50 dark:bg-petrol-900/30 text-petrol-600' : 'hover:bg-light-100 dark:hover:bg-dark-700'
                        }`}
                        onClick={() => setSelectedModule('')}
                      >
                        <span className="text-sm font-medium">Root (Gesamtes Projekt)</span>
                      </div>
                      {filteredModules.map((mod) => (
                        <div
                          key={mod.relativePath}
                          className={`px-4 py-2.5 cursor-pointer transition-colors ${
                            selectedModule === mod.relativePath ? 'bg-petrol-50 dark:bg-petrol-900/30 text-petrol-600' : 'hover:bg-light-100 dark:hover:bg-dark-700'
                          }`}
                          onClick={() => setSelectedModule(mod.relativePath)}
                        >
                          <span className="text-sm" style={{ paddingLeft: mod.depth * 12 }}>{mod.displayName}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Goals */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-dark-500 dark:text-light-100">
                <Terminal size={16} />
                Maven Goals
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 placeholder:text-dark-300 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="clean install"
              />
              <p className="text-xs text-dark-300">z.B. clean install, package, deploy</p>
            </div>

            {/* JDK Selection */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-dark-500 dark:text-light-100">
                <Coffee size={16} />
                JDK
              </label>
              <div className="relative">
                <select 
                  className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
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
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-300 pointer-events-none" />
              </div>
            </div>

            {/* Profiles with 3-state toggle */}
            {profiles.length > 0 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-dark-500 dark:text-light-100">
                  <Settings2 size={16} />
                  Profile
                </label>
                <p className="text-xs text-dark-300">
                  Klicken zum Aktivieren/Deaktivieren. Deaktivierte Profile werden mit <code className="px-1 py-0.5 bg-light-200 dark:bg-dark-600 rounded">!</code> übergeben.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {isLoadingProfiles ? (
                    <div className="flex items-center gap-2 text-dark-300">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">Profile laden...</span>
                    </div>
                  ) : (
                    profileStates.map(({ name, state }) => (
                      <button
                        key={name}
                        type="button"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                          state === 'active' 
                            ? 'bg-success-50 dark:bg-success-900/30 text-success-600 dark:text-success-400 border-success-200 dark:border-success-800'
                            : state === 'disabled'
                            ? 'bg-error-50 dark:bg-error-900/30 text-error-600 dark:text-error-400 border-error-200 dark:border-error-800'
                            : 'bg-light-200 dark:bg-dark-600 text-dark-400 dark:text-light-300 border-light-400 dark:border-dark-500'
                        }`}
                        onClick={() => cycleProfileState(name)}
                      >
                        {state === 'active' && <Check size={14} />}
                        {state === 'disabled' && <Minus size={14} />}
                        {state === 'disabled' && <span className="text-xs">!</span>}
                        {name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Options */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-500 dark:text-light-100">Optionen</label>
              <div className="grid grid-cols-2 gap-3">
                <ToggleOption 
                  label="Tests überspringen" 
                  hint="-DskipTests"
                  checked={skipTests} 
                  onChange={setSkipTests} 
                />
                <ToggleOption 
                  label="Offline-Modus" 
                  hint="-o"
                  checked={offline} 
                  onChange={setOffline} 
                />
                <ToggleOption 
                  label="Snapshots aktualisieren" 
                  hint="-U"
                  checked={updateSnapshots} 
                  onChange={setUpdateSnapshots} 
                />
                <ToggleOption 
                  label="Fehler ignorieren" 
                  hint="-fae"
                  checked={forceUpdate} 
                  onChange={setForceUpdate} 
                />
                <ToggleOption 
                  label="Debug-Ausgabe" 
                  hint="-X"
                  checked={debug} 
                  onChange={setDebug} 
                />
                <ToggleOption 
                  label="Stille Ausgabe" 
                  hint="-q"
                  checked={quiet} 
                  onChange={setQuiet} 
                />
              </div>
            </div>

            {/* Threads */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-dark-500 dark:text-light-100">
                <Settings2 size={16} />
                Parallele Threads (optional)
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 placeholder:text-dark-300 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                value={threads}
                onChange={(e) => setThreads(e.target.value)}
                placeholder="z.B. 4 oder 1C (1 Thread pro Core)"
              />
            </div>

            {/* Command Preview */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-500 dark:text-light-100">Befehl-Vorschau</label>
              <div className="px-4 py-3 bg-dark-900 rounded-xl font-mono text-sm text-light-100 overflow-x-auto">
                <code>{commandPreview}</code>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-light-300 dark:border-dark-600 bg-light-100 dark:bg-dark-700/50">
            <button 
              className="px-5 py-2.5 bg-light-200 dark:bg-dark-600 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-500 transition-colors"
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button 
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

function ToggleOption({ 
  label, 
  hint,
  checked, 
  onChange 
}: { 
  label: string; 
  hint: string;
  checked: boolean; 
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-light-100 dark:hover:bg-dark-700 transition-colors">
      <input
        type="checkbox"
        className="w-4 h-4 accent-petrol-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="flex-1">
        <span className="text-sm text-dark-500 dark:text-light-100">{label}</span>
        <span className="ml-2 text-xs text-dark-300 font-mono">{hint}</span>
      </div>
    </label>
  );
}
