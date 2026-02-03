/**
 * Settings View
 * 
 * Configure application settings.
 */

import React, { useState } from 'react';
import { api } from '../api';
import { useAppStore } from '../store/useAppStore';
import { 
  Save, 
  FolderOpen, 
  RefreshCw,
  Info
} from 'lucide-react';

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
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Paths Section */}
      <SettingsSection title="Pfade" description="Konfiguriere die Scan-Pfade für Projekte und JDKs">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Projekt-Verzeichnis
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localSettings.scanRootPath}
                onChange={(e) => handleChange('scanRootPath', e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-gfos-500 focus:ring-1 focus:ring-gfos-500"
                placeholder="C:\dev\quellen"
              />
              <button
                onClick={() => handleSelectFolder('scanRootPath')}
                className="px-4 py-2.5 bg-slate-700 rounded-lg text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
              >
                <FolderOpen size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Wurzelverzeichnis für die Projektsuche
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              JDK-Verzeichnisse
            </label>
            <input
              type="text"
              value={localSettings.jdkScanPaths}
              onChange={(e) => handleChange('jdkScanPaths', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-gfos-500 focus:ring-1 focus:ring-gfos-500"
              placeholder="C:\dev\java"
            />
            <p className="text-xs text-slate-500 mt-1">
              Mehrere Pfade mit Semikolon trennen (z.B. C:\Java;D:\JDKs)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Maven Home
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localSettings.defaultMavenHome}
                onChange={(e) => handleChange('defaultMavenHome', e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-gfos-500 focus:ring-1 focus:ring-gfos-500"
                placeholder="C:\dev\maven\mvn3"
              />
              <button
                onClick={() => handleSelectFolder('defaultMavenHome')}
                className="px-4 py-2.5 bg-slate-700 rounded-lg text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
              >
                <FolderOpen size={18} />
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Build Defaults Section */}
      <SettingsSection title="Build-Einstellungen" description="Standard-Einstellungen für neue Builds">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Standard Maven Goals
            </label>
            <input
              type="text"
              value={localSettings.defaultMavenGoal}
              onChange={(e) => handleChange('defaultMavenGoal', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-gfos-500 focus:ring-1 focus:ring-gfos-500"
              placeholder="clean install"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Max. parallele Builds
            </label>
            <input
              type="number"
              min={1}
              max={8}
              value={localSettings.maxParallelBuilds}
              onChange={(e) => handleChange('maxParallelBuilds', parseInt(e.target.value) || 1)}
              className="w-24 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:border-gfos-500 focus:ring-1 focus:ring-gfos-500"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={localSettings.skipTestsByDefault}
                onChange={(e) => handleChange('skipTestsByDefault', e.target.checked)}
                className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-gfos-500 focus:ring-gfos-500 focus:ring-offset-slate-800"
              />
              <div>
                <p className="text-white group-hover:text-gfos-400 transition-colors">
                  Tests standardmäßig überspringen
                </p>
                <p className="text-sm text-slate-400">-DskipTests bei allen Builds</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={localSettings.offlineMode}
                onChange={(e) => handleChange('offlineMode', e.target.checked)}
                className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-gfos-500 focus:ring-gfos-500 focus:ring-offset-slate-800"
              />
              <div>
                <p className="text-white group-hover:text-gfos-400 transition-colors">
                  Offline-Modus
                </p>
                <p className="text-sm text-slate-400">Keine Netzwerkzugriffe bei Builds</p>
              </div>
            </label>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={localSettings.enableThreads}
                onChange={(e) => handleChange('enableThreads', e.target.checked)}
                className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-gfos-500 focus:ring-gfos-500 focus:ring-offset-slate-800"
              />
              <div className="flex-1">
                <p className="text-white">Parallele Builds (-T)</p>
                <p className="text-sm text-slate-400">Maven Multi-Threading aktivieren</p>
              </div>
              {localSettings.enableThreads && (
                <input
                  type="text"
                  value={localSettings.threadCount}
                  onChange={(e) => handleChange('threadCount', e.target.value)}
                  placeholder="1C"
                  className="w-20 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-gfos-500"
                />
              )}
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4">
        {saved && (
          <span className="text-sm text-green-400 flex items-center gap-1">
            <Info size={14} />
            Einstellungen gespeichert
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`
            px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all
            ${hasChanges && !saving
              ? 'bg-gfos-600 text-white hover:bg-gfos-500 shadow-lg shadow-gfos-500/25'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          {saving ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {saving ? 'Speichere...' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>
      {children}
    </div>
  );
}
