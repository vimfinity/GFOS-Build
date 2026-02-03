/**
 * Pipeline List View
 * 
 * Lists all saved pipelines with options to run, edit, or delete them.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Box, Text } from 'ink';

import { theme, icons, palette } from '../theme/index.js';
import { Divider, EmptyState } from '../primitives/index.js';
import { useNavigator, useKeyboard, type KeyEvent } from '../hooks/index.js';
import { useAppStore, usePipelines } from '../../core/store/useAppStore.js';
import { useNotifications } from '../system/notifications.js';
import { createJobsForPipeline } from '../../core/services/PipelineExecutor.js';
import type { PipelineDefinition } from '../../core/services/PipelineService.js';

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

function formatStepCount(steps: number): string {
  return steps === 1 ? '1 Step' : `${steps} Steps`;
}

function getTotalModules(pipeline: PipelineDefinition): number {
  return pipeline.steps.reduce((sum, step) => sum + step.selectedModules.length, 0);
}

// ============================================================================
// Sub-Components
// ============================================================================

interface PipelineRowProps {
  pipeline: PipelineDefinition;
  isSelected: boolean;
}

function PipelineRow({ pipeline, isSelected }: PipelineRowProps): React.ReactElement {
  const moduleCount = getTotalModules(pipeline);
  const stepCount = pipeline.steps.length;
  
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color={isSelected ? theme.accent.primary : theme.text.muted}>
          {isSelected ? icons.pointer : ' '} 
        </Text>
        <Text color={theme.accent.primary}>{icons.pipeline} </Text>
        <Text color={theme.text.primary} bold={isSelected}>
          {pipeline.name}
        </Text>
      </Box>
      <Box marginLeft={4}>
        <Text color={theme.text.muted}>
          {formatStepCount(stepCount)} {icons.bullet} {moduleCount} Module{moduleCount !== 1 ? 's' : ''} {icons.bullet} {formatDate(pipeline.createdAt)}
        </Text>
      </Box>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PipelineListView(): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  const { goBack, toJobs, toPipelineEditor } = useNavigator();
  const pipelines = usePipelines();
  const { success, error, info } = useNotifications();

  // Actions from store (using getState pattern)
  const removePipeline = useCallback(
    (id: string) => useAppStore.getState().removePipeline(id),
    []
  );

  // Clamp selected index
  const effectiveIndex = Math.min(selectedIndex, Math.max(0, pipelines.length - 1));

  // Selected pipeline
  const selectedPipeline = pipelines[effectiveIndex];

  // Handle running a pipeline
  const handleRunPipeline = useCallback(() => {
    if (!selectedPipeline) return;
    
    try {
      const jobs = createJobsForPipeline(selectedPipeline);
      if (jobs.length === 0) {
        error('Pipeline has no modules to build');
        return;
      }
      
      const state = useAppStore.getState();
      for (const job of jobs) {
        state.addJob({
          projectPath: job.projectPath,
          modulePath: job.modulePath,
          name: job.name,
          jdkPath: job.jdkPath,
          mavenGoals: job.mavenGoals,
          status: job.status,
          skipTests: job.skipTests ?? false,
          offline: job.offline ?? false,
          customArgs: job.customArgs ?? [],
          sequenceId: job.sequenceId,
          sequenceIndex: job.sequenceIndex,
          sequenceTotal: job.sequenceTotal,
        });
      }
      
      success(`Started pipeline "${selectedPipeline.name}" with ${jobs.length} job(s)`);
      toJobs();
    } catch (err) {
      error(`Failed to start pipeline: ${err}`);
    }
  }, [selectedPipeline, success, error, toJobs]);

  // Handle deletion
  const handleDelete = useCallback(() => {
    if (!selectedPipeline) return;
    
    if (confirmDelete === selectedPipeline.id) {
      removePipeline(selectedPipeline.id);
      success(`Deleted pipeline "${selectedPipeline.name}"`);
      setConfirmDelete(null);
      if (selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      }
    } else {
      setConfirmDelete(selectedPipeline.id);
      info('Press [d] again to confirm deletion');
    }
  }, [selectedPipeline, confirmDelete, removePipeline, success, info, selectedIndex]);

  // Keyboard handling
  const handleKey = useCallback((event: KeyEvent): boolean => {
    const { key } = event;

    // Cancel delete confirmation on any other key
    if (confirmDelete && key !== 'd') {
      setConfirmDelete(null);
    }

    if (key === 'escape' || key === 'q') {
      goBack();
      return true;
    }

    // Create new pipeline
    if (key === 'n') {
      toPipelineEditor();
      return true;
    }

    // Edit existing pipeline
    if (key === 'e' && selectedPipeline) {
      toPipelineEditor(selectedPipeline.id);
      return true;
    }

    if (key === 'up' || key === 'k') {
      setSelectedIndex(Math.max(0, effectiveIndex - 1));
      return true;
    }

    if (key === 'down' || key === 'j') {
      setSelectedIndex(Math.min(pipelines.length - 1, effectiveIndex + 1));
      return true;
    }

    if (key === 'return' || key === 'r') {
      handleRunPipeline();
      return true;
    }

    if (key === 'd') {
      handleDelete();
      return true;
    }

    return false;
  }, [goBack, toPipelineEditor, selectedPipeline, effectiveIndex, pipelines.length, handleRunPipeline, handleDelete, confirmDelete]);

  useKeyboard(handleKey, { priority: 10, id: 'pipeline-list' });

  // Empty state
  if (pipelines.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        {/* Header */}
        <Box marginBottom={1}>
          <Text color={theme.accent.primary} bold>
            {icons.pipeline} Pipelines
          </Text>
        </Box>
        <Divider />
        
        <EmptyState
          icon={icons.pipeline}
          title="No Pipelines"
          description="Press [n] to create your first pipeline"
        />
        
        {/* Quick Keys */}
        <Box marginTop={1}>
          <Divider />
          <Box marginTop={1}>
            <Text color={theme.text.muted}>
              <Text color={palette.green}>[n]</Text> New Pipeline  
              <Text color={theme.accent.primary}> [q]</Text> Back
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={theme.accent.primary} bold>
          {icons.pipeline} Pipelines
        </Text>
        <Text color={theme.text.muted}> ({pipelines.length})</Text>
      </Box>
      <Divider />
      
      {/* Pipeline List */}
      <Box flexDirection="column" marginY={1}>
        {pipelines.map((pipeline, index) => (
          <PipelineRow
            key={pipeline.id}
            pipeline={pipeline}
            isSelected={index === effectiveIndex}
          />
        ))}
      </Box>
      
      {/* Delete Confirmation */}
      {confirmDelete && (
        <Box marginY={1} paddingX={1}>
          <Text color={palette.yellow}>
            {icons.warning} Press [d] again to delete "{selectedPipeline?.name}"
          </Text>
        </Box>
      )}
      
      {/* Quick Keys */}
      <Divider />
      <Box marginTop={1} justifyContent="space-between">
        <Text color={theme.text.muted}>
          <Text color={theme.accent.primary}>↑↓</Text> Nav  
          <Text color={theme.accent.primary}> ⏎</Text> Run
        </Text>
        <Text color={theme.text.muted}>
          <Text color={palette.green}>n</Text> New  
          <Text color={theme.accent.secondary}> e</Text> Edit  
          <Text color={theme.accent.secondary}> d</Text> Delete  
          <Text color={theme.accent.secondary}> Esc</Text> Back
        </Text>
      </Box>
    </Box>
  );
}

export default PipelineListView;
