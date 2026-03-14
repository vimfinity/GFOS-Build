import { app, shell } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AppInfo, DistributionMode, UpdateState } from '@gfos-build/shared';
import type { AppUpdater, UpdateInfo } from 'electron-updater';

const GITHUB_RELEASES_API = 'https://api.github.com/repos/vimfinity/GFOS-Build/releases';
const GITHUB_RELEASES_PAGE = 'https://github.com/vimfinity/GFOS-Build/releases';
const APP_UPDATE_CONFIG = 'app-update.yml';
const CHANNEL = 'alpha';
const GITHUB_USER_AGENT = 'GFOS-Build-Updater';
const ACTIVE_JOB_POLL_MS = 2_000;

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
}

interface CreateUpdaterServiceOptions {
  getActiveJobCount: () => number;
  sendState: (state: UpdateState) => void;
}

interface ElectronUpdaterModuleShape {
  autoUpdater?: AppUpdater;
  default?: {
    autoUpdater?: AppUpdater;
  };
}

export interface UpdaterService {
  getAppInfo: () => AppInfo;
  getState: () => UpdateState;
  checkForUpdates: () => Promise<UpdateState>;
  downloadUpdate: () => Promise<UpdateState>;
  applyUpdate: () => Promise<UpdateState>;
  dispose: () => void;
}

function resolveAutoUpdater(module: ElectronUpdaterModuleShape): AppUpdater {
  const autoUpdater = module.autoUpdater ?? module.default?.autoUpdater;
  if (!autoUpdater) {
    throw new Error('electron-updater did not expose autoUpdater in this packaged build.');
  }
  return autoUpdater;
}

function detectDistribution(): DistributionMode {
  if (!app.isPackaged) return 'portable';
  if (process.env['PORTABLE_EXECUTABLE_DIR']) return 'portable';
  return existsSync(path.join(process.resourcesPath, APP_UPDATE_CONFIG)) ? 'managed' : 'portable';
}

function sanitizeReleaseNotes(body: string | null | undefined): string | undefined {
  if (!body) return undefined;
  const cleaned = body
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 6)
    .join('\n')
    .slice(0, 500);
  return cleaned || undefined;
}

function sanitizeUpdaterError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('latest.yml') && message.includes('404')) {
    return 'Managed updates are not published for the current GitHub prerelease yet. The latest release is missing latest.yml.';
  }

  if (message.includes('electron-updater did not expose autoUpdater')) {
    return 'Managed updater initialization failed in this build.';
  }

  return message;
}

function normalizeReleaseNotes(notes: UpdateInfo['releaseNotes']): string | undefined {
  if (typeof notes === 'string') return sanitizeReleaseNotes(notes);
  if (Array.isArray(notes)) {
    return sanitizeReleaseNotes(
      notes
        .map((note) => (typeof note === 'string' ? note : note.note))
        .filter(Boolean)
        .join('\n\n'),
    );
  }
  return undefined;
}

function parseVersion(input: string): {
  major: number;
  minor: number;
  patch: number;
  prereleaseTag: string | null;
  prereleaseNumber: number | null;
} | null {
  const match = input.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  const prerelease = match[4] ?? null;
  const prereleaseParts = prerelease ? prerelease.split('.') : [];
  const maybeNumber = prereleaseParts.length > 1 ? Number(prereleaseParts[prereleaseParts.length - 1]) : NaN;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prereleaseTag: prereleaseParts[0] ?? null,
    prereleaseNumber: Number.isFinite(maybeNumber) ? maybeNumber : null,
  };
}

function prereleaseRank(tag: string | null): number {
  if (!tag) return 4;
  if (tag.startsWith('rc')) return 3;
  if (tag.startsWith('beta')) return 2;
  if (tag.startsWith('alpha')) return 1;
  return 0;
}

function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return left.localeCompare(right);
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  const prereleaseDelta = prereleaseRank(a.prereleaseTag) - prereleaseRank(b.prereleaseTag);
  if (prereleaseDelta !== 0) return prereleaseDelta;
  return (a.prereleaseNumber ?? 0) - (b.prereleaseNumber ?? 0);
}

function getNextTestVersion(currentVersion: string): string {
  const parsed = parseVersion(currentVersion);
  if (!parsed) return currentVersion;

  const base = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  if (!parsed.prereleaseTag) {
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }

  return `${base}-${parsed.prereleaseTag}.${(parsed.prereleaseNumber ?? 0) + 1}`;
}

async function fetchLatestRelease(distribution: DistributionMode): Promise<GitHubRelease | null> {
  const response = await fetch(GITHUB_RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': GITHUB_USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub release lookup failed: ${response.status}`);
  }

  const releases = (await response.json()) as GitHubRelease[];
  const assetSuffix = distribution === 'portable' ? '.zip' : '.exe';
  return (
    releases.find((release) => {
      if (release.draft) return false;
      return release.assets.some((asset) => asset.name.endsWith(assetSuffix));
    }) ?? null
  );
}

