/**
 * Build Config View - Terminal-Neon Design
 * 
 * Build parameter configuration interface.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import type { BuildJob } from '../types';

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
      const profiles = await api.scanProfiles(project.pomPath);
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
      await api.startBuild(job);
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
      <div className="flex items-center justify-center h-64 terminal-window">
        <div className="text-center">
          <div className="text-4xl text-terminal-700 mb-2 font-mono">404</div>
          <p className="text-terminal-500 font-mono text-sm">PROJECT_NOT_FOUND</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="terminal-window">
        <div className="terminal-header">
          <span className="text-neon-orange">▶</span>
          <span>BUILD_CONFIG</span>
          <span className="text-terminal-500">//</span>
          <span className="text-terminal-400">{project.name}</span>
        </div>
      </div>

      {/* Build Target */}
      <div className="terminal-window animate-slide-up" style={{ animationDelay: '0ms' }}>
        <div className="terminal-header">
          <span className="text-neon-green">▸</span>
          <span>TARGET</span>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-neon-green text-lg">⎇</span>
            <div>
              <p className="text-terminal-100 font-mono">{project.name}</p>
              {modulePath && (
                <p className="text-neon-cyan text-sm font-mono mt-0.5">
                  └─ module: {modulePath}
                </p>
              )}
              <p className="text-terminal-600 text-xs font-mono mt-1">{project.path}</p>
            </div>
          </div>
        </div>
      </div>

      {/* JDK Selection */}
      <div className="terminal-window animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="terminal-header">
          <span className="text-neon-orange">☕</span>
          <span>JAVA_HOME</span>
        </div>
        <div className="p-4">
          <div className="relative">
            <button
              onClick={() => setJdkDropdownOpen(!jdkDropdownOpen)}
              className="w-full flex items-center justify-between p-3 bg-terminal-900 border border-terminal-700 
                         hover:border-neon-cyan/50 transition-colors font-mono text-sm"
            >
              <div className="text-left">
                {selectedJdkInfo ? (
                  <>
                    <p className="text-terminal-200">{selectedJdkInfo.version}</p>
                    <p className="text-terminal-600 text-xs">{selectedJdkInfo.jdkHome}</p>
                  </>
                ) : (
                  <p className="text-terminal-500">SELECT_JDK...</p>
                )}
              </div>
              <span className="text-terminal-500">{jdkDropdownOpen ? '▲' : '▼'}</span>
            </button>
            
            {jdkDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-terminal-900 border border-terminal-700 overflow-hidden">
                {jdks.map((jdk, index) => (
                  <button
                    key={jdk.jdkHome}
                    onClick={() => {
                      setSelectedJdk(jdk.jdkHome);
                      setJdkDropdownOpen(false);
                    }}
                    className={`w-full p-3 flex items-center gap-3 hover:bg-terminal-800 transition-colors text-left ${
                      selectedJdk === jdk.jdkHome ? 'bg-neon-green/10 border-l-2 border-neon-green' : ''
                    }`}
                  >
                    <span className="text-neon-orange">☕</span>
                    <div className="flex-1 font-mono">
                      <p className="text-terminal-200 text-sm">{jdk.version}</p>
                      <p className="text-xs text-terminal-600">{jdk.vendor}</p>
                    </div>
                    {selectedJdk === jdk.jdkHome && (
                      <span className="text-neon-green">✓</span>
                    )}
                  </button>
                ))}
                {jdks.length === 0 && (
                  <p className="p-4 text-sm text-terminal-500 text-center font-mono">
                    NO_JDK_FOUND
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Maven Goals */}
      <div className="terminal-window animate-slide-up" style={{ animationDelay: '100ms' }}>
        <div className="terminal-header">
          <span className="text-neon-cyan">$</span>
          <span>MVN_GOALS</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-neon-cyan font-mono">$</span>
            <span className="text-terminal-500 font-mono text-sm">mvn</span>
            <input
              type="text"
              value={mavenGoals}
              onChange={(e) => setMavenGoals(e.target.value)}
              placeholder="clean install"
              className="flex-1 terminal-input"
            />
          </div>
          
          <div className="flex flex-wrap gap-1">
            {['clean', 'install', 'package', 'test', 'verify', 'deploy'].map((goal) => (
              <button
                key={goal}
                onClick={() => setMavenGoals((prev) => prev.includes(goal) ? prev : `${prev} ${goal}`.trim())}
                className="px-2 py-1 text-xs font-mono bg-terminal-800 text-terminal-400 
                           border border-terminal-700 hover:border-neon-cyan/50 hover:text-neon-cyan transition-colors"
              >
                {goal}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="terminal-window animate-slide-up" style={{ animationDelay: '150ms' }}>
        <div className="terminal-header">
          <span className="text-terminal-400">⚙</span>
          <span>BUILD_FLAGS</span>
        </div>
        <div className="p-4 space-y-3">
          <ToggleOption
            label="SKIP_TESTS"
            flag="-DskipTests"
            checked={skipTests}
            onChange={setSkipTests}
          />
          
          <ToggleOption
            label="OFFLINE_MODE"
            flag="--offline"
            checked={offline}
            onChange={setOffline}
          />
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEnableThreads(!enableThreads)}
              className={`w-6 h-6 border flex items-center justify-center font-mono text-xs transition-colors ${
                enableThreads
                  ? 'border-neon-green bg-neon-green/20 text-neon-green'
                  : 'border-terminal-600 text-terminal-600'
              }`}
            >
              {enableThreads ? '✓' : ''}
            </button>
            <div className="flex-1">
              <span className="text-terminal-300 font-mono text-sm">PARALLEL_BUILD</span>
              <span className="text-terminal-600 font-mono text-xs ml-2">-T</span>
            </div>
            {enableThreads && (
              <input
                type="text"
                value={threads}
                onChange={(e) => setThreads(e.target.value)}
                placeholder="1C"
                className="w-20 px-3 py-1.5 bg-terminal-900 border border-terminal-600 text-terminal-200 
                           font-mono text-sm text-center focus:border-neon-green focus:outline-none
                           transition-colors"
              />
            )}
          </div>
        </div>
      </div>

      {/* Profiles */}
      {profiles.length > 0 && (
        <div className="terminal-window animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="terminal-header">
            <span className="text-neon-cyan">-P</span>
            <span>PROFILES</span>
            <span className="text-terminal-600">[{selectedProfiles.length}/{profiles.length}]</span>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {profiles.map((profile) => (
                <button
                  key={profile}
                  onClick={() => toggleProfile(profile)}
                  className={`px-3 py-1.5 text-xs font-mono border transition-all ${
                    selectedProfiles.includes(profile)
                      ? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
                      : 'border-terminal-700 text-terminal-400 hover:border-terminal-500'
                  }`}
                >
                  {selectedProfiles.includes(profile) && '✓ '}
                  {profile}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Command Preview */}
      <div className="terminal-window animate-slide-up" style={{ animationDelay: '250ms' }}>
        <div className="terminal-header">
          <span className="text-terminal-500">#</span>
          <span className="text-terminal-500">PREVIEW</span>
        </div>
        <div className="p-3 bg-terminal-950">
          <code className="text-xs font-mono text-terminal-400 break-all">
            <span className="text-neon-green">$</span>{' '}
            <span className="text-terminal-300">JAVA_HOME</span>=
            <span className="text-neon-orange">{selectedJdkInfo?.jdkHome || '...'}</span>{' '}
            <span className="text-neon-cyan">mvn</span>{' '}
            {mavenGoals}{' '}
            {skipTests && <span className="text-terminal-500">-DskipTests </span>}
            {offline && <span className="text-terminal-500">--offline </span>}
            {enableThreads && <span className="text-terminal-500">-T {threads} </span>}
            {selectedProfiles.map(p => <span key={p} className="text-neon-cyan">-P{p} </span>)}
          </code>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={handleStartBuild}
        disabled={!selectedJdk || !mavenGoals.trim()}
        className={`w-full py-4 font-mono text-sm flex items-center justify-center gap-3 
                    border-2 transition-all ${
          selectedJdk && mavenGoals.trim()
            ? 'border-neon-green text-neon-green hover:bg-neon-green/10 active:bg-neon-green/20'
            : 'border-terminal-700 text-terminal-600 cursor-not-allowed'
        }`}
      >
        <span className="text-xl">▶</span>
        <span>EXECUTE_BUILD</span>
        <span className="text-xs">[ENTER]</span>
      </button>
    </div>
  );
}

interface ToggleOptionProps {
  label: string;
  flag: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleOption({ label, flag, checked, onChange }: ToggleOptionProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        onClick={() => onChange(!checked)}
        className={`w-6 h-6 border flex items-center justify-center font-mono text-xs transition-colors ${
          checked
            ? 'border-neon-green bg-neon-green/20 text-neon-green'
            : 'border-terminal-600 text-terminal-600 group-hover:border-terminal-500'
        }`}
      >
        {checked ? '✓' : ''}
      </button>
      <div className="flex-1">
        <span className="text-terminal-300 font-mono text-sm group-hover:text-terminal-100 transition-colors">
          {label}
        </span>
        <span className="text-terminal-600 font-mono text-xs ml-2">{flag}</span>
      </div>
      <span className="text-xs font-mono text-terminal-700">
        {checked ? '[ON]' : '[OFF]'}
      </span>
    </label>
  );
}
