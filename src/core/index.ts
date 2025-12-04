/**
 * Core Module Exports
 * 
 * Central export point for all core types, services, and business logic.
 */

// Types (but exclude duplicates that are in store)
export {
  type DirectoryEntry,
  type ScanResult,
  type GitRepository,
  type MavenProject,
  type JDK,
  // Note: BuildJob and NavigationState are exported from store
  // Note: MavenModule and JdkInstallation are exported from services/WorkspaceScanner
} from './types';
export * from './types/filesystem';

// Services
export * from './services';

// Store (includes BuildJob and NavigationState)
export * from './store';
