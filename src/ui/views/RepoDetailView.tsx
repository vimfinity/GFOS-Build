/**
 * RepoDetailView Component
 * 
 * Repository detail screen with module selection.
 * Features:
 * - Lazy scan for Maven modules on mount
 * - Root project info display
 * - Multi-select modules for build pipeline
 * - Search/filter modules
 * - Run build action
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { matchSorter } from 'match-sorter';

import {
  ScreenContainer,
  Header,
  StatusBar,
  Spinner,
} from '../components/index.js';
import { CheckboxList, type CheckboxItem } from '../components/CheckboxList.js';
import { colors, icons } from '../theme.js';
import {
  useAppStore,
  useSelectedProject,
  useProjectModules,
  useProjectProfiles,
  useJdks,
  usePendingJobsCount,
  useRunningJobsCount,
  useSettings,
} from '../../core/store/useAppStore.js';
import { WorkspaceScanner, type MavenModule } from '../../core/services/WorkspaceScanner.js';
import { getCacheService } from '../../core/services/CacheService.js';
import { getFileSystem } from '../../infrastructure/ServiceLocator.js';
import type { Shortcut } from '../components/index.js';

/**
 * Hook to lazy-scan modules and profiles for a project.
 * Stores both in the global store for persistence.
 * Uses disk cache for faster subsequent loads.
 */
