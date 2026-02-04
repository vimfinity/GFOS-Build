/**
 * PipelineEditorView - Create and edit pipelines
 * 
 * Allows configuring pipeline steps with goals, JDKs, etc.
 */

import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { savePipelinesDebounced } from '../App';
import { 
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, 
  Save, Workflow, Settings 
} from 'lucide-react';
import type { PipelineStep } from '../types';

const DEFAULT_STEP: PipelineStep = {
  name: 'Build',
  goals: ['clean', 'install'],
  skipTests: false,
  profiles: [],
};

export function PipelineEditorView() {
  const selectedPipelineId = useAppStore((state) => state.selectedPipelineId);
  const pipelines = useAppStore((state) => state.pipelines);
  const projects = useAppStore((state) => state.projects);
  const jdks = useAppStore((state) => state.jdks);
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

  const activeStep = steps[activeStepIndex];

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

  const handleProfilesChange = (value: string) => {
    const profiles = value.split(/[,\s]+/).filter(p => p.trim());
    updateStep({ profiles });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={goBack}
            className="p-2 border border-zinc-700 hover:border-neon-green hover:text-neon-green transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-10 h-10 border border-neon-green flex items-center justify-center relative">
            <Workflow size={20} className="text-neon-green" />
            <div className="absolute -top-px -left-px w-2 h-2 bg-neon-green" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-zinc-200 uppercase tracking-wider">
              {existingPipeline ? 'Pipeline bearbeiten' : 'Neue Pipeline'}
            </h1>
            <p className="text-xs text-zinc-500">
              Konfiguriere Build-Schritte
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleSave}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={14} />
          <span>Speichern</span>
        </button>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
        {/* Left: Basic Info & Step List */}
        <div className="col-span-1 flex flex-col space-y-4">
          {/* Basic Info */}
          <div className="terminal-panel">
            <h3 className="text-xs text-neon-green uppercase tracking-wider mb-4 font-display">
              Grundeinstellungen
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="label">Pipeline-Name</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="z.B. Full Build"
                />
              </div>
              
              <div>
                <label className="label">Projekt</label>
                <select 
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  className="input"
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
          <div className="terminal-panel flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs text-neon-green uppercase tracking-wider font-display">
                Pipeline-Schritte
              </h3>
              <button 
                onClick={addStep}
                className="p-1 border border-zinc-700 hover:border-neon-green hover:text-neon-green transition-colors"
                title="Schritt hinzufügen"
              >
                <Plus size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto space-y-2">
              {steps.map((step, index) => (
                <div 
                  key={index}
                  onClick={() => setActiveStepIndex(index)}
                  className={`
                    p-3 border cursor-pointer transition-all
                    ${index === activeStepIndex 
                      ? 'border-neon-green bg-neon-green/5' 
                      : 'border-zinc-700 hover:border-zinc-600'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neon-green/70">{index + 1}.</span>
                      <span className="text-sm text-zinc-300">{step.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveStep(index, 'up'); }}
                        disabled={index === 0}
                        className="p-1 hover:text-neon-green disabled:opacity-30 disabled:hover:text-current"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveStep(index, 'down'); }}
                        disabled={index === steps.length - 1}
                        className="p-1 hover:text-neon-green disabled:opacity-30 disabled:hover:text-current"
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeStep(index); }}
                        disabled={steps.length <= 1}
                        className="p-1 hover:text-neon-red disabled:opacity-30 disabled:hover:text-current"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1">
                    {step.goals.join(' ')}
                    {step.skipTests && ' -DskipTests'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Step Configuration */}
        <div className="col-span-2 terminal-panel flex flex-col min-h-0">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-terminal-border">
            <Settings size={16} className="text-neon-green" />
            <h3 className="text-xs text-neon-green uppercase tracking-wider font-display">
              Schritt {activeStepIndex + 1}: {activeStep?.name}
            </h3>
          </div>
          
          {activeStep && (
            <div className="flex-1 overflow-auto space-y-4">
              <div>
                <label className="label">Schritt-Name</label>
                <input 
                  type="text"
                  value={activeStep.name}
                  onChange={(e) => updateStep({ name: e.target.value })}
                  className="input"
                  placeholder="z.B. Clean Build"
                />
              </div>
              
              <div>
                <label className="label">Maven Goals (Leerzeichen getrennt)</label>
                <input 
                  type="text"
                  value={activeStep.goals.join(' ')}
                  onChange={(e) => handleGoalsChange(e.target.value)}
                  className="input"
                  placeholder="z.B. clean install"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {['clean', 'compile', 'test', 'package', 'install', 'deploy'].map((goal) => (
                    <button
                      key={goal}
                      onClick={() => {
                        const goals = activeStep.goals.includes(goal)
                          ? activeStep.goals.filter(g => g !== goal)
                          : [...activeStep.goals, goal];
                        updateStep({ goals });
                      }}
                      className={`
                        px-2 py-1 text-[10px] border transition-colors
                        ${activeStep.goals.includes(goal)
                          ? 'border-neon-green text-neon-green bg-neon-green/10'
                          : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                        }
                      `}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="label">JDK (optional - überschreibt Standard)</label>
                <select 
                  value={activeStep.jdkPath || ''}
                  onChange={(e) => updateStep({ jdkPath: e.target.value || undefined })}
                  className="input"
                >
                  <option value="">Standard-JDK verwenden</option>
                  {jdks.map((jdk) => (
                    <option key={jdk.jdkHome} value={jdk.jdkHome}>
                      JDK {jdk.majorVersion} - {jdk.version}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="label">Maven Profile (optional)</label>
                <input 
                  type="text"
                  value={activeStep.profiles?.join(', ') || ''}
                  onChange={(e) => handleProfilesChange(e.target.value)}
                  className="input"
                  placeholder="z.B. development, docker"
                />
              </div>
              
              <div className="flex items-center gap-3 p-3 border border-terminal-border bg-terminal-dark/50">
                <input 
                  type="checkbox"
                  id="skipTests"
                  checked={activeStep.skipTests || false}
                  onChange={(e) => updateStep({ skipTests: e.target.checked })}
                  className="checkbox"
                />
                <label htmlFor="skipTests" className="text-sm text-zinc-300 cursor-pointer">
                  Tests überspringen (-DskipTests)
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
