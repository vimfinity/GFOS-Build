/**
 * PipelineEditorView - Create and Edit Pipelines
 * Configure pipeline steps with JDK, Maven goals, and module selection
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import Fuse from 'fuse.js';
import { 
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, 
  Save, Workflow, Settings, GripVertical,
  Coffee, Zap, Package, Layers, Search, X
} from 'lucide-react';
import { useAppStore, type StorePipelineStep } from '../store/useAppStore';
import { GlassPanel } from '../components/shared';
import { api } from '../api';
import type { MavenModule } from '../types';

const COMMON_GOALS = ['clean', 'compile', 'test', 'package', 'install', 'deploy', 'verify'];

const DEFAULT_STEP: StorePipelineStep = {
  id: '',
  name: 'Neuer Schritt',
  goals: ['clean', 'install'],
  skipTests: false,
  profiles: [],
  modules: [],
};

export default function PipelineEditorView() {
  const { 
    pipelines, 
    selectedPipelineId,
    projects,
    jdks,
    goBack,
    addPipeline,
    updatePipeline,
    addNotification,
    setActiveView
  } = useAppStore();

  const existingPipeline = selectedPipelineId 
    ? pipelines.find(p => p.id === selectedPipelineId) 
    : null;

  const [name, setName] = useState(existingPipeline?.name || '');
  const [projectId, setProjectId] = useState(existingPipeline?.projectId || projects[0]?.id || '');
  const [steps, setSteps] = useState<StorePipelineStep[]>(
    existingPipeline?.steps || [{ ...DEFAULT_STEP, id: Date.now().toString() }]
  );
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  
  // Module management
  const [availableModules, setAvailableModules] = useState<MavenModule[]>([]);
  const [moduleSearch, setModuleSearch] = useState('');
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  
  // Load modules when project changes
  useEffect(() => {
    const loadModules = async () => {
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        setAvailableModules([]);
        return;
      }
      
      setIsLoadingModules(true);
      try {
        const pomPath = `${project.path}/pom.xml`;
        const modules = await api.scanModules(pomPath);
        setAvailableModules(modules);
      } catch (error) {
        console.error('Failed to load modules:', error);
        setAvailableModules([]);
      } finally {
        setIsLoadingModules(false);
      }
    };
    
    loadModules();
  }, [projectId, projects]);
  
  // Fuse.js for module search
  const moduleFuse = useMemo(() => new Fuse(availableModules, {
    keys: ['artifactId', 'groupId', 'displayName', 'relativePath'],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
  }), [availableModules]);
  
  const filteredModules = useMemo(() => {
    if (!moduleSearch.trim()) {
      return availableModules;
    }
    return moduleFuse.search(moduleSearch).map(r => r.item);
  }, [availableModules, moduleSearch, moduleFuse]);

  // Sync when editing existing pipeline
  useEffect(() => {
    if (existingPipeline) {
      setName(existingPipeline.name);
      setProjectId(existingPipeline.projectId);
      setSteps(existingPipeline.steps);
      setActiveStepIndex(0);
    }
  }, [selectedPipelineId, existingPipeline]);

  const activeStep = steps[activeStepIndex];

  const handleSave = () => {
    if (!name.trim()) {
      addNotification('error', 'Bitte einen Namen eingeben');
      return;
    }
    if (!projectId) {
      addNotification('error', 'Bitte ein Projekt auswählen');
      return;
    }
    if (steps.length === 0) {
      addNotification('error', 'Mindestens ein Schritt erforderlich');
      return;
    }

    if (existingPipeline) {
      updatePipeline(existingPipeline.id, {
        name,
        projectId,
        steps,
      });
      addNotification('success', `Pipeline "${name}" aktualisiert`);
    } else {
      addPipeline(name, projectId, steps);
      addNotification('success', `Pipeline "${name}" erstellt`);
    }
    
    setActiveView('pipelines');
  };

  const addStep = () => {
    const newStep: StorePipelineStep = {
      ...DEFAULT_STEP,
      id: Date.now().toString(),
      name: `Schritt ${steps.length + 1}`,
    };
    setSteps([...steps, newStep]);
    setActiveStepIndex(steps.length);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) {
      addNotification('warning', 'Mindestens ein Schritt erforderlich');
      return;
    }
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

  const updateStep = (updates: Partial<StorePipelineStep>) => {
    const newSteps = [...steps];
    newSteps[activeStepIndex] = { ...newSteps[activeStepIndex], ...updates };
    setSteps(newSteps);
  };

  const toggleGoal = (goal: string) => {
    const currentGoals = activeStep?.goals || [];
    if (currentGoals.includes(goal)) {
      updateStep({ goals: currentGoals.filter(g => g !== goal) });
    } else {
      updateStep({ goals: [...currentGoals, goal] });
    }
  };

  const toggleModule = (artifactId: string) => {
    const currentModules = activeStep?.modules || [];
    if (currentModules.includes(artifactId)) {
      updateStep({ modules: currentModules.filter(m => m !== artifactId) });
    } else {
      updateStep({ modules: [...currentModules, artifactId] });
    }
  };

  return (
    <>
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <button className="flex items-center justify-center w-10 h-10 rounded-xl bg-light-200 dark:bg-dark-700 text-dark-400 hover:bg-light-300 dark:hover:bg-dark-600 transition-colors" onClick={goBack}>
            <ArrowLeft size={20} />
          </button>
          <Workflow size={28} className="text-dark-400" />
          <div>
            <h1 className="text-2xl font-bold text-dark-500 dark:text-light-100">{existingPipeline ? 'Pipeline bearbeiten' : 'Neue Pipeline'}</h1>
            <p className="text-sm text-dark-300 dark:text-light-400">Konfiguriere die Build-Schritte</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-light-200 dark:bg-dark-700 text-dark-500 dark:text-light-100 font-medium rounded-xl hover:bg-light-300 dark:hover:bg-dark-600 transition-colors" onClick={goBack}>
            Abbrechen
          </button>
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-petrol-500 text-white font-medium rounded-xl hover:bg-petrol-600 transition-colors" onClick={handleSave}>
            <Save size={18} />
            <span>Speichern</span>
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Left: Pipeline Settings & Steps List */}
        <GlassPanel className="p-6">
          {/* Pipeline Name */}
          <div className="space-y-2 mb-5">
            <label className="text-sm font-medium text-dark-400 dark:text-light-300">Pipeline Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Full Build Pipeline"
              className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
            />
          </div>

          {/* Project Selection */}
          <div className="space-y-2 mb-6">
            <label className="text-sm font-medium text-dark-400 dark:text-light-300">Projekt</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500 appearance-none cursor-pointer"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Steps List */}
          <div className="border-t border-light-200 dark:border-dark-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-dark-500 dark:text-light-100">Schritte</h3>
              <button className="inline-flex items-center gap-1.5 text-sm text-petrol-500 hover:text-petrol-600 font-medium" onClick={addStep}>
                <Plus size={16} />
                Hinzufügen
              </button>
            </div>

            <Reorder.Group 
              axis="y" 
              values={steps} 
              onReorder={setSteps}
              className="space-y-2"
            >
              <AnimatePresence>
                {steps.map((step, index) => (
                  <Reorder.Item 
                    key={step.id} 
                    value={step}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${index === activeStepIndex ? 'bg-petrol-50 dark:bg-petrol-900/20 ring-1 ring-petrol-200 dark:ring-petrol-800' : 'bg-light-100 dark:bg-dark-700/50 hover:bg-light-200 dark:hover:bg-dark-700'}`}
                    onClick={() => setActiveStepIndex(index)}
                  >
                    <GripVertical size={16} className="text-dark-300 cursor-grab" />
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-light-300 dark:bg-dark-600 text-xs font-medium text-dark-400 dark:text-light-300">{index + 1}</div>
                    <div className="flex-1 text-sm font-medium text-dark-500 dark:text-light-100 truncate">{step.name}</div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveStep(index, 'up'); }}
                        disabled={index === 0}
                        className="p-1 text-dark-300 hover:text-dark-500 disabled:opacity-30 transition-colors"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveStep(index, 'down'); }}
                        disabled={index === steps.length - 1}
                        className="p-1 text-dark-300 hover:text-dark-500 disabled:opacity-30 transition-colors"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeStep(index); }}
                        className="p-1 text-dark-300 hover:text-error-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>
          </div>
        </GlassPanel>

        {/* Right: Step Configuration */}
        <GlassPanel className="lg:col-span-2 p-6">
          {activeStep ? (
            <>
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-light-200 dark:border-dark-700">
                <Settings size={20} className="text-petrol-500" />
                <h3 className="font-semibold text-dark-500 dark:text-light-100">Schritt {activeStepIndex + 1} konfigurieren</h3>
              </div>

              <div className="space-y-6">
                {/* Step Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dark-400 dark:text-light-300">Schritt-Name</label>
                  <input
                    type="text"
                    value={activeStep.name}
                    onChange={(e) => updateStep({ name: e.target.value })}
                    placeholder="z.B. Build & Test"
                    className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                  />
                </div>

                {/* JDK Selection */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-dark-400 dark:text-light-300">
                    <Coffee size={14} />
                    JDK
                  </label>
                  <select
                    value={activeStep.jdkId || ''}
                    onChange={(e) => updateStep({ jdkId: e.target.value || undefined })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500 appearance-none cursor-pointer"
                  >
                    <option value="">Standard JDK</option>
                    {jdks.map(j => (
                      <option key={j.id} value={j.id}>
                        JDK {j.version} ({j.vendor})
                        {j.isDefault && ' ★'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Maven Goals */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-dark-400 dark:text-light-300">
                    <Package size={14} />
                    Maven Goals
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {COMMON_GOALS.map(goal => (
                      <button
                        key={goal}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeStep.goals.includes(goal) ? 'bg-petrol-500 text-white' : 'bg-light-200 dark:bg-dark-700 text-dark-400 dark:text-light-300 hover:bg-light-300 dark:hover:bg-dark-600'}`}
                        onClick={() => toggleGoal(goal)}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={activeStep.goals.join(' ')}
                    onChange={(e) => updateStep({ goals: e.target.value.split(/\s+/).filter(Boolean) })}
                    placeholder="Goals (Leerzeichen-getrennt)"
                    className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500 font-mono text-sm"
                  />
                </div>

                {/* Options */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-dark-400 dark:text-light-300">
                    <Zap size={14} />
                    Optionen
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 bg-light-100 dark:bg-dark-700/50 rounded-lg cursor-pointer hover:bg-light-200 dark:hover:bg-dark-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={activeStep.skipTests || false}
                        onChange={(e) => updateStep({ skipTests: e.target.checked })}
                        className="w-4 h-4 rounded border-light-400 text-petrol-500 focus:ring-petrol-500"
                      />
                      <span className="text-sm text-dark-500 dark:text-light-100">Tests überspringen (-DskipTests)</span>
                    </label>
                  </div>
                </div>

                {/* Profiles */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dark-400 dark:text-light-300">Profile (optional)</label>
                  <input
                    type="text"
                    value={(activeStep.profiles || []).join(', ')}
                    onChange={(e) => updateStep({ 
                      profiles: e.target.value.split(',').map(p => p.trim()).filter(Boolean) 
                    })}
                    placeholder="z.B. production, release"
                    className="w-full px-4 py-2.5 bg-white dark:bg-dark-700 rounded-xl border border-light-400 dark:border-dark-600 text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                  />
                </div>

                {/* Module Selection */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-dark-400 dark:text-light-300">
                    <Layers size={14} />
                    Module ({(activeStep.modules || []).length} ausgewählt)
                  </label>
                  
                  {isLoadingModules ? (
                    <div className="flex items-center gap-2 p-3 bg-light-100 dark:bg-dark-700/50 rounded-lg text-sm text-dark-400">
                      <div className="w-4 h-4 border-2 border-petrol-500/30 border-t-petrol-500 rounded-full animate-spin" />
                      Module werden geladen...
                    </div>
                  ) : availableModules.length === 0 ? (
                    <div className="p-3 bg-light-100 dark:bg-dark-700/50 rounded-lg text-sm text-dark-400">
                      Keine Module gefunden
                    </div>
                  ) : (
                    <>
                      {/* Module Search */}
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-300" />
                        <input
                          type="text"
                          value={moduleSearch}
                          onChange={(e) => setModuleSearch(e.target.value)}
                          placeholder="Module durchsuchen..."
                          className="w-full pl-9 pr-9 py-2 bg-white dark:bg-dark-700 rounded-lg border border-light-400 dark:border-dark-600 text-sm text-dark-500 dark:text-light-100 focus:outline-none focus:ring-2 focus:ring-petrol-500/30 focus:border-petrol-500"
                        />
                        {moduleSearch && (
                          <button
                            onClick={() => setModuleSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-300 hover:text-dark-500"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      
                      {/* Module List */}
                      <div className="max-h-48 overflow-y-auto space-y-1 p-1 bg-light-50 dark:bg-dark-800/50 rounded-lg">
                        {filteredModules.map(module => {
                          const isSelected = (activeStep.modules || []).includes(module.artifactId);
                          return (
                            <button
                              key={module.artifactId}
                              onClick={() => toggleModule(module.artifactId)}
                              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                                isSelected 
                                  ? 'bg-petrol-100 dark:bg-petrol-900/30 text-petrol-700 dark:text-petrol-300' 
                                  : 'hover:bg-light-200 dark:hover:bg-dark-700 text-dark-500 dark:text-light-100'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                isSelected 
                                  ? 'bg-petrol-500 border-petrol-500 text-white' 
                                  : 'border-light-400 dark:border-dark-500'
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{module.artifactId}</div>
                                <div className="text-xs text-dark-300 dark:text-light-400 truncate">{module.relativePath}</div>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded bg-light-200 dark:bg-dark-600 text-dark-400 dark:text-light-300">
                                {module.packaging}
                              </span>
                            </button>
                          );
                        })}
                        {filteredModules.length === 0 && moduleSearch && (
                          <div className="p-3 text-center text-sm text-dark-400">
                            Keine Module für "{moduleSearch}" gefunden
                          </div>
                        )}
                      </div>
                      
                      {/* Selected modules summary */}
                      {(activeStep.modules || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {(activeStep.modules || []).map(artifactId => (
                            <span 
                              key={artifactId}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-petrol-100 dark:bg-petrol-900/30 text-petrol-700 dark:text-petrol-300"
                            >
                              {artifactId}
                              <button
                                onClick={() => toggleModule(artifactId)}
                                className="hover:text-petrol-900 dark:hover:text-petrol-100"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-dark-300">
              <Settings size={48} className="mb-4 text-dark-200" />
              <h3 className="text-lg font-semibold text-dark-400 dark:text-light-200 mb-2">Kein Schritt ausgewählt</h3>
              <p className="text-dark-300 dark:text-light-400">Wähle einen Schritt aus oder füge einen neuen hinzu.</p>
            </div>
          )}
        </GlassPanel>
      </div>
    </>
  );
}
