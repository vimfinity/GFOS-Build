/**
 * Settings View
 * 
 * Application configuration and preferences.
 */

import React, { useState, useCallback, memo } from 'react';
import { Box, Text } from 'ink';

import { theme, icons } from '../theme/index.js';
import { Divider } from '../primitives/index.js';
import { useNavigator, useKeyboard, type KeyEvent } from '../hooks/index.js';
import { useAppStore, useSettings, type AppSettings } from '../../core/store/useAppStore.js';
import { useNotifications } from '../system/notifications.js';

// ============================================================================
// Types
// ============================================================================

interface SettingDef {
  key: keyof AppSettings;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  icon: string;
}

// ============================================================================
// Settings Configuration
// ============================================================================

const SETTINGS: SettingDef[] = [
  {
    key: 'scanRootPath',
    label: 'Scan Root Path',
    description: 'Root directory to scan for Maven projects',
    type: 'string',
    icon: icons.folder,
  },
  {
    key: 'jdkScanPaths',
    label: 'JDK Scan Paths',
    description: 'Semicolon-separated paths to scan for JDKs',
    type: 'string',
    icon: icons.java,
  },
  {
    key: 'defaultMavenGoal',
    label: 'Default Maven Goal',
    description: 'Default goals for Maven builds (e.g., clean install)',
    type: 'string',
    icon: icons.module,
  },
  {
    key: 'defaultMavenHome',
    label: 'Maven Home',
    description: 'Path to Maven installation',
    type: 'string',
    icon: icons.folder,
  },
  {
    key: 'maxParallelBuilds',
    label: 'Max Parallel Builds',
    description: 'Maximum number of concurrent build jobs',
    type: 'number',
    icon: icons.jobs,
  },
  {
    key: 'skipTestsByDefault',
    label: 'Skip Tests by Default',
    description: 'Skip tests when running builds',
    type: 'boolean',
    icon: icons.running,
  },
  {
    key: 'offlineMode',
    label: 'Offline Mode',
    description: 'Run Maven in offline mode',
    type: 'boolean',
    icon: icons.info,
  },
  {
    key: 'enableThreads',
    label: 'Enable Threads',
    description: 'Enable Maven thread count option (-T)',
    type: 'boolean',
    icon: icons.running,
  },
  {
    key: 'threadCount',
    label: 'Thread Count',
    description: 'Thread count for Maven (e.g., 1C for one per core)',
    type: 'string',
    icon: icons.clock,
  },
];

// ============================================================================
// Sub-Components
// ============================================================================

interface SettingRowProps {
  setting: SettingDef;
  value: string | number | boolean;
  isSelected: boolean;
  isEditing: boolean;
  editValue: string;
}

