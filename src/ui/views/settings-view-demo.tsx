/**
 * SettingsView Demo
 * 
 * Demonstrates the settings configuration UI.
 */

import React, { useEffect } from 'react';
import { render, useApp } from 'ink';
import { SettingsView } from './SettingsView.js';
import { getConfigService } from '../../core/services/ConfigService.js';

function SettingsViewDemo(): React.ReactElement {
  const { exit } = useApp();
  
  // Load config into store on mount
  useEffect(() => {
    const loadConfig = async () => {
      const configService = getConfigService();
      await configService.loadIntoStore();
    };
    loadConfig();
  }, []);
  
  return (
    <SettingsView onBack={() => exit()} />
  );
}

// Run the demo
render(<SettingsViewDemo />);
