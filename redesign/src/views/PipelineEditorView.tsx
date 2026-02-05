/**
 * PipelineEditorView - Create and Edit Pipelines
 * Configure pipeline steps with JDK and Maven goals
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, 
  Save, Workflow, Settings, GripVertical,
  Coffee, Zap, Package
} from 'lucide-react';
import { useAppStore, type StorePipelineStep } from '../store/useAppStore';
import { GlassPanel } from '../components/shared';

const COMMON_GOALS = ['clean', 'compile', 'test', 'package', 'install', 'deploy', 'verify'];

const DEFAULT_STEP: StorePipelineStep = {
  id: '',
  name: 'Neuer Schritt',
  goals: ['clean', 'install'],
  skipTests: false,
  profiles: [],
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

  // Sync when editing existing pipeline
  useEffect(() => {
    if (existingPipeline) {
      setName(existingPipeline.name);
      setProjectId(existingPipeline.projectId);
      setSteps(existingPipeline.steps);
      setActiveStepIndex(0);
    }
  }, [selectedPipelineId]);

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

  return (
    <>
      {/* Header */}
      <motion.div 
        className="gfos-page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="gfos-page-title">
          <button className="gfos-back-btn" onClick={goBack}>
            <ArrowLeft size={20} />
          </button>
          <Workflow size={28} />
          <div>
            <h1>{existingPipeline ? 'Pipeline bearbeiten' : 'Neue Pipeline'}</h1>
            <p>Konfiguriere die Build-Schritte</p>
          </div>
        </div>
        <div className="gfos-page-actions">
          <button className="gfos-secondary-btn" onClick={goBack}>
            Abbrechen
          </button>
          <button className="gfos-primary-btn" onClick={handleSave}>
            <Save size={18} />
            <span>Speichern</span>
          </button>
        </div>
      </motion.div>

      <div className="gfos-pipeline-editor-grid">
        {/* Left: Pipeline Settings & Steps List */}
        <GlassPanel className="gfos-pipeline-settings">
          {/* Pipeline Name */}
          <div className="gfos-form-group">
            <label>Pipeline Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Full Build Pipeline"
              className="gfos-input"
            />
          </div>

          {/* Project Selection */}
          <div className="gfos-form-group">
            <label>Projekt</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="gfos-select"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Steps List */}
          <div className="gfos-pipeline-steps-section">
            <div className="gfos-section-header">
              <h3>Schritte</h3>
              <button className="gfos-text-btn" onClick={addStep}>
                <Plus size={16} />
                Hinzufügen
              </button>
            </div>

            <Reorder.Group 
              axis="y" 
              values={steps} 
              onReorder={setSteps}
              className="gfos-steps-list"
            >
              <AnimatePresence>
                {steps.map((step, index) => (
                  <Reorder.Item 
                    key={step.id} 
                    value={step}
                    className={`gfos-step-item ${index === activeStepIndex ? 'gfos-step-active' : ''}`}
                    onClick={() => setActiveStepIndex(index)}
                  >
                    <GripVertical size={16} className="gfos-drag-handle" />
                    <div className="gfos-step-number">{index + 1}</div>
                    <div className="gfos-step-name">{step.name}</div>
                    <div className="gfos-step-quick-actions">
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveStep(index, 'up'); }}
                        disabled={index === 0}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveStep(index, 'down'); }}
                        disabled={index === steps.length - 1}
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeStep(index); }}
                        className="gfos-btn-danger-subtle"
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
        <GlassPanel className="gfos-step-config">
          {activeStep ? (
            <>
              <div className="gfos-step-config-header">
                <Settings size={20} />
                <h3>Schritt {activeStepIndex + 1} konfigurieren</h3>
              </div>

              {/* Step Name */}
              <div className="gfos-form-group">
                <label>Schritt-Name</label>
                <input
                  type="text"
                  value={activeStep.name}
                  onChange={(e) => updateStep({ name: e.target.value })}
                  placeholder="z.B. Build & Test"
                  className="gfos-input"
                />
              </div>

              {/* JDK Selection */}
              <div className="gfos-form-group">
                <label>
                  <Coffee size={14} />
                  JDK
                </label>
                <select
                  value={activeStep.jdkId || ''}
                  onChange={(e) => updateStep({ jdkId: e.target.value || undefined })}
                  className="gfos-select"
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
              <div className="gfos-form-group">
                <label>
                  <Package size={14} />
                  Maven Goals
                </label>
                <div className="gfos-goals-chips">
                  {COMMON_GOALS.map(goal => (
                    <button
                      key={goal}
                      className={`gfos-goal-chip ${activeStep.goals.includes(goal) ? 'gfos-goal-active' : ''}`}
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
                  className="gfos-input gfos-input-mono"
                />
              </div>

              {/* Options */}
              <div className="gfos-form-group">
                <label>
                  <Zap size={14} />
                  Optionen
                </label>
                <div className="gfos-checkbox-group">
                  <label className="gfos-checkbox-label">
                    <input
                      type="checkbox"
                      checked={activeStep.skipTests || false}
                      onChange={(e) => updateStep({ skipTests: e.target.checked })}
                    />
                    <span>Tests überspringen (-DskipTests)</span>
                  </label>
                </div>
              </div>

              {/* Profiles */}
              <div className="gfos-form-group">
                <label>Profile (optional)</label>
                <input
                  type="text"
                  value={(activeStep.profiles || []).join(', ')}
                  onChange={(e) => updateStep({ 
                    profiles: e.target.value.split(',').map(p => p.trim()).filter(Boolean) 
                  })}
                  placeholder="z.B. production, release"
                  className="gfos-input"
                />
              </div>
            </>
          ) : (
            <div className="gfos-empty-state">
              <Settings size={48} />
              <h3>Kein Schritt ausgewählt</h3>
              <p>Wähle einen Schritt aus oder füge einen neuen hinzu.</p>
            </div>
          )}
        </GlassPanel>
      </div>
    </>
  );
}
