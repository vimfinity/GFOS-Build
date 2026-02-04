/**
 * SetupWizardView - Initial configuration wizard
 * 
 * Guides users through first-time setup.
 */

import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../api';
import { 
  Cpu, FolderSearch, Coffee, Settings, ChevronRight, 
  Check, Loader2, AlertCircle, FolderOpen, ArrowRight
} from 'lucide-react';

type WizardStep = 'welcome' | 'paths' | 'scanning' | 'complete';

export function SetupWizardView() {
  const settings = useAppStore((state) => state.settings);
  const setSettings = useAppStore((state) => state.setSettings);
  const setProjects = useAppStore((state) => state.setProjects);
  const setJdks = useAppStore((state) => state.setJdks);
  const setScreen = useAppStore((state) => state.setScreen);

  const [step, setStep] = useState<WizardStep>('welcome');
  const [scanRootPath, setScanRootPath] = useState(settings.scanRootPath);
  const [jdkScanPaths, setJdkScanPaths] = useState(settings.jdkScanPaths);
  const [mavenHome, setMavenHome] = useState(settings.defaultMavenHome);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<{ projects: number; jdks: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFolder = async (setter: (value: string) => void) => {
    const folder = await api.selectFolder();
    if (folder) {
      setter(folder);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    setStep('scanning');
    
    try {
      // Scan for projects and JDKs
      const [projects, jdks] = await Promise.all([
        api.scanProjects(scanRootPath),
        api.scanJDKs(jdkScanPaths),
      ]);
      
      setProjects(projects);
      setJdks(jdks);
      setScanResults({ projects: projects.length, jdks: jdks.length });
      
      // Save settings
      const newSettings = {
        ...settings,
        scanRootPath,
        jdkScanPaths,
        defaultMavenHome: mavenHome,
        setupComplete: true,
      };
      await api.saveConfig(newSettings);
      setSettings(newSettings);
      
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Scannen');
      setStep('paths');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFinish = () => {
    setScreen('HOME');
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <div className="text-center">
            {/* Logo */}
            <div className="w-20 h-20 mx-auto mb-8 border border-neon-green relative flex items-center justify-center">
              <Cpu size={40} className="text-neon-green" />
              <div className="absolute -top-px -left-px w-3 h-3 bg-neon-green" />
              <div className="absolute -bottom-px -right-px w-3 h-3 bg-neon-green" />
              <div className="absolute inset-0 border border-neon-green/30 animate-ping" style={{ animationDuration: '2s' }} />
            </div>
            
            <h1 className="font-display text-2xl font-bold text-neon-green tracking-[0.3em] uppercase mb-3 neon-glow">
              GFOS BUILD
            </h1>
            
            <p className="text-sm text-zinc-400 mb-8 max-w-md mx-auto">
              Willkommen! Dieser Assistent hilft dir, GFOS Build einzurichten.
              Wir konfigurieren die Pfade zu deinen Projekten und JDKs.
            </p>
            
            <div className="flex justify-center gap-6 mb-8 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 border border-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FolderSearch size={16} className="text-neon-green" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-300">Projekte entdecken</h3>
                  <p className="text-xs text-zinc-500">Maven/Git Repos finden</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 border border-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Coffee size={16} className="text-neon-green" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-300">JDKs scannen</h3>
                  <p className="text-xs text-zinc-500">Verfügbare Java-Versionen</p>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setStep('paths')}
              className="btn-primary flex items-center gap-2 mx-auto"
            >
              <span>Einrichtung starten</span>
              <ArrowRight size={14} />
            </button>
          </div>
        );
        
      case 'paths':
        return (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 border border-neon-green flex items-center justify-center">
                <Settings size={20} className="text-neon-green" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-zinc-200 uppercase tracking-wider">
                  Pfade konfigurieren
                </h2>
                <p className="text-xs text-zinc-500">
                  Gib die Verzeichnisse für Projekte und JDKs an
                </p>
              </div>
            </div>
            
            {error && (
              <div className="mb-6 p-3 border border-neon-red bg-neon-red/5 flex items-start gap-3">
                <AlertCircle size={16} className="text-neon-red flex-shrink-0 mt-0.5" />
                <div className="text-sm text-neon-red">{error}</div>
              </div>
            )}
            
            <div className="space-y-5">
              <div>
                <label className="label flex items-center gap-2">
                  <FolderSearch size={14} />
                  Projekt-Stammverzeichnis
                </label>
                <p className="text-[10px] text-zinc-500 mb-2">
                  Verzeichnis, in dem deine Maven-Projekte liegen
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={scanRootPath}
                    onChange={(e) => setScanRootPath(e.target.value)}
                    className="input flex-1"
                    placeholder="z.B. C:\dev\quellen"
                  />
                  <button 
                    onClick={() => handleSelectFolder(setScanRootPath)}
                    className="btn-outline"
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>
              
              <div>
                <label className="label flex items-center gap-2">
                  <Coffee size={14} />
                  JDK-Verzeichnis
                </label>
                <p className="text-[10px] text-zinc-500 mb-2">
                  Verzeichnis, das deine JDK-Installationen enthält
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={jdkScanPaths}
                    onChange={(e) => setJdkScanPaths(e.target.value)}
                    className="input flex-1"
                    placeholder="z.B. C:\dev\java"
                  />
                  <button 
                    onClick={() => handleSelectFolder(setJdkScanPaths)}
                    className="btn-outline"
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>
              
              <div>
                <label className="label flex items-center gap-2">
                  <Settings size={14} />
                  Maven-Verzeichnis
                </label>
                <p className="text-[10px] text-zinc-500 mb-2">
                  Verzeichnis deiner Maven-Installation (mit bin/mvn)
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={mavenHome}
                    onChange={(e) => setMavenHome(e.target.value)}
                    className="input flex-1"
                    placeholder="z.B. C:\dev\maven\mvn3"
                  />
                  <button 
                    onClick={() => handleSelectFolder(setMavenHome)}
                    className="btn-outline"
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-8">
              <button 
                onClick={handleScan}
                disabled={!scanRootPath || !jdkScanPaths}
                className="btn-primary flex items-center gap-2"
              >
                <span>Workspace scannen</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        );
        
      case 'scanning':
        return (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-6 border border-neon-green flex items-center justify-center relative">
              <Loader2 size={28} className="text-neon-green animate-spin" />
              <div className="absolute inset-0 border border-neon-green/30 animate-ping" style={{ animationDuration: '2s' }} />
            </div>
            
            <h2 className="font-display text-lg font-bold text-zinc-200 uppercase tracking-wider mb-3">
              Scanne Workspace...
            </h2>
            
            <div className="font-mono text-xs text-zinc-500 space-y-1">
              <p>&gt; Suche nach Maven-Projekten...</p>
              <p>&gt; Scanne JDK-Installationen...</p>
              <p className="animate-pulse">&gt; Bitte warten<span className="animate-blink">_</span></p>
            </div>
          </div>
        );
        
      case 'complete':
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 border border-neon-green bg-neon-green/10 flex items-center justify-center">
              <Check size={32} className="text-neon-green" />
            </div>
            
            <h2 className="font-display text-xl font-bold text-neon-green uppercase tracking-wider mb-3">
              Einrichtung abgeschlossen!
            </h2>
            
            <p className="text-sm text-zinc-400 mb-6">
              GFOS Build wurde erfolgreich konfiguriert.
            </p>
            
            {scanResults && (
              <div className="flex justify-center gap-8 mb-8">
                <div className="text-center">
                  <div className="text-3xl font-display font-bold text-neon-green">
                    {scanResults.projects}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Projekte gefunden
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-display font-bold text-neon-green">
                    {scanResults.jdks}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    JDKs verfügbar
                  </div>
                </div>
              </div>
            )}
            
            <button 
              onClick={handleFinish}
              className="btn-primary flex items-center gap-2 mx-auto"
            >
              <span>Los geht's</span>
              <ArrowRight size={14} />
            </button>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <div className="terminal-panel p-8">
          {/* Progress indicator */}
          {step !== 'welcome' && (
            <div className="flex items-center justify-center gap-2 mb-8">
              {(['welcome', 'paths', 'scanning', 'complete'] as WizardStep[]).map((s, idx) => (
                <React.Fragment key={s}>
                  <div 
                    className={`
                      w-2 h-2 rounded-full transition-colors
                      ${s === step ? 'bg-neon-green' : 
                        ['welcome', 'paths', 'scanning', 'complete'].indexOf(step) > idx 
                          ? 'bg-neon-green/50' : 'bg-zinc-700'
                      }
                    `}
                  />
                  {idx < 3 && <div className="w-8 h-px bg-zinc-700" />}
                </React.Fragment>
              ))}
            </div>
          )}
          
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
