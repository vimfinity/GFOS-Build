/**
 * Settings View - Application Configuration
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, Save, FolderOpen, Plus, Trash2,
  RefreshCw, AlertTriangle
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
// Shared components can be imported if needed

export default function SettingsView() {
  const { settings, updateSettings, addNotification } = useAppStore();
  
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [newScanPath, setNewScanPath] = useState('');

  const handleChange = <K extends keyof typeof settings>(
    key: K, 
    value: typeof settings[K]
  ) => {
    setLocalSettings({ ...localSettings, [key]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettings(localSettings);
    setHasChanges(false);
    addNotification('success', 'Einstellungen gespeichert');
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasChanges(false);
  };

  const addScanPath = () => {
    if (newScanPath && !localSettings.scanPaths.includes(newScanPath)) {
      handleChange('scanPaths', [...localSettings.scanPaths, newScanPath]);
      setNewScanPath('');
    }
  };

  const removeScanPath = (path: string) => {
    handleChange('scanPaths', localSettings.scanPaths.filter(p => p !== path));
  };

  return (
    <>
      {/* Page Header */}
      <motion.div 
        className="gfos-page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="gfos-page-title">
          <Settings size={28} />
          <div>
            <h1>Einstellungen</h1>
            <p>Konfiguriere GFOS Build</p>
          </div>
        </div>
        <div className="gfos-page-actions">
          {hasChanges && (
            <>
              <button className="gfos-secondary-btn" onClick={handleReset}>
                <RefreshCw size={18} />
                <span>Zurücksetzen</span>
              </button>
              <button className="gfos-primary-btn" onClick={handleSave}>
                <Save size={18} />
                <span>Speichern</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Settings Sections */}
      <div className="gfos-settings-grid">
        {/* Maven Configuration */}
        <motion.section 
          className="gfos-glass-panel gfos-settings-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="gfos-section-header">
            <h2>Maven Konfiguration</h2>
          </div>

          <div className="gfos-form-group">
            <label>Maven Pfad</label>
            <div className="gfos-input-with-btn">
              <input
                type="text"
                value={localSettings.mavenPath}
                onChange={(e) => handleChange('mavenPath', e.target.value)}
                placeholder="C:\dev\maven\bin\mvn.cmd"
              />
              <button className="gfos-icon-btn-sm">
                <FolderOpen size={16} />
              </button>
            </div>
            <span className="gfos-input-hint">Pfad zur Maven-Executable (mvn oder mvn.cmd)</span>
          </div>

          <div className="gfos-form-group">
            <label>Standard Maven Goals</label>
            <input
              type="text"
              value={localSettings.defaultGoals}
              onChange={(e) => handleChange('defaultGoals', e.target.value)}
              placeholder="clean install"
            />
            <span className="gfos-input-hint">Standard-Goals für neue Projekte</span>
          </div>

          <div className="gfos-form-group">
            <label>Parallele Builds</label>
            <div className="gfos-number-input">
              <button 
                onClick={() => handleChange('parallelBuilds', Math.max(1, localSettings.parallelBuilds - 1))}
                disabled={localSettings.parallelBuilds <= 1}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max="8"
                value={localSettings.parallelBuilds}
                onChange={(e) => handleChange('parallelBuilds', parseInt(e.target.value) || 1)}
              />
              <button 
                onClick={() => handleChange('parallelBuilds', Math.min(8, localSettings.parallelBuilds + 1))}
                disabled={localSettings.parallelBuilds >= 8}
              >
                +
              </button>
            </div>
            <span className="gfos-input-hint">Maximale Anzahl gleichzeitiger Builds</span>
          </div>
        </motion.section>

        {/* Scan Configuration */}
        <motion.section 
          className="gfos-glass-panel gfos-settings-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="gfos-section-header">
            <h2>Projekt-Scan</h2>
          </div>

          <div className="gfos-form-group">
            <label className="gfos-toggle-label">
              <span>Automatischer Scan</span>
              <button 
                className={`gfos-toggle ${localSettings.autoScan ? 'gfos-toggle-on' : ''}`}
                onClick={() => handleChange('autoScan', !localSettings.autoScan)}
              >
                <span className="gfos-toggle-handle" />
              </button>
            </label>
            <span className="gfos-input-hint">
              Scanne automatisch nach neuen Maven-Projekten beim Start
            </span>
          </div>

          <div className="gfos-form-group">
            <label>Scan-Verzeichnisse</label>
            <div className="gfos-scan-paths">
              {localSettings.scanPaths.map((path, i) => (
                <div key={i} className="gfos-scan-path-item">
                  <code>{path}</code>
                  <button 
                    className="gfos-icon-btn-sm"
                    onClick={() => removeScanPath(path)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="gfos-input-with-btn">
              <input
                type="text"
                value={newScanPath}
                onChange={(e) => setNewScanPath(e.target.value)}
                placeholder="Neues Verzeichnis hinzufügen..."
                onKeyDown={(e) => e.key === 'Enter' && addScanPath()}
              />
              <button className="gfos-icon-btn-sm" onClick={addScanPath}>
                <Plus size={16} />
              </button>
            </div>
          </div>
        </motion.section>

        {/* About Section */}
        <motion.section 
          className="gfos-glass-panel gfos-settings-section gfos-about-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="gfos-section-header">
            <h2>Über GFOS Build</h2>
          </div>

          <div className="gfos-about-content">
            <div className="gfos-about-logo">
              <img src="/GFOS_Logo.svg" alt="GFOS" />
            </div>
            <div className="gfos-about-info">
              <h3>GFOS Build</h3>
              <p>Version 1.0.0</p>
              <p className="gfos-muted">
                Ein leistungsstarkes Tool zur Verwaltung lokaler Maven-Builds 
                mit mehreren JDK-Versionen.
              </p>
            </div>
          </div>

          <div className="gfos-about-meta">
            <div className="gfos-meta-item">
              <span className="gfos-meta-label">Runtime</span>
              <span className="gfos-meta-value">Bun + React</span>
            </div>
            <div className="gfos-meta-item">
              <span className="gfos-meta-label">Platform</span>
              <span className="gfos-meta-value">Windows</span>
            </div>
            <div className="gfos-meta-item">
              <span className="gfos-meta-label">Build</span>
              <span className="gfos-meta-value">{new Date().toLocaleDateString('de-DE')}</span>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <motion.div 
          className="gfos-unsaved-banner"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle size={18} />
          <span>Du hast ungespeicherte Änderungen</span>
          <div className="gfos-banner-actions">
            <button className="gfos-text-btn" onClick={handleReset}>
              Verwerfen
            </button>
            <button className="gfos-primary-btn gfos-btn-sm" onClick={handleSave}>
              <Save size={16} />
              <span>Speichern</span>
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}
