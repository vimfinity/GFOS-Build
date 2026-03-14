export type DistributionMode = 'managed' | 'portable';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not_available'
  | 'error'
  | 'apply_blocked_active_jobs';

export interface AppInfo {
  version: string;
  distribution: DistributionMode;
  channel: 'alpha';
}

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  distribution: DistributionMode;
  channel: 'alpha';
  availableVersion?: string;
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string;
  downloadPercent?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  downloadUrl?: string;
  releasePageUrl?: string;
  lastCheckedAt?: string;
  error?: string;
  applyBlockedReason?: 'active_jobs';
}
