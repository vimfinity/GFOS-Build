#!/usr/bin/env bun
/**
 * GFOS-Build
 * 
 * High-performance CLI tool for managing local Maven builds
 * across multiple JDK versions.
 * 
 * @author GFOS mbH
 * @version 2.0.0
 */

import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { processManager } from './core/services/ProcessManager.js';

// ============================================================================
// Version & Info
// ============================================================================

const VERSION = '2.0.0';
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
  
  // Debug mode - skip alternate screen for error visibility
  const debugMode = process.env.DEBUG === 'true';
  
  // Start the application
  try {
    if (!debugMode) {
      // Enter alternate screen buffer for clean fullscreen experience
      process.stdout.write('\x1B[?1049h'); // Enter alternate screen
      process.stdout.write('\x1B[?25l');   // Hide cursor
      process.stdout.write('\x1B[2J\x1B[0f'); // Clear screen
    }
    
    const { waitUntilExit } = render(<App />, {
      // Prevent Ink from wrapping, we handle sizing ourselves
      patchConsole: !debugMode,
    });
    
    // Wait for the app to exit
    await waitUntilExit();
    
    if (!debugMode) {
      // Exit alternate screen buffer
      process.stdout.write('\x1B[?25h');   // Show cursor
      process.stdout.write('\x1B[?1049l'); // Exit alternate screen
    }
    
    // Ensure all processes are cleaned up
    await processManager.killAll();
    
    process.exit(0);
  } catch (error) {
    if (!debugMode) {
      // Restore terminal state on error
      process.stdout.write('\x1B[?25h');   // Show cursor
      process.stdout.write('\x1B[?1049l'); // Exit alternate screen
    }
    
    console.error('[GFOS-Build] Fatal error:', error);
    await processManager.killAll();
    process.exit(1);
  }
}

// Run the application
main();
