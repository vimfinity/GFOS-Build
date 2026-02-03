/**
 * Repository Detail View
 * 
 * Shows repository information, Maven modules, and allows starting builds.
 */

import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { matchSorter } from 'match-sorter';

import { theme, icons, palette } from '../theme/index.js';
import { Divider, EmptyState, TextInput, SearchInput, Spinner } from '../primitives/index.js';
import { useNavigator, useKeyboard, useSpinner, type KeyEvent } from '../hooks/index.js';
import { useAppStore, useProjects, useJdks, useActiveJobs, useJobHistory, useProjectModules, useSettings } from '../../core/store/useAppStore.js';
import { useNotifications } from '../system/notifications.js';
import type { JDK, BuildJob, SelectedModuleData } from '../../core/types/index.js';
import type { DiscoveredProject, MavenModule as ScannerModule } from '../../core/services/WorkspaceScanner.js';
import { getPipelineService, type PipelineDefinition, type PipelineStep } from '../../core/services/PipelineService.js';
import { WorkspaceScanner } from '../../core/services/WorkspaceScanner.js';
import { ServiceLocator } from '../../infrastructure/ServiceLocator.js';

// ============================================================================
// Types
// ============================================================================

export interface RepoDetailViewProps {
  repoPath: string;
}

type TabId = 'overview' | 'modules' | 'options' | 'builds';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

// Build options interface
interface BuildOptions {
  goals: string[];
  skipTests: boolean;
  offline: boolean;
  enableThreads: boolean;
  threads: string;
  profiles: string[];
  customArgs: string;
}

// Note: DEFAULT_BUILD_OPTIONS will be merged with user settings on component mount
const DEFAULT_BUILD_OPTIONS: BuildOptions = {
  goals: ['clean', 'install'],
  skipTests: false,
  offline: false,
  enableThreads: false,
  threads: '1C',
  profiles: [],
  customArgs: '',
};

// Available Maven goals
const COMMON_GOALS = [
  { id: 'clean', label: 'clean', description: 'Clean target directory' },
  { id: 'compile', label: 'compile', description: 'Compile source code' },
  { id: 'test', label: 'test', description: 'Run tests' },
  { id: 'package', label: 'package', description: 'Create JAR/WAR' },
  { id: 'install', label: 'install', description: 'Install to local repo' },
  { id: 'deploy', label: 'deploy', description: 'Deploy to remote repo' },
  { id: 'verify', label: 'verify', description: 'Run integration tests' },
];

// ============================================================================
// Constants
// ============================================================================

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: icons.info },
  { id: 'modules', label: 'Modules', icon: icons.module },
  { id: 'options', label: 'Options', icon: icons.build },
  { id: 'builds', label: 'Builds', icon: icons.clock },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatPath(path: string): string {
  if (path.length > 50) {
    const parts = path.split(/[\\/]/);
    if (parts.length > 3) {
      return `.../${parts.slice(-3).join('/')}`;
    }
  }
  return path;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ModuleRowProps {
  module: ScannerModule;
  isSelected: boolean;
  isChecked: boolean;
}

const ModuleRow = memo(function ModuleRow({ module, isSelected, isChecked }: ModuleRowProps): React.ReactElement {
  // Show directory name as primary identifier, with artifactId as secondary info
  const displayName = module.directoryName || module.artifactId;
  const showArtifactId = module.directoryName && module.directoryName !== module.artifactId;
  
  return (
    <Box paddingX={1}>
      <Text color={isSelected ? theme.accent.primary : theme.text.muted}>
        {isSelected ? icons.pointer : ' '} 
      </Text>
      <Text color={isChecked ? palette.green : theme.text.muted}>
        {isChecked ? icons.selected : icons.unselected} 
      </Text>
      <Text color={theme.text.primary} bold={isSelected}> {displayName}</Text>
      {showArtifactId && (
        <Text color={theme.text.muted} dimColor> [{module.artifactId}]</Text>
      )}
      <Text color={theme.text.muted}> ({module.packaging ?? 'jar'})</Text>
    </Box>
  );
});

// ============================================================================
// Tab Panels
// ============================================================================

interface OverviewTabProps {
  repo: DiscoveredProject;
}

function OverviewTab({ repo }: OverviewTabProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.text.muted}>Path: </Text>
        <Text color={theme.text.primary}>{formatPath(repo.path)}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={theme.text.muted}>Type: </Text>
        <Text color={palette.blue}>
          {repo.hasMaven ? 'Maven' : 'Project'}
          {repo.hasGit ? ' + Git' : ''}
        </Text>
      </Box>
    </Box>
  );
}

interface ModulesTabProps {
  modules: ScannerModule[];
  selectedIndex: number;
  selectedModules: Set<string>;
  isLoading?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearching: boolean;
  visibleHeight: number;
}

