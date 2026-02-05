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
            className="gfos-wizard-welcome"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="gfos-wizard-logo">
              <div className="gfos-wizard-logo-inner">
                <Cpu size={48} />
                <div className="gfos-wizard-logo-pulse" />
              </div>
            </div>
            
            <h1>Willkommen bei GFOS Build</h1>
            <p className="gfos-wizard-subtitle">
              Der schnellste Weg, Maven-Projekte zu bauen und zu verwalten.
            </p>
            
            <div className="gfos-wizard-features">
              <div className="gfos-wizard-feature">
                <FolderSearch size={24} />
                <div>
                  <h3>Smart Discovery</h3>
                  <p>Automatisches Erkennen von Maven-Projekten</p>
                </div>
              </div>
              <div className="gfos-wizard-feature">
                <Coffee size={24} />
                <div>
                  <h3>Multi-JDK Support</h3>
                  <p>Verschiedene JDK-Versionen pro Projekt</p>
                </div>
              </div>
              <div className="gfos-wizard-feature">
                <GitBranch size={24} />
                <div>
                  <h3>Build Pipelines</h3>
                  <p>Automatisierte Build-Workflows</p>
                </div>
              </div>
            </div>
            
            <button className="gfos-wizard-primary-btn" onClick={nextStep}>
              <span>Einrichtung starten</span>
              <ArrowRight size={20} />
            </button>
          </motion.div>
        );

      case 'paths':
        return (
          <motion.div 
            className="gfos-wizard-content"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <div className="gfos-wizard-step-header">
              <Settings size={32} />
              <div>
                <h2>Pfade konfigurieren</h2>
                <p>Gib an, wo deine Projekte und JDKs liegen</p>
              </div>
            </div>

            {setupWizard.scanError && (
              <div className="gfos-wizard-error">
                <AlertCircle size={20} />
                <span>{setupWizard.scanError}</span>
              </div>
            )}

            <div className="gfos-wizard-form">
              <div className="gfos-form-group">
                <label>
                  <FolderSearch size={16} />
                  Projekt-Stammverzeichnis
                </label>
                <p className="gfos-form-hint">
                  Das Verzeichnis, in dem deine Maven-Projekte liegen
                </p>
                <div className="gfos-input-with-btn">
                  <input
                    type="text"
                    value={localScanPath}
                    onChange={(e) => setLocalScanPath(e.target.value)}
                    placeholder="z.B. J:\dev\quellen"
                    className="gfos-input"
                  />
                  <button 
                    className="gfos-secondary-btn gfos-btn-icon"
                    onClick={selectProjectFolder}
                    type="button"
                  >
                    <Folder size={18} />
                  </button>
                </div>
              </div>

              <div className="gfos-form-group">
                <label>
                  <Coffee size={16} />
                  JDK-Verzeichnis
                </label>
                <p className="gfos-form-hint">
                  Das Verzeichnis, das deine JDK-Installationen enthält
                </p>
                <div className="gfos-input-with-btn">
                  <input
                    type="text"
                    value={localJdkPath}
                    onChange={(e) => setLocalJdkPath(e.target.value)}
                    placeholder="z.B. J:\dev\java"
                    className="gfos-input"
                  />
                  <button 
                    className="gfos-secondary-btn gfos-btn-icon"
                    onClick={selectJdkFolder}
                    type="button"
                  >
                    <Folder size={18} />
                  </button>
                </div>
              </div>

              <div className="gfos-form-group">
                <label>
                  <Terminal size={16} />
                  Maven-Verzeichnis
                </label>
                <p className="gfos-form-hint">
                  Das Verzeichnis, das Maven enthält (z.B. mvn3 Ordner)
                </p>
                <div className="gfos-input-with-btn">
                  <input
                    type="text"
                    value={localMavenPath}
                    onChange={(e) => setLocalMavenPath(e.target.value)}
                    placeholder="z.B. J:\dev\maven\mvn3"
                    className="gfos-input"
                  />
                  <button 
                    className="gfos-secondary-btn gfos-btn-icon"
                    onClick={selectMavenFile}
                    type="button"
                  >
                    <Folder size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="gfos-wizard-actions">
              <button className="gfos-secondary-btn" onClick={prevStep}>
                <ArrowLeft size={18} />
                <span>Zurück</span>
              </button>
              <button 
                className="gfos-primary-btn" 
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
            className="gfos-wizard-content"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <div className="gfos-wizard-step-header">
              <Coffee size={32} />
              <div>
                <h2>JDKs scannen</h2>
                <p>Wir suchen nach installierten Java-Versionen</p>
              </div>
            </div>

            {setupWizard.scanError && (
              <div className="gfos-wizard-error">
                <AlertCircle size={20} />
                <span>{setupWizard.scanError}</span>
              </div>
            )}

            <div className="gfos-wizard-scan-info">
              <div className="gfos-scan-path">
                <Folder size={18} />
                <code>{localJdkPath || 'Kein Verzeichnis angegeben'}</code>
              </div>
              
              {setupWizard.isScanning ? (
                <div className="gfos-wizard-scanning">
                  <Loader2 size={48} className="gfos-spin" />
                  <p>Suche nach JDKs...</p>
                </div>
              ) : scannedJdks.length > 0 ? (
                <div className="gfos-wizard-scan-result">
                  <Check size={48} />
                  <h3>{scannedJdks.length} JDKs gefunden</h3>
                  <div className="gfos-scanned-list">
                    {scannedJdks.slice(0, 5).map((jdk, i) => (
                      <div key={i} className="gfos-scanned-item">
                        <Coffee size={16} />
                        <span>{jdk.version}</span>
                        <code>{jdk.path}</code>
                      </div>
                    ))}
                    {scannedJdks.length > 5 && (
                      <p className="gfos-more-items">
                        +{scannedJdks.length - 5} weitere
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="gfos-wizard-scan-preview">
                  <FolderSearch size={48} />
                  <p>Klicke auf "Scannen" um nach JDKs zu suchen.</p>
                </div>
              )}
            </div>

            <div className="gfos-wizard-actions">
              <button className="gfos-secondary-btn" onClick={prevStep}>
                <ArrowLeft size={18} />
                <span>Zurück</span>
              </button>
              
              <div className="gfos-wizard-actions-right">
                {scannedJdks.length > 0 && (
                  <button 
                    className="gfos-secondary-btn" 
                    onClick={handleScanJdks}
                    disabled={setupWizard.isScanning}
                  >
                    <RefreshCw size={18} />
                    <span>Erneut scannen</span>
                  </button>
                )}
                
                {scannedJdks.length > 0 ? (
                  <button className="gfos-primary-btn" onClick={nextStep}>
                    <span>Weiter</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button 
                    className="gfos-primary-btn" 
                    onClick={handleScanJdks}
                    disabled={setupWizard.isScanning || !localJdkPath.trim()}
                  >
                    {setupWizard.isScanning ? (
                      <>
                        <Loader2 size={18} className="gfos-spin" />
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
            className="gfos-wizard-content"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <div className="gfos-wizard-step-header">
              <FolderSearch size={32} />
              <div>
                <h2>Projekte suchen</h2>
                <p>Wir suchen nach Maven-Projekten und Git-Repositories</p>
              </div>
            </div>

            {setupWizard.scanError && (
              <div className="gfos-wizard-error">
                <AlertCircle size={20} />
                <span>{setupWizard.scanError}</span>
              </div>
            )}

            <div className="gfos-wizard-scan-info">
              <div className="gfos-scan-path">
                <Folder size={18} />
                <code>{localScanPath || 'Kein Verzeichnis angegeben'}</code>
              </div>
              
              {setupWizard.isScanning ? (
                <div className="gfos-wizard-scanning">
                  <Loader2 size={48} className="gfos-spin" />
                  <p>Suche nach Projekten...</p>
                </div>
              ) : scannedProjects.length > 0 ? (
                <div className="gfos-wizard-scan-result">
                  <Check size={48} />
                  <h3>{scannedProjects.length} Projekte gefunden</h3>
                  <div className="gfos-scanned-list">
                    {scannedProjects.slice(0, 5).map((proj, i) => (
                      <div key={i} className="gfos-scanned-item">
                        <GitBranch size={16} />
                        <span>{proj.name}</span>
                        <code>{proj.path}</code>
                      </div>
                    ))}
                    {scannedProjects.length > 5 && (
                      <p className="gfos-more-items">
                        +{scannedProjects.length - 5} weitere
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="gfos-wizard-scan-preview">
                  <FolderSearch size={48} />
                  <p>Klicke auf "Scannen" um nach Projekten zu suchen.</p>
                </div>
              )}
            </div>

            <div className="gfos-wizard-actions">
              <button className="gfos-secondary-btn" onClick={prevStep}>
                <ArrowLeft size={18} />
                <span>Zurück</span>
              </button>
              
              <div className="gfos-wizard-actions-right">
                {scannedProjects.length > 0 && (
                  <button 
                    className="gfos-secondary-btn" 
                    onClick={handleScanProjects}
                    disabled={setupWizard.isScanning}
                  >
                    <RefreshCw size={18} />
                    <span>Erneut scannen</span>
                  </button>
                )}
                
                {scannedProjects.length > 0 ? (
                  <button className="gfos-primary-btn" onClick={nextStep}>
                    <span>Weiter</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button 
                    className="gfos-primary-btn" 
                    onClick={handleScanProjects}
                    disabled={setupWizard.isScanning || !localScanPath.trim()}
                  >
                    {setupWizard.isScanning ? (
                      <>
                        <Loader2 size={18} className="gfos-spin" />
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
            className="gfos-wizard-complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="gfos-wizard-complete-icon">
              <Sparkles size={64} />
            </div>
            
            <h1>Alles bereit!</h1>
            <p className="gfos-wizard-subtitle">
              GFOS Build ist einsatzbereit. Starte jetzt deinen ersten Build.
            </p>
            
            <div className="gfos-wizard-summary">
              <div className="gfos-summary-item">
                <Coffee size={24} />
                <div>
                  <strong>{scannedJdks.length}</strong>
                  <span>JDKs konfiguriert</span>
                </div>
              </div>
              <div className="gfos-summary-item">
                <FolderSearch size={24} />
                <div>
                  <strong>{scannedProjects.length}</strong>
                  <span>Projekte gefunden</span>
                </div>
              </div>
            </div>
            
            <button className="gfos-wizard-primary-btn" onClick={handleComplete}>
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
    <div className="gfos-wizard-container">
      {/* Progress Indicator */}
      <div className="gfos-wizard-progress">
        {STEPS.map((step, index) => (
          <div 
            key={step.id}
            className={`gfos-wizard-step ${
              index < currentStepIndex ? 'gfos-step-complete' : 
              index === currentStepIndex ? 'gfos-step-current' : ''
            }`}
          >
            <div className="gfos-step-indicator">
              {index < currentStepIndex ? (
                <Check size={16} />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <span className="gfos-step-label">{step.label}</span>
            {index < STEPS.length - 1 && <div className="gfos-step-connector" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="gfos-wizard-panel">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>
    </div>
  );
}
