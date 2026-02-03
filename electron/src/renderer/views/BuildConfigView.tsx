/**
 * Build Config View
 * 
 * Configure and start a build.
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { BuildJob } from '../types';
import { 
  Play, 
  Coffee, 
  Settings2,
  ChevronDown,
  Check,
  X
} from 'lucide-react';

export function BuildConfigView() {
  const navigation = useAppStore((state) => state.navigation);
  const projects = useAppStore((state) => state.projects);
  const jdks = useAppStore((state) => state.jdks);
  const settings = useAppStore((state) => state.settings);
  const profilesByProject = useAppStore((state) => state.profilesByProject);
  const setProfiles = useAppStore((state) => state.setProfiles);
  const addJob = useAppStore((state) => state.addJob);
  const updateJob = useAppStore((state) => state.updateJob);
  const setScreen = useAppStore((state) => state.setScreen);

  const projectPath = navigation.params.projectPath as string;
  const modulePath = navigation.params.module as string | null;
  
  const project = projects.find((p) => p.path === projectPath);
  const profiles = projectPath ? profilesByProject[projectPath] || [] : [];

  // Form State
  const [selectedJdk, setSelectedJdk] = useState<string>(jdks[0]?.jdkHome || '');
  const [mavenGoals, setMavenGoals] = useState(settings.defaultMavenGoal);
  const [skipTests, setSkipTests] = useState(settings.skipTestsByDefault);
  const [offline, setOffline] = useState(settings.offlineMode);
  const [enableThreads, setEnableThreads] = useState(settings.enableThreads);
  const [threads, setThreads] = useState(settings.threadCount);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [jdkDropdownOpen, setJdkDropdownOpen] = useState(false);

  useEffect(() => {
    if (project?.pomPath && !profilesByProject[project.path]) {
      loadProfiles();
    }
  }, [project]);

  const loadProfiles = async () => {
    if (!project?.pomPath) return;
    try {
      const profiles = await window.electronAPI.scanProfiles(project.pomPath);
      setProfiles(project.path, profiles);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const handleStartBuild = async () => {
    if (!project || !selectedJdk) return;

    const goals = mavenGoals.split(' ').filter(Boolean);
    const jobName = modulePath 
      ? `${project.name} (${modulePath})`
      : project.name;

    const jobId = addJob({
      projectPath: project.path,
      modulePath: modulePath || undefined,
      name: jobName,
      jdkPath: selectedJdk,
      mavenGoals: goals,
      skipTests,
      offline,
      enableThreads,
      threads: enableThreads ? threads : undefined,
      profiles: selectedProfiles,
    });

    // Update status to running
    updateJob(jobId, { status: 'running', startedAt: new Date() });

    // Start the build
    const job: BuildJob = {
      id: jobId,
      projectPath: project.path,
      modulePath: modulePath || undefined,
      name: jobName,
      jdkPath: selectedJdk,
      mavenGoals: goals,
      status: 'running',
      progress: 0,
      createdAt: new Date(),
      skipTests,
      offline,
      enableThreads,
      threads: enableThreads ? threads : undefined,
      profiles: selectedProfiles,
    };

    try {
      await window.electronAPI.startBuild(job);
      setScreen('JOBS');
    } catch (error) {
      console.error('Failed to start build:', error);
      updateJob(jobId, { status: 'failed' });
    }
  };

  const toggleProfile = (profile: string) => {
    setSelectedProfiles((prev) =>
      prev.includes(profile)
        ? prev.filter((p) => p !== profile)
        : [...prev, profile]
    );
  };

  const selectedJdkInfo = jdks.find((j) => j.jdkHome === selectedJdk);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Projekt nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Build Target */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Build-Ziel</h3>
        <div className="bg-slate-700/50 rounded-lg p-4">
          <p className="text-white font-medium">{project.name}</p>
          {modulePath && (
            <p className="text-sm text-gfos-400 mt-1">Modul: {modulePath}</p>
          )}
          <p className="text-sm text-slate-400 mt-1">{project.path}</p>
        </div>
      </div>

      {/* JDK Selection */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Coffee size={20} className="text-orange-400" />
          JDK auswählen
        </h3>
        
        <div className="relative">
          <button
            onClick={() => setJdkDropdownOpen(!jdkDropdownOpen)}
            className="w-full flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-gfos-500 transition-colors"
          >
            <div>
              {selectedJdkInfo ? (
                <>
                  <p className="text-white font-medium">{selectedJdkInfo.version}</p>
                  <p className="text-sm text-slate-400">{selectedJdkInfo.jdkHome}</p>
                </>
              ) : (
                <p className="text-slate-400">JDK auswählen...</p>
              )}
            </div>
            <ChevronDown size={20} className={`text-slate-400 transition-transform ${jdkDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {jdkDropdownOpen && (
            <div className="absolute z-10 w-full mt-2 bg-slate-700 rounded-lg border border-slate-600 shadow-xl overflow-hidden">
              {jdks.map((jdk) => (
                <button
                  key={jdk.jdkHome}
                  onClick={() => {
                    setSelectedJdk(jdk.jdkHome);
                    setJdkDropdownOpen(false);
                  }}
                  className={`w-full p-3 flex items-center gap-3 hover:bg-slate-600 transition-colors text-left ${
                    selectedJdk === jdk.jdkHome ? 'bg-gfos-600/20' : ''
                  }`}
                >
                  <Coffee size={18} className="text-orange-400" />
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{jdk.version}</p>
                    <p className="text-xs text-slate-400">{jdk.vendor}</p>
                  </div>
                  {selectedJdk === jdk.jdkHome && (
                    <Check size={18} className="text-gfos-400" />
                  )}
                </button>
              ))}
              {jdks.length === 0 && (
                <p className="p-4 text-sm text-slate-400 text-center">
                  Keine JDKs gefunden
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Maven Goals */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Settings2 size={20} className="text-gfos-400" />
          Maven Goals
        </h3>
        
        <input
          type="text"
          value={mavenGoals}
          onChange={(e) => setMavenGoals(e.target.value)}
          placeholder="z.B. clean install"
          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-gfos-500 focus:ring-1 focus:ring-gfos-500 transition-colors"
        />
        
        <div className="flex flex-wrap gap-2 mt-3">
          {['clean', 'install', 'package', 'test', 'verify', 'deploy'].map((goal) => (
            <button
              key={goal}
              onClick={() => setMavenGoals((prev) => prev.includes(goal) ? prev : `${prev} ${goal}`.trim())}
              className="px-3 py-1 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
            >
              {goal}
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Optionen</h3>
        
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={skipTests}
              onChange={(e) => setSkipTests(e.target.checked)}
              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-gfos-500 focus:ring-gfos-500 focus:ring-offset-slate-800"
            />
            <div>
              <p className="text-white group-hover:text-gfos-400 transition-colors">Tests überspringen</p>
              <p className="text-sm text-slate-400">-DskipTests</p>
            </div>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={offline}
              onChange={(e) => setOffline(e.target.checked)}
              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-gfos-500 focus:ring-gfos-500 focus:ring-offset-slate-800"
            />
            <div>
              <p className="text-white group-hover:text-gfos-400 transition-colors">Offline-Modus</p>
              <p className="text-sm text-slate-400">-o (keine Netzwerkzugriffe)</p>
            </div>
          </label>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={enableThreads}
              onChange={(e) => setEnableThreads(e.target.checked)}
              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-gfos-500 focus:ring-gfos-500 focus:ring-offset-slate-800"
            />
            <div className="flex-1">
              <p className="text-white">Parallele Builds</p>
              <p className="text-sm text-slate-400">-T (Multi-Threading)</p>
            </div>
            {enableThreads && (
              <input
                type="text"
                value={threads}
                onChange={(e) => setThreads(e.target.value)}
                placeholder="1C"
                className="w-20 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-gfos-500"
              />
            )}
          </div>
        </div>
      </div>

      {/* Profiles */}
      {profiles.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Profile</h3>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => (
              <button
                key={profile}
                onClick={() => toggleProfile(profile)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                  selectedProfiles.includes(profile)
                    ? 'bg-gfos-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {selectedProfiles.includes(profile) && <Check size={14} />}
                {profile}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Start Button */}
      <button
        onClick={handleStartBuild}
        disabled={!selectedJdk || !mavenGoals.trim()}
        className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
          selectedJdk && mavenGoals.trim()
            ? 'bg-gradient-to-r from-gfos-500 to-gfos-600 text-white hover:from-gfos-400 hover:to-gfos-500 shadow-lg shadow-gfos-500/25'
            : 'bg-slate-700 text-slate-400 cursor-not-allowed'
        }`}
      >
        <Play size={24} />
        Build starten
      </button>
    </div>
  );
}