const SettingRow = memo(function SettingRow({ 
  setting, 
  value, 
  isSelected,
  isEditing,
  editValue 
}: SettingRowProps): React.ReactElement {
  const displayValue = isEditing ? editValue : String(value);

  return (
    <Box flexDirection="column" paddingX={1} marginBottom={1}>
      <Box>
        <Text color={isSelected ? theme.accent.primary : theme.text.muted}>
          {isSelected ? icons.pointer : ' '} {setting.icon}
        </Text>
        <Text color={theme.text.primary} bold={isSelected}> {setting.label}</Text>
      </Box>
      <Box marginLeft={4}>
        <Text color={theme.text.muted}>{setting.description}</Text>
      </Box>
      <Box marginLeft={4}>
        <Text color={theme.text.muted}>Value: </Text>
        {isEditing ? (
          <Text color="cyan">{editValue}<Text color="yellow">│</Text></Text>
        ) : setting.type === 'boolean' ? (
          <Text color={value ? 'green' : 'red'}>{value ? 'Yes' : 'No'}</Text>
        ) : (
          <Text color={theme.text.primary}>{displayValue || '(empty)'}</Text>
        )}
      </Box>
    </Box>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export function SettingsView(): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const { goBack } = useNavigator();
  const settings = useSettings();
  const { success, info } = useNotifications();

  // Get stable action references
  const updateSettings = useCallback(
    (updates: Partial<typeof settings>) => useAppStore.getState().updateSettings(updates),
    []
  );
  const resetSettings = useCallback(
    () => useAppStore.getState().resetSettings(),
    []
  );

  const currentSetting = SETTINGS[selectedIndex];
  const currentValue = currentSetting ? settings[currentSetting.key] : '';

  const startEdit = useCallback(() => {
    if (!currentSetting) return;
    
    if (currentSetting.type === 'boolean') {
      // Toggle boolean directly
      const newValue = !settings[currentSetting.key];
      updateSettings({ [currentSetting.key]: newValue });
      success(`${currentSetting.label}: ${newValue ? 'Yes' : 'No'}`);
    } else {
      setEditValue(String(currentValue));
      setIsEditing(true);
    }
  }, [currentSetting, settings, currentValue, updateSettings, success]);

  const saveEdit = useCallback(() => {
    if (!currentSetting) return;
    
    let finalValue: string | number | boolean = editValue;
    
    if (currentSetting.type === 'number') {
      const num = parseInt(editValue, 10);
      if (isNaN(num)) {
        info('Invalid number, keeping previous value');
        setIsEditing(false);
        return;
      }
      finalValue = num;
    }
    
    updateSettings({ [currentSetting.key]: finalValue });
    success(`${currentSetting.label} updated`);
    setIsEditing(false);
  }, [currentSetting, editValue, updateSettings, success, info]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  useKeyboard(
    useCallback((e: KeyEvent) => {
      if (isEditing) {
        if (e.isEscape) { cancelEdit(); return true; }
        if (e.isEnter) { saveEdit(); return true; }
        if (e.isBackspace) {
          setEditValue((v) => v.slice(0, -1));
          return true;
        }
        if (e.key.length === 1 && !e.ctrl && !e.alt) {
          setEditValue((v) => v + e.key);
          return true;
        }
        return true; // Consume all input while editing
      }
      
      if (e.isEscape) { goBack(); return true; }
      if (e.isUp) { setSelectedIndex((i) => Math.max(0, i - 1)); return true; }
      if (e.isDown) { setSelectedIndex((i) => Math.min(SETTINGS.length - 1, i + 1)); return true; }
      if (e.isEnter || e.key === ' ') { startEdit(); return true; }
      if (e.key === 'r' && !e.ctrl) { 
        resetSettings();
        info('Settings reset to defaults');
        return true;
      }
      return false;
    }, [isEditing, goBack, startEdit, cancelEdit, saveEdit]),
    { priority: isEditing ? 10 : 5 }
  );

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={theme.accent.primary}>{icons.settings}</Text>
        <Text bold color={theme.text.primary}> Settings</Text>
      </Box>

      <Divider />

      {/* Settings List */}
      <Box marginTop={1} flexDirection="column" flexGrow={1}>
        {SETTINGS.map((setting, idx) => (
          <SettingRow
            key={setting.key}
            setting={setting}
            value={settings[setting.key]}
            isSelected={idx === selectedIndex}
            isEditing={isEditing && idx === selectedIndex}
            editValue={editValue}
          />
        ))}
      </Box>

      <Divider />

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color={theme.text.muted}>
          <Text color={theme.accent.primary}>↑↓</Text> Navigate  
          <Text color={theme.accent.primary}> ⏎/Space</Text> Edit
        </Text>
        <Text color={theme.text.muted}>
          <Text color={theme.accent.secondary}>r</Text> Reset  
          <Text color={theme.accent.secondary}> Esc</Text> Back
        </Text>
      </Box>
      
      {isEditing && (
        <Box marginTop={1}>
          <Text color="yellow">
            ✎ Editing: Type value, then press Enter to save or Esc to cancel
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default SettingsView;
