/**
 * BuildConfigView Component
 * 
 * Screen for configuring build options before starting.
 * 
 * Layout Strategy:
 * - 4 sections: Goals, Profiles, Options, Custom
 * - ONLY the active section shows its items
 * - Inactive sections show a single-line summary
 * - Tab switches between sections
 * - Arrow keys navigate within active section
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

import {
  ScreenContainer,
  Header,
  StatusBar,
} from '../components/index.js';
import { useTerminalSize } from '../components/ScreenContainer.js';
import type { Shortcut } from '../components/index.js';
import { colors, icons } from '../theme.js';
import {
  useAppStore,
  useSettings,
} from '../../core/store/useAppStore.js';

// ============================================================================
// Types
// ============================================================================

export interface BuildOptions {
  goals: string[];
  profiles: string[];
  skipTests: boolean;
  offline: boolean;
  batchMode: boolean;
  threads: string;
  updateSnapshots: boolean;
  alsoMake: boolean;
  alsoMakeDependents: boolean;
  showErrors: boolean;
  customArgs: string;
  sequential: boolean;
}

export interface BuildConfigViewProps {
  projectPath: string;
  projectName: string;
  selectedModules: Array<{ artifactId: string; pomPath: string; relativePath?: string }>;
  availableProfiles?: string[];
  jdkPath: string;
  jdkVersion: string;
  onConfirm: (options: BuildOptions) => void;
  onBack?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MAVEN_GOALS = ['clean', 'compile', 'test', 'package', 'install', 'deploy'];
type Section = 'goals' | 'profiles' | 'options' | 'custom';

// ============================================================================
// Component
// ============================================================================

export function BuildConfigView({
  projectName,
  selectedModules,
  availableProfiles = [],
  jdkVersion,
  onConfirm,
  onBack,
}: BuildConfigViewProps): React.ReactElement {
  const settings = useSettings();
  const goBack = useAppStore((state) => state.goBack);
  const { height: terminalHeight } = useTerminalSize();
  
  // Default goals from settings
  const defaultGoals = useMemo(() => 
    settings.defaultMavenGoal.split(' ').filter(g => g.trim()),
    [settings.defaultMavenGoal]
  );
  
  // ============================================================================
  // State
  // ============================================================================
  
  const [selectedGoals, setSelectedGoals] = useState<string[]>(defaultGoals);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [skipTests, setSkipTests] = useState(settings.skipTestsByDefault);
  const [offline, setOffline] = useState(settings.offlineMode);
  const [batchMode, setBatchMode] = useState(false);
  const [threads, setThreads] = useState(settings.enableThreads ? settings.threadCount : '');
  const [sequential, setSequential] = useState(true);
  const [updateSnapshots, setUpdateSnapshots] = useState(false);
  const [alsoMake, setAlsoMake] = useState(false);
  const [alsoMakeDependents, setAlsoMakeDependents] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [customArgs, setCustomArgs] = useState('');
  
  const [activeSection, setActiveSection] = useState<Section>('goals');
  const [focusIndex, setFocusIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  
  // ============================================================================
  // Computed Values
  // ============================================================================
  
  const hasProfiles = availableProfiles.length > 0;
  const showSequentialOption = selectedModules.length > 1;
  
  const availableSections = useMemo<Section[]>(() => {
    const sections: Section[] = ['goals'];
    if (hasProfiles) sections.push('profiles');
    sections.push('options', 'custom');
    return sections;
  }, [hasProfiles]);
  
  // Calculate max visible items - leave room for other UI elements
  const maxVisibleItems = useMemo(() => {
    // Header(2) + Title(2) + 3 collapsed sections(3) + Preview(2) + Modules(1) + Hint(1) + StatusBar(2) = 13
    const reserved = 15;
    return Math.max(3, Math.min(10, terminalHeight - reserved));
  }, [terminalHeight]);
  
  // Get items count for active section
  const getItemCount = useCallback((section: Section): number => {
    switch (section) {
      case 'goals': return MAVEN_GOALS.length;
      case 'profiles': return availableProfiles.length;
      case 'options': return showSequentialOption ? 9 : 8;
      case 'custom': return 1;
    }
  }, [availableProfiles.length, showSequentialOption]);
  
  // ============================================================================
  // Effects
  // ============================================================================
  
  // Reset focus when section changes
  useEffect(() => {
    setFocusIndex(0);
    setScrollOffset(0);
  }, [activeSection]);
  
  // Update scroll when focus changes
  useEffect(() => {
    if (focusIndex < scrollOffset) {
      setScrollOffset(focusIndex);
    } else if (focusIndex >= scrollOffset + maxVisibleItems) {
      setScrollOffset(focusIndex - maxVisibleItems + 1);
    }
  }, [focusIndex, scrollOffset, maxVisibleItems]);
  
  // ============================================================================
  // Actions
  // ============================================================================
  
  const toggleGoal = useCallback((goal: string) => {
    setSelectedGoals(prev => 
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    );
  }, []);
  
  const cycleProfile = useCallback((profile: string) => {
    setSelectedProfiles(prev => {
      const hasActivated = prev.includes(profile);
      const hasDeactivated = prev.includes(`!${profile}`);
      const cleaned = prev.filter(p => p !== profile && p !== `!${profile}`);
      
      if (!hasActivated && !hasDeactivated) return [...cleaned, profile];
      if (hasActivated) return [...cleaned, `!${profile}`];
      return cleaned;
    });
  }, []);
  
  const getProfileState = useCallback((profile: string): 'none' | 'activated' | 'deactivated' => {
    if (selectedProfiles.includes(profile)) return 'activated';
    if (selectedProfiles.includes(`!${profile}`)) return 'deactivated';
    return 'none';
  }, [selectedProfiles]);
  
  const handleConfirm = useCallback(() => {
    if (selectedGoals.length === 0) return;
    onConfirm({
      goals: selectedGoals,
      profiles: selectedProfiles,
      skipTests, offline, batchMode, threads,
      updateSnapshots, alsoMake, alsoMakeDependents, showErrors,
      customArgs, sequential,
    });
  }, [selectedGoals, selectedProfiles, skipTests, offline, batchMode, threads, 
      updateSnapshots, alsoMake, alsoMakeDependents, showErrors, customArgs, sequential, onConfirm]);
  
  // ============================================================================
  // Keyboard Handler
  // ============================================================================
  
  useInput((input, key) => {
    if (key.escape) {
      if (isEditingCustom) {
        setIsEditingCustom(false);
      } else {
        onBack?.() || goBack();
      }
      return;
    }
    
    if (isEditingCustom) {
      if (key.return) {
        setIsEditingCustom(false);
      } else if (key.backspace || key.delete) {
        setCustomArgs(prev => prev.slice(0, -1));
      } else if (input && input.length === 1 && input.charCodeAt(0) >= 32) {
        setCustomArgs(prev => prev + input);
      }
      return;
    }
    
    if (key.tab) {
      const idx = availableSections.indexOf(activeSection);
      const nextIdx = key.shift 
        ? (idx - 1 + availableSections.length) % availableSections.length
        : (idx + 1) % availableSections.length;
      const next = availableSections[nextIdx];
      if (next) setActiveSection(next);
      return;
    }
    
    if (key.upArrow) {
      setFocusIndex(prev => Math.max(0, prev - 1));
      return;
    }
    
    if (key.downArrow) {
      const max = getItemCount(activeSection) - 1;
      setFocusIndex(prev => Math.min(max, prev + 1));
      return;
    }
    
    if (input === ' ') {
      switch (activeSection) {
        case 'goals':
          const goal = MAVEN_GOALS[focusIndex];
          if (goal) toggleGoal(goal);
          break;
        case 'profiles':
          const profile = availableProfiles[focusIndex];
          if (profile) cycleProfile(profile);
          break;
        case 'options':
          switch (focusIndex) {
            case 0: setSkipTests(p => !p); break;
            case 1: setOffline(p => !p); break;
            case 2: setBatchMode(p => !p); break;
            case 3: setThreads(p => p === '' ? '1C' : p === '1C' ? '2C' : p === '2C' ? '4' : ''); break;
            case 4: setUpdateSnapshots(p => !p); break;
            case 5: setAlsoMake(p => !p); break;
            case 6: setAlsoMakeDependents(p => !p); break;
            case 7: setShowErrors(p => !p); break;
            case 8: if (showSequentialOption) setSequential(p => !p); break;
          }
          break;
        case 'custom':
          setIsEditingCustom(true);
          break;
      }
      return;
    }
    
    if (key.return) {
      if (activeSection === 'custom') {
        setIsEditingCustom(true);
      } else {
        handleConfirm();
      }
    }
  }, { isActive: true });
  
  // ============================================================================
  // Summaries for collapsed sections
  // ============================================================================
  
  const goalsSummary = selectedGoals.length > 0 ? selectedGoals.join(' ') : '(none)';
  
  const profilesSummary = selectedProfiles.length > 0 
    ? selectedProfiles.slice(0, 2).join(', ') + (selectedProfiles.length > 2 ? '...' : '')
    : '(none)';
  
  const optionsSummary = [
    skipTests && '-DskipTests',
    threads && `-T${threads}`,
    offline && '-o',
  ].filter(Boolean).slice(0, 3).join(' ') || '(defaults)';
  
  const customSummary = customArgs || '(none)';
  
  // Command preview
  const commandPreview = useMemo(() => {
    const parts = ['mvn', ...selectedGoals];
    if (selectedProfiles.length > 0) parts.push(`-P ${selectedProfiles.join(',')}`);
    if (skipTests) parts.push('-DskipTests');
    if (offline) parts.push('-o');
    if (batchMode) parts.push('-B');
    if (threads) parts.push(`-T ${threads}`);
    if (updateSnapshots) parts.push('-U');
    if (alsoMake) parts.push('-am');
    if (alsoMakeDependents) parts.push('-amd');
    if (showErrors) parts.push('-e');
    if (customArgs.trim()) parts.push(customArgs.trim());
    return parts.join(' ');
  }, [selectedGoals, selectedProfiles, skipTests, offline, batchMode, threads, 
      updateSnapshots, alsoMake, alsoMakeDependents, showErrors, customArgs]);
  
  // Shortcuts
  const shortcuts: Shortcut[] = isEditingCustom
    ? [{ key: 'ESC', label: 'Done' }]
    : [
        { key: 'Tab', label: 'Section' },
        { key: '↑↓', label: 'Nav' },
        { key: 'Space', label: 'Toggle' },
        { key: '⏎', label: 'Build' },
      ];
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <Box flexDirection="column" height="100%">
      <Header title="GFOS-Build" version="1.0.0" />
      
      <ScreenContainer
        title="Build Config"
        subtitle={`${projectName} • ${selectedModules.length} mod • JDK ${jdkVersion}`}
        fillHeight
      >
        <Box flexDirection="column" flexGrow={1}>
          
          {/* === GOALS SECTION === */}
          {activeSection === 'goals' ? (
            <Box flexDirection="column">
              <Text bold color={colors.primary}>
                {icons.pointer} Goals ({focusIndex + 1}/{MAVEN_GOALS.length})
                {scrollOffset > 0 && <Text color={colors.textDim}> ↑</Text>}
                {scrollOffset + maxVisibleItems < MAVEN_GOALS.length && <Text color={colors.textDim}> ↓</Text>}
              </Text>
              {MAVEN_GOALS.slice(scrollOffset, scrollOffset + maxVisibleItems).map((goal, i) => {
                const idx = scrollOffset + i;
                const selected = selectedGoals.includes(goal);
                const focused = focusIndex === idx;
                return (
                  <Text key={goal} color={focused ? colors.primary : colors.text}>
                    {'  '}{focused ? '›' : ' '} {selected ? '■' : '□'} {goal}
                  </Text>
                );
              })}
            </Box>
          ) : (
            <Text color={colors.textDim}>  Goals: <Text color={colors.info}>{goalsSummary}</Text></Text>
          )}
          
          {/* === PROFILES SECTION === */}
          {hasProfiles && (
            activeSection === 'profiles' ? (
              <Box flexDirection="column">
                <Text bold color={colors.primary}>
                  {icons.pointer} Profiles ({focusIndex + 1}/{availableProfiles.length})
                  {scrollOffset > 0 && <Text color={colors.textDim}> ↑</Text>}
                  {scrollOffset + maxVisibleItems < availableProfiles.length && <Text color={colors.textDim}> ↓</Text>}
                </Text>
                {availableProfiles.slice(scrollOffset, scrollOffset + maxVisibleItems).map((profile, i) => {
                  const idx = scrollOffset + i;
                  const state = getProfileState(profile);
                  const focused = focusIndex === idx;
                  const icon = state === 'activated' ? '◉' : state === 'deactivated' ? '⊘' : '○';
                  const col = state === 'activated' ? colors.success : state === 'deactivated' ? colors.error : colors.textDim;
                  return (
                    <Text key={profile} color={focused ? colors.primary : colors.text}>
                      {'  '}{focused ? '›' : ' '} <Text color={col}>{icon}</Text> {profile}
                    </Text>
                  );
                })}
              </Box>
            ) : (
              <Text color={colors.textDim}>  Profiles: <Text color={colors.info}>{profilesSummary}</Text></Text>
            )
          )}
          
          {/* === OPTIONS SECTION === */}
          {activeSection === 'options' ? (
            <Box flexDirection="column">
              <Text bold color={colors.primary}>
                {icons.pointer} Options ({focusIndex + 1}/{showSequentialOption ? 9 : 8})
                {scrollOffset > 0 && <Text color={colors.textDim}> ↑</Text>}
                {scrollOffset + maxVisibleItems < (showSequentialOption ? 9 : 8) && <Text color={colors.textDim}> ↓</Text>}
              </Text>
              {(() => {
                const options = [
                  { label: 'Skip Tests', value: skipTests, hint: '-DskipTests' },
                  { label: 'Offline', value: offline, hint: '-o' },
                  { label: 'Batch Mode', value: batchMode, hint: '-B' },
                  { label: 'Threads', value: !!threads, hint: `-T ${threads || 'off'}` },
                  { label: 'Update Snapshots', value: updateSnapshots, hint: '-U' },
                  { label: 'Also Make Deps', value: alsoMake, hint: '-am' },
                  { label: 'Also Make Dependents', value: alsoMakeDependents, hint: '-amd' },
                  { label: 'Show Errors', value: showErrors, hint: '-e' },
                ];
                if (showSequentialOption) {
                  options.push({ label: 'Sequential', value: sequential, hint: '' });
                }
                return options.slice(scrollOffset, scrollOffset + maxVisibleItems).map((opt, i) => {
                  const idx = scrollOffset + i;
                  const focused = focusIndex === idx;
                  return (
                    <Text key={opt.label} color={focused ? colors.primary : colors.text}>
                      {'  '}{focused ? '›' : ' '} {opt.value ? '■' : '□'} {opt.label}
                      {opt.hint && <Text color={colors.textDim}> ({opt.hint})</Text>}
                    </Text>
                  );
                });
              })()}
            </Box>
          ) : (
            <Text color={colors.textDim}>  Options: <Text color={colors.info}>{optionsSummary}</Text></Text>
          )}
          
          {/* === CUSTOM SECTION === */}
          {activeSection === 'custom' ? (
            <Box flexDirection="column">
              <Text bold color={colors.primary}>{icons.pointer} Custom Args</Text>
              <Text color={colors.primary}>
                {'  '}› {isEditingCustom ? (
                  <Text>{customArgs}<Text color={colors.textDim}>_</Text></Text>
                ) : (
                  <Text>{customArgs || '(Space to edit)'}</Text>
                )}
              </Text>
            </Box>
          ) : (
            <Text color={colors.textDim}>  Custom: <Text color={colors.info}>{customSummary}</Text></Text>
          )}
          
          {/* Spacer */}
          <Box flexGrow={1} />
          
          {/* Command Preview */}
          <Box borderStyle="single" borderColor={colors.border} paddingX={1}>
            <Text color={colors.primaryBright} wrap="truncate">{commandPreview}</Text>
          </Box>
          
          {/* Modules */}
          <Text color={colors.textDim}>
            Modules: <Text color={colors.info}>
              {selectedModules.slice(0, 2).map(m => m.artifactId).join(', ')}
              {selectedModules.length > 2 && ` +${selectedModules.length - 2}`}
            </Text>
          </Text>
          
          {/* Build Hint */}
          <Box justifyContent="center">
            <Text color={selectedGoals.length > 0 ? colors.success : colors.warning}>
              {selectedGoals.length > 0 ? '✓ Press Enter to build' : '⚠ Select at least one goal'}
            </Text>
          </Box>
          
        </Box>
      </ScreenContainer>
      
      <StatusBar shortcuts={shortcuts} />
    </Box>
  );
}

export default BuildConfigView;
