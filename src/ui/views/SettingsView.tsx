/**
 * SettingsView Component
 * 
 * UI for viewing and modifying application settings.
 * Features:
 * - Edit settings fields inline
 * - Save/Reset functionality
 * - Validation feedback
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

import {
  ScreenContainer,
  Badge,
  Header,
  StatusBar,
} from '../components/index.js';
import { colors, icons } from '../theme.js';
import {
  useAppStore,
  useSettings,
  type AppSettings,
} from '../../core/store/useAppStore.js';
import { getConfigService } from '../../core/services/ConfigService.js';
import type { Shortcut } from '../components/index.js';

// ============================================================================
// Types
// ============================================================================

interface SettingField {
  key: keyof AppSettings;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'path';
}

const SETTING_FIELDS: SettingField[] = [
  {
    key: 'scanRootPath',
    label: 'Scan Root Path',
    description: 'Root directory to scan for Maven projects',
    type: 'path',
  },
  {
    key: 'jdkScanPaths',
    label: 'JDK Scan Paths',
    description: 'Semicolon-separated paths to scan for JDKs',
    type: 'string',
  },
  {
    key: 'defaultJavaHome',
    label: 'Default JAVA_HOME',
    description: 'Default JDK path for builds (if auto-detect fails)',
    type: 'path',
  },
  {
    key: 'defaultMavenHome',
    label: 'Maven Home',
    description: 'Maven installation directory (e.g., C:\\apache-maven-3.9.6)',
    type: 'path',
  },
  {
    key: 'defaultMavenGoal',
    label: 'Default Maven Goal',
    description: 'Default goals to run (e.g., clean install)',
    type: 'string',
  },
  {
    key: 'maxParallelBuilds',
    label: 'Max Parallel Builds',
    description: 'Maximum concurrent builds (1-8)',
    type: 'number',
  },
  {
    key: 'skipTestsByDefault',
    label: 'Skip Tests by Default',
    description: 'Add -DskipTests to all builds',
    type: 'boolean',
  },
  {
    key: 'offlineMode',
    label: 'Offline Mode',
    description: 'Run Maven in offline mode (-o)',
    type: 'boolean',
  },
  {
    key: 'enableThreads',
    label: 'Enable Threads (-T)',
    description: 'Enable multi-threaded builds by default',
    type: 'boolean',
  },
  {
    key: 'threadCount',
    label: 'Thread Count',
    description: 'Thread count value (e.g., 1C = 1 per core, or 4)',
    type: 'string',
  },
];

// ============================================================================
// SettingsView Component
// ============================================================================

export interface SettingsViewProps {
  /** Callback when user wants to go back */
  onBack?: () => void;
}

/**
 * SettingsView - Settings management UI.
 */
