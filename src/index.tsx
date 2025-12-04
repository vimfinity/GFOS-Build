#!/usr/bin/env bun
/**
 * GFOS-Build
 * 
 * High-performance CLI tool for managing local Maven builds
 * across multiple JDK versions.
 * 
 * @author GFOS mbH
 * @version 1.0.0
 */

import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { processManager } from './core/services/ProcessManager.js';

// ============================================================================
// Version & Info
// ============================================================================

const VERSION = '1.0.0';
const APP_NAME = 'GFOS-Build';

// ============================================================================
// CLI Arguments
// ============================================================================

function parseArgs(): { help: boolean; version: boolean; mock: boolean } {
  const args = process.argv.slice(2);
  
  return {
    help: args.includes('--help') || args.includes('-h'),
    version: args.includes('--version') || args.includes('-v'),
    mock: args.includes('--mock') || process.env.MOCK_MODE === 'true',
  };
}

function printHelp(): void {
  console.log(`
${APP_NAME} v${VERSION}

USAGE:
  gfos-build [OPTIONS]

OPTIONS:
  -h, --help      Show this help message
  -v, --version   Show version information
  --mock          Run in mock mode (for development/testing)

DESCRIPTION:
  A high-performance CLI tool for managing local Maven builds
  across multiple JDK versions. Features include:
  
  • Smart repository discovery
  • Dynamic JAVA_HOME switching per build
  • Parallel build execution
  • Real-time build output streaming
  • Persistent configuration

KEYBOARD SHORTCUTS:
  ↑/↓             Navigate lists
  Enter           Select / Confirm
  ESC             Go back / Cancel
  Ctrl+C          Exit application
  Ctrl+S          Save settings (in Settings view)

ENVIRONMENT:
  MOCK_MODE=true  Enable mock mode for testing
  
For more information, visit: https://github.com/gfos/gfos-build
`);
}

function printVersion(): void {
  console.log(`${APP_NAME} v${VERSION}`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();
  
  // Handle --help
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  
  // Handle --version
  if (args.version) {
    printVersion();
    process.exit(0);
  }
  
  // Set mock mode if requested
  if (args.mock) {
    process.env.MOCK_MODE = 'true';
  }
  
  // Start the application
  try {
    // Clear screen and hide cursor for clean fullscreen experience
    process.stdout.write('\x1B[2J\x1B[0f');
    
    const { waitUntilExit } = render(<App />, {
      // Prevent Ink from wrapping, we handle sizing ourselves
      patchConsole: true,
    });
    
    // Wait for the app to exit
    await waitUntilExit();
    
    // Clear screen on exit
    process.stdout.write('\x1B[2J\x1B[0f');
    
    // Ensure all processes are cleaned up
    await processManager.killAll();
    
    process.exit(0);
  } catch (error) {
    console.error('[GFOS-Build] Fatal error:', error);
    await processManager.killAll();
    process.exit(1);
  }
}

// Run the application
main();
