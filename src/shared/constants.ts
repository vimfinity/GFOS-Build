/**
 * Application constants shared between main and renderer.
 */

import type { AppSettings } from './types';

export const APP_NAME = 'GFOS Build';

export const CONFIG_FILE = 'gfos-build-config.json';
export const JOBS_FILE = 'gfos-build-jobs.json';
export const PIPELINES_FILE = 'gfos-build-pipelines.json';
export const CACHE_FILE = 'gfos-build-cache.json';

export const DEFAULT_SETTINGS = {
  scanRootPath: '',
  jdkScanPaths: '',
  defaultMavenHome: '',
  defaultMavenGoal: 'clean install',
  maxParallelBuilds: 2,
  skipTestsByDefault: false,
  offlineMode: false,
  enableThreads: false,
  threadCount: '1C',
  setupComplete: false,
} satisfies AppSettings;

export const SCAN_EXCLUDE_DIRS = [
  'target',
  'node_modules',
  '.git',
  'build',
  'dist',
  '.idea',
  '.vscode',
];
