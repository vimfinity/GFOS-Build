/**
 * Settings View - Terminal-Neon Design
 * 
 * System configuration interface.
 */

import React, { useState } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';

export function SettingsView() {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setProjects = useAppStore((state) => state.setProjects);
  const setJdks = useAppStore((state) => state.setJdks);

  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (key: keyof typeof settings, value: string | number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSelectFolder = async (key: 'scanRootPath' | 'defaultMavenHome') => {
    const path = await api.selectFolder();
    if (path) {
      handleChange(key, path);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveConfig(localSettings);
      updateSettings(localSettings);
      setSaved(true);
      
      // Re-scan with new paths
      const projects = await api.scanProjects(localSettings.scanRootPath);
      setProjects(projects);
      
      const jdks = await api.scanJDKs(localSettings.jdkScanPaths);
      setJdks(jdks);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(localSettings);

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="terminal-window">
        <div className="terminal-header">
          <span className="text-neon-cyan">⚙</span>
          <span>SYSTEM_CONFIG</span>
          <span className="text-terminal-500">//</span>
          <span className="text-terminal-400">v1.0.0</span>
        </div>
      </div>

      {/* Paths Section */}
      <ConfigSection 
        title="PATH_CONFIG" 
        description="Configure scan paths for projects and JDKs"
        index={0}
      >
        <div className="space-y-4">
          <ConfigInput
            label="SCAN_ROOT"
            value={localSettings.scanRootPath}
            onChange={(v) => handleChange('scanRootPath', v)}
            placeholder="C:\dev\quellen"
            hint="Root directory for project discovery"
            onBrowse={() => handleSelectFolder('scanRootPath')}
          />

          <ConfigInput
            label="JDK_PATHS"
            value={localSettings.jdkScanPaths}
            onChange={(v) => handleChange('jdkScanPaths', v)}
            placeholder="C:\dev\java"
            hint="Multiple paths separated by semicolon"
          />

          <ConfigInput
            label="MAVEN_HOME"
            value={localSettings.defaultMavenHome}
            onChange={(v) => handleChange('defaultMavenHome', v)}
            placeholder="C:\dev\maven\mvn3"
            onBrowse={() => handleSelectFolder('defaultMavenHome')}
          />
        </div>
      </ConfigSection>

      {/* Build Defaults Section */}
      <ConfigSection 
        title="BUILD_DEFAULTS" 
        description="Default settings for new build jobs"
        index={1}
      >
        <div className="space-y-4">
          <ConfigInput
            label="DEFAULT_GOALS"
            value={localSettings.defaultMavenGoal}
            onChange={(v) => handleChange('defaultMavenGoal', v)}
            placeholder="clean install"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono text-terminal-500 uppercase mb-1">
                MAX_PARALLEL
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={localSettings.maxParallelBuilds}
                onChange={(e) => handleChange('maxParallelBuilds', parseInt(e.target.value) || 1)}
                className="terminal-input w-full"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-mono text-terminal-500 uppercase mb-1">
                THREAD_COUNT
              </label>
              <input
                type="text"
                value={localSettings.threadCount}
                onChange={(e) => handleChange('threadCount', e.target.value)}
                placeholder="1C"
                disabled={!localSettings.enableThreads}
                className={`terminal-input w-full ${!localSettings.enableThreads ? 'opacity-50' : ''}`}
              />
            </div>
          </div>

          <div className="border-t border-terminal-700 pt-4 space-y-3">
            <ConfigToggle
              label="SKIP_TESTS"
              description="-DskipTests on all builds"
              checked={localSettings.skipTestsByDefault}
              onChange={(v) => handleChange('skipTestsByDefault', v)}
            />

            <ConfigToggle
              label="OFFLINE_MODE"
              description="No network access during builds"
              checked={localSettings.offlineMode}
              onChange={(v) => handleChange('offlineMode', v)}
            />

            <ConfigToggle
              label="ENABLE_THREADS"
              description="Maven multi-threading (-T)"
              checked={localSettings.enableThreads}
              onChange={(v) => handleChange('enableThreads', v)}
            />
          </div>
        </div>
      </ConfigSection>

      {/* Actions */}
      <div className="terminal-window">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {hasChanges && (
              <span className="text-neon-orange text-xs font-mono animate-pulse">
                ● UNSAVED_CHANGES
              </span>
            )}
            {saved && (
              <span className="text-neon-green text-xs font-mono">
                ✓ CONFIG_SAVED
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocalSettings(settings)}
              disabled={!hasChanges}
              className="btn-ghost text-xs disabled:opacity-30"
            >
              [RESET]
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`text-xs font-mono px-4 py-2 border transition-all ${
                hasChanges && !saving
                  ? 'border-neon-green text-neon-green hover:bg-neon-green/10'
                  : 'border-terminal-700 text-terminal-600 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">◐</span>
                  SAVING...
                </span>
              ) : (
                '[SAVE_CONFIG]'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="text-[10px] font-mono text-terminal-700 text-right px-2">
        CONFIG_PATH: ~/.gfos-build/config.json
      </div>
    </div>
  );
}

interface ConfigSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
  index: number;
}

function ConfigSection({ title, description, children, index }: ConfigSectionProps) {
  return (
    <div 
      className="terminal-window animate-slide-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="terminal-header">
        <span className="text-neon-green">▸</span>
        <span>{title}</span>
      </div>
      <div className="px-4 py-1 border-b border-terminal-800">
        <p className="text-xs text-terminal-500 font-mono"># {description}</p>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

interface ConfigInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  onBrowse?: () => void;
}

function ConfigInput({ label, value, onChange, placeholder, hint, onBrowse }: ConfigInputProps) {
  return (
    <div>
      <label className="block text-[10px] font-mono text-terminal-500 uppercase mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-600 font-mono text-sm">
            $
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="terminal-input w-full pl-7"
          />
        </div>
        {onBrowse && (
          <button
            onClick={onBrowse}
            className="px-3 py-2 bg-terminal-800 border border-terminal-700 text-terminal-400 
                       hover:text-neon-cyan hover:border-neon-cyan/50 transition-colors font-mono text-xs"
          >
            [...]
          </button>
        )}
      </div>
      {hint && (
        <p className="text-[10px] text-terminal-600 font-mono mt-1">
          // {hint}
        </p>
      )}
    </div>
  );
}

interface ConfigToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ConfigToggle({ label, description, checked, onChange }: ConfigToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div 
        className={`w-10 h-5 border relative transition-colors ${
          checked 
            ? 'border-neon-green bg-neon-green/20' 
            : 'border-terminal-600 bg-terminal-900'
        }`}
        onClick={() => onChange(!checked)}
      >
        <div 
          className={`absolute top-0.5 w-4 h-4 transition-all ${
            checked 
              ? 'right-0.5 bg-neon-green' 
              : 'left-0.5 bg-terminal-600'
          }`}
        />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-mono transition-colors ${
          checked ? 'text-neon-green' : 'text-terminal-300 group-hover:text-terminal-100'
        }`}>
          {label}
        </p>
        <p className="text-xs text-terminal-600 font-mono">{description}</p>
      </div>
      <span className="text-xs font-mono text-terminal-600">
        {checked ? '[ON]' : '[OFF]'}
      </span>
    </label>
  );
}