function ModulesTab({ 
  modules, 
  selectedIndex, 
  selectedModules, 
  isLoading,
  searchQuery,
  onSearchChange,
  isSearching,
  visibleHeight,
}: ModulesTabProps): React.ReactElement {
  // Calculate how many items we can display
  const maxVisibleItems = Math.max(5, visibleHeight - 6); // Reserve space for header/footer
  
  // Filter modules based on search
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return modules;
    return matchSorter(modules, searchQuery, {
      keys: ['directoryName', 'artifactId', 'groupId'],
      threshold: matchSorter.rankings.CONTAINS,
    });
  }, [modules, searchQuery]);
  
  // Virtual scrolling - calculate visible window
  const scrollOffset = useMemo(() => {
    const halfVisible = Math.floor(maxVisibleItems / 2);
    let offset = Math.max(0, selectedIndex - halfVisible);
    const maxOffset = Math.max(0, filteredModules.length - maxVisibleItems);
    return Math.min(offset, maxOffset);
  }, [selectedIndex, maxVisibleItems, filteredModules.length]);
  
  const visibleModules = useMemo(() => 
    filteredModules.slice(scrollOffset, scrollOffset + maxVisibleItems),
    [filteredModules, scrollOffset, maxVisibleItems]
  );

  if (isLoading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Spinner label="Loading modules..." />
        </Box>
      </Box>
    );
  }
  
  if (modules.length === 0) {
    return (
      <EmptyState
        icon={icons.module}
        title="No Modules Found"
        description="This repository has no Maven modules"
      />
    );
  }

  const showScrollIndicatorTop = scrollOffset > 0;
  const showScrollIndicatorBottom = scrollOffset + maxVisibleItems < filteredModules.length;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color={theme.text.muted}>{icons.search} </Text>
        {isSearching ? (
          <Box>
            <Text color={theme.accent.primary}>{searchQuery}</Text>
            <Text color={theme.text.muted}>_</Text>
          </Box>
        ) : searchQuery ? (
          <Text color={theme.text.secondary}>{searchQuery}</Text>
        ) : (
          <Text color={theme.text.muted}>Press / to search modules...</Text>
        )}
        {searchQuery && (
          <Text color={theme.text.muted}> ({filteredModules.length}/{modules.length})</Text>
        )}
      </Box>
      
      {/* Scroll indicator top */}
      {showScrollIndicatorTop && (
        <Box paddingX={1}>
          <Text color={theme.text.muted}>{icons.arrowUp} {scrollOffset} more above</Text>
        </Box>
      )}
      
      {/* Module list */}
      <Box flexDirection="column">
        {visibleModules.map((mod, idx) => {
          const actualIndex = scrollOffset + idx;
          return (
            <ModuleRow
              key={`${mod.pomPath}-${actualIndex}`}
              module={mod}
              isSelected={actualIndex === selectedIndex}
              isChecked={selectedModules.has(mod.artifactId)}
            />
          );
        })}
      </Box>
      
      {/* Scroll indicator bottom */}
      {showScrollIndicatorBottom && (
        <Box paddingX={1}>
          <Text color={theme.text.muted}>
            {icons.arrowDown} {filteredModules.length - scrollOffset - maxVisibleItems} more below
          </Text>
        </Box>
      )}
      
      {/* No results */}
      {filteredModules.length === 0 && searchQuery && (
        <Box paddingX={1}>
          <Text color={palette.yellow}>{icons.warning} No modules matching "{searchQuery}"</Text>
        </Box>
      )}
    </Box>
  );
}

interface BuildsTabProps {
  repoJobs: BuildJob[];
}

