import type {
  BuildLogPage,
  BuildRunRowApi,
  BuildStatsApi,
  ConfigResponse,
  DeploymentPlanPreview,
  DeploymentProjectInspectionResponse,
  GitInfoResponse,
  JdkDetectionResponse,
  PipelineListItem,
  ProjectInspectionResponse,
  ScanResponse,
  StartJobResponse,
} from './api.js';

export const IPC = {
  GET_HEALTH: 'gfos:get-health',
  GET_CONFIG: 'gfos:get-config',
  SAVE_CONFIG: 'gfos:save-config',
  LIST_PIPELINES: 'gfos:list-pipelines',
  CREATE_PIPELINE: 'gfos:create-pipeline',
  UPDATE_PIPELINE: 'gfos:update-pipeline',
  DELETE_PIPELINE: 'gfos:delete-pipeline',
  RUN_PIPELINE: 'gfos:run-pipeline',
  RUN_QUICK: 'gfos:run-quick',
  CANCEL_JOB: 'gfos:cancel-job',
  LIST_RUNS: 'gfos:list-runs',
  GET_RUN_LOGS: 'gfos:get-run-logs',
  GET_STATS: 'gfos:get-stats',
  GET_SCAN: 'gfos:get-scan',
  REFRESH_SCAN: 'gfos:refresh-scan',
  INSPECT_PROJECT: 'gfos:inspect-project',
  INSPECT_DEPLOYMENT_PROJECT: 'gfos:inspect-deployment-project',
  PREVIEW_DEPLOYMENT_PLAN: 'gfos:preview-deployment-plan',
  DETECT_JDKS: 'gfos:detect-jdks',
  CLEAR_RUN_LOGS: 'gfos:clear-run-logs',
  CLEAR_RUNS: 'gfos:clear-runs',
  OPEN_DIRECTORY: 'gfos:open-directory',
  OPEN_FILE: 'gfos:open-file',
  GET_GIT_INFO: 'gfos:get-git-info',
  GET_GIT_INFO_BATCH: 'gfos:get-git-info-batch',
  RUN_SUBSCRIBE: 'gfos:run-subscribe',
  RUN_UNSUBSCRIBE: 'gfos:run-unsubscribe',
  RUN_EVENT: 'gfos:run-event',
  GIT_HEAD_CHANGED: 'gfos:git-head-changed',
} as const;

export interface ElectronBridge {
  getHealth: () => Promise<{ version: string; uptime: number; platform: string }>;
  getConfig: () => Promise<ConfigResponse>;
  saveConfig: (patch: Record<string, unknown>) => Promise<{ ok: boolean }>;
  listPipelines: () => Promise<PipelineListItem[]>;
  createPipeline: (input: { name: string; pipeline: unknown }) => Promise<{ ok: boolean; name: string }>;
  updatePipeline: (input: { name: string; pipeline: unknown }) => Promise<{ ok: boolean; name: string }>;
  deletePipeline: (name: string) => Promise<void>;
  runPipeline: (input: { name: string; from?: string }) => Promise<StartJobResponse>;
  runQuick: (input: Record<string, unknown>) => Promise<StartJobResponse>;
  cancelJob: (jobId: string) => Promise<void>;
  listRuns: (opts?: { pipeline?: string; limit?: number }) => Promise<BuildRunRowApi[]>;
  getRunLogs: (runId: number, opts?: { limit?: number; beforeSeq?: number }) => Promise<BuildLogPage>;
  getStats: () => Promise<BuildStatsApi>;
  getScan: () => Promise<ScanResponse>;
  refreshScan: () => Promise<StartJobResponse>;
  inspectProject: (path: string) => Promise<ProjectInspectionResponse>;
  inspectDeploymentProject: (path: string) => Promise<DeploymentProjectInspectionResponse>;
  previewDeploymentPlan: (input: Record<string, unknown>) => Promise<DeploymentPlanPreview>;
  detectJdks: (path: string) => Promise<JdkDetectionResponse>;
  clearRunLogs: () => Promise<void>;
  clearRuns: () => Promise<void>;
  openDirectory: () => Promise<string | null>;
  openFile: (opts?: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
  getGitInfo: (path: string) => Promise<GitInfoResponse>;
  getGitInfoBatch: (paths: string[]) => Promise<Record<string, GitInfoResponse>>;
  onRunEvent: (jobId: string, listener: (event: import('./api.js').RunEventEnvelope) => void) => () => void;
  onGitHeadChanged: (listener: () => void) => () => void;
}
