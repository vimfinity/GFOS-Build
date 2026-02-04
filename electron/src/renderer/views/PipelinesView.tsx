/**
 * PipelinesView - Pipeline management screen
 * 
 * Shows all pipelines and allows creating/running them.
 */

import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../api';
import { savePipelinesDebounced } from '../App';
import { GitBranch, Plus, Play, Trash2, Edit, Clock, ChevronRight, Workflow, Loader2 } from 'lucide-react';
import type { Pipeline, BuildJob } from '../types';

export function PipelinesView() {
  const pipelines = useAppStore((state) => state.pipelines);
  const projects = useAppStore((state) => state.projects);
  const jdks = useAppStore((state) => state.jdks);
  const settings = useAppStore((state) => state.settings);
  const setScreen = useAppStore((state) => state.setScreen);
  const selectPipeline = useAppStore((state) => state.selectPipeline);
  const removePipeline = useAppStore((state) => state.removePipeline);
  const updatePipeline = useAppStore((state) => state.updatePipeline);
  const addJob = useAppStore((state) => state.addJob);
  const updateJob = useAppStore((state) => state.updateJob);

  const [runningPipelineId, setRunningPipelineId] = useState<string | null>(null);

  const handleCreate = () => {
    selectPipeline(null);
    setScreen('PIPELINE_EDITOR');
  };

  const handleEdit = (pipeline: Pipeline) => {
    selectPipeline(pipeline.id);
    setScreen('PIPELINE_EDITOR');
  };

  const handleDelete = (id: string) => {
    if (confirm('Pipeline wirklich löschen?')) {
      removePipeline(id);
      savePipelinesDebounced();
    }
  };

  // Helper function to wait for a build to complete
  const waitForBuildComplete = (jobId: string): Promise<{ status: string; exitCode: number | null }> => {
    return new Promise((resolve) => {
      const unsubscribe = api.onBuildComplete((completedJobId, status, exitCode) => {
        if (completedJobId === jobId) {
          unsubscribe();
          resolve({ status, exitCode });
        }
      });
    });
  };

  const handleRunPipeline = async (pipeline: Pipeline) => {
    if (runningPipelineId) return; // Already running a pipeline
    
    setRunningPipelineId(pipeline.id);
    
    const project = projects.find(p => p.path === pipeline.projectPath);
    if (!project) {
      alert('Projekt nicht gefunden!');
      setRunningPipelineId(null);
      return;
    }

    // Update lastRun timestamp
    updatePipeline(pipeline.id, { lastRun: new Date() });
    savePipelinesDebounced();

    // Execute each step SEQUENTIALLY - wait for each to complete
    for (let i = 0; i < pipeline.steps.length; i++) {
      const step = pipeline.steps[i];
      const jdkPath = step.jdkPath || jdks[0]?.jdkHome || '';
      
      if (!jdkPath) {
        alert(`Kein JDK für Schritt "${step.name}" verfügbar!`);
        setRunningPipelineId(null);
        return;
      }

      const jobName = step.modulePath 
        ? `${pipeline.name} > ${step.name} (${step.modulePath})`
        : `${pipeline.name} > ${step.name}`;

      const jobId = addJob({
        projectPath: project.path,
        modulePath: step.modulePath || undefined,
        name: jobName,
        jdkPath,
        mavenGoals: step.goals,
        skipTests: step.skipTests,
        offline: step.offline,
        enableThreads: step.enableThreads,
        threads: step.threads || settings.threadCount,
        profiles: step.profiles,
        pipelineId: pipeline.id,
        pipelineStep: i,
      });

      updateJob(jobId, { status: 'running', startedAt: new Date() });

      const job: BuildJob = {
        id: jobId,
        projectPath: project.path,
        modulePath: step.modulePath || undefined,
        name: jobName,
        jdkPath,
        mavenGoals: step.goals,
        status: 'running',
        progress: 0,
        createdAt: new Date(),
        skipTests: step.skipTests,
        offline: step.offline,
        enableThreads: step.enableThreads,
        threads: step.threads || settings.threadCount,
        profiles: step.profiles,
        pipelineId: pipeline.id,
        pipelineStep: i,
      };

      try {
        // Start the build
        await api.startBuild(job);
        
        // WAIT for the build to complete before starting next step
        const result = await waitForBuildComplete(jobId);
        
        // If build failed, stop the pipeline
        if (result.status === 'failed') {
          console.error(`Pipeline stopped: Step "${step.name}" failed`);
          setRunningPipelineId(null);
          setScreen('JOBS');
          return; // Stop pipeline on failure
        }
        
        if (result.status === 'cancelled') {
          console.log('Pipeline cancelled by user');
          setRunningPipelineId(null);
          setScreen('JOBS');
          return;
        }
        
      } catch (error) {
        console.error(`Pipeline step ${i + 1} failed:`, error);
        updateJob(jobId, { status: 'failed' });
        setRunningPipelineId(null);
        setScreen('JOBS');
        return; // Stop on error
      }
    }

    setRunningPipelineId(null);
    setScreen('JOBS');
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProjectName = (path: string) => {
    const project = projects.find(p => p.path === path);
    return project?.name || path.split(/[\\\/]/).pop() || path;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-neon-green flex items-center justify-center relative">
            <Workflow size={20} className="text-neon-green" />
            <div className="absolute -top-px -left-px w-2 h-2 bg-neon-green" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-zinc-200 uppercase tracking-wider">
              Build Pipelines
            </h1>
            <p className="text-xs text-zinc-500">
              {pipelines.length} Pipeline{pipelines.length !== 1 ? 's' : ''} konfiguriert
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleCreate}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={14} />
          <span>Neue Pipeline</span>
        </button>
      </div>

      {/* Empty State */}
      {pipelines.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 border border-dashed border-terminal-border max-w-md">
            <div className="w-14 h-14 mx-auto mb-5 border border-zinc-700 flex items-center justify-center">
              <Workflow size={28} className="text-zinc-600" />
            </div>
            <h2 className="font-display text-lg font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Keine Pipelines
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              Erstelle Build-Pipelines, um mehrere Maven-Goals nacheinander auszuführen.
            </p>
            <button 
              onClick={handleCreate}
              className="btn-primary flex items-center gap-2 mx-auto"
            >
              <Plus size={14} />
              <span>Erste Pipeline erstellen</span>
            </button>
          </div>
        </div>
      ) : (
        /* Pipeline List */
        <div className="space-y-3">
          {pipelines.map((pipeline) => (
            <div 
              key={pipeline.id}
              className="terminal-panel group hover:border-neon-green/50 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Workflow size={16} className="text-neon-green flex-shrink-0" />
                    <h3 className="font-display font-bold text-zinc-200 uppercase tracking-wider truncate">
                      {pipeline.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 bg-terminal-dark border border-zinc-700 text-zinc-400">
                      {pipeline.steps.length} Schritte
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <GitBranch size={12} />
                      {getProjectName(pipeline.projectPath)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Erstellt: {formatDate(pipeline.createdAt)}
                    </span>
                    {pipeline.lastRun && (
                      <span className="flex items-center gap-1">
                        <Play size={12} />
                        Letzter Lauf: {formatDate(pipeline.lastRun)}
                      </span>
                    )}
                  </div>
                  
                  {/* Pipeline Steps Preview */}
                  <div className="flex items-center gap-1 mt-3 overflow-hidden">
                    {pipeline.steps.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <div className="flex items-center gap-1 px-2 py-1 bg-terminal-dark border border-zinc-700 text-[10px] text-zinc-400">
                          <span className="text-neon-green/70">{idx + 1}.</span>
                          <span className="truncate max-w-[100px]">{step.name}</span>
                        </div>
                        {idx < pipeline.steps.length - 1 && (
                          <ChevronRight size={12} className="text-zinc-600 flex-shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEdit(pipeline)}
                    className="p-2 border border-zinc-700 hover:border-neon-green hover:text-neon-green transition-colors"
                    title="Bearbeiten"
                  >
                    <Edit size={14} />
                  </button>
                  <button 
                    onClick={() => handleDelete(pipeline.id)}
                    className="p-2 border border-zinc-700 hover:border-neon-red hover:text-neon-red transition-colors"
                    title="Löschen"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button 
                    onClick={() => handleRunPipeline(pipeline)}
                    disabled={runningPipelineId !== null}
                    className={`p-2 border transition-colors ${
                      runningPipelineId === pipeline.id 
                        ? 'border-neon-orange text-neon-orange'
                        : 'border-neon-green text-neon-green hover:bg-neon-green/10'
                    } ${runningPipelineId && runningPipelineId !== pipeline.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Pipeline ausführen"
                  >
                    {runningPipelineId === pipeline.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
