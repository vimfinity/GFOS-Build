import { queryOptions, useMutation } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type {
  HealthResponse,
  PipelineListItem,
  BuildRunRowApi,
  BuildStatsApi,
  StartJobResponse,
  ConfigResponse,
  ScanResponse,
} from '@shared/api';

export const healthQuery = queryOptions({
  queryKey: ['health'],
  queryFn: () => apiGet<HealthResponse>('/api/health'),
  refetchInterval: 30_000,
  staleTime: 20_000,
});

export const configQuery = queryOptions({
  queryKey: ['config'],
  queryFn: () => apiGet<ConfigResponse>('/api/config'),
  staleTime: Infinity,
  gcTime: 300_000,
});

export const pipelinesQuery = queryOptions({
  queryKey: ['pipelines'],
  queryFn: () => apiGet<PipelineListItem[]>('/api/pipelines'),
  refetchInterval: 30_000,
  staleTime: 20_000,
  gcTime: 120_000,
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
    refetchInterval: 10_000,
    staleTime: 8_000,
    gcTime: 120_000,
  });

export const buildStatsQuery = queryOptions({
  queryKey: ['builds', 'stats'],
  queryFn: () => apiGet<BuildStatsApi>('/api/builds/stats'),
  refetchInterval: 60_000,
  staleTime: 30_000,
  gcTime: 120_000,
});

export const scanQuery = queryOptions({
  queryKey: ['scan'],
  queryFn: () => apiGet<ScanResponse>('/api/scan'),
  staleTime: 60_000,
  gcTime: 300_000,
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

export function useCreatePipeline() {
  return useMutation({
    mutationFn: (data: { name: string; pipeline: unknown }) =>
      apiPost<{ ok: boolean; name: string }>('/api/pipelines', data),
  });
}

export function useUpdatePipeline() {
  return useMutation({
    mutationFn: (data: { name: string; pipeline: unknown }) =>
      apiPut<{ ok: boolean; name: string }>(`/api/pipelines/${encodeURIComponent(data.name)}`, { pipeline: data.pipeline }),
  });
}

export function useDeletePipeline() {
  return useMutation({
    mutationFn: (name: string) => apiDelete(`/api/pipelines/${encodeURIComponent(name)}`),
  });
}

export function useSaveConfig() {
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiPost<{ ok: boolean }>('/api/config', patch),
  });
}

export function useRefreshScan() {
  return useMutation({
    mutationFn: () => apiPost<StartJobResponse>('/api/scan/refresh'),
  });
}

export function useAdHocBuild() {
  return useMutation({
    mutationFn: (body: { path: string; goals?: string[]; flags?: string[]; java?: string }) =>
      apiPost<StartJobResponse>('/api/build', body),
  });
}
