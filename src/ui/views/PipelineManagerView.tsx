import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

import { ScreenContainer, Header, StatusBar } from '../components/index.js';
import { ActionList, type ActionItem } from '../components/ActionList.js';
import { colors, icons } from '../theme.js';
import { useAppStore, usePipelines } from '../../core/store/useAppStore.js';
import { createJobsForPipeline } from '../../core/services/PipelineExecutor.js';
import { getPipelineService } from '../../core/services/PipelineService.js';
import type { PipelineDefinition } from '../../core/services/PipelineService.js';
import type { Shortcut } from '../components/index.js';

interface PipelineManagerViewProps {
  onBack?: () => void;
}

export function PipelineManagerView({ onBack }: PipelineManagerViewProps): React.ReactElement {
  const pipelines = usePipelines();
  const addJob = useAppStore((state) => state.addJob);
  const addNotification = useAppStore((state) => state.addNotification);
  const removePipeline = useAppStore((state) => state.removePipeline);
  const pendingJobs = useAppStore((state) => state.activeJobs.filter((j) => j.status === 'pending').length);
  const runningJobs = useAppStore((state) => state.activeJobs.filter((j) => j.status === 'running').length);
  const goBack = useAppStore((state) => state.goBack);
  const setScreen = useAppStore((state) => state.setScreen);
  
  const [highlightedPipelineId, setHighlightedPipelineId] = useState<string | null>(pipelines[0]?.id ?? null);

  const items: ActionItem<string>[] = useMemo(() => pipelines.map((pipeline) => ({
    value: pipeline.id,
    label: pipeline.name,
    description: `${pipeline.steps.length} step(s) • Saved ${new Date(pipeline.createdAt).toLocaleDateString('de-DE')}`,
  })), [pipelines]);

  const handleSelect = useCallback((pipeline: ActionItem<string>) => {
    const definition = pipelines.find((p) => p.id === pipeline.value);
    if (!definition) return;

    const jobs = createJobsForPipeline(definition);
    jobs.forEach((job) => addJob(job));
    addNotification('success', `Pipeline "${definition.name}" queued (${jobs.length} job(s))`);
    setScreen('BUILD_QUEUE');
  }, [pipelines, addJob, addNotification, setScreen]);

  const handleDelete = useCallback(() => {
    if (!highlightedPipelineId) return;
    const definition = pipelines.find((p) => p.id === highlightedPipelineId);
    if (!definition) return;

    const service = getPipelineService();
    void service.delete(definition.id);
    removePipeline(definition.id);
    addNotification('warning', `Pipeline "${definition.name}" removed`);
  }, [highlightedPipelineId, pipelines, removePipeline, addNotification]);

  useInput((input, key) => {
    if (key.escape) {
      onBack?.() || goBack();
      return;
    }
    if (input === 'd' || input === 'D') {
      handleDelete();
    }
  });

  useEffect(() => {
    if (pipelines.length === 0) {
      setHighlightedPipelineId(null);
      return;
    }
    if (!highlightedPipelineId || !pipelines.some((p) => p.id === highlightedPipelineId)) {
      setHighlightedPipelineId(pipelines[0]?.id ?? null);
    }
  }, [pipelines, highlightedPipelineId]);

  const shortcuts: Shortcut[] = [
    { key: '↑↓', label: 'Navigate' },
    { key: '⏎', label: 'Run Pipeline' },
    { key: 'D', label: 'Delete' },
    { key: 'ESC', label: 'Back' },
  ];

  return (
    <Box flexDirection="column" height="100%">
      <Header title="GFOS-Build" version="1.0.0" />
      <ScreenContainer title="Pipelines" subtitle="Saved presets" fillHeight>
        {pipelines.length === 0 ? (
          <Text color={colors.textDim} italic>
            No pipelines saved yet. Save configurations from the build config screen.
          </Text>
        ) : (
          <ActionList
            items={items}
            onSelect={handleSelect}
            onHighlight={(item: ActionItem<string>) => setHighlightedPipelineId(item.value)}
            indicator="➜"
          />
        )}
      </ScreenContainer>
      <StatusBar shortcuts={shortcuts} pendingJobs={pendingJobs} runningJobs={runningJobs} />
    </Box>
  );
}

export default PipelineManagerView;