export function SettingsView({ onBack }: SettingsViewProps): React.ReactElement {
  const settings = useSettings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const goBack = useAppStore((state) => state.goBack);
  const addNotification = useAppStore((state) => state.addNotification);
  
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const currentField = SETTING_FIELDS[highlightedIndex];
  
  // Get current value for the highlighted field
  const getCurrentValue = useCallback((key: keyof AppSettings): string => {
    const value = settings[key];
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }, [settings]);
  
  // Auto-save settings to disk
  const autoSave = useCallback(async () => {
    try {
      const configService = getConfigService();
      await configService.saveFromStore();
    } catch {
      // Silent fail for auto-save
    }
  }, []);
  
  // Enter edit mode
  const enterEditMode = useCallback(() => {
    if (!currentField) return;
    
    if (currentField.type === 'boolean') {
      // Toggle boolean directly
      const currentValue = settings[currentField.key] as boolean;
      updateSettings({ [currentField.key]: !currentValue });
      // Auto-save after toggle
      setTimeout(() => autoSave(), 100);
    } else {
      setEditValue(String(settings[currentField.key]));
      setEditMode(true);
    }
  }, [currentField, settings, updateSettings, autoSave]);
  
  // Save edited value
  const saveEditValue = useCallback(() => {
    if (!currentField) return;
    
    let parsedValue: string | number | boolean = editValue;
    
    if (currentField.type === 'number') {
      parsedValue = parseInt(editValue, 10);
      if (isNaN(parsedValue) || parsedValue < 1 || parsedValue > 8) {
        addNotification('error', 'Invalid number (must be 1-8)');
        return;
      }
    }
    
    updateSettings({ [currentField.key]: parsedValue });
    setEditMode(false);
    // Auto-save after edit
    setTimeout(() => autoSave(), 100);
  }, [currentField, editValue, updateSettings, addNotification, autoSave]);
  
  // Cancel edit mode
  const cancelEdit = useCallback(() => {
    setEditMode(false);
    setEditValue('');
  }, []);
  
  // Save all settings to disk
  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      const configService = getConfigService();
      const success = await configService.saveFromStore();
      
      if (success) {
        addNotification('success', 'Settings saved successfully');
        setHasChanges(false);
      } else {
        addNotification('error', 'Failed to save settings');
      }
    } catch (error) {
      addNotification('error', 'Error saving settings');
    } finally {
      setIsSaving(false);
    }
  }, [addNotification]);
  
  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const configService = getConfigService();
    const defaults = configService.getDefaults();
    updateSettings(defaults);
    setHasChanges(true);
    addNotification('info', 'Settings reset to defaults (not saved yet)');
  }, [updateSettings, addNotification]);
  
  // Handle keyboard input
  useInput((input, key) => {
    // In edit mode, handle text input
    if (editMode) {
      if (key.escape) {
        cancelEdit();
        return;
      }
      
      if (key.return) {
        saveEditValue();
        return;
      }
      
      if (key.backspace || key.delete) {
        setEditValue(prev => prev.slice(0, -1));
        return;
      }
      
      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        setEditValue(prev => prev + input);
      }
      return;
    }
    
    // Normal mode
    if (key.escape) {
      if (hasChanges) {
        // Could show confirmation dialog here
      }
      onBack?.() || goBack();
      return;
    }
    
    // Navigate up
    if (key.upArrow) {
      setHighlightedIndex(prev => Math.max(0, prev - 1));
      return;
    }
    
    // Navigate down
    if (key.downArrow) {
      setHighlightedIndex(prev => Math.min(SETTING_FIELDS.length - 1, prev + 1));
      return;
    }
    
    // Enter edit mode or toggle
    if (key.return || input === ' ') {
      enterEditMode();
      return;
    }
    
    // Save with Ctrl+S
    if (key.ctrl && input === 's') {
      saveSettings();
      return;
    }
    
    // Reset with 'r'
    if (input === 'r' || input === 'R') {
      resetToDefaults();
      return;
    }
  }, { isActive: true });
  
  // Shortcuts
  const shortcuts: Shortcut[] = editMode
    ? [
        { key: 'ESC', label: 'Cancel' },
        { key: 'Enter', label: 'Save' },
      ]
    : [
        { key: 'ESC', label: 'Back' },
        { key: '↑/↓', label: 'Navigate' },
        { key: 'Enter', label: 'Edit' },
        { key: 'Ctrl+S', label: 'Save to Disk' },
        { key: 'R', label: 'Reset' },
      ];
  
  return (
    <Box flexDirection="column" height="100%">
      <Header title="GFOS-Build" version="1.0.0" />
      
      <ScreenContainer
        title="Settings"
        subtitle={hasChanges ? 'Unsaved changes' : 'Configuration'}
        fillHeight
      >
        <Box flexDirection="column" paddingX={1}>
          {/* Config file path */}
          <Box marginBottom={1}>
            <Text color={colors.textDim}>
              Config: {getConfigService().getConfigPath()}
            </Text>
            {hasChanges && (
              <Text color={colors.warning}> (modified)</Text>
            )}
          </Box>
          
          {/* Settings list */}
          <Box flexDirection="column">
            {SETTING_FIELDS.map((field, index) => (
              <SettingRow
                key={field.key}
                field={field}
                value={getCurrentValue(field.key)}
                isHighlighted={index === highlightedIndex}
                isEditing={editMode && index === highlightedIndex}
                editValue={editValue}
              />
            ))}
          </Box>
          
          {/* Help text for current field */}
          {currentField && (
            <Box marginTop={1} paddingTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
              <Text color={colors.textDim} italic>
                {currentField.description}
              </Text>
            </Box>
          )}
          
          {/* Save status */}
          {isSaving && (
            <Box marginTop={1}>
              <Text color={colors.info}>Saving...</Text>
            </Box>
          )}
        </Box>
      </ScreenContainer>
      
      <StatusBar
        shortcuts={shortcuts}
        mode={process.env['MOCK_MODE'] === 'true' ? 'MOCK' : undefined}
      />
    </Box>
  );
}

// ============================================================================
// SettingRow Component
// ============================================================================

interface SettingRowProps {
  field: SettingField;
  value: string;
  isHighlighted: boolean;
  isEditing: boolean;
  editValue: string;
}

/**
 * Single setting row with label and value.
 */
function SettingRow({
  field,
  value,
  isHighlighted,
  isEditing,
  editValue,
}: SettingRowProps): React.ReactElement {
  return (
    <Box>
      {/* Pointer */}
      <Box width={2}>
        <Text color={isHighlighted ? colors.primary : undefined}>
          {isHighlighted ? icons.pointer : ' '}
        </Text>
      </Box>
      
      {/* Label */}
      <Box width={25}>
        <Text 
          color={isHighlighted ? colors.primaryBright : colors.text}
          bold={isHighlighted}
        >
          {field.label}
        </Text>
      </Box>
      
      {/* Value */}
      <Box flexGrow={1}>
        {isEditing ? (
          <Box>
            <Text color={colors.primary}>{editValue}</Text>
            <Text color={colors.textDim} dimColor>▌</Text>
          </Box>
        ) : (
          <Text color={
            field.type === 'boolean'
              ? (value === 'Yes' ? colors.success : colors.textDim)
              : (value || '(not set)' ? colors.text : colors.textDim)
          }>
            {value || '(not set)'}
          </Text>
        )}
      </Box>
      
      {/* Type indicator */}
      {field.type === 'boolean' && !isEditing && (
        <Badge variant={value === 'Yes' ? 'success' : 'default'}>
          {value === 'Yes' ? 'ON' : 'OFF'}
        </Badge>
      )}
    </Box>
  );
}

export default SettingsView;
