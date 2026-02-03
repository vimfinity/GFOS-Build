/**
 * Pipeline Editor View
 * 
 * Create or edit a pipeline by selecting repositories and modules.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useStdout, useInput } from 'ink';
import { matchSorter } from 'match-sorter';

import { theme, icons, palette } from '../theme/index.js';
import { Divider, EmptyState } from '../primitives/index.js';
import { useNavigator } from '../hooks/index.js';
import { useAppStore, useProjects, useJdks } from '../../core/store/useAppStore.js';
import { useNotifications } from '../system/notifications.js';
import { getPipelineService, type PipelineDefinition, type PipelineStep, type PipelineStepOptions } from '../../core/services/PipelineService.js';
import { WorkspaceScanner } from '../../core/services/WorkspaceScanner.js';
import { ServiceLocator } from '../../infrastructure/ServiceLocator.js';
import type { MavenModule } from '../../core/services/WorkspaceScanner.js';
import type { SelectedModuleData } from '../../core/types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface PipelineEditorViewProps {
  /** Pipeline to edit, or undefined for new */
  pipelineId?: string;
}

type EditorMode = 'name' | 'repo' | 'modules' | 'review';

interface PendingStep {
  projectPath: string;
  projectName: string;
  modules: MavenModule[];
  selectedModuleIds: Set<string>;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: PipelineStepOptions = {
  goals: ['clean', 'install'],
  profiles: [],
  skipTests: false,
  offline: false,
  batchMode: true,
  threads: '1C',
  updateSnapshots: false,
  alsoMake: false,
  alsoMakeDependents: false,
  showErrors: true,
  customArgs: '',
  sequential: true,
};

// ============================================================================
// Main Component
// ============================================================================

export function PipelineEditorView({ pipelineId }: PipelineEditorViewProps): React.ReactElement {
  // Mode and state
  const [mode, setMode] = useState<EditorMode>(pipelineId ? 'review' : 'name');
  const [pipelineName, setPipelineName] = useState('');
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [selectedRepoIndex, setSelectedRepoIndex] = useState(0);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(0);
  const [pendingStep, setPendingStep] = useState<PendingStep | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  
  // Search state for repo and module selection
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');
  
  // Terminal dimensions for virtual scrolling
  const { stdout } = useStdout();
  const terminalRows = stdout?.rows ?? 24;
  const listHeight = Math.max(5, terminalRows - 14);
  
  const { goBack, toPipelines } = useNavigator();
  const projects = useProjects();
  const jdks = useJdks();
  const { success, error } = useNotifications();
  
  // Filter only Maven projects
  const mavenProjects = useMemo(() => 
    projects.filter(p => p.hasMaven), 
    [projects]
  );
  
  // Filter repos based on search
  const filteredRepos = useMemo(() => {
    if (!repoSearchQuery.trim()) return mavenProjects;
    return matchSorter(mavenProjects, repoSearchQuery, {
      keys: ['name', 'path'],
      threshold: matchSorter.rankings.CONTAINS,
    });
  }, [mavenProjects, repoSearchQuery]);
  
  // Filter modules based on search
  const filteredModules = useMemo(() => {
    if (!pendingStep) return [];
    if (!moduleSearchQuery.trim()) return pendingStep.modules;
    return matchSorter(pendingStep.modules, moduleSearchQuery, {
      keys: ['directoryName', 'artifactId', 'groupId'],
      threshold: matchSorter.rankings.CONTAINS,
    });
  }, [pendingStep, moduleSearchQuery]);

  // Selected JDK (use first available)
  const selectedJdk = jdks[0];

  // Load existing pipeline if editing
  useEffect(() => {
    if (pipelineId) {
      const pipelines = useAppStore.getState().pipelines;
      const existing = pipelines.find(p => p.id === pipelineId);
      if (existing) {
        setPipelineName(existing.name);
        setSteps(existing.steps);
      }
    }
  }, [pipelineId]);

  // Load modules when selecting a repo
  const loadModulesForRepo = useCallback(async (repoPath: string, repoName: string) => {
    setIsLoadingModules(true);
    try {
      // Check if modules are already in store
      let modules = useAppStore.getState().scannedData.modulesByProject[repoPath] ?? [];
      
      if (modules.length === 0) {
        // Load from scanner
        const fs = ServiceLocator.getFileSystem();
        const scanner = new WorkspaceScanner(fs);
        modules = await scanner.findMavenModules(repoPath);
        useAppStore.getState().loadModules(repoPath, modules);
      }
      
      setPendingStep({
        projectPath: repoPath,
        projectName: repoName,
        modules,
        selectedModuleIds: new Set(),
      });
      setSelectedModuleIndex(0);
      setMode('modules');
    } catch (err) {
      error(`Failed to load modules: ${err}`);
    } finally {
      setIsLoadingModules(false);
    }
  }, [error]);

  // Add current pending step to pipeline
  const addPendingStep = useCallback(() => {
    if (!pendingStep || !selectedJdk) return;
    
    const selectedModules: SelectedModuleData[] = pendingStep.modules
      .filter(m => pendingStep.selectedModuleIds.has(m.artifactId))
      .map(m => ({
        artifactId: m.artifactId,
        pomPath: m.pomPath,
        projectPath: m.projectPath,
        relativePath: m.projectPath.replace(pendingStep.projectPath, '').replace(/^[\\/]+/, '') || '.',
      }));
    
    if (selectedModules.length === 0) {
      error('Select at least one module');
      return;
    }
    
    const newStep: PipelineStep = {
      id: crypto.randomUUID(),
      projectPath: pendingStep.projectPath,
      projectName: pendingStep.projectName,
      jdkPath: selectedJdk.jdkHome,
      jdkVersion: selectedJdk.version,
      selectedModules,
      options: { ...DEFAULT_OPTIONS },
    };
    
    setSteps(prev => [...prev, newStep]);
    setPendingStep(null);
    setMode('review');
    success(`Added step: ${pendingStep.projectName} (${selectedModules.length} modules)`);
  }, [pendingStep, selectedJdk, success, error]);

  // Remove a step
  const removeStep = useCallback((index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
    if (selectedStepIndex >= steps.length - 1) {
      setSelectedStepIndex(Math.max(0, steps.length - 2));
    }
  }, [steps.length, selectedStepIndex]);

  // Move step up/down
  const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    
    setSteps(prev => {
      const newSteps = [...prev];
      [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex]!, newSteps[index]!];
      return newSteps;
    });
    setSelectedStepIndex(newIndex);
  }, [steps.length]);

  // Save pipeline
  const savePipeline = useCallback(async () => {
    if (!pipelineName.trim()) {
      error('Please enter a pipeline name');
      return;
    }
    if (steps.length === 0) {
      error('Add at least one step to the pipeline');
      return;
    }
    
    const pipeline: PipelineDefinition = {
      id: pipelineId || crypto.randomUUID(),
      name: pipelineName.trim(),
      createdAt: new Date().toISOString(),
      steps,
    };
    
    try {
      const service = getPipelineService();
      await service.save(pipeline);
      useAppStore.getState().savePipeline(pipeline);
      success(`Pipeline "${pipelineName}" saved with ${steps.length} steps`);
      toPipelines();
    } catch (err) {
      error(`Failed to save pipeline: ${err}`);
    }
  }, [pipelineId, pipelineName, steps, success, error, toPipelines]);

  // Toggle module selection
  const toggleModule = useCallback((artifactId: string) => {
    if (!pendingStep) return;
    setPendingStep(prev => {
      if (!prev) return null;
      const next = new Set(prev.selectedModuleIds);
      if (next.has(artifactId)) {
        next.delete(artifactId);
      } else {
        next.add(artifactId);
      }
      return { ...prev, selectedModuleIds: next };
    });
  }, []);

  // Select all/none modules
  const selectAllModules = useCallback(() => {
    if (!pendingStep) return;
    setPendingStep(prev => {
      if (!prev) return null;
      return { ...prev, selectedModuleIds: new Set(prev.modules.map(m => m.artifactId)) };
    });
  }, []);

  const clearModules = useCallback(() => {
    if (!pendingStep) return;
    setPendingStep(prev => {
      if (!prev) return null;
      return { ...prev, selectedModuleIds: new Set() };
    });
  }, []);
  
  // Reset indices when search changes
  useEffect(() => {
    setSelectedRepoIndex(0);
  }, [filteredRepos.length]);
  
  useEffect(() => {
    setSelectedModuleIndex(0);
  }, [filteredModules.length]);
  
  // Refs for input handling
  const repoSearchRef = useRef(repoSearchQuery);
  repoSearchRef.current = repoSearchQuery;
  
  const moduleSearchRef = useRef(moduleSearchQuery);
  moduleSearchRef.current = moduleSearchQuery;
  
  const filteredReposRef = useRef(filteredRepos);
  filteredReposRef.current = filteredRepos;
  
  const filteredModulesRef = useRef(filteredModules);
  filteredModulesRef.current = filteredModules;
  
  // Virtual scrolling for repos
  const repoScrollOffset = useMemo(() => {
    const halfVisible = Math.floor(listHeight / 2);
    let offset = Math.max(0, selectedRepoIndex - halfVisible);
    const maxOffset = Math.max(0, filteredRepos.length - listHeight);
    return Math.min(offset, maxOffset);
  }, [selectedRepoIndex, listHeight, filteredRepos.length]);
  
  const visibleRepos = useMemo(() => 
    filteredRepos.slice(repoScrollOffset, repoScrollOffset + listHeight),
    [filteredRepos, repoScrollOffset, listHeight]
  );
  
  // Virtual scrolling for modules
  const moduleScrollOffset = useMemo(() => {
    const halfVisible = Math.floor(listHeight / 2);
    let offset = Math.max(0, selectedModuleIndex - halfVisible);
    const maxOffset = Math.max(0, filteredModules.length - listHeight);
    return Math.min(offset, maxOffset);
  }, [selectedModuleIndex, listHeight, filteredModules.length]);
  
  const visibleModules = useMemo(() => 
    filteredModules.slice(moduleScrollOffset, moduleScrollOffset + listHeight),
    [filteredModules, moduleScrollOffset, listHeight]
  );

  // Keyboard handling using useInput
  useInput(useCallback((input: string, key: {
    escape?: boolean;
    return?: boolean;
    backspace?: boolean;
    delete?: boolean;
    upArrow?: boolean;
    downArrow?: boolean;
    ctrl?: boolean;
    meta?: boolean;
  }) => {
    // Name input mode
    if (mode === 'name') {
      if (key.escape) { goBack(); return; }
      if (key.return && pipelineName.trim()) {
        setMode('repo');
        return;
      }
      if (key.backspace || key.delete) {
        setPipelineName(n => n.slice(0, -1));
        return;
      }
      if (input && input.length === 1 && input.charCodeAt(0) >= 32 && !key.ctrl && !key.meta) {
        setPipelineName(n => n + input);
        return;
      }
      return;
    }
    
    // Repository selection mode
    if (mode === 'repo') {
      if (key.escape) {
        if (repoSearchRef.current) {
          setRepoSearchQuery('');
        } else if (steps.length > 0) {
          setMode('review');
        } else {
          setMode('name');
        }
        return;
      }
      
      if (key.backspace || key.delete) {
        if (repoSearchRef.current.length > 0) {
          setRepoSearchQuery(repoSearchRef.current.slice(0, -1));
        }
        return;
      }
      
      if (key.upArrow || input === 'k') {
        setSelectedRepoIndex(i => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        const maxIdx = filteredReposRef.current.length - 1;
        setSelectedRepoIndex(i => Math.min(Math.max(0, maxIdx), i + 1));
        return;
      }
      if (key.return) {
        const repo = filteredReposRef.current[selectedRepoIndex];
        if (repo) loadModulesForRepo(repo.path, repo.name);
        return;
      }
      
      // Printable characters for search
      if (input && input.length === 1 && input.charCodeAt(0) >= 32 && !key.ctrl && !key.meta) {
        setRepoSearchQuery(repoSearchRef.current + input);
        return;
      }
      return;
    }
    
    // Module selection mode
    if (mode === 'modules') {
      if (key.escape) {
        if (moduleSearchRef.current) {
          setModuleSearchQuery('');
        } else {
          setPendingStep(null);
          setModuleSearchQuery('');
          setMode('repo');
        }
        return;
      }
      
      if (key.backspace || key.delete) {
        if (moduleSearchRef.current.length > 0) {
          setModuleSearchQuery(moduleSearchRef.current.slice(0, -1));
        }
        return;
      }
      
      if (key.upArrow) {
        setSelectedModuleIndex(i => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        const maxIdx = filteredModulesRef.current.length - 1;
        setSelectedModuleIndex(i => Math.min(Math.max(0, maxIdx), i + 1));
        return;
      }
      if (input === ' ') {
        const mod = filteredModulesRef.current[selectedModuleIndex];
        if (mod) toggleModule(mod.artifactId);
        return;
      }
      if (input === 'a' && !key.ctrl) {
        selectAllModules();
        return;
      }
      if (input === 'n' && !key.ctrl) {
        clearModules();
        return;
      }
      if (key.return) {
        addPendingStep();
        return;
      }
      
      // Printable characters for search (except a, n, space which are shortcuts)
      if (input && input.length === 1 && input.charCodeAt(0) >= 32 && 
          !key.ctrl && !key.meta && input !== ' ' && input !== 'a' && input !== 'n') {
        setModuleSearchQuery(moduleSearchRef.current + input);
        return;
      }
      return;
    }
    
    // Review mode
    if (mode === 'review') {
      if (key.escape) { goBack(); return; }
      if (key.upArrow || input === 'k') {
        setSelectedStepIndex(i => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        setSelectedStepIndex(i => Math.min(steps.length - 1, i + 1));
        return;
      }
      if (input === 'a' && !key.ctrl) {
        setRepoSearchQuery('');
        setMode('repo');
        return;
      }
      if (input === 'd' && !key.ctrl && steps.length > 0) {
        removeStep(selectedStepIndex);
        return;
      }
      if (input === 'k' && key.ctrl && selectedStepIndex > 0) {
        moveStep(selectedStepIndex, 'up');
        return;
      }
      if (input === 'j' && key.ctrl && selectedStepIndex < steps.length - 1) {
        moveStep(selectedStepIndex, 'down');
        return;
      }
      if (key.return || input === 's') {
        savePipeline();
        return;
      }
      return;
    }
  }, [mode, pipelineName, goBack, steps, selectedRepoIndex, loadModulesForRepo, 
      selectedModuleIndex, toggleModule, selectAllModules, clearModules, addPendingStep,
      selectedStepIndex, removeStep, moveStep, savePipeline]));

  // Render based on mode
  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={theme.accent.primary} bold>
          {icons.pipeline} {pipelineId ? 'Edit Pipeline' : 'New Pipeline'}
        </Text>
        {pipelineName && <Text color={theme.text.muted}> - {pipelineName}</Text>}
      </Box>
      
      <Divider />
      
      {/* Name Input Mode */}
      {mode === 'name' && (
        <Box flexDirection="column" marginTop={1}>
          <Box marginBottom={1}>
            <Text color={theme.text.primary}>Enter pipeline name:</Text>
          </Box>
          <Box>
            <Text color={theme.accent.primary}>&gt; </Text>
            <Text color={theme.text.primary}>{pipelineName}</Text>
            <Text color={theme.text.muted}>_</Text>
          </Box>
          <Box marginTop={2}>
            <Text color={theme.text.muted}>
              <Text color={theme.accent.primary}>Enter</Text> Continue  
              <Text color={theme.accent.primary}> Esc</Text> Cancel
            </Text>
          </Box>
        </Box>
      )}
      
      {/* Repository Selection Mode */}
      {mode === 'repo' && (
        <Box flexDirection="column" marginTop={1} flexGrow={1}>
          {/* Search bar */}
          <Box marginBottom={1}>
            <Text color={theme.accent.primary}>{icons.search} </Text>
            {repoSearchQuery ? (
              <Text color={theme.text.primary}>{repoSearchQuery}</Text>
            ) : (
              <Text color={theme.text.muted}>Type to filter repositories...</Text>
            )}
            <Text color={theme.text.muted}>_</Text>
            {repoSearchQuery && (
              <Text color={theme.text.muted}> ({filteredRepos.length}/{mavenProjects.length})</Text>
            )}
          </Box>
          
          {filteredRepos.length === 0 ? (
            <EmptyState
              icon={icons.folder}
              title={mavenProjects.length === 0 ? "No Repositories" : "No Matches"}
              description={mavenProjects.length === 0 ? "No Maven repositories found" : `No repositories matching "${repoSearchQuery}"`}
            />
          ) : (
            <>
              {repoScrollOffset > 0 && (
                <Box paddingX={1}>
                  <Text color={theme.text.muted}>{icons.arrowUp} {repoScrollOffset} more above</Text>
                </Box>
              )}
              
              <Box flexDirection="column">
                {visibleRepos.map((repo, idx) => {
                  const actualIndex = repoScrollOffset + idx;
                  const isSelected = actualIndex === selectedRepoIndex;
                  return (
                    <Box key={repo.path} paddingX={1}>
                      <Text color={isSelected ? theme.accent.primary : theme.text.muted}>
                        {isSelected ? icons.pointer : ' '}{' '}
                      </Text>
                      <Text>{icons.maven} </Text>
                      <Text color={theme.text.primary} bold={isSelected}>
                        {repo.name}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
              
              {repoScrollOffset + listHeight < filteredRepos.length && (
                <Box paddingX={1}>
                  <Text color={theme.text.muted}>
                    {icons.arrowDown} {filteredRepos.length - repoScrollOffset - listHeight} more below
                  </Text>
                </Box>
              )}
            </>
          )}
          
          {isLoadingModules && (
            <Box marginTop={1}>
              <Text color={theme.accent.primary}>{icons.spinner[0]} Loading modules...</Text>
            </Box>
          )}
          
          <Box marginTop={1} justifyContent="space-between">
            <Text color={theme.text.muted}>
              <Text color={theme.accent.primary}>↑↓</Text> Navigate{' '}
              <Text color={theme.accent.primary}>⏎</Text> Select
            </Text>
            <Text color={theme.text.muted}>
              <Text color={theme.accent.secondary}>Esc</Text> {steps.length > 0 ? 'Back to Review' : 'Cancel'}
            </Text>
          </Box>
        </Box>
      )}
      
      {/* Module Selection Mode */}
      {mode === 'modules' && pendingStep && (
        <Box flexDirection="column" marginTop={1} flexGrow={1}>
          <Box marginBottom={1}>
            <Text color={theme.text.primary}>Select modules from </Text>
            <Text color={theme.accent.primary} bold>{pendingStep.projectName}</Text>
            <Text color={theme.text.muted}> ({pendingStep.selectedModuleIds.size}/{pendingStep.modules.length})</Text>
          </Box>
          
          {/* Search bar */}
          <Box marginBottom={1}>
            <Text color={theme.accent.primary}>{icons.search} </Text>
            {moduleSearchQuery ? (
              <Text color={theme.text.primary}>{moduleSearchQuery}</Text>
            ) : (
              <Text color={theme.text.muted}>Type to filter modules...</Text>
            )}
            <Text color={theme.text.muted}>_</Text>
            {moduleSearchQuery && (
              <Text color={theme.text.muted}> ({filteredModules.length}/{pendingStep.modules.length})</Text>
            )}
          </Box>
          
          {filteredModules.length === 0 ? (
            <Box paddingX={1}>
              <Text color={palette.yellow}>{icons.warning} No modules matching "{moduleSearchQuery}"</Text>
            </Box>
          ) : (
            <>
              {moduleScrollOffset > 0 && (
                <Box paddingX={1}>
                  <Text color={theme.text.muted}>{icons.arrowUp} {moduleScrollOffset} more above</Text>
                </Box>
              )}
              
              <Box flexDirection="column">
                {visibleModules.map((mod, idx) => {
                  const actualIndex = moduleScrollOffset + idx;
                  const isSelected = actualIndex === selectedModuleIndex;
                  const isChecked = pendingStep.selectedModuleIds.has(mod.artifactId);
                  return (
                    <Box key={mod.artifactId} paddingX={1}>
                      <Text color={isSelected ? theme.accent.primary : theme.text.muted}>
                        {isSelected ? icons.pointer : ' '}{' '}
                      </Text>
                      <Text color={isChecked ? palette.green : theme.text.muted}>
                        {isChecked ? icons.selected : icons.unselected}{' '}
                      </Text>
                      <Text color={theme.text.primary} bold={isSelected}>
                        {mod.directoryName || mod.artifactId}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
              
              {moduleScrollOffset + listHeight < filteredModules.length && (
                <Box paddingX={1}>
                  <Text color={theme.text.muted}>
                    {icons.arrowDown} {filteredModules.length - moduleScrollOffset - listHeight} more below
                  </Text>
                </Box>
              )}
            </>
          )}
          
          <Box marginTop={1} justifyContent="space-between">
            <Text color={theme.text.muted}>
              <Text color={theme.accent.primary}>↑↓</Text> Nav{' '}
              <Text color={theme.accent.primary}>Space</Text> Toggle{' '}
              <Text color={theme.accent.primary}>a</Text>/<Text color={theme.accent.primary}>n</Text> All/None
            </Text>
            <Text color={theme.text.muted}>
              <Text color={palette.green}>⏎</Text> Add Step{' '}
              <Text color={theme.accent.secondary}>Esc</Text> Back
            </Text>
          </Box>
        </Box>
      )}
      
      {/* Review Mode */}
      {mode === 'review' && (
        <Box flexDirection="column" marginTop={1} flexGrow={1}>
          <Box marginBottom={1}>
            <Text color={theme.text.primary}>Pipeline Steps ({steps.length}):</Text>
          </Box>
          {steps.length === 0 ? (
            <EmptyState
              icon={icons.pipeline}
              title="No Steps"
              description="Press 'a' to add steps"
            />
          ) : (
            <Box flexDirection="column">
              {steps.map((step, idx) => {
                const isSelected = idx === selectedStepIndex;
                return (
                  <Box key={step.id} flexDirection="column" paddingX={1} marginBottom={1}>
                    <Box>
                      <Text color={isSelected ? theme.accent.primary : theme.text.muted}>
                        {isSelected ? icons.pointer : ' '} 
                      </Text>
                      <Text color={theme.accent.primary}>{idx + 1}. </Text>
                      <Text color={theme.text.primary} bold={isSelected}>
                        {step.projectName}
                      </Text>
                    </Box>
                    <Box marginLeft={4}>
                      <Text color={theme.text.muted}>
                        {step.selectedModules.length} module{step.selectedModules.length !== 1 ? 's' : ''}: 
                        {step.selectedModules.slice(0, 3).map(m => m.artifactId).join(', ')}
                        {step.selectedModules.length > 3 && '...'}
                      </Text>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
          
          <Divider />
          
          <Box marginTop={1} justifyContent="space-between">
            <Text color={theme.text.muted}>
              <Text color={theme.accent.primary}>a</Text> Add Step  
              {steps.length > 0 && <><Text color={theme.accent.primary}> d</Text> Delete  </>}
              {steps.length > 1 && <><Text color={theme.accent.primary}> Ctrl+j/k</Text> Move  </>}
            </Text>
            <Text color={theme.text.muted}>
              <Text color={palette.green}>Enter/s</Text> Save  
              <Text color={theme.accent.secondary}> Esc</Text> Cancel
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default PipelineEditorView;