function BuildsTab({ repoJobs }: BuildsTabProps): React.ReactElement {
  if (repoJobs.length === 0) {
    return (
      <EmptyState
        icon={icons.clock}
        title="No Builds Yet"
        description="Start a build to see history"
      />
    );
  }

  return (
    <Box flexDirection="column">
      {repoJobs.slice(0, 10).map((job) => (
        <Box key={job.id} paddingX={1}>
          <Text color={job.status === 'success' ? palette.green : job.status === 'failed' ? palette.red : palette.blue}>
            {job.status === 'success' ? icons.success : job.status === 'failed' ? icons.error : icons.running}
          </Text>
          <Text color={theme.text.primary}> {job.name}</Text>
          <Text color={theme.text.muted}> - {job.status}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ============================================================================
// Options Tab
// ============================================================================

interface ProfileItem {
  id: string;
  name: string;
  isNegated: boolean;
}

// Thread count options for Maven -T flag
const THREAD_OPTIONS = ['1', '2', '4', '1C', '2C'];

interface OptionsTabProps {
  options: BuildOptions;
  availableProfiles: string[];
  onToggleGoal: (goal: string) => void;
  onToggleProfile: (profile: string) => void;
  onToggleSkipTests: () => void;
  onToggleOffline: () => void;
  onToggleEnableThreads: () => void;
  onChangeThreads: (threads: string) => void;
  selectedIndex: number;
}

function OptionsTab({ 
  options, 
  availableProfiles,
  onToggleGoal, 
  onToggleProfile,
  onToggleSkipTests, 
  onToggleOffline,
  onToggleEnableThreads,
  onChangeThreads,
  selectedIndex 
}: OptionsTabProps): React.ReactElement {
  // Calculate total item count: goals + profiles + 4 toggles (skipTests, offline, enableThreads, threadCount)
  const goalsCount = COMMON_GOALS.length;
  const profilesCount = availableProfiles.length;
  const togglesStartIndex = goalsCount + profilesCount;
  // Item indices: togglesStartIndex = skipTests, +1 = offline, +2 = enableThreads, +3 = threadCount (if enabled)
  const totalItemCount = togglesStartIndex + 3 + (options.enableThreads ? 1 : 0);
  
  // Parse current profile selections (some may be negated with !)
  const activeProfiles = new Set(options.profiles.filter(p => !p.startsWith('!')));
  const negatedProfiles = new Set(options.profiles.filter(p => p.startsWith('!')).map(p => p.slice(1)));
  
  // Get thread description
  const getThreadDescription = (value: string): string => {
    if (value.endsWith('C')) {
      const count = value.replace('C', '');
      return `${count} thread${count === '1' ? '' : 's'} per CPU core`;
    }
    return `${value} fixed thread${value === '1' ? '' : 's'}`;
  };
  
  return (
    <Box flexDirection="column">
      {/* Goals section */}
      <Box marginBottom={1}>
        <Text color={theme.accent.primary} bold>Maven Goals</Text>
        <Text color={palette.gray400}> (Space to toggle)</Text>
      </Box>
      
      {COMMON_GOALS.map((goal, idx) => {
        const isSelected = idx === selectedIndex;
        const isActive = options.goals.includes(goal.id);
        
        return (
          <Box key={goal.id} paddingX={1}>
            <Text color={isSelected ? theme.accent.primary : palette.gray500}>
              {isSelected ? icons.pointer : ' '}{' '}
            </Text>
            <Text color={isActive ? palette.green : palette.gray500}>
              {isActive ? icons.selected : icons.unselected}{' '}
            </Text>
            <Text color={theme.text.primary} bold={isSelected}>{goal.label}</Text>
            <Text color={palette.gray400}> - {goal.description}</Text>
          </Box>
        );
      })}
      
      {/* Profiles section */}
      {availableProfiles.length > 0 && (
        <>
          <Box marginTop={1} marginBottom={1}>
            <Text color={theme.accent.primary} bold>Maven Profiles</Text>
            <Text color={palette.gray400}> (Space: activate, ! : deactivate)</Text>
          </Box>
          
          {availableProfiles.map((profile, idx) => {
            const itemIndex = goalsCount + idx;
            const isSelected = itemIndex === selectedIndex;
            const isActive = activeProfiles.has(profile);
            const isNegated = negatedProfiles.has(profile);
            
            return (
              <Box key={profile} paddingX={1}>
                <Text color={isSelected ? theme.accent.primary : palette.gray500}>
                  {isSelected ? icons.pointer : ' '}{' '}
                </Text>
                <Text color={isNegated ? palette.red : isActive ? palette.green : palette.gray500}>
                  {isNegated ? '!' : isActive ? icons.selected : icons.unselected}{' '}
                </Text>
                <Text color={theme.text.primary} bold={isSelected}>{profile}</Text>
                {isNegated && <Text color={palette.red}> (deactivated)</Text>}
              </Box>
            );
          })}
        </>
      )}
      
      {/* Options section */}
      <Box marginTop={1} marginBottom={1}>
        <Text color={theme.accent.primary} bold>Build Options</Text>
      </Box>
      
      {/* Skip Tests */}
      <Box paddingX={1}>
        <Text color={selectedIndex === togglesStartIndex ? theme.accent.primary : palette.gray500}>
          {selectedIndex === togglesStartIndex ? icons.pointer : ' '}{' '}
        </Text>
        <Text color={options.skipTests ? palette.green : palette.gray500}>
          {options.skipTests ? icons.selected : icons.unselected}{' '}
        </Text>
        <Text color={theme.text.primary} bold={selectedIndex === togglesStartIndex}>Skip Tests</Text>
        <Text color={palette.gray400}> - -DskipTests</Text>
      </Box>
      
      {/* Offline Mode */}
      <Box paddingX={1}>
        <Text color={selectedIndex === togglesStartIndex + 1 ? theme.accent.primary : palette.gray500}>
          {selectedIndex === togglesStartIndex + 1 ? icons.pointer : ' '}{' '}
        </Text>
        <Text color={options.offline ? palette.green : palette.gray500}>
          {options.offline ? icons.selected : icons.unselected}{' '}
        </Text>
        <Text color={theme.text.primary} bold={selectedIndex === togglesStartIndex + 1}>Offline Mode</Text>
        <Text color={palette.gray400}> - No network access (-o)</Text>
      </Box>
      
      {/* Enable Parallel Threads */}
      <Box paddingX={1}>
        <Text color={selectedIndex === togglesStartIndex + 2 ? theme.accent.primary : palette.gray500}>
          {selectedIndex === togglesStartIndex + 2 ? icons.pointer : ' '}{' '}
        </Text>
        <Text color={options.enableThreads ? palette.green : palette.gray500}>
          {options.enableThreads ? icons.selected : icons.unselected}{' '}
        </Text>
        <Text color={theme.text.primary} bold={selectedIndex === togglesStartIndex + 2}>Maven Multi-Threading</Text>
        <Text color={palette.gray400}> - Build modules in parallel (-T)</Text>
      </Box>
      
      {/* Thread Count (only shown when threads enabled) */}
      {options.enableThreads && (
        <Box paddingX={1} marginLeft={2}>
          <Text color={selectedIndex === togglesStartIndex + 3 ? theme.accent.primary : palette.gray500}>
            {selectedIndex === togglesStartIndex + 3 ? icons.pointer : ' '}{' '}
          </Text>
          <Text color={palette.cyan}>{icons.pipeline}{' '}</Text>
          <Text color={theme.text.primary} bold={selectedIndex === togglesStartIndex + 3}>
            Thread Count: <Text color={palette.cyan}>-T {options.threads}</Text>
          </Text>
          <Text color={palette.gray400}> - {getThreadDescription(options.threads)}</Text>
          {selectedIndex === togglesStartIndex + 3 && (
            <Text color={palette.gray400}> (←/→ to change)</Text>
          )}
        </Box>
      )}
      
      {/* Current selection summary */}
      <Box marginTop={2} borderStyle="round" borderColor={palette.gray600} paddingX={1}>
        <Text color={palette.gray400}>Command: </Text>
        <Text color={palette.green}>mvn {options.goals.join(' ')}</Text>
        {options.profiles.length > 0 && (
          <Text color={palette.cyan}> -P {options.profiles.join(',')}</Text>
        )}
        {options.skipTests && <Text color={palette.yellow}> -DskipTests</Text>}
        {options.offline && <Text color={palette.yellow}> -o</Text>}
        {options.enableThreads && <Text color={palette.cyan}> -T {options.threads}</Text>}
      </Box>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RepoDetailView({ repoPath }: RepoDetailViewProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [moduleIndex, setModuleIndex] = useState(0);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [jdkIndex, setJdkIndex] = useState(0);
  const [selectedJdk, setSelectedJdk] = useState<string | null>(null);
  const [showSavePipeline, setShowSavePipeline] = useState(false);
  const [pipelineName, setPipelineName] = useState('');
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  
  // Module search state
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');
  const [isModuleSearching, setIsModuleSearching] = useState(false);
  
  // Build options state - will be initialized with settings in useEffect
  const [buildOptions, setBuildOptions] = useState<BuildOptions>(DEFAULT_BUILD_OPTIONS);
  const [optionsInitialized, setOptionsInitialized] = useState(false);
  const [optionsIndex, setOptionsIndex] = useState(0);
  
  // Get settings to initialize build options
  const settings = useSettings();
  
  // Get terminal dimensions for virtual scrolling
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  
  const spinnerFrames = useMemo(() => [...icons.spinner], []);
  const spinnerFrame = useSpinner(spinnerFrames);

  const { goBack, toJobs } = useNavigator();
  const repos = useProjects();
  const jdks = useJdks();
  const activeJobs = useActiveJobs();
  const jobHistory = useJobHistory();
  const { success, error } = useNotifications();

  // Combine active and history for this repo's builds
  const jobs = useMemo(() => [...activeJobs, ...jobHistory], [activeJobs, jobHistory]);

  // Get stable action references
  const addJob = useCallback(
    (job: Omit<import('../../core/types/index.js').BuildJob, 'id' | 'createdAt' | 'progress'>) => 
      useAppStore.getState().addJob(job),
    []
  );

  const loadModules = useCallback(
    (projectPath: string, modules: ScannerModule[]) =>
      useAppStore.getState().loadModules(projectPath, modules),
    []
  );
  
  // Build options handlers
  const toggleGoal = useCallback((goalId: string) => {
    setBuildOptions(prev => {
      const goals = prev.goals.includes(goalId)
        ? prev.goals.filter(g => g !== goalId)
        : [...prev.goals, goalId];
      return { ...prev, goals };
    });
  }, []);
  
  const toggleSkipTests = useCallback(() => {
    setBuildOptions(prev => ({ ...prev, skipTests: !prev.skipTests }));
  }, []);
  
  const toggleOffline = useCallback(() => {
    setBuildOptions(prev => ({ ...prev, offline: !prev.offline }));
  }, []);
  
  const toggleEnableThreads = useCallback(() => {
    setBuildOptions(prev => ({ ...prev, enableThreads: !prev.enableThreads }));
  }, []);
  
  const changeThreads = useCallback((threads: string) => {
    setBuildOptions(prev => ({ ...prev, threads }));
  }, []);
  
  // Toggle profile: cycles through off -> active -> negated -> off
  const toggleProfile = useCallback((profile: string) => {
    setBuildOptions(prev => {
      const hasProfile = prev.profiles.includes(profile);
      const hasNegated = prev.profiles.includes(`!${profile}`);
      
      let newProfiles: string[];
      if (!hasProfile && !hasNegated) {
        // Off -> Active
        newProfiles = [...prev.profiles, profile];
      } else if (hasProfile) {
        // Active -> Negated
        newProfiles = prev.profiles.filter(p => p !== profile);
        newProfiles.push(`!${profile}`);
      } else {
        // Negated -> Off
        newProfiles = prev.profiles.filter(p => p !== `!${profile}`);
      }
      
      return { ...prev, profiles: newProfiles };
    });
  }, []);
  
  // Initialize build options from settings (once)
  useEffect(() => {
    if (!optionsInitialized && settings) {
      // Parse default goals from settings
      const defaultGoals = settings.defaultMavenGoal
        ? settings.defaultMavenGoal.split(/\s+/).filter(g => g.length > 0)
        : ['clean', 'install'];
      
      setBuildOptions({
        goals: defaultGoals,
        skipTests: settings.skipTestsByDefault ?? false,
        offline: settings.offlineMode ?? false,
        enableThreads: settings.enableThreads ?? false,
        threads: settings.threadCount || '1C',
        profiles: [],
        customArgs: '',
      });
      setOptionsInitialized(true);
    }
  }, [settings, optionsInitialized]);

  // Find repository
  const repo = useMemo(() => repos.find((r) => r.path === repoPath), [repos, repoPath]);
  
  // Get modules for this project (may be empty initially)
  const modules = useProjectModules(repoPath);
  
  // Auto-load modules when viewing a repo that doesn't have modules loaded yet
  useEffect(() => {
    async function loadProjectModules() {
      if (repo && repo.hasMaven && modules.length === 0 && !isLoadingModules) {
        setIsLoadingModules(true);
        try {
          const fs = ServiceLocator.getFileSystem();
          const scanner = new WorkspaceScanner(fs);
          const foundModules = await scanner.findMavenModules(repoPath);
          loadModules(repoPath, foundModules);
        } catch (err) {
          console.error('Failed to load modules:', err);
        } finally {
          setIsLoadingModules(false);
        }
      }
    }
    loadProjectModules();
  }, [repo, repoPath, modules.length, isLoadingModules, loadModules]);
  
  // Filter jobs for this repo
  const repoJobs = useMemo(() => 
    jobs.filter((j) => j.projectPath === repoPath),
    [jobs, repoPath]
  );

  // Running builds for this repo
  const hasRunningBuild = useMemo(() => 
    repoJobs.some((j) => j.status === 'running'),
    [repoJobs]
  );

  // Module count for bounds checking
  const moduleCount = modules.length;
  
  // Extract available profiles from all modules
  const availableProfiles = useMemo(() => {
    const profileSet = new Set<string>();
    for (const mod of modules) {
      if (mod.profiles) {
        for (const profile of mod.profiles) {
          profileSet.add(profile);
        }
      }
    }
    return Array.from(profileSet).sort();
  }, [modules]);
  
  // Calculate options item count dynamically
  // Goals + profiles + skipTests + offline + enableThreads + (threadCount if enabled)
  const optionsItemCount = COMMON_GOALS.length + availableProfiles.length + 3 + (buildOptions.enableThreads ? 1 : 0);

  const toggleModule = useCallback((artifactId: string) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(artifactId)) {
        next.delete(artifactId);
      } else {
        next.add(artifactId);
      }
      return next;
    });
  }, []);

  const selectAllModules = useCallback(() => {
    setSelectedModules(new Set(modules.map((m) => m.artifactId)));
  }, [modules]);

  const clearModules = useCallback(() => {
    setSelectedModules(new Set());
  }, []);

  const startBuild = useCallback(() => {
    if (!repo || !selectedJdk) {
      error('Select a JDK to start build');
      return;
    }

    const jdk = jdks.find((j) => j.jdkHome === selectedJdk);
    if (!jdk) {
      error('JDK not found');
      return;
    }

    const modulesToBuild = selectedModules.size > 0 
      ? Array.from(selectedModules)
      : modules.map((m) => m.artifactId);

    const newJob: Omit<BuildJob, 'id' | 'createdAt' | 'progress'> = {
      name: `${repo.name}${modulesToBuild.length < modules.length ? ` (${modulesToBuild.length} modules)` : ''}`,
      projectPath: repo.path,
      jdkPath: selectedJdk,
      mavenGoals: buildOptions.goals.length > 0 ? buildOptions.goals : ['clean', 'install'],
      profiles: buildOptions.profiles.length > 0 ? buildOptions.profiles : undefined,
      skipTests: buildOptions.skipTests,
      offline: buildOptions.offline,
      enableThreads: buildOptions.enableThreads,
      threads: buildOptions.threads,
      status: 'pending',
    };

    addJob(newJob);
    success(`Build started: ${newJob.name}`);
    toJobs();
  }, [repo, selectedJdk, selectedModules, modules, jdks, buildOptions, addJob, success, error, toJobs]);

  // Save as Pipeline
  const savePipeline = useCallback(async () => {
    if (!repo || !selectedJdk || !pipelineName.trim()) {
      error('Please enter a pipeline name and select a JDK');
      return;
    }

    const jdk = jdks.find((j) => j.jdkHome === selectedJdk);
    if (!jdk) {
      error('JDK not found');
      return;
    }

    const modulesToSave: SelectedModuleData[] = selectedModules.size > 0
      ? modules
          .filter((m) => selectedModules.has(m.artifactId))
          .map((m) => ({
            artifactId: m.artifactId,
            pomPath: m.pomPath,
            projectPath: m.projectPath,
            relativePath: m.projectPath.replace(repo.path, '').replace(/^[\\/]+/, '') || '.',
          }))
      : modules.map((m) => ({
          artifactId: m.artifactId,
          pomPath: m.pomPath,
          projectPath: m.projectPath,
          relativePath: m.projectPath.replace(repo.path, '').replace(/^[\\/]+/, '') || '.',
        }));

    const step: PipelineStep = {
      id: crypto.randomUUID(),
      projectPath: repo.path,
      projectName: repo.name,
      jdkPath: selectedJdk,
      jdkVersion: jdk.version,
      selectedModules: modulesToSave,
      options: {
        goals: ['clean', 'install'],
        profiles: [],
        skipTests: false,
        offline: false,
        batchMode: true,
        threads: '1C',
        updateSnapshots: false,
        alsoMake: false,
        alsoMakeDependents: false,
        showErrors: true,
        customArgs: '',
        sequential: false,
      },
    };

    const pipeline: PipelineDefinition = {
      id: crypto.randomUUID(),
      name: pipelineName.trim(),
      createdAt: new Date().toISOString(),
      steps: [step],
    };

    try {
      const service = getPipelineService();
      await service.save(pipeline);
      useAppStore.getState().savePipeline(pipeline);
      success(`Pipeline "${pipelineName}" saved`);
      setShowSavePipeline(false);
      setPipelineName('');
    } catch (err) {
      error(`Failed to save pipeline: ${err}`);
    }
  }, [repo, selectedJdk, selectedModules, modules, jdks, pipelineName, success, error]);

  useKeyboard(
    useCallback((e: KeyEvent) => {
      // Handle pipeline name input mode
      if (showSavePipeline) {
        if (e.isEscape) {
          setShowSavePipeline(false);
          setPipelineName('');
          return true;
        }
        if (e.isEnter && pipelineName.trim()) {
          savePipeline();
          return true;
        }
        if (e.isBackspace) {
          setPipelineName((n) => n.slice(0, -1));
          return true;
        }
        if (e.key.length === 1 && e.key.charCodeAt(0) >= 32 && !e.ctrl && !e.alt) {
          setPipelineName((n) => n + e.key);
          return true;
        }
        return true; // Consume all input in this mode
      }
      
      // Handle module search input mode
      if (isModuleSearching) {
        if (e.isEscape) {
          setIsModuleSearching(false);
          if (!moduleSearchQuery) return true;
          return true;
        }
        if (e.isEnter) {
          setIsModuleSearching(false);
          return true;
        }
        if (e.isBackspace) {
          setModuleSearchQuery((q) => q.slice(0, -1));
          return true;
        }
        if (e.key.length === 1 && e.key.charCodeAt(0) >= 32 && !e.ctrl && !e.alt) {
          setModuleSearchQuery((q) => q + e.key);
          setModuleIndex(0); // Reset selection when searching
          return true;
        }
        return true;
      }
      
      if (e.isEscape) { 
        if (moduleSearchQuery) {
          setModuleSearchQuery('');
          setModuleIndex(0);
          return true;
        }
        goBack(); 
        return true; 
      }
      
      // Start module search with /
      if (e.key === '/' && activeTab === 'modules') {
        setIsModuleSearching(true);
        return true;
      }
      
      // Tab switching (only when not searching)
      if (e.isLeft || e.isRight) {
        const dir = e.isRight ? 1 : -1;
        const idx = TABS.findIndex((t) => t.id === activeTab);
        const nextTab = TABS[(idx + dir + TABS.length) % TABS.length];
        if (nextTab) {
          setActiveTab(nextTab.id);
          // Clear module search when switching tabs
          if (nextTab.id !== 'modules') {
            setModuleSearchQuery('');
            setModuleIndex(0);
          }
        }
        return true;
      }

      // Module tab navigation - use filtered modules for navigation bounds
      if (activeTab === 'modules') {
        // Get filtered module count for bounds
        const filteredCount = moduleSearchQuery 
          ? matchSorter(modules, moduleSearchQuery, {
              keys: ['directoryName', 'artifactId', 'groupId'],
              threshold: matchSorter.rankings.CONTAINS,
            }).length
          : moduleCount;
        
        if (filteredCount > 0) {
          if (e.isUp) { 
            setModuleIndex((i) => Math.max(0, i - 1)); 
            return true; 
          }
          if (e.isDown) { 
            setModuleIndex((i) => Math.min(filteredCount - 1, i + 1)); 
            return true; 
          }
          // Page up/down for faster navigation
          if (e.key === 'pageup' || (e.ctrl && e.key === 'u')) {
            setModuleIndex((i) => Math.max(0, i - 10));
            return true;
          }
          if (e.key === 'pagedown' || (e.ctrl && e.key === 'd')) {
            setModuleIndex((i) => Math.min(filteredCount - 1, i + 10));
            return true;
          }
          if (e.key === ' ') {
            // Toggle the filtered module at current index
            const filteredModules = moduleSearchQuery 
              ? matchSorter(modules, moduleSearchQuery, {
                  keys: ['directoryName', 'artifactId', 'groupId'],
                  threshold: matchSorter.rankings.CONTAINS,
                })
              : modules;
            const mod = filteredModules[moduleIndex];
            if (mod) toggleModule(mod.artifactId);
            return true;
          }
        }
        if (e.key === 'a' && !e.ctrl) { selectAllModules(); return true; }
        if (e.key === 'n' && !e.ctrl) { clearModules(); return true; }
      }
      
      // Options tab navigation
      if (activeTab === 'options') {
        const goalsCount = COMMON_GOALS.length;
        const profilesCount = availableProfiles.length;
        const togglesStart = goalsCount + profilesCount;
        const threadCountIndex = togglesStart + 3; // Index of thread count selector
        
        if (e.isUp) {
          setOptionsIndex((i) => Math.max(0, i - 1));
          return true;
        }
        if (e.isDown) {
          setOptionsIndex((i) => Math.min(optionsItemCount - 1, i + 1));
          return true;
        }
        
        // Handle left/right for thread count adjustment
        if (optionsIndex === threadCountIndex && buildOptions.enableThreads) {
          if (e.isLeft) {
            const currentIdx = THREAD_OPTIONS.indexOf(buildOptions.threads);
            if (currentIdx > 0) {
              changeThreads(THREAD_OPTIONS[currentIdx - 1] ?? '1C');
            }
            return true;
          }
          if (e.isRight) {
            const currentIdx = THREAD_OPTIONS.indexOf(buildOptions.threads);
            if (currentIdx < THREAD_OPTIONS.length - 1) {
              changeThreads(THREAD_OPTIONS[currentIdx + 1] ?? '2C');
            }
            return true;
          }
        }
        
        if (e.key === ' ') {
          // Toggle the selected option
          if (optionsIndex < goalsCount) {
            // Toggle a goal
            const goal = COMMON_GOALS[optionsIndex];
            if (goal) toggleGoal(goal.id);
          } else if (optionsIndex < togglesStart) {
            // Toggle a profile
            const profileIdx = optionsIndex - goalsCount;
            const profile = availableProfiles[profileIdx];
            if (profile) toggleProfile(profile);
          } else if (optionsIndex === togglesStart) {
            toggleSkipTests();
          } else if (optionsIndex === togglesStart + 1) {
            toggleOffline();
          } else if (optionsIndex === togglesStart + 2) {
            toggleEnableThreads();
            // Adjust index if we're hiding/showing thread count
            if (buildOptions.enableThreads && optionsIndex >= threadCountIndex) {
              setOptionsIndex((i) => Math.min(i, optionsItemCount - 2));
            }
          }
          return true;
        }
      }

      // JDK selection (always available in footer)
      if (e.key === 'j') {
        if (jdks.length > 0) {
          const nextIdx = (jdkIndex + 1) % jdks.length;
          setJdkIndex(nextIdx);
          setSelectedJdk(jdks[nextIdx]?.jdkHome ?? null);
        }
        return true;
      }

      // Save as Pipeline (p key)
      if (e.key === 'p' && !e.ctrl) {
        setPipelineName(repo?.name ?? '');
        setShowSavePipeline(true);
        return true;
      }

      // Start build
      if (e.isEnter || e.key === 'b') {
        if (!hasRunningBuild && !isModuleSearching) startBuild();
        return true;
      }

      return false;
    }, [showSavePipeline, pipelineName, savePipeline, goBack, activeTab, moduleCount, modules, moduleIndex, moduleSearchQuery, isModuleSearching, toggleModule, selectAllModules, clearModules, optionsIndex, optionsItemCount, availableProfiles, toggleGoal, toggleProfile, toggleSkipTests, toggleOffline, jdks, jdkIndex, hasRunningBuild, startBuild, repo?.name]),
    { priority: 5 }
  );

  // Auto-select first JDK
  useEffect(() => {
    if (jdks.length > 0 && !selectedJdk) {
      setSelectedJdk(jdks[0]?.jdkHome ?? null);
    }
  }, [jdks, selectedJdk]);

  // Repo not found
  if (!repo) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={palette.red}>{icons.error} Repository not found</Text>
        <Text color={theme.text.muted}>Press Esc to go back</Text>
      </Box>
    );
  }

  const selectedJdkInfo = jdks.find((j) => j.jdkHome === selectedJdk);

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={theme.accent.primary}>{icons.folder}</Text>
        <Text bold color={theme.text.primary}> {repo.name}</Text>
        {hasRunningBuild && (
          <>
            <Text color={palette.blue}> {spinnerFrame}</Text>
            <Text color={theme.text.muted}> Building...</Text>
          </>
        )}
      </Box>

      {/* Tabs */}
      <Box marginBottom={1}>
        {TABS.map((tab) => (
          <Box key={tab.id} marginRight={2}>
            <Text
              color={tab.id === activeTab ? theme.accent.primary : theme.text.muted}
              bold={tab.id === activeTab}
              underline={tab.id === activeTab}
            >
              {tab.icon} {tab.label}
            </Text>
          </Box>
        ))}
      </Box>

      <Divider />

      {/* Tab content */}
      <Box flexDirection="column" marginTop={1} flexGrow={1}>
        {activeTab === 'overview' && <OverviewTab repo={repo} />}
        {activeTab === 'modules' && (
          <ModulesTab
            modules={modules}
            selectedIndex={moduleIndex}
            selectedModules={selectedModules}
            isLoading={isLoadingModules}
            searchQuery={moduleSearchQuery}
            onSearchChange={setModuleSearchQuery}
            isSearching={isModuleSearching}
            visibleHeight={terminalHeight - 12}
          />
        )}
        {activeTab === 'options' && (
          <OptionsTab
            options={buildOptions}
            availableProfiles={availableProfiles}
            onToggleGoal={toggleGoal}
            onToggleProfile={toggleProfile}
            onToggleSkipTests={toggleSkipTests}
            onToggleOffline={toggleOffline}
            onToggleEnableThreads={toggleEnableThreads}
            onChangeThreads={changeThreads}
            selectedIndex={optionsIndex}
          />
        )}
        {activeTab === 'builds' && <BuildsTab repoJobs={repoJobs} />}
      </Box>

      <Divider />

      {/* JDK Selection - simplified display */}
      <Box marginTop={1} marginBottom={1}>
        <Text color={theme.accent.secondary}>{icons.java} </Text>
        {selectedJdkInfo ? (
          <>
            <Text color={palette.green}>JDK {selectedJdkInfo.version}</Text>
            {selectedJdkInfo.vendor && <Text color={theme.text.muted}> ({selectedJdkInfo.vendor})</Text>}
            {jdks.length > 1 && <Text color={theme.text.muted}> [{jdkIndex + 1}/{jdks.length}]</Text>}
          </>
        ) : (
          <Text color={palette.yellow}>No JDK selected</Text>
        )}
      </Box>

      {/* Module selection summary */}
      {selectedModules.size > 0 && (
        <Box marginBottom={1}>
          <Text color={theme.text.muted}>
            {icons.selected} {selectedModules.size} module{selectedModules.size > 1 ? 's' : ''} selected
          </Text>
        </Box>
      )}

      {/* Save Pipeline Input */}
      {showSavePipeline && (
        <Box marginBottom={1} flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.accent.primary}>{icons.pipeline} Save as Pipeline</Text>
          </Box>
          <Box>
            <Text color={theme.text.muted}>Name: </Text>
            <Text color={theme.text.primary}>{pipelineName}</Text>
            <Text color={theme.text.muted}>_</Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.text.muted}>
              <Text color={theme.accent.primary}>Enter</Text> Save  
              <Text color={theme.accent.primary}> Esc</Text> Cancel
            </Text>
          </Box>
        </Box>
      )}

      {/* Footer with shortcuts */}
      <Box justifyContent="space-between">
        <Text color={theme.text.muted}>
          <Text color={theme.accent.primary}>←→</Text> Tabs  
          {activeTab === 'modules' && (
            <>
              <Text color={theme.accent.primary}> /</Text> Search  
              <Text color={theme.accent.primary}> ↑↓</Text> Nav  
              <Text color={theme.accent.primary}> Space</Text> Toggle  
              <Text color={theme.accent.primary}> a</Text>/<Text color={theme.accent.primary}>n</Text> All/None
            </>
          )}
        </Text>
        <Text color={theme.text.muted}>
          {jdks.length > 1 && <><Text color={theme.accent.secondary}>j</Text> JDK  </>}
          <Text color={theme.accent.secondary}>p</Text> Pipeline  
          <Text color={hasRunningBuild ? theme.text.muted : palette.green}>b</Text> Build  
          <Text color={theme.accent.secondary}> Esc</Text> Back
        </Text>
      </Box>
    </Box>
  );
}

export default RepoDetailView;
