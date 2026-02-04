/**
 * Settings View - Terminal-Neon Design (Polished)
 * 
 * System configuration interface with enhanced interactions.
 */

import React, { useState } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import { Settings, Folder, Save, RotateCcw, Check, AlertCircle } from 'lucide-react';

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
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Settings size={14} className="text-[#22ffaa]" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-display">Configuration</span>
          </div>
          <h1 className="font-display text-xl font-bold text-zinc-100 uppercase tracking-wide">
            System Settings
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Version</p>
          <p className="text-xs text-[#00d4ff] font-mono">v1.0.0</p>
        </div>
      </div>

      {/* Paths Section */}
      <ConfigSection 
        title="PATH_CONFIG" 
        description="Configure scan paths for projects and JDKs"
        index={0}
      >
        <div className="space-y-5">
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
        <div className="space-y-5">
          <ConfigInput
            label="DEFAULT_GOALS"
            value={localSettings.defaultMavenGoal}
            onChange={(v) => handleChange('defaultMavenGoal', v)}
            placeholder="clean install"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-2 tracking-wider">
                MAX_PARALLEL
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={localSettings.maxParallelBuilds}
                onChange={(e) => handleChange('maxParallelBuilds', parseInt(e.target.value) || 1)}
                className="
                  w-full py-2.5 px-4 bg-[#0a0a0c] border border-[#1a1a1f] text-sm text-zinc-200 font-mono
                  focus:border-[#00d4ff] focus:bg-[#0c0c0e]
                  focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)]
                  transition-all outline-none
                "
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-2 tracking-wider">
                THREAD_COUNT
              </label>
              <input
                type="text"
                value={localSettings.threadCount}
                onChange={(e) => handleChange('threadCount', e.target.value)}
                placeholder="1C"
                disabled={!localSettings.enableThreads}
                className={`
                  w-full py-2.5 px-4 bg-[#0a0a0c] border border-[#1a1a1f] text-sm text-zinc-200 font-mono
                  focus:border-[#00d4ff] focus:bg-[#0c0c0e]
                  focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)]
                  transition-all outline-none
                  ${!localSettings.enableThreads ? 'opacity-40 cursor-not-allowed' : ''}
                `}
              />
            </div>
          </div>

          <div className="border-t border-[#1a1a1f] pt-5 space-y-4">
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
      <div className="bg-[#0c0c0e] border border-[#1a1a1f] p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {hasChanges && (
            <span className="flex items-center gap-2 text-[#ffaa00] text-xs font-mono animate-pulse">
              <AlertCircle size={14} />
              UNSAVED_CHANGES
            </span>
          )}
          {saved && !hasChanges && (
            <span className="flex items-center gap-2 text-[#22ffaa] text-xs font-mono">
              <Check size={14} />
              CONFIG_SAVED
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocalSettings(settings)}
            disabled={!hasChanges}
            className={`
              flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider
              border transition-all
              ${hasChanges 
                ? 'border-zinc-600 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 hover:bg-[#151518]' 
                : 'border-[#1a1a1f] text-zinc-700 cursor-not-allowed'
              }
            `}
          >
            <RotateCcw size={12} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`
              flex items-center gap-2 px-5 py-2 text-xs font-mono uppercase tracking-wider
              border transition-all
              ${hasChanges && !saving
                ? 'border-[#22ffaa] text-[#22ffaa] hover:bg-[#22ffaa] hover:text-[#0a0a0c] hover:shadow-[0_0_20px_rgba(34,255,170,0.2)]'
                : 'border-[#1a1a1f] text-zinc-700 cursor-not-allowed'
              }
            `}
          >
            {saving ? (
              <>
                <span className="animate-spin">◐</span>
                Saving...
              </>
            ) : (
              <>
                <Save size={12} />
                Save Config
              </>
            )}
          </button>
        </div>
      </div>

      {/* Debug Info */}
      <div className="text-[10px] font-mono text-zinc-700 text-right px-2">
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
      className="bg-[#0c0c0e] border border-[#1a1a1f] animate-slide-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="px-5 py-3 border-b border-[#1a1a1f] flex items-center gap-2">
        <span className="text-[#22ffaa]">▸</span>
        <span className="text-[10px] text-zinc-300 uppercase tracking-[0.15em] font-display font-medium">{title}</span>
      </div>
      <div className="px-5 py-2 border-b border-[#1a1a1f]/50 bg-[#0a0a0c]">
        <p className="text-xs text-zinc-600 font-mono"># {description}</p>
      </div>
      <div className="p-5">
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
  const [focused, setFocused] = useState(false);
  
  return (
    <div>
      <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-2 tracking-wider">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <span className={`
            absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm transition-colors
            ${focused ? 'text-[#00d4ff]' : 'text-zinc-700'}
          `}>
            $
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            className="
              w-full py-2.5 pl-7 pr-4 bg-[#0a0a0c] border border-[#1a1a1f] text-sm text-zinc-200 font-mono
              placeholder:text-zinc-700
              focus:border-[#00d4ff] focus:bg-[#0c0c0e]
              focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1),0_0_20px_rgba(0,212,255,0.1)]
              transition-all outline-none
            "
          />
        </div>
        {onBrowse && (
          <button
            onClick={onBrowse}
            className="
              px-4 py-2 bg-[#0e0e11] border border-[#1a1a1f] text-zinc-500 
              hover:text-[#00d4ff] hover:border-[#00d4ff]/50 hover:bg-[#00d4ff]/5
              transition-all font-mono text-xs
            "
          >
            <Folder size={14} />
          </button>
        )}
      </div>
      {hint && (
        <p className="text-[10px] text-zinc-700 font-mono mt-1.5">
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
  const [hovered, setHovered] = useState(false);
  
  return (
    <label 
      className="flex items-center gap-4 cursor-pointer py-2 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button 
        type="button"
        onClick={() => onChange(!checked)}
        className={`
          w-11 h-6 border relative transition-all flex-shrink-0
          ${checked 
            ? 'border-[#22ffaa]/60 bg-[#22ffaa]/10' 
            : hovered 
              ? 'border-zinc-600 bg-[#151518]' 
              : 'border-[#1a1a1f] bg-[#0a0a0c]'
          }
        `}
      >
        <div 
          className={`
            absolute top-1 w-4 h-4 transition-all
            ${checked 
              ? 'right-1 bg-[#22ffaa] shadow-[0_0_8px_#22ffaa]' 
              : 'left-1 bg-zinc-600'
            }
          `}
        />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`
          text-sm font-mono transition-colors
          ${checked ? 'text-[#22ffaa]' : hovered ? 'text-zinc-200' : 'text-zinc-400'}
        `}>
          {label}
        </p>
        <p className="text-[10px] text-zinc-600 font-mono truncate">{description}</p>
      </div>
      <span className={`
        text-[10px] font-mono uppercase tracking-wider px-2 py-1 border transition-all
        ${checked 
          ? 'text-[#22ffaa] border-[#22ffaa]/30 bg-[#22ffaa]/5' 
          : 'text-zinc-600 border-[#1a1a1f] bg-transparent'
        }
      `}>
        {checked ? 'ON' : 'OFF'}
      </span>
    </label>
  );
}
