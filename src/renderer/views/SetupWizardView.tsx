/**
 * SetupWizardView - Initial Configuration Wizard
 * Guides users through first-time setup
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cpu, FolderSearch, Coffee, Settings, 
  Check, Loader2, AlertCircle, Folder, ArrowRight, 
  ArrowLeft, Sparkles, GitBranch, Terminal, RefreshCw
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../api';
import type { SetupWizardStep } from '../types';

const STEPS: { id: SetupWizardStep; label: string }[] = [
  { id: 'welcome', label: 'Willkommen' },
  { id: 'paths', label: 'Pfade' },
  { id: 'jdk-scan', label: 'JDK Scan' },
  { id: 'project-scan', label: 'Projekte' },
  { id: 'complete', label: 'Fertig' },
];

export default function SetupWizardView() {
  const { 
    setupWizard,
    updateSetupWizard,
    completeSetup,
    setProjects,
    setJdks,
    updateSettings,
  } = useAppStore();

  const [localScanPath, setLocalScanPath] = useState(setupWizard.scanRootPath || '');
  const [localJdkPath, setLocalJdkPath] = useState(setupWizard.jdkScanPaths || '');
  const [localMavenPath, setLocalMavenPath] = useState(setupWizard.mavenPath || '');
  
  // Local scan results to display
  const [scannedJdks, setScannedJdks] = useState<Array<{ id: string; version: string; path: string; vendor: string }>>([]);
  const [scannedProjects, setScannedProjects] = useState<Array<{ name: string; path: string; hasPom: boolean }>>([]);

  const currentStepIndex = STEPS.findIndex(s => s.id === setupWizard.currentStep);

  const goToStep = (step: SetupWizardStep) => {
    updateSetupWizard({ currentStep: step, scanError: undefined });
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      goToStep(STEPS[nextIndex].id);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      goToStep(STEPS[prevIndex].id);
    }
  };

  // Folder selection dialogs
  const selectProjectFolder = async () => {
    try {
      const folder = await api.selectFolder();
      if (folder) {
        setLocalScanPath(folder);
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  };

  const selectJdkFolder = async () => {
    try {
      const folder = await api.selectFolder();
      if (folder) {
        setLocalJdkPath(folder);
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  };

  const selectMavenFile = async () => {
    try {
      const folder = await api.selectFolder();
      if (folder) {
        setLocalMavenPath(folder);
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  };

  // Actual scanning functions using the API
  const handleScanJdks = async () => {
    if (!localJdkPath.trim()) {
      updateSetupWizard({ scanError: 'Bitte gib ein JDK-Verzeichnis an.' });
      return;
    }

    updateSetupWizard({ 
      isScanning: true, 
      scanError: undefined,
      jdkScanPaths: localJdkPath,
      mavenPath: localMavenPath
    });
    
    try {
      const jdks = await api.scanJDKs(localJdkPath);
      setScannedJdks(jdks.map((jdk: { id?: string; jdkHome: string; version: string; vendor?: string }) => ({
        id: jdk.id || jdk.jdkHome,
        version: jdk.version,
        path: jdk.jdkHome,
        vendor: jdk.vendor || 'Unknown'
      })));
      
      updateSetupWizard({ 
        isScanning: false, 
        foundJdks: jdks.length 
      });
      
      // Store JDKs in app state
      if (jdks.length > 0) {
        setJdks(jdks.map((jdk: { id?: string; jdkHome: string; version: string; vendor?: string; majorVersion?: number }, i: number) => ({
          id: jdk.id || `jdk-${i}`,
          version: jdk.version,
          path: jdk.jdkHome,
          vendor: jdk.vendor || 'Unknown',
          isDefault: i === 0
        })));
      }
    } catch (err) {
      console.error('JDK scan failed:', err);
      updateSetupWizard({ 
        isScanning: false, 
        scanError: `Scan fehlgeschlagen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
      });
    }
  };

  const handleScanProjects = async () => {
    if (!localScanPath.trim()) {
      updateSetupWizard({ scanError: 'Bitte gib ein Projekt-Verzeichnis an.' });
      return;
    }

    updateSetupWizard({ 
      isScanning: true, 
      scanError: undefined,
      scanRootPath: localScanPath 
    });
    
    try {
      const projects = await api.scanProjects(localScanPath);
      setScannedProjects(projects.map((p: { name: string; path: string; hasPom?: boolean }) => ({
        name: p.name,
        path: p.path,
        hasPom: p.hasPom ?? true
      })));
      
      updateSetupWizard({ 
        isScanning: false, 
        foundProjects: projects.length 
      });
      
      // Store projects in app state
      if (projects.length > 0) {
        setProjects(projects.map((p: { name: string; path: string; isGitRepo?: boolean; relativePath?: string }, i: number) => ({
          id: `project-${i}`,
          name: p.name,
          path: p.path,
          branch: 'main',
          jdk: 'JDK 21',
          mavenGoals: 'clean install'
        })));
      }
    } catch (err) {
      console.error('Project scan failed:', err);
      updateSetupWizard({ 
        isScanning: false, 
        scanError: `Scan fehlgeschlagen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
      });
    }
  };

  const handleComplete = () => {
    // Save settings
    updateSettings({
      mavenPath: localMavenPath,
      scanPaths: localScanPath ? [localScanPath] : [],
      jdkScanPath: localJdkPath,
      setupComplete: true
    });
    completeSetup();
  };

  const renderStep = () => {
    switch (setupWizard.currentStep) {
      case 'welcome':
        return (
          <motion.div 
            className="flex flex-col items-center text-center py-12"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="relative mb-8">
              <div className="flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-petrol-400 to-petrol-600 text-white shadow-lg">
                <Cpu size={48} />
              </div>
              <div className="absolute inset-0 rounded-3xl bg-petrol-500/30 animate-ping" />
            </div>
            
            <h1 className="text-3xl font-bold text-dark-500 dark:text-light-100 mb-3">Willkommen bei GFOS Build</h1>
            <p className="text-lg text-dark-300 dark:text-light-400 mb-10 max-w-md">
              Der schnellste Weg, Maven-Projekte zu bauen und zu verwalten.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 w-full max-w-2xl">
              <div className="flex items-start gap-4 p-4 bg-light-100 dark:bg-dark-700/50 rounded-xl text-left">
                <FolderSearch size={24} className="text-petrol-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-dark-500 dark:text-light-100">Smart Discovery</h3>
                  <p className="text-sm text-dark-300 dark:text-light-400">Automatisches Erkennen von Maven-Projekten</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-light-100 dark:bg-dark-700/50 rounded-xl text-left">
                <Coffee size={24} className="text-petrol-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-dark-500 dark:text-light-100">Multi-JDK Support</h3>
                  <p className="text-sm text-dark-300 dark:text-light-400">Verschiedene JDK-Versionen pro Projekt</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-light-100 dark:bg-dark-700/50 rounded-xl text-left">
                <GitBranch size={24} className="text-petrol-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-dark-500 dark:text-light-100">Build Pipelines</h3>
                  <p className="text-sm text-dark-300 dark:text-light-400">Automatisierte Build-Workflows</p>
                </div>
              </div>
            </div>
            
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors text-lg" onClick={nextStep}>
              <span>Einrichtung starten</span>
              <ArrowRight size={20} />
            </button>
          </motion.div>
        );

      case 'paths':
        return (
          <motion.div 
            className="py-8"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-petrol-100 dark:bg-petrol-900/30 text-petrol-500">
                <Settings size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-dark-500 dark:text-light-100">Pfade konfigurieren</h2>
                <p className="text-dark-300 dark:text-light-400">Gib an, wo deine Projekte und JDKs liegen</p>
              </div>
            </div>

            {setupWizard.scanError && (
              <div className="flex items-center gap-3 p-4 mb-6 bg-error-50 dark:bg-error-900/20 rounded-xl border border-error-200 dark:border-error-800">
                <AlertCircle size={20} className="text-error-500" />
                <span className="text-error-600 dark:text-error-400">{setupWizard.scanError}</span>
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-dark-400 dark:text-light-300">
                  <FolderSearch size={16} />
                  Projekt-Stammverzeichnis
                </label>
                <p className="text-xs text-dark-300 dark:text-light-400">
                  Das Verzeichnis, in dem deine Maven-Projekte liegen
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localScanPath}
                    onChange={(e) => setLocalScanPath(e.target.value)}
                    placeholder="z.B. J:\dev\quellen"
                    className="flex-1 px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                  />
                  <button 
                    className="inline-flex items-center justify-center w-10 h-10 bg-light-200 dark:bg-dark-700 text-dark-400 rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors"
                    onClick={selectProjectFolder}
                    type="button"
                  >
                    <Folder size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-dark-400 dark:text-light-300">
                  <Coffee size={16} />
                  JDK-Verzeichnis
                </label>
                <p className="text-xs text-dark-300 dark:text-light-400">
                  Das Verzeichnis, das deine JDK-Installationen enthält
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localJdkPath}
                    onChange={(e) => setLocalJdkPath(e.target.value)}
                    placeholder="z.B. J:\dev\java"
                    className="flex-1 px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                  />
                  <button 
                    className="inline-flex items-center justify-center w-10 h-10 bg-light-200 dark:bg-dark-700 text-dark-400 rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors"
                    onClick={selectJdkFolder}
                    type="button"
                  >
                    <Folder size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-dark-400 dark:text-light-300">
                  <Terminal size={16} />
                  Maven-Verzeichnis
                </label>
                <p className="text-xs text-dark-300 dark:text-light-400">
                  Das Verzeichnis, das Maven enthält (z.B. mvn3 Ordner)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localMavenPath}
                    onChange={(e) => setLocalMavenPath(e.target.value)}
                    placeholder="z.B. J:\dev\maven\mvn3"
                    className="flex-1 px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                  />
                  <button 
                    className="inline-flex items-center justify-center w-10 h-10 bg-light-200 dark:bg-dark-700 text-dark-400 rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors"
                    onClick={selectMavenFile}
                    type="button"
                  >
                    <Folder size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-10">
              <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors" onClick={prevStep}>
                <ArrowLeft size={18} />
                <span>Zurück</span>
              </button>
              <button 
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors disabled:opacity-50" 
                onClick={nextStep}
                disabled={!localScanPath.trim() || !localJdkPath.trim()}
              >
                <span>Weiter</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        );

      case 'jdk-scan':
        return (
          <motion.div 
            className="py-8"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-petrol-100 dark:bg-petrol-900/30 text-petrol-500">
                <Coffee size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-dark-500 dark:text-light-100">JDKs scannen</h2>
                <p className="text-dark-300 dark:text-light-400">Wir suchen nach installierten Java-Versionen</p>
              </div>
            </div>

            {setupWizard.scanError && (
              <div className="flex items-center gap-3 p-4 mb-6 bg-error-50 dark:bg-error-900/20 rounded-xl border border-error-200 dark:border-error-800">
                <AlertCircle size={20} className="text-error-500" />
                <span className="text-error-600 dark:text-error-400">{setupWizard.scanError}</span>
              </div>
            )}

            <div className="mb-8">
              <div className="flex items-center gap-2 p-3 bg-light-100 dark:bg-dark-700 rounded-lg mb-6">
                <Folder size={18} className="text-dark-400" />
                <code className="text-sm text-dark-400 dark:text-light-300">{localJdkPath || 'Kein Verzeichnis angegeben'}</code>
              </div>
              
              {setupWizard.isScanning ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={48} className="text-petrol-500 animate-spin mb-4" />
                  <p className="text-dark-300 dark:text-light-400">Suche nach JDKs...</p>
                </div>
              ) : scannedJdks.length > 0 ? (
                <div className="flex flex-col items-center py-8">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success-100 dark:bg-success-900/30 text-success-500 mb-4">
                    <Check size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-dark-500 dark:text-light-100 mb-4">{scannedJdks.length} JDKs gefunden</h3>
                  <div className="w-full max-w-md space-y-2">
                    {scannedJdks.slice(0, 5).map((jdk, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-light-100 dark:bg-dark-700 rounded-lg">
                        <Coffee size={16} className="text-petrol-500" />
                        <span className="font-medium text-dark-500 dark:text-light-100">{jdk.version}</span>
                        <code className="flex-1 text-xs text-dark-300 dark:text-light-400 truncate">{jdk.path}</code>
                      </div>
                    ))}
                    {scannedJdks.length > 5 && (
                      <p className="text-sm text-dark-300 dark:text-light-400 text-center">
                        +{scannedJdks.length - 5} weitere
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-12">
                  <FolderSearch size={48} className="text-dark-200 mb-4" />
                  <p className="text-dark-300 dark:text-light-400">Klicke auf "Scannen" um nach JDKs zu suchen.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors" onClick={prevStep}>
                <ArrowLeft size={18} />
                <span>Zurück</span>
              </button>
              
              <div className="flex items-center gap-3">
                {scannedJdks.length > 0 && (
                  <button 
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors disabled:opacity-50" 
                    onClick={handleScanJdks}
                    disabled={setupWizard.isScanning}
                  >
                    <RefreshCw size={18} />
                    <span>Erneut scannen</span>
                  </button>
                )}
                
                {scannedJdks.length > 0 ? (
                  <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors" onClick={nextStep}>
                    <span>Weiter</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button 
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors disabled:opacity-50" 
                    onClick={handleScanJdks}
                    disabled={setupWizard.isScanning || !localJdkPath.trim()}
                  >
                    {setupWizard.isScanning ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Scanne...</span>
                      </>
                    ) : (
                      <>
                        <FolderSearch size={18} />
                        <span>Scannen</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        );

      case 'project-scan':
        return (
          <motion.div 
            className="py-8"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-petrol-100 dark:bg-petrol-900/30 text-petrol-500">
                <FolderSearch size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-dark-500 dark:text-light-100">Projekte suchen</h2>
                <p className="text-dark-300 dark:text-light-400">Wir suchen nach Maven-Projekten und Git-Repositories</p>
              </div>
            </div>

            {setupWizard.scanError && (
              <div className="flex items-center gap-3 p-4 mb-6 bg-error-50 dark:bg-error-900/20 rounded-xl border border-error-200 dark:border-error-800">
                <AlertCircle size={20} className="text-error-500" />
                <span className="text-error-600 dark:text-error-400">{setupWizard.scanError}</span>
              </div>
            )}

            <div className="mb-8">
              <div className="flex items-center gap-2 p-3 bg-light-100 dark:bg-dark-700 rounded-lg mb-6">
                <Folder size={18} className="text-dark-400" />
                <code className="text-sm text-dark-400 dark:text-light-300">{localScanPath || 'Kein Verzeichnis angegeben'}</code>
              </div>
              
              {setupWizard.isScanning ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={48} className="text-petrol-500 animate-spin mb-4" />
                  <p className="text-dark-300 dark:text-light-400">Suche nach Projekten...</p>
                </div>
              ) : scannedProjects.length > 0 ? (
                <div className="flex flex-col items-center py-8">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success-100 dark:bg-success-900/30 text-success-500 mb-4">
                    <Check size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-dark-500 dark:text-light-100 mb-4">{scannedProjects.length} Projekte gefunden</h3>
                  <div className="w-full max-w-md space-y-2">
                    {scannedProjects.slice(0, 5).map((proj, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-light-100 dark:bg-dark-700 rounded-lg">
                        <GitBranch size={16} className="text-petrol-500" />
                        <span className="font-medium text-dark-500 dark:text-light-100">{proj.name}</span>
                        <code className="flex-1 text-xs text-dark-300 dark:text-light-400 truncate">{proj.path}</code>
                      </div>
                    ))}
                    {scannedProjects.length > 5 && (
                      <p className="text-sm text-dark-300 dark:text-light-400 text-center">
                        +{scannedProjects.length - 5} weitere
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-12">
                  <FolderSearch size={48} className="text-dark-200 mb-4" />
                  <p className="text-dark-300 dark:text-light-400">Klicke auf "Scannen" um nach Projekten zu suchen.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors" onClick={prevStep}>
                <ArrowLeft size={18} />
                <span>Zurück</span>
              </button>
              
              <div className="flex items-center gap-3">
                {scannedProjects.length > 0 && (
                  <button 
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors disabled:opacity-50" 
                    onClick={handleScanProjects}
                    disabled={setupWizard.isScanning}
                  >
                    <RefreshCw size={18} />
                    <span>Erneut scannen</span>
                  </button>
                )}
                
                {scannedProjects.length > 0 ? (
                  <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors" onClick={nextStep}>
                    <span>Weiter</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button 
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors disabled:opacity-50" 
                    onClick={handleScanProjects}
                    disabled={setupWizard.isScanning || !localScanPath.trim()}
                  >
                    {setupWizard.isScanning ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Scanne...</span>
                      </>
                    ) : (
                      <>
                        <FolderSearch size={18} />
                        <span>Scannen</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        );

      case 'complete':
        return (
          <motion.div 
            className="flex flex-col items-center text-center py-12"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-success-400 to-success-600 text-white shadow-lg mb-8">
              <Sparkles size={40} />
            </div>
            
            <h1 className="text-3xl font-bold text-dark-500 dark:text-light-100 mb-3">Alles bereit!</h1>
            <p className="text-lg text-dark-300 dark:text-light-400 mb-10 max-w-md">
              GFOS Build ist einsatzbereit. Starte jetzt deinen ersten Build.
            </p>
            
            <div className="flex items-center gap-6 mb-10">
              <div className="flex items-center gap-3 p-4 bg-light-100 dark:bg-dark-700/50 rounded-xl">
                <Coffee size={24} className="text-petrol-500" />
                <div className="text-left">
                  <strong className="block text-dark-500 dark:text-light-100">{scannedJdks.length}</strong>
                  <span className="text-sm text-dark-300 dark:text-light-400">JDKs konfiguriert</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-light-100 dark:bg-dark-700/50 rounded-xl">
                <FolderSearch size={24} className="text-petrol-500" />
                <div className="text-left">
                  <strong className="block text-dark-500 dark:text-light-100">{scannedProjects.length}</strong>
                  <span className="text-sm text-dark-300 dark:text-light-400">Projekte gefunden</span>
                </div>
              </div>
            </div>
            
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors text-lg" onClick={handleComplete}>
              <Sparkles size={20} />
              <span>Loslegen</span>
            </button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-8">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((step, index) => (
          <div 
            key={step.id}
            className="flex items-center"
          >
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              index < currentStepIndex 
                ? 'bg-petrol-500 text-white' 
                : index === currentStepIndex 
                  ? 'bg-petrol-500 text-white ring-4 ring-petrol-100 dark:ring-petrol-900/50' 
                  : 'bg-light-300 dark:bg-dark-600 text-dark-300 dark:text-light-400'
            }`}>
              {index < currentStepIndex ? (
                <Check size={16} />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <span className={`ml-2 text-sm font-medium hidden sm:block ${
              index === currentStepIndex ? 'text-dark-500 dark:text-light-100' : 'text-dark-300 dark:text-light-400'
            }`}>{step.label}</span>
            {index < STEPS.length - 1 && <div className={`w-8 h-0.5 mx-2 rounded-full ${index < currentStepIndex ? 'bg-petrol-500' : 'bg-light-300 dark:bg-dark-600'}`} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="flex-1 bg-white/60 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-white/10 shadow-[0_8px_32px_rgba(0,125,143,0.08)] p-8 max-w-3xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>
    </div>
  );
}
