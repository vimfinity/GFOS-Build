import { queryOptions, useMutation } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from './client';
import type { HealthResponse, PipelineListItem, BuildRunRowApi, BuildStatsApi, StartJobResponse } from '@shared/api';

export const healthQuery = queryOptions({
  queryKey: ['health'],
  queryFn: () => apiGet<HealthResponse>('/api/health'),
  refetchInterval: 30_000,
});

export const pipelinesQuery = queryOptions({
  queryKey: ['pipelines'],
  queryFn: () => apiGet<PipelineListItem[]>('/api/pipelines'),
  refetchInterval: 10_000,
  staleTime: 5_000,
});

export const buildsQuery = (opts?: { pipeline?: string; limit?: number }) =>
  queryOptions({
    queryKey: ['builds', opts],
    queryFn: () => {
      const params = new URLSearchParams();
      if (opts?.pipeline) params.set('pipeline', opts.pipeline);
      params.set('limit', String(opts?.limit ?? 100));
      return apiGet<BuildRunRowApi[]>(`/api/builds?${params}`);
    },
    refetchInterval: 5_000,
    staleTime: 2_000,
  });

export const buildStatsQuery = queryOptions({
  queryKey: ['builds', 'stats'],
  queryFn: () => apiGet<BuildStatsApi>('/api/builds/stats'),
  refetchInterval: 30_000,
  staleTime: 10_000,
});

export function useRunPipeline() {
  return useMutation({
    mutationFn: (name: string) => apiPost<StartJobResponse>(`/api/pipeline/${encodeURIComponent(name)}/run`),
  });
}

export function useCancelJob() {
  return useMutation({
    mutationFn: (jobId: string) => apiDelete(`/api/jobs/${jobId}`),
  });
}
