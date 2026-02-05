/**
 * Settings View - Application Configuration
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, Save, FolderOpen, Plus, Trash2,
  RefreshCw, AlertTriangle, Coffee, Check
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function SettingsView() {
  const { settings, updateSettings, addNotification, jdks, setDefaultJdk } = useAppStore();
  
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
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <Settings size={28} />
          <div>
            <h1 className="text-2xl font-bold text-dark-500 dark:text-light-100">Einstellungen</h1>
            <p className="text-sm text-dark-300 dark:text-light-400">Konfiguriere GFOS Build</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <>
              <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors" onClick={handleReset}>
                <RefreshCw size={18} />
                <span>Zurücksetzen</span>
              </button>
              <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors" onClick={handleSave}>
                <Save size={18} />
                <span>Speichern</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Maven Configuration */}
        <motion.section 
          className="bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-sm p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-dark-500 dark:text-light-100">Maven Konfiguration</h2>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-400 dark:text-light-300">Maven Pfad</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localSettings.mavenPath}
                  onChange={(e) => handleChange('mavenPath', e.target.value)}
                  placeholder="C:\dev\maven\bin\mvn.cmd"
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                />
                <button className="flex items-center justify-center w-10 h-10 rounded-xl bg-light-200 dark:bg-dark-700 text-dark-400 hover:bg-light-300 dark:hover:bg-dark-600 transition-colors">
                  <FolderOpen size={16} />
                </button>
              </div>
              <span className="text-xs text-dark-300 dark:text-light-400">Pfad zur Maven-Executable (mvn oder mvn.cmd)</span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-400 dark:text-light-300">Standard Maven Goals</label>
              <input
                type="text"
                value={localSettings.defaultGoals}
                onChange={(e) => handleChange('defaultGoals', e.target.value)}
                placeholder="clean install"
                className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
              />
              <span className="text-xs text-dark-300 dark:text-light-400">Standard-Goals für neue Projekte</span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-400 dark:text-light-300">Parallele Builds</label>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleChange('parallelBuilds', Math.max(1, localSettings.parallelBuilds - 1))}
                  disabled={localSettings.parallelBuilds <= 1}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium hover:bg-light-300 dark:hover:bg-dark-600 transition-colors disabled:opacity-50"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={localSettings.parallelBuilds}
                  onChange={(e) => handleChange('parallelBuilds', parseInt(e.target.value) || 1)}
                  className="w-16 px-3 py-2.5 bg-white dark:bg-dark-700 rounded-lg border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 text-center focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                />
                <button 
                  onClick={() => handleChange('parallelBuilds', Math.min(8, localSettings.parallelBuilds + 1))}
                  disabled={localSettings.parallelBuilds >= 8}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium hover:bg-light-300 dark:hover:bg-dark-600 transition-colors disabled:opacity-50"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-dark-300 dark:text-light-400">Maximale Anzahl gleichzeitiger Builds</span>
            </div>
          </div>
        </motion.section>

        {/* JDK Configuration */}
        <motion.section 
          className="bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-sm p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-dark-500 dark:text-light-100">JDK Konfiguration</h2>
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-medium bg-petrol-100 dark:bg-petrol-900/30 text-petrol-600 dark:text-petrol-400 rounded-full">{jdks.length}</span>
          </div>

          <div className="space-y-3 mb-5">
            {jdks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Coffee size={24} className="text-dark-200 mb-2" />
                <p className="text-sm text-dark-300 dark:text-light-400">Keine JDKs gefunden</p>
              </div>
            ) : (
              jdks.map((jdk) => (
                <div 
                  key={jdk.id} 
                  className={`p-4 rounded-xl ${jdk.isDefault ? 'bg-petrol-50 dark:bg-petrol-900/20 ring-1 ring-petrol-200 dark:ring-petrol-800' : 'bg-light-100 dark:bg-dark-700/50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Coffee size={16} className={jdk.isDefault ? 'text-petrol-500' : 'text-dark-400'} />
                        <span className="font-medium text-dark-500 dark:text-light-100">Java {jdk.version}</span>
                        {jdk.isDefault && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-petrol-100 dark:bg-petrol-900/40 text-petrol-600 dark:text-petrol-400">Standard</span>
                        )}
                      </div>
                      <code className="block text-xs text-dark-400 dark:text-light-400">{jdk.path}</code>
                      <span className="text-xs text-dark-300 dark:text-light-400">{jdk.vendor}</span>
                    </div>
                    <div>
                      {!jdk.isDefault && (
                        <button 
                          className="inline-flex items-center gap-1.5 text-sm text-petrol-500 hover:text-petrol-600 font-medium"
                          onClick={() => setDefaultJdk(jdk.id)}
                          title="Als Standard setzen"
                        >
                          <Check size={16} />
                          <span>Standard</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-dark-400 dark:text-light-300">JDK-Scan-Verzeichnis</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localSettings.jdkScanPath || ''}
                onChange={(e) => handleChange('jdkScanPath' as keyof typeof settings, e.target.value as never)}
                placeholder="C:\dev\java"
                className="flex-1 px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
              />
              <button className="flex items-center justify-center w-10 h-10 rounded-xl bg-light-200 dark:bg-dark-700 text-dark-400 hover:bg-light-300 dark:hover:bg-dark-600 transition-colors">
                <FolderOpen size={16} />
              </button>
            </div>
            <span className="text-xs text-dark-300 dark:text-light-400">Verzeichnis mit JDK-Installationen</span>
          </div>
        </motion.section>

        {/* Build Defaults */}
        <motion.section 
          className="bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-sm p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-dark-500 dark:text-light-100">Build Voreinstellungen</h2>
          </div>

          <div className="space-y-5">
            {/* Skip Tests by Default */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-dark-500 dark:text-light-100">Tests überspringen</span>
                <span className="text-xs text-dark-300 dark:text-light-400">
                  Standardmäßig -DskipTests bei neuen Builds aktivieren
                </span>
              </div>
              <button 
                className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.skipTestsByDefault ? 'bg-petrol-500' : 'bg-light-300 dark:bg-dark-600'}`}
                onClick={() => handleChange('skipTestsByDefault', !localSettings.skipTestsByDefault)}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${localSettings.skipTestsByDefault ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {/* Offline Mode */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-dark-500 dark:text-light-100">Offline Modus</span>
                <span className="text-xs text-dark-300 dark:text-light-400">
                  Builds im Offline-Modus ausführen (-o)
                </span>
              </div>
              <button 
                className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.offlineMode ? 'bg-petrol-500' : 'bg-light-300 dark:bg-dark-600'}`}
                onClick={() => handleChange('offlineMode', !localSettings.offlineMode)}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${localSettings.offlineMode ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {/* Threading */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-dark-500 dark:text-light-100">Multithreading</span>
                <span className="text-xs text-dark-300 dark:text-light-400">
                  Maven mit mehreren Threads ausführen (-T)
                </span>
              </div>
              <button 
                className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.enableThreads ? 'bg-petrol-500' : 'bg-light-300 dark:bg-dark-600'}`}
                onClick={() => handleChange('enableThreads', !localSettings.enableThreads)}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${localSettings.enableThreads ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {/* Thread Count */}
            {localSettings.enableThreads && (
              <div className="space-y-2 pl-4 border-l-2 border-petrol-200 dark:border-petrol-800">
                <label className="text-sm font-medium text-dark-400 dark:text-light-300">Thread Anzahl</label>
                <div className="flex gap-2">
                  {['1C', '2C', '4', '8'].map(count => (
                    <button
                      key={count}
                      onClick={() => handleChange('threadCount', count)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        localSettings.threadCount === count
                          ? 'bg-petrol-500 text-white'
                          : 'bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 hover:bg-light-300 dark:hover:bg-dark-600'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-dark-300 dark:text-light-400">
                  C = pro CPU-Kern (z.B. 1C = 1 Thread pro Kern)
                </span>
              </div>
            )}
          </div>
        </motion.section>

        {/* Scan Configuration */}
        <motion.section 
          className="bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-sm p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-dark-500 dark:text-light-100">Projekt-Scan</h2>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-dark-500 dark:text-light-100">Automatischer Scan</span>
                <span className="text-xs text-dark-300 dark:text-light-400">
                  Scanne automatisch nach neuen Maven-Projekten beim Start
                </span>
              </div>
              <button 
                className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.autoScan ? 'bg-petrol-500' : 'bg-light-300 dark:bg-dark-600'}`}
                onClick={() => handleChange('autoScan', !localSettings.autoScan)}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${localSettings.autoScan ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-400 dark:text-light-300">Scan-Verzeichnisse</label>
              <div className="space-y-2">
                {localSettings.scanPaths.map((path, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-light-100 dark:bg-dark-700 rounded-lg">
                    <code className="flex-1 text-sm text-dark-400 dark:text-light-300 truncate">{path}</code>
                    <button 
                      className="flex items-center justify-center w-6 h-6 text-dark-300 hover:text-error-500 transition-colors"
                      onClick={() => removeScanPath(path)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newScanPath}
                  onChange={(e) => setNewScanPath(e.target.value)}
                  placeholder="Neues Verzeichnis hinzufügen..."
                  onKeyDown={(e) => e.key === 'Enter' && addScanPath()}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                />
                <button className="flex items-center justify-center w-10 h-10 rounded-xl bg-light-200 dark:bg-dark-700 text-dark-400 hover:bg-light-300 dark:hover:bg-dark-600 transition-colors" onClick={addScanPath}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* About Section */}
        <motion.section 
          className="bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-sm p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-dark-500 dark:text-light-100">Über GFOS Build</h2>
          </div>

          <div className="flex items-center gap-6 mb-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-petrol-100 dark:bg-petrol-900/30">
              <img src="./GFOS_Logo.svg" alt="GFOS" className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-dark-500 dark:text-light-100">GFOS Build</h3>
              <p className="text-sm text-dark-400 dark:text-light-300">Version 1.0.0</p>
              <p className="text-sm text-dark-300 dark:text-light-400 mt-1">
                Ein leistungsstarkes Tool zur Verwaltung lokaler Maven-Builds 
                mit mehreren JDK-Versionen.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-light-100 dark:bg-dark-700/50 rounded-lg text-center">
              <span className="block text-xs text-dark-300 dark:text-light-400 mb-1">Runtime</span>
              <span className="text-sm font-medium text-dark-500 dark:text-light-100">Bun + React</span>
            </div>
            <div className="p-3 bg-light-100 dark:bg-dark-700/50 rounded-lg text-center">
              <span className="block text-xs text-dark-300 dark:text-light-400 mb-1">Platform</span>
              <span className="text-sm font-medium text-dark-500 dark:text-light-100">Windows</span>
            </div>
            <div className="p-3 bg-light-100 dark:bg-dark-700/50 rounded-lg text-center">
              <span className="block text-xs text-dark-300 dark:text-light-400 mb-1">Build</span>
              <span className="text-sm font-medium text-dark-500 dark:text-light-100">{new Date().toLocaleDateString('de-DE')}</span>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <motion.div 
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 bg-warning-50 dark:bg-warning-900/90 backdrop-blur-xl rounded-2xl border border-warning-200 dark:border-warning-800 shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle size={18} className="text-warning-500" />
          <span className="text-warning-700 dark:text-warning-300">Du hast ungespeicherte Änderungen</span>
          <div className="flex items-center gap-2">
            <button className="text-sm text-warning-600 dark:text-warning-400 hover:text-warning-700 font-medium" onClick={handleReset}>
              Verwerfen
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-petrol-500 text-white text-sm font-medium rounded-lg hover:bg-petrol-600 transition-colors" onClick={handleSave}>
              <Save size={16} />
              <span>Speichern</span>
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}
