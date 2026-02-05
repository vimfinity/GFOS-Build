/**
 * SetupWizardView - Initial Configuration Wizard
 * Guides users through first-time setup
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cpu, FolderSearch, Coffee, Settings, 
  Check, Loader2, AlertCircle, Folder, ArrowRight, 
  ArrowLeft, Sparkles, GitBranch, Terminal
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
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
    projects,
    jdks,
    addNotification
  } = useAppStore();

  const [localScanPath, setLocalScanPath] = useState(setupWizard.scanRootPath);
  const [localJdkPath, setLocalJdkPath] = useState(setupWizard.jdkScanPaths);
  const [localMavenPath, setLocalMavenPath] = useState(setupWizard.mavenPath);

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

  const handleScanJdks = async () => {
    updateSetupWizard({ 
      isScanning: true, 
      scanError: undefined,
      jdkScanPaths: localJdkPath,
      mavenPath: localMavenPath
    });
    
    // Simulate JDK scan
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    updateSetupWizard({ 
      isScanning: false, 
      foundJdks: jdks.length 
    });
    
    addNotification('success', `${jdks.length} JDKs gefunden`);
    nextStep();
  };

  const handleScanProjects = async () => {
    updateSetupWizard({ 
      isScanning: true, 
      scanError: undefined,
      scanRootPath: localScanPath 
    });
    
    // Simulate project scan
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    updateSetupWizard({ 
      isScanning: false, 
      foundProjects: projects.length 
    });
    
    addNotification('success', `${projects.length} Projekte gefunden`);
    nextStep();
  };

  const handleComplete = () => {
    completeSetup();
    addNotification('success', 'Setup abgeschlossen! Willkommen bei GFOS Build.');
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
                    placeholder="z.B. C:\dev\quellen"
                    className="gfos-input"
                  />
                  <button className="gfos-secondary-btn gfos-btn-icon">
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
                    placeholder="z.B. C:\dev\java"
                    className="gfos-input"
                  />
                  <button className="gfos-secondary-btn gfos-btn-icon">
                    <Folder size={18} />
                  </button>
                </div>
              </div>

              <div className="gfos-form-group">
                <label>
                  <Terminal size={16} />
                  Maven-Executable
                </label>
                <p className="gfos-form-hint">
                  Der Pfad zur Maven-Executable (mvn.cmd oder mvn)
                </p>
                <div className="gfos-input-with-btn">
                  <input
                    type="text"
                    value={localMavenPath}
                    onChange={(e) => setLocalMavenPath(e.target.value)}
                    placeholder="z.B. C:\dev\maven\bin\mvn.cmd"
                    className="gfos-input"
                  />
                  <button className="gfos-secondary-btn gfos-btn-icon">
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
              <button className="gfos-primary-btn" onClick={nextStep}>
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

            <div className="gfos-wizard-scan-info">
              <div className="gfos-scan-path">
                <Folder size={18} />
                <code>{localJdkPath}</code>
              </div>
              
              {setupWizard.isScanning ? (
                <div className="gfos-wizard-scanning">
                  <Loader2 size={48} className="gfos-spin" />
                  <p>Suche nach JDKs...</p>
                </div>
              ) : setupWizard.foundJdks > 0 ? (
                <div className="gfos-wizard-scan-result">
                  <Check size={48} />
                  <h3>{setupWizard.foundJdks} JDKs gefunden</h3>
                  <p>Du kannst die JDK-Konfiguration später anpassen.</p>
                </div>
              ) : (
                <div className="gfos-wizard-scan-preview">
                  <p>Klicke auf "Scannen" um nach JDKs zu suchen.</p>
                </div>
              )}
            </div>

            <div className="gfos-wizard-actions">
              <button className="gfos-secondary-btn" onClick={prevStep}>
                <ArrowLeft size={18} />
                <span>Zurück</span>
              </button>
              {setupWizard.foundJdks > 0 ? (
                <button className="gfos-primary-btn" onClick={nextStep}>
                  <span>Weiter</span>
                  <ArrowRight size={18} />
                </button>
              ) : (
                <button 
                  className="gfos-primary-btn" 
                  onClick={handleScanJdks}
                  disabled={setupWizard.isScanning}
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

            <div className="gfos-wizard-scan-info">
              <div className="gfos-scan-path">
                <Folder size={18} />
                <code>{localScanPath}</code>
              </div>
              
              {setupWizard.isScanning ? (
                <div className="gfos-wizard-scanning">
                  <Loader2 size={48} className="gfos-spin" />
                  <p>Suche nach Projekten...</p>
                </div>
              ) : setupWizard.foundProjects > 0 ? (
                <div className="gfos-wizard-scan-result">
                  <Check size={48} />
                  <h3>{setupWizard.foundProjects} Projekte gefunden</h3>
                  <p>Du kannst Projekte später hinzufügen oder entfernen.</p>
                </div>
              ) : (
                <div className="gfos-wizard-scan-preview">
                  <p>Klicke auf "Scannen" um nach Projekten zu suchen.</p>
                </div>
              )}
            </div>

            <div className="gfos-wizard-actions">
              <button className="gfos-secondary-btn" onClick={prevStep}>
                <ArrowLeft size={18} />
                <span>Zurück</span>
              </button>
              {setupWizard.foundProjects > 0 ? (
                <button className="gfos-primary-btn" onClick={nextStep}>
                  <span>Weiter</span>
                  <ArrowRight size={18} />
                </button>
              ) : (
                <button 
                  className="gfos-primary-btn" 
                  onClick={handleScanProjects}
                  disabled={setupWizard.isScanning}
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
                  <strong>{jdks.length}</strong>
                  <span>JDKs konfiguriert</span>
                </div>
              </div>
              <div className="gfos-summary-item">
                <FolderSearch size={24} />
                <div>
                  <strong>{projects.length}</strong>
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