export function createUpdaterService(options: CreateUpdaterServiceOptions): UpdaterService {
  const devUpdateSimulation = !app.isPackaged;
  const distribution = devUpdateSimulation ? 'managed' : detectDistribution();
  const updatesEnabled = app.isPackaged || devUpdateSimulation;
  let state: UpdateState = {
    status: 'idle',
    currentVersion: app.getVersion(),
    distribution,
    channel: CHANNEL,
    releasePageUrl: GITHUB_RELEASES_PAGE,
  };
  let pollTimer: NodeJS.Timeout | null = null;
  let latestPortableAssetUrl: string | null = null;
  let latestPortableReleasePageUrl: string | null = null;
  let managedUpdaterPromise: Promise<AppUpdater> | null = null;

  const emitState = (): UpdateState => {
    state = refreshApplyBlockState(state, options.getActiveJobCount);
    options.sendState(state);
    return state;
  };

  const setState = (next: Partial<UpdateState>): UpdateState => {
    state = {
      ...state,
      ...next,
    };
    return emitState();
  };

  const appInfo: AppInfo = {
    version: app.getVersion(),
    distribution,
    channel: CHANNEL,
  };

  const refreshLoop = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      const next = refreshApplyBlockState(state, options.getActiveJobCount);
      if (JSON.stringify(next) !== JSON.stringify(state)) {
        state = next;
        options.sendState(state);
      }
    }, ACTIVE_JOB_POLL_MS);
  };

  refreshLoop();

  const runDevCheck = async (): Promise<UpdateState> => {
    const availableVersion = getNextTestVersion(appInfo.version);
    const publishedAt = new Date().toISOString();
    return setState({
      status: 'available',
      availableVersion,
      releaseName: `GFOS Build v${availableVersion}`,
      releaseNotes: 'Local updater simulation for desktop development.',
      publishedAt,
      downloadPercent: undefined,
      downloadedBytes: undefined,
      totalBytes: undefined,
      error: undefined,
      releasePageUrl: GITHUB_RELEASES_PAGE,
    });
  };

  const runDevDownload = async (): Promise<UpdateState> => {
    const availableVersion = state.availableVersion ?? getNextTestVersion(appInfo.version);
    const releaseName = state.releaseName ?? `GFOS Build v${availableVersion}`;
    const publishedAt = state.publishedAt ?? new Date().toISOString();

    return setState({
      status: 'downloaded',
      availableVersion,
      releaseName,
      publishedAt,
      downloadPercent: 100,
      downloadedBytes: 100,
      totalBytes: 100,
      error: undefined,
    });
  };

  const runDevApply = async (): Promise<UpdateState> => {
    const next = refreshApplyBlockState(state, options.getActiveJobCount);
    state = next;
    if (next.status === 'apply_blocked_active_jobs') {
      options.sendState(state);
      return state;
    }

    return setState({
      status: 'idle',
      availableVersion: undefined,
      releaseName: undefined,
      releaseNotes: undefined,
      publishedAt: undefined,
      downloadPercent: undefined,
      downloadedBytes: undefined,
      totalBytes: undefined,
      error: undefined,
      applyBlockedReason: undefined,
      lastCheckedAt: new Date().toISOString(),
    });
  };

  const ensureManagedUpdater = async (): Promise<AppUpdater> => {
    if (managedUpdaterPromise) {
      return managedUpdaterPromise;
    }

    managedUpdaterPromise = import('electron-updater').then((module) => {
      const autoUpdater = resolveAutoUpdater(module);
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = false;
      autoUpdater.allowPrerelease = true;
      return autoUpdater;
    }).then((autoUpdater) => {
      autoUpdater.on('checking-for-update', () => {
        setState({
          status: 'checking',
          error: undefined,
          lastCheckedAt: new Date().toISOString(),
        });
      });

      autoUpdater.on('update-available', (info) => {
        setState({
          status: 'available',
          availableVersion: info.version,
          releaseName: info.releaseName ?? `GFOS Build ${info.version}`,
          releaseNotes: normalizeReleaseNotes(info.releaseNotes),
          publishedAt: info.releaseDate,
          error: undefined,
        });
      });

      autoUpdater.on('update-not-available', () => {
        setState({
          status: 'not_available',
          availableVersion: undefined,
          releaseName: undefined,
          releaseNotes: undefined,
          publishedAt: undefined,
          downloadPercent: undefined,
          downloadedBytes: undefined,
          totalBytes: undefined,
          error: undefined,
        });
      });

      autoUpdater.on('download-progress', (progress) => {
        setState({
          status: 'downloading',
          downloadPercent: progress.percent,
          downloadedBytes: progress.transferred,
          totalBytes: progress.total,
        });
      });

      autoUpdater.on('update-downloaded', (info) => {
        setState({
          status: 'downloaded',
          availableVersion: info.version,
          releaseName: info.releaseName ?? `GFOS Build ${info.version}`,
          releaseNotes: normalizeReleaseNotes(info.releaseNotes),
          publishedAt: info.releaseDate,
          downloadPercent: 100,
        });
      });

      autoUpdater.on('error', (error) => {
        setState({
          status: 'error',
          error: sanitizeUpdaterError(error),
          releasePageUrl: GITHUB_RELEASES_PAGE,
        });
      });

      return autoUpdater;
    });

    return managedUpdaterPromise;
  };

  const runPortableCheck = async (): Promise<UpdateState> => {
    setState({
      status: 'checking',
      error: undefined,
      lastCheckedAt: new Date().toISOString(),
    });
    try {
      const release = await fetchLatestRelease(distribution);
      if (!release) {
        return setState({
          status: 'not_available',
        });
      }

      const version = release.tag_name.replace(/^v/, '');
      latestPortableAssetUrl =
        release.assets.find((asset) => asset.name.endsWith('.zip'))?.browser_download_url ?? null;
      latestPortableReleasePageUrl = release.html_url;

      if (compareVersions(version, appInfo.version) > 0 && latestPortableAssetUrl) {
        return setState({
          status: 'available',
          availableVersion: version,
          releaseName: release.name,
          releaseNotes: sanitizeReleaseNotes(release.body),
          publishedAt: release.published_at,
          downloadUrl: latestPortableAssetUrl,
          releasePageUrl: release.html_url,
        });
      }

      latestPortableAssetUrl = null;
      return setState({
        status: 'not_available',
        availableVersion: undefined,
        releaseName: undefined,
        releaseNotes: undefined,
        publishedAt: undefined,
        downloadUrl: undefined,
        releasePageUrl: release.html_url,
      });
    } catch (error) {
      return setState({
        status: 'error',
        error: sanitizeUpdaterError(error),
        releasePageUrl: GITHUB_RELEASES_PAGE,
      });
    }
  };

  return {
    getAppInfo: () => appInfo,
    getState: () => emitState(),
    checkForUpdates: async () => {
      if (!updatesEnabled) {
        return setState({
          status: 'not_available',
          error: 'Updates are unavailable in development builds.',
        });
      }
      if (devUpdateSimulation) {
        return runDevCheck();
      }
      if (distribution === 'managed') {
        try {
          const managedUpdater = await ensureManagedUpdater();
          await managedUpdater.checkForUpdates();
          return emitState();
        } catch (error) {
          return setState({
            status: 'error',
            error: sanitizeUpdaterError(error),
            releasePageUrl: GITHUB_RELEASES_PAGE,
          });
        }
      }

      return runPortableCheck();
    },
    downloadUpdate: async () => {
      if (!updatesEnabled) {
        return setState({
          status: 'error',
          error: 'Updates are unavailable in development builds.',
        });
      }
      if (devUpdateSimulation) {
        return runDevDownload();
      }
      if (distribution === 'managed') {
        try {
          const managedUpdater = await ensureManagedUpdater();
          await managedUpdater.downloadUpdate();
          return emitState();
        } catch (error) {
          return setState({
            status: 'error',
            error: sanitizeUpdaterError(error),
            releasePageUrl: GITHUB_RELEASES_PAGE,
          });
        }
      }

      if (!latestPortableAssetUrl) {
        await runPortableCheck();
      }

      if (!latestPortableAssetUrl) {
        return setState({
          status: 'error',
          error: 'No portable download is available right now.',
        });
      }

      await shell.openExternal(latestPortableAssetUrl);
      return setState({
        releasePageUrl: latestPortableReleasePageUrl ?? undefined,
      });
    },
    applyUpdate: async () => {
      if (!updatesEnabled) {
        return setState({
          status: 'error',
          error: 'Updates are unavailable in development builds.',
        });
      }
      if (devUpdateSimulation) {
        return runDevApply();
      }
      if (distribution !== 'managed') {
        return setState({
          status: 'error',
          error: 'Portable builds use manual updates.',
        });
      }

      const next = refreshApplyBlockState(state, options.getActiveJobCount);
      state = next;
      if (next.status === 'apply_blocked_active_jobs') {
        options.sendState(state);
        return state;
      }

      try {
        const managedUpdater = await ensureManagedUpdater();
        // The renderer already confirmed the restart, so install silently and relaunch the app.
        managedUpdater.quitAndInstall(true, true);
        return emitState();
      } catch (error) {
        return setState({
          status: 'error',
          error: sanitizeUpdaterError(error),
          releasePageUrl: GITHUB_RELEASES_PAGE,
        });
      }
    },
    dispose: () => {
      if (pollTimer) clearInterval(pollTimer);
    },
  };
}

function refreshApplyBlockState(
  state: UpdateState,
  getActiveJobCount: () => number,
): UpdateState {
  const activeJobs = getActiveJobCount();
  if (state.status === 'downloaded' && activeJobs > 0) {
    return {
      ...state,
      status: 'apply_blocked_active_jobs',
      applyBlockedReason: 'active_jobs',
    };
  }

  if (state.status === 'apply_blocked_active_jobs' && activeJobs === 0) {
    return {
      ...state,
      status: 'downloaded',
      applyBlockedReason: undefined,
    };
  }

  return state;
}
