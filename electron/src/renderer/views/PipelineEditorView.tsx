/**
 * PipelineEditorView - Create and edit pipelines
 * 
 * Polished terminal-style interface for configuring multi-step build pipelines.
 */

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { savePipelinesDebounced } from '../App';
import { api } from '../api';
import { 
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, 
  Save, Workflow, Settings, Package, Search, X, Loader2,
  Zap, FolderTree
} from 'lucide-react';
import type { PipelineStep, MavenModule } from '../types';

const DEFAULT_STEP: PipelineStep = {
  name: 'Build',
  goals: ['clean', 'install'],
  skipTests: false,
  profiles: [],
};

const COMMON_GOALS = ['clean', 'compile', 'test', 'package', 'install', 'deploy', 'verify'];

export function PipelineEditorView() {
  const selectedPipelineId = useAppStore((state) => state.selectedPipelineId);
  const pipelines = useAppStore((state) => state.pipelines);
  const projects = useAppStore((state) => state.projects);
  const jdks = useAppStore((state) => state.jdks);
  const settings = useAppStore((state) => state.settings);
  const modulesByProject = useAppStore((state) => state.modulesByProject);
  const profilesByProject = useAppStore((state) => state.profilesByProject);
  const setModules = useAppStore((state) => state.setModules);
  const setProfiles = useAppStore((state) => state.setProfiles);
  const addPipeline = useAppStore((state) => state.addPipeline);
  const updatePipeline = useAppStore((state) => state.updatePipeline);
  const goBack = useAppStore((state) => state.goBack);

  const existingPipeline = selectedPipelineId 
    ? pipelines.find(p => p.id === selectedPipelineId) 
    : null;

  const [name, setName] = useState(existingPipeline?.name || '');
  const [projectPath, setProjectPath] = useState(existingPipeline?.projectPath || projects[0]?.path || '');
  const [steps, setSteps] = useState<PipelineStep[]>(existingPipeline?.steps || [{ ...DEFAULT_STEP }]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');
  const [showModuleDropdown, setShowModuleDropdown] = useState(false);

  const activeStep = steps[activeStepIndex];
  const currentProject = projects.find(p => p.path === projectPath);
  const modules = projectPath ? modulesByProject[projectPath] || [] : [];
  const profiles = projectPath ? profilesByProject[projectPath] || [] : [];

  // Fuzzy search for modules
  const filteredModules = useMemo(() => {
    if (!moduleSearch.trim()) return modules;
    const search = moduleSearch.toLowerCase();
    return modules.filter(mod => 
      mod.artifactId.toLowerCase().includes(search) ||
      mod.displayName.toLowerCase().includes(search) ||
      mod.relativePath.toLowerCase().includes(search)
    );
  }, [modules, moduleSearch]);

  // Load modules when project changes
  useEffect(() => {
    if (currentProject?.pomPath && !modulesByProject[projectPath]) {
      loadProjectModules();
    }
    if (currentProject?.pomPath && !profilesByProject[projectPath]) {
      loadProjectProfiles();
    }
  }, [projectPath, currentProject]);

  const loadProjectModules = async () => {
    if (!currentProject?.pomPath) return;
    setLoadingModules(true);
    try {
      const mods = await api.scanModules(currentProject.pomPath);
      setModules(projectPath, mods);
    } catch (err) {
      console.error('Failed to load modules:', err);
    } finally {
      setLoadingModules(false);
    }
  };

  const loadProjectProfiles = async () => {
    if (!currentProject?.pomPath) return;
    setLoadingProfiles(true);
    try {
      const profs = await api.scanProfiles(currentProject.pomPath);
      setProfiles(projectPath, profs);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleSave = () => {
    if (!name.trim() || !projectPath || steps.length === 0) {
      alert('Bitte Name, Projekt und mindestens einen Schritt angeben.');
      return;
    }

    if (existingPipeline) {
      updatePipeline(existingPipeline.id, {
        name,
        projectPath,
        steps,
      });
    } else {
      addPipeline({
        name,
        projectPath,
        steps,
      });
    }
    
    savePipelinesDebounced();
    goBack();
  };

  const addStep = () => {
    const newStep: PipelineStep = {
      ...DEFAULT_STEP,
      name: `Schritt ${steps.length + 1}`,
    };
    setSteps([...steps, newStep]);
    setActiveStepIndex(steps.length);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps);
    if (activeStepIndex >= newSteps.length) {
      setActiveStepIndex(newSteps.length - 1);
    }
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    
    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps);
    setActiveStepIndex(newIndex);
  };

  const updateStep = (updates: Partial<PipelineStep>) => {
    const newSteps = [...steps];
    newSteps[activeStepIndex] = { ...newSteps[activeStepIndex], ...updates };
    setSteps(newSteps);
  };

  const handleGoalsChange = (value: string) => {
    const goals = value.split(/\s+/).filter(g => g.trim());
    updateStep({ goals });
  };

  const selectModule = (mod: MavenModule | null) => {
    updateStep({ modulePath: mod ? mod.relativePath : undefined });
    setModuleSearch('');
    setShowModuleDropdown(false);
  };

  const selectedModule = modules.find(m => m.relativePath === activeStep?.modulePath);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={goBack}
            className="p-2 bg-[#0a0a0c] border border-[#1a1a1f] text-zinc-400 
                       hover:border-[#22ffaa] hover:text-[#22ffaa] transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-10 h-10 bg-[#0a0a0c] border border-[#22ffaa] flex items-center justify-center relative">
            <Workflow size={20} className="text-[#22ffaa]" />
            <div className="absolute -top-px -left-px w-2 h-2 bg-[#22ffaa]" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-zinc-200 uppercase tracking-wider">
              {existingPipeline ? 'Pipeline bearbeiten' : 'Neue Pipeline'}
            </h1>
            <p className="text-xs text-zinc-500">
              Konfiguriere Build-Schritte für automatisierte Builds
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#22ffaa] text-[#080808] 
                     font-mono text-xs font-bold uppercase tracking-wider
                     hover:bg-[#55ffcc] hover:shadow-[0_0_20px_rgba(34,255,170,0.3)] 
                     transition-all"
        >
          <Save size={14} />
          <span>Speichern</span>
        </button>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
        {/* Left: Basic Info & Step List */}
        <div className="col-span-1 flex flex-col space-y-4">
          {/* Basic Info */}
          <div className="bg-[#0c0c0e] border border-[#1a1a1f] p-4">
            <h3 className="text-[10px] text-[#22ffaa] uppercase tracking-[0.15em] mb-4 font-display flex items-center gap-2">
              <Zap size={12} />
              Grundeinstellungen
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
                  Pipeline-Name
                </label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#080808] border border-[#1a1a1f] text-zinc-200 text-sm font-mono
                             placeholder:text-zinc-600 focus:border-[#22ffaa] focus:outline-none
                             focus:shadow-[0_0_0_3px_rgba(34,255,170,0.1)] transition-all"
                  placeholder="z.B. Full Build"
                />
              </div>
              
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
                  Projekt
                </label>
                <select 
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#080808] border border-[#1a1a1f] text-zinc-200 text-sm font-mono
                             focus:border-[#22ffaa] focus:outline-none
                             focus:shadow-[0_0_0_3px_rgba(34,255,170,0.1)] transition-all"
                >
                  {projects.map((project) => (
                    <option key={project.path} value={project.path}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Steps List */}
          <div className="flex-1 bg-[#0c0c0e] border border-[#1a1a1f] p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] text-[#22ffaa] uppercase tracking-[0.15em] font-display flex items-center gap-2">
                <FolderTree size={12} />
                Pipeline-Schritte ({steps.length})
              </h3>
              <button 
                onClick={addStep}
                className="p-1.5 bg-[#080808] border border-[#1a1a1f] text-zinc-400
                           hover:border-[#22ffaa] hover:text-[#22ffaa] transition-all"
                title="Schritt hinzufügen"
              >
                <Plus size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto space-y-2 pr-1">
              {steps.map((step, index) => (
                <div 
                  key={index}
                  onClick={() => setActiveStepIndex(index)}
                  className={`
                    p-3 border cursor-pointer transition-all relative
                    ${index === activeStepIndex 
                      ? 'border-[#22ffaa] bg-[#22ffaa]/5' 
                      : 'border-[#1a1a1f] bg-[#080808] hover:border-[#27272b]'
                    }
                  `}
                >
                  {index === activeStepIndex && (
                    <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#22ffaa]" />
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 pl-2">
                      <span className={`text-[10px] ${index === activeStepIndex ? 'text-[#22ffaa]' : 'text-zinc-600'}`}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className={`text-sm ${index === activeStepIndex ? 'text-zinc-200' : 'text-zinc-400'}`}>
                        {step.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveStep(index, 'up'); }}
                        disabled={index === 0}
                        className="p-1 text-zinc-500 hover:text-[#22ffaa] disabled:opacity-30 disabled:hover:text-zinc-500"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveStep(index, 'down'); }}
                        disabled={index === steps.length - 1}
                        className="p-1 text-zinc-500 hover:text-[#22ffaa] disabled:opacity-30 disabled:hover:text-zinc-500"
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeStep(index); }}
                        disabled={steps.length <= 1}
                        className="p-1 text-zinc-500 hover:text-[#ff4477] disabled:opacity-30 disabled:hover:text-zinc-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pl-2">
                    <code className="text-[10px] text-zinc-500 font-mono">
                      mvn {step.goals.join(' ')}
                    </code>
                    {step.skipTests && (
                      <span className="text-[8px] px-1.5 py-0.5 bg-[#ffaa00]/10 border border-[#ffaa00]/30 text-[#ffaa00]">
                        -DskipTests
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Step Configuration */}
        <div className="col-span-2 bg-[#0c0c0e] border border-[#1a1a1f] p-5 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#1a1a1f]">
            <Settings size={16} className="text-[#00d4ff]" />
            <h3 className="text-xs text-[#00d4ff] uppercase tracking-wider font-display">
              Schritt {activeStepIndex + 1} konfigurieren
            </h3>
          </div>
          
          {activeStep && (
            <div className="flex-1 overflow-auto space-y-5 pr-2">
              {/* Step Name */}
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
                  Schritt-Name
                </label>
                <input 
                  type="text"
                  value={activeStep.name}
                  onChange={(e) => updateStep({ name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#080808] border border-[#1a1a1f] text-zinc-200 text-sm font-mono
                             placeholder:text-zinc-600 focus:border-[#00d4ff] focus:outline-none
                             focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)] transition-all"
                  placeholder="z.B. Clean Build"
                />
              </div>
              
              {/* Maven Goals */}
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
                  Maven Goals (Leerzeichen getrennt)
                </label>
                <input 
                  type="text"
                  value={activeStep.goals.join(' ')}
                  onChange={(e) => handleGoalsChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#080808] border border-[#1a1a1f] text-zinc-200 text-sm font-mono
                             placeholder:text-zinc-600 focus:border-[#00d4ff] focus:outline-none
                             focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)] transition-all"
                  placeholder="z.B. clean install"
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  {COMMON_GOALS.map((goal) => (
                    <button
                      key={goal}
                      onClick={() => {
                        const goals = activeStep.goals.includes(goal)
                          ? activeStep.goals.filter(g => g !== goal)
                          : [...activeStep.goals, goal];
                        updateStep({ goals });
                      }}
                      className={`
                        px-2.5 py-1 text-[10px] font-mono border transition-all
                        ${activeStep.goals.includes(goal)
                          ? 'border-[#22ffaa] text-[#22ffaa] bg-[#22ffaa]/10'
                          : 'border-[#1a1a1f] text-zinc-500 bg-[#080808] hover:border-[#27272b] hover:text-zinc-400'
                        }
                      `}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* JDK Selection */}
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
                  JDK (optional - überschreibt Standard)
                </label>
                <select 
                  value={activeStep.jdkPath || ''}
                  onChange={(e) => updateStep({ jdkPath: e.target.value || undefined })}
                  className="w-full px-3 py-2.5 bg-[#080808] border border-[#1a1a1f] text-zinc-200 text-sm font-mono
                             focus:border-[#00d4ff] focus:outline-none
                             focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)] transition-all"
                >
                  <option value="">Standard-JDK verwenden</option>
                  {jdks.map((jdk) => (
                    <option key={jdk.jdkHome} value={jdk.jdkHome}>
                      JDK {jdk.majorVersion} - {jdk.version}
                    </option>
                  ))}
                </select>
              </div>

              {/* Module Selection with Fuzzy Search */}
              <div className="relative">
                <label className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
                  <Package size={12} />
                  Modul auswählen (optional)
                  {loadingModules && <Loader2 size={10} className="animate-spin text-[#22ffaa]" />}
                </label>
                
                {/* Selected Module Display */}
                {selectedModule ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-[#080808] border border-[#22ffaa]/50">
                    <div className="flex-1">
                      <div className="text-sm text-[#22ffaa] font-mono">{selectedModule.artifactId}</div>
                      <div className="text-[10px] text-zinc-500">{selectedModule.relativePath}</div>
                    </div>
                    <button
                      onClick={() => selectModule(null)}
                      className="p-1 text-zinc-500 hover:text-[#ff4477]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input 
                      type="text"
                      value={moduleSearch}
                      onChange={(e) => {
                        setModuleSearch(e.target.value);
                        setShowModuleDropdown(true);
                      }}
                      onFocus={() => setShowModuleDropdown(true)}
                      className="w-full pl-10 pr-3 py-2.5 bg-[#080808] border border-[#1a1a1f] text-zinc-200 text-sm font-mono
                                 placeholder:text-zinc-600 focus:border-[#00d4ff] focus:outline-none
                                 focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)] transition-all"
                      placeholder={loadingModules ? 'Module werden geladen...' : `${modules.length} Module durchsuchen...`}
                    />
                    {moduleSearch && (
                      <button
                        onClick={() => {
                          setModuleSearch('');
                          setShowModuleDropdown(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}
                
                {/* Module Dropdown */}
                {showModuleDropdown && !selectedModule && (
                  <div className="absolute z-50 w-full mt-1 bg-[#0a0a0c] border border-[#1a1a1f] max-h-64 overflow-auto shadow-xl">
                    <button
                      onClick={() => selectModule(null)}
                      className="w-full px-3 py-2.5 text-left text-sm text-zinc-400 hover:bg-[#151518] 
                                 border-b border-[#1a1a1f] flex items-center gap-2"
                    >
                      <FolderTree size={14} className="text-zinc-500" />
                      <span>Gesamtes Projekt bauen</span>
                    </button>
                    {filteredModules.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-zinc-500 text-center">
                        {loadingModules ? 'Lade Module...' : 'Keine Module gefunden'}
                      </div>
                    ) : (
                      filteredModules.map((mod) => (
                        <button
                          key={mod.pomPath}
                          onClick={() => selectModule(mod)}
                          className="w-full px-3 py-2 text-left hover:bg-[#151518] border-b border-[#1a1a1f]/50
                                     last:border-b-0 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Package size={12} className="text-[#ffaa00] flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-zinc-200 font-mono truncate">
                                {mod.artifactId}
                              </div>
                              <div className="text-[10px] text-zinc-500 truncate">
                                {mod.relativePath}
                              </div>
                            </div>
                            <span className="text-[8px] px-1.5 py-0.5 bg-[#1a1a1f] text-zinc-500 flex-shrink-0">
                              {mod.packaging}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                    {filteredModules.length > 10 && (
                      <div className="px-3 py-2 text-[10px] text-zinc-600 text-center border-t border-[#1a1a1f]">
                        Zeige {filteredModules.length} von {modules.length} Modulen
                      </div>
                    )}
                  </div>
                )}
                
                {/* Click outside to close */}
                {showModuleDropdown && !selectedModule && (
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowModuleDropdown(false)}
                  />
                )}
              </div>
              
              {/* Maven Profiles */}
              <div>
                <label className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
                  Maven Profile (optional)
                  {loadingProfiles && <Loader2 size={10} className="animate-spin text-[#22ffaa]" />}
                </label>
                {profiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profiles.map((profile) => {
                      const isSelected = (activeStep.profiles || []).includes(profile);
                      return (
                        <button
                          key={profile}
                          onClick={() => {
                            const currentProfiles = activeStep.profiles || [];
                            const newProfiles = isSelected
                              ? currentProfiles.filter(p => p !== profile)
                              : [...currentProfiles, profile];
                            updateStep({ profiles: newProfiles });
                          }}
                          className={`
                            px-2.5 py-1.5 text-[10px] font-mono border transition-all
                            ${isSelected
                              ? 'border-[#b066ff] text-[#b066ff] bg-[#b066ff]/10'
                              : 'border-[#1a1a1f] text-zinc-500 bg-[#080808] hover:border-[#27272b] hover:text-zinc-400'
                            }
                          `}
                        >
                          {isSelected && '✓ '}
                          {profile}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500 px-3 py-2 bg-[#080808] border border-[#1a1a1f]">
                    {loadingProfiles ? 'Profile werden geladen...' : 'Keine Profile im Projekt gefunden'}
                  </div>
                )}
              </div>

              {/* Build Options */}
              <div className="p-4 bg-[#080808] border border-[#1a1a1f] space-y-4">
                <h4 className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-display">
                  Build-Optionen
                </h4>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`
                    w-4 h-4 border flex items-center justify-center transition-all
                    ${activeStep.skipTests 
                      ? 'bg-[#ffaa00] border-[#ffaa00]' 
                      : 'border-[#1a1a1f] bg-[#0a0a0c] group-hover:border-[#27272b]'
                    }
                  `}>
                    {activeStep.skipTests && (
                      <svg className="w-3 h-3 text-[#080808]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <input 
                    type="checkbox"
                    checked={activeStep.skipTests || false}
                    onChange={(e) => updateStep({ skipTests: e.target.checked })}
                    className="sr-only"
                  />
                  <span className="text-sm text-zinc-300">Tests überspringen (-DskipTests)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`
                    w-4 h-4 border flex items-center justify-center transition-all
                    ${activeStep.offline 
                      ? 'bg-[#00d4ff] border-[#00d4ff]' 
                      : 'border-[#1a1a1f] bg-[#0a0a0c] group-hover:border-[#27272b]'
                    }
                  `}>
                    {activeStep.offline && (
                      <svg className="w-3 h-3 text-[#080808]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <input 
                    type="checkbox"
                    checked={activeStep.offline || false}
                    onChange={(e) => updateStep({ offline: e.target.checked })}
                    className="sr-only"
                  />
                  <span className="text-sm text-zinc-300">Offline-Modus (--offline)</span>
                </label>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-3 cursor-pointer group flex-1">
                    <div className={`
                      w-4 h-4 border flex items-center justify-center transition-all
                      ${activeStep.enableThreads 
                        ? 'bg-[#22ffaa] border-[#22ffaa]' 
                        : 'border-[#1a1a1f] bg-[#0a0a0c] group-hover:border-[#27272b]'
                      }
                    `}>
                      {activeStep.enableThreads && (
                        <svg className="w-3 h-3 text-[#080808]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <input 
                      type="checkbox"
                      checked={activeStep.enableThreads || false}
                      onChange={(e) => updateStep({ enableThreads: e.target.checked })}
                      className="sr-only"
                    />
                    <span className="text-sm text-zinc-300">Paralleler Build (-T)</span>
                  </label>
                  {activeStep.enableThreads && (
                    <input 
                      type="text"
                      value={activeStep.threads || settings.threadCount || '1C'}
                      onChange={(e) => updateStep({ threads: e.target.value })}
                      className="w-20 px-2.5 py-1.5 bg-[#0a0a0c] border border-[#1a1a1f] text-zinc-200 
                                 font-mono text-xs text-center focus:border-[#22ffaa] focus:outline-none transition-all"
                      placeholder="1C"
                    />
                  )}
                </div>
              </div>

              {/* Command Preview */}
              <div className="p-4 bg-[#050506] border border-[#1a1a1f]">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Kommando-Vorschau</div>
                <code className="text-xs text-[#22ffaa] font-mono break-all">
                  mvn {activeStep.goals.join(' ')}
                  {activeStep.skipTests && ' -DskipTests'}
                  {activeStep.offline && ' --offline'}
                  {activeStep.enableThreads && ` -T ${activeStep.threads || settings.threadCount || '1C'}`}
                  {activeStep.profiles && activeStep.profiles.length > 0 && ` -P ${activeStep.profiles.join(',')}`}
                  {activeStep.modulePath && ` -pl ${activeStep.modulePath} -am`}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
