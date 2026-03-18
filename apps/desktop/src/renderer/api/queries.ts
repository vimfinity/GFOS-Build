import { queryOptions, useInfiniteQuery, useMutation } from '@tanstack/react-query';
import type {
  BuildLogPage,
  BuildRunRowApi,
  BuildStatsApi,
  ConfigResponse,
  HealthResponse,
  JdkDetectionResponse,
  PipelineListItem,
  ProjectInspectionResponse,
  ScanResponse,
  StartJobResponse,
} from '@gfos-build/contracts';
import type { ExecutionMode, MavenOptionKey, MavenProfileState, MavenSubmoduleBuildStrategy, NodeCommandType } from '@gfos-build/contracts';
import { getDesktopApi } from './client';

export const healthQuery = queryOptions({
  queryKey: ['health'],
  queryFn: (): Promise<HealthResponse> => getDesktopApi().getHealth(),
  refetchInterval: 30_000,
  staleTime: 20_000,
  retry: 1,
  retryDelay: 1_500,
});

export const configQuery = queryOptions({
  queryKey: ['config'],
  queryFn: (): Promise<ConfigResponse> => getDesktopApi().getConfig(),
  staleTime: Infinity,
  gcTime: 300_000,
});

export const pipelinesQuery = queryOptions({
  queryKey: ['pipelines'],
  queryFn: (): Promise<PipelineListItem[]> => getDesktopApi().listPipelines(),
  refetchInterval: 30_000,
  staleTime: 20_000,
  gcTime: 120_000,
});

export const buildsQuery = (opts?: { pipeline?: string; limit?: number }) =>
  queryOptions({
    queryKey: ['builds', opts],
    queryFn: (): Promise<BuildRunRowApi[]> => getDesktopApi().listRuns(opts),
    refetchInterval: 10_000,
    staleTime: 8_000,
    gcTime: 120_000,
  });

export const buildStatsQuery = queryOptions({
  queryKey: ['builds', 'stats'],
  queryFn: (): Promise<BuildStatsApi> => getDesktopApi().getStats(),
  refetchInterval: 60_000,
  staleTime: 30_000,
  gcTime: 120_000,
});

export const scanQuery = queryOptions({
  queryKey: ['scan'],
  queryFn: (): Promise<ScanResponse> => getDesktopApi().getScan(),
  staleTime: 60_000,
  gcTime: 300_000,
});

export function useRunPipeline() {
  return useMutation({
    mutationFn: (name: string) => getDesktopApi().runPipeline({ name }),
  });
}

export function useCancelJob() {
  return useMutation({
    mutationFn: (jobId: string) => getDesktopApi().cancelJob(jobId),
  });
}

export function useCreatePipeline() {
  return useMutation({
    mutationFn: (data: { name: string; pipeline: unknown }) => getDesktopApi().createPipeline(data),
  });
}

export function useUpdatePipeline() {
  return useMutation({
    mutationFn: (data: { name: string; pipeline: unknown }) => getDesktopApi().updatePipeline(data),
  });
}

export function useDeletePipeline() {
  return useMutation({
    mutationFn: (name: string) => getDesktopApi().deletePipeline(name),
  });
}

export function useSaveConfig() {
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => getDesktopApi().saveConfig(patch),
  });
}

export function useRefreshScan() {
  return useMutation({
    mutationFn: (): Promise<StartJobResponse> => getDesktopApi().refreshScan(),
  });
}

export function useBuildLogs(runId: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['builds', runId, 'logs'],
    queryFn: ({ pageParam }): Promise<BuildLogPage> =>
      getDesktopApi().getRunLogs(runId, { limit: 500, beforeSeq: pageParam }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextBeforeSeq ?? undefined,
    enabled,
    staleTime: Infinity,
    gcTime: 300_000,
  });
}

export function useQuickRun() {
  return useMutation({
    mutationFn: (body: {
      path: string;
      buildSystem: 'maven' | 'node';
      modulePath?: string;
      submoduleBuildStrategy?: MavenSubmoduleBuildStrategy;
      goals?: string[];
      optionKeys?: MavenOptionKey[];
      profileStates?: Record<string, MavenProfileState>;
      extraOptions?: string[];
      java?: string;
      commandType?: NodeCommandType;
      script?: string;
      args?: string[];
      executionMode?: ExecutionMode;
    }) => getDesktopApi().runQuick(body as Record<string, unknown>),
  });
}

export function inspectProject(projectPath: string): Promise<ProjectInspectionResponse> {
  return getDesktopApi().inspectProject(projectPath);
}

export function useDetectJdks() {
  return useMutation({
    mutationFn: (baseDir: string): Promise<JdkDetectionResponse> => getDesktopApi().detectJdks(baseDir),
  });
}

export function useClearBuildLogs() {
  return useMutation({ mutationFn: () => getDesktopApi().clearRunLogs() });
}

export function useClearAllBuilds() {
  return useMutation({ mutationFn: () => getDesktopApi().clearRuns() });
}