function useModuleScan(projectPath: string | null) {
  const [isScanning, setIsScanning] = useState(false);
  const loadModules = useAppStore((state) => state.loadModules);
  const loadProfiles = useAppStore((state) => state.loadProfiles);
  const addNotification = useAppStore((state) => state.addNotification);
  const existingModules = useProjectModules(projectPath || '');
  const existingProfiles = useProjectProfiles(projectPath || '');

  const scan = useCallback(async () => {
    if (!projectPath) return;
    
    setIsScanning(true);
    try {
      const cacheService = getCacheService();
      
      // Try to load from disk cache first
      const cachedProject = await cacheService.loadProjectCache(projectPath);
      if (cachedProject && cachedProject.modules.length > 0) {
        // Convert cached modules to MavenModule format
        const cachedModules: MavenModule[] = cachedProject.modules.map(m => ({
          pomPath: m.pomPath,
          projectPath: m.projectPath,
          artifactId: m.artifactId,
          groupId: m.groupId,
          version: m.version,
          packaging: m.packaging,
          javaVersion: m.javaVersion,
          parentArtifactId: m.parentArtifactId,
          isRoot: m.isRoot,
        }));
        
        loadModules(projectPath, cachedModules);
        loadProfiles(projectPath, cachedProject.profiles);
        addNotification('info', `Loaded ${cachedModules.length} modules from cache`);
        setIsScanning(false);
        return;
      }
      
      // No cache - do full scan
      const fs = getFileSystem();
      const scanner = new WorkspaceScanner(fs);
      
      const modules = await scanner.findMavenModules(projectPath);
      loadModules(projectPath, modules);
      
      // Collect profiles from ALL pom.xml files
      const allProfiles = new Set<string>();
      
      for (const module of modules) {
        try {
          const parsedPom = await scanner.parsePom(module.pomPath);
          if (parsedPom?.profiles) {
            parsedPom.profiles.forEach(p => allProfiles.add(p));
          }
        } catch {
          // Ignore individual parse errors
        }
      }
      
      const profilesArray = Array.from(allProfiles).sort();
      
      // Store profiles in global store
      loadProfiles(projectPath, profilesArray);
      
      // Save to disk cache for next time
      await cacheService.saveProjectCache(projectPath, modules, profilesArray);
      
      addNotification('success', `Found ${modules.length} modules, ${allProfiles.size} profiles`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scan error';
      addNotification('error', `Module scan failed: ${message}`);
    } finally {
      setIsScanning(false);
    }
  }, [projectPath, loadModules, loadProfiles, addNotification]);

  // Auto-scan on mount if no modules cached
  useEffect(() => {
    if (projectPath && existingModules.length === 0 && !isScanning) {
      scan();
    }
  }, [projectPath, existingModules.length, isScanning, scan]);

  return { isScanning, scan, modules: existingModules, profiles: existingProfiles };
}

/**
 * Convert Maven module to checkbox item.
 */
function moduleToCheckboxItem(module: MavenModule): CheckboxItem<string> {
  return {
    value: module.pomPath,
    label: module.artifactId || 'unknown',
    badge: module.javaVersion ? `Java ${module.javaVersion}` : module.packaging,
    badgeColor: module.javaVersion 
      ? getJavaVersionColor(module.javaVersion)
      : colors.secondary,
    defaultSelected: module.isRoot,
  };
}

/**
 * Get color for Java version badge.
 */
function getJavaVersionColor(version: string): string {
  const major = parseInt(version.split('.')[0] || '0', 10);
  if (major >= 21) return colors.success;
  if (major >= 17) return colors.info;
  if (major >= 11) return colors.warning;
  return colors.error;
}

// ============================================================================
// Props
// ============================================================================

/** Data passed to BuildConfigView */
export interface BuildConfigData {
  projectPath: string;
  projectName: string;
  selectedModules: Array<{ artifactId: string; pomPath: string; relativePath?: string }>;
  availableProfiles: string[];
  jdkPath: string;
  jdkVersion: string;
}

export interface RepoDetailViewProps {
  /** Project path to display (overrides store selection) */
  projectPath?: string;
  /** Callback when user wants to go back */
  onBack?: () => void;
  /** Callback when navigating to build config */
  onNavigateToBuildConfig?: (data: BuildConfigData) => void;
  /** Callback when navigating to jobs (legacy) */
  onNavigateToJobs?: () => void;
}

/**
 * RepoDetailView - Repository detail with module selection.
 */
export function RepoDetailView({
  projectPath: propProjectPath,
  onBack,
  onNavigateToBuildConfig,
  onNavigateToJobs,
}: RepoDetailViewProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  
  // Store selectors
  const storeProject = useSelectedProject();
  const projects = useAppStore((state) => state.scannedData.projects);
  const jdks = useJdks();
  const settings = useSettings();
  const pendingJobs = usePendingJobsCount();
  const runningJobs = useRunningJobsCount();
  
  // Use prop path or fall back to store selection
  const project = useMemo(() => {
    if (propProjectPath) {
      return projects.find(p => p.path === propProjectPath) || storeProject;
    }
    return storeProject;
  }, [propProjectPath, projects, storeProject]);
  
  // Store actions
  const goBack = useAppStore((state) => state.goBack);
  const addJob = useAppStore((state) => state.addJob);
  const addNotification = useAppStore((state) => state.addNotification);
  const selectProject = useAppStore((state) => state.selectProject);
  
  // Ensure project is selected in store
  useEffect(() => {
    if (propProjectPath && (!storeProject || storeProject.path !== propProjectPath)) {
      selectProject(propProjectPath);
    }
  }, [propProjectPath, storeProject, selectProject]);
  
  // Module scanning
  const { isScanning, scan, modules, profiles } = useModuleScan(project?.path || null);

  // Find root module
  const rootModule = useMemo(() => 
    modules.find(m => m.isRoot), [modules]);

  // Filter modules using fuzzy search
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) {
      return modules;
    }
    return matchSorter(modules, searchQuery, {
      keys: ['artifactId', 'pomPath'],
      threshold: matchSorter.rankings.CONTAINS,
    });
  }, [modules, searchQuery]);

  // Convert to checkbox items
  const checkboxItems = useMemo(() => 
    filteredModules.map(moduleToCheckboxItem), [filteredModules]);

  // Pre-select root module on first load
  useEffect(() => {
    if (rootModule && selectedModules.length === 0) {
      setSelectedModules([rootModule.pomPath]);
    }
  }, [rootModule]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle keyboard input
  useInput((input, key) => {
    // Go back with Escape only (allow B for search)
    if (key.escape) {
      onBack?.() || goBack();
      return;
    }

    // Backspace removes from search
    if (key.backspace || key.delete) {
      if (searchQuery.length > 0) {
        setSearchQuery(prev => prev.slice(0, -1));
      }
      return;
    }

    // Skip navigation keys (but NOT Enter - we handle it for build)
    if (key.upArrow || key.downArrow || input === ' ') {
      return;
    }

    // Enter starts build if modules are selected, otherwise toggles in CheckboxList
    if (key.return) {
      if (selectedModules.length > 0) {
        runBuild();
      }
      // If no modules selected, let CheckboxList handle it for toggling
      return;
    }

    // Ctrl+U clears search
    if (key.ctrl && (input === 'u' || input === 'U')) {
      setSearchQuery('');
      return;
    }

    // Rescan with Ctrl+R
    if (key.ctrl && (input === 'r' || input === 'R')) {
      scan();
      return;
    }

    // Printable characters add to search (all letters allowed now)
    if (input && input.length === 1 && input.charCodeAt(0) >= 32 && !key.ctrl) {
      setSearchQuery(prev => prev + input);
    }
  });

  // Run build with selected modules
  const runBuild = useCallback(() => {
    if (selectedModules.length === 0) {
      addNotification('warning', 'No modules selected for build');
      return;
    }

    if (!project) {
      addNotification('error', 'No project selected');
      return;
    }

    // Determine required JDK version based on project path
    // Convention: 2025 folder = Java 21, 4.8plus = Java 17, 4.8 = Java 11
    const pathParts = project.path.split(/[\\/]/);
    const versionFolder = pathParts.find(p => ['2025', '4.8plus', '4.8'].includes(p)) || '';
    
    let requiredJdkVersion: number | null = null;
    if (versionFolder === '2025') {
      requiredJdkVersion = 21;
    } else if (versionFolder === '4.8plus') {
      requiredJdkVersion = 17;
    } else if (versionFolder === '4.8') {
      requiredJdkVersion = 11;
    }

    // Find matching JDK from available JDKs
    let selectedJdk = jdks[0]; // Default to first JDK
    if (requiredJdkVersion && jdks.length > 0) {
      // Try to find exact match first
      const exactMatch = jdks.find(j => {
        const versionNum = parseInt(j.version.split('.')[0] || '0', 10);
        return versionNum === requiredJdkVersion;
      });
      if (exactMatch) {
        selectedJdk = exactMatch;
      } else {
        // Find closest higher version
        const higherVersions = jdks
          .filter(j => {
            const versionNum = parseInt(j.version.split('.')[0] || '0', 10);
            return versionNum >= (requiredJdkVersion || 0);
          })
          .sort((a, b) => {
            const aVer = parseInt(a.version.split('.')[0] || '0', 10);
            const bVer = parseInt(b.version.split('.')[0] || '0', 10);
            return aVer - bVer;
          });
        if (higherVersions[0]) {
          selectedJdk = higherVersions[0];
        }
      }
    }

    // Get JAVA_HOME: selected JDK > settings default > system JAVA_HOME
    const javaHome = selectedJdk?.jdkHome || settings.defaultJavaHome || process.env.JAVA_HOME || '';
    const jdkVersion = selectedJdk?.version || 'system';

    // Get selected module objects with relative paths
    const selectedModuleObjects = modules.filter(m => 
      selectedModules.includes(m.pomPath)
    );

    // Check if only the root module is selected (no -pl needed)
    // Normalize path separators for comparison
    const normalizedProjectPath = project.path.replace(/\\/g, '/');
    const isRootOnly = selectedModuleObjects.length === 1 && 
      selectedModuleObjects[0]?.pomPath.replace(/\\/g, '/') === `${normalizedProjectPath}/pom.xml`;

    // Prepare module data with relative paths
    const modulesWithRelativePaths = selectedModuleObjects.map(module => {
      let relativePath: string | undefined;
      if (!isRootOnly) {
        const modulePomPath = module.pomPath;
        const projectRoot = project.path;
        const moduleDir = modulePomPath.replace(/[\\/]pom\.xml$/i, '');
        if (moduleDir !== projectRoot) {
          // Calculate relative path and convert to forward slashes for Maven
          relativePath = moduleDir
            .replace(projectRoot, '')
            .replace(/^[\\/]+/, '')
            .replace(/\\/g, '/'); // Always use forward slashes for Maven -pl
        }
      }
      return {
        artifactId: module.artifactId,
        pomPath: module.pomPath,
        relativePath,
      };
    });

    // Navigate to build config screen
    if (onNavigateToBuildConfig) {
      onNavigateToBuildConfig({
        projectPath: project.path,
        projectName: project.name,
        selectedModules: modulesWithRelativePaths,
        availableProfiles: profiles,
        jdkPath: javaHome,
        jdkVersion,
      });
    } else if (onNavigateToJobs) {
      // Fallback: directly add jobs (legacy behavior)
      modulesWithRelativePaths.forEach(module => {
        addJob({
          projectPath: project.path,
          modulePath: module.relativePath,
          name: `${project.name}:${module.artifactId}`,
          jdkPath: javaHome,
          mavenGoals: settings.defaultMavenGoal.split(' '),
          status: 'pending',
        });
      });
      addNotification('success', `Added ${modulesWithRelativePaths.length} build job(s) to queue`);
      onNavigateToJobs();
    }
  }, [selectedModules, modules, project, jdks, settings, addJob, addNotification, onNavigateToBuildConfig, onNavigateToJobs]);

  // Status bar shortcuts
  const shortcuts: Shortcut[] = [
    { key: 'Type', label: 'Search' },
    { key: 'ESC', label: 'Back' },
    { key: 'Space', label: 'Toggle' },
    { key: 'Ctrl+A/N', label: 'All/None' },
    { key: 'Enter', label: 'Configure Build' },
  ];

  // Handle missing project
  if (!project) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Header title="GFOS-Build" version="1.0.0" />
        <ScreenContainer title="Error" padding={1}>
          <Text color={colors.error}>No project selected. Press ESC to go back.</Text>
        </ScreenContainer>
        <StatusBar shortcuts={[{ key: 'ESC', label: 'Back' }]} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header 
        title="GFOS-Build" 
        version="1.0.0" 
        isMockMode={process.env['MOCK_MODE'] === 'true'} 
      />
      
      <ScreenContainer
        title={project.name}
        subtitle={`${selectedModules.length} of ${modules.length} modules selected`}
        padding={1}
        fillHeight
      >
        {/* Compact Project Info - single line */}
        <Text color={colors.textDim}>
          {project.name} {rootModule?.version && `v${rootModule.version}`} {rootModule?.javaVersion && <Text color={colors.info}>[Java {rootModule.javaVersion}]</Text>}
        </Text>

        {/* Search Bar */}
        <Box marginBottom={1}>
          <Box marginRight={1}>
            <Text color={colors.textDim}>{icons.search}</Text>
          </Box>
          <Text color={searchQuery ? colors.text : colors.textDim}>
            {searchQuery || 'Type to filter modules...'}
          </Text>
          {searchQuery && (
            <Text color={colors.textDim}> ({filteredModules.length} matches)</Text>
          )}
        </Box>

        {/* Modules Section */}
        <Box flexDirection="column">
          <Box>
            <Text bold color={colors.primaryBright}>Maven Modules</Text>
            {isScanning && (
              <Box marginLeft={1}>
                <Spinner />
              </Box>
            )}
          </Box>
          
          <Box marginTop={1}>
            {isScanning ? (
              <Box paddingY={1}>
                <Spinner message="Scanning for modules..." />
              </Box>
            ) : modules.length === 0 ? (
              <Box paddingY={1}>
                <Text color={colors.textDim}>
                  No Maven modules found. Press Ctrl+R to rescan.
                </Text>
              </Box>
            ) : (
              <CheckboxList
                items={checkboxItems}
                selectedValues={selectedModules}
                onSelectionChange={setSelectedModules}
                isFocused={true}
                limit={10}
                showSelectAll={true}
              />
            )}
          </Box>
        </Box>

        {/* Build Action */}
        {selectedModules.length > 0 && (
          <Text color={colors.success}>
            {icons.play} {selectedModules.length} module(s) selected - Enter to build
          </Text>
        )}
      </ScreenContainer>

      <StatusBar
        shortcuts={shortcuts}
        pendingJobs={pendingJobs}
        runningJobs={runningJobs}
        mode={process.env['MOCK_MODE'] === 'true' ? 'MOCK' : undefined}
      />
    </Box>
  );
}

export default RepoDetailView;
