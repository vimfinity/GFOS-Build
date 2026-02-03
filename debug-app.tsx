#!/usr/bin/env bun
/**
 * Debug wrapper to capture errors
 */

import * as fs from 'fs';

const LOG_FILE = '/tmp/gfos-debug.log';

// Clear log file
fs.writeFileSync(LOG_FILE, `=== GFOS-Build Debug Log ===\nStarted: ${new Date().toISOString()}\n\n`);

function log(message: string) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

// Override console methods to capture output
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
};

console.log = (...args: any[]) => {
  log(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')}`);
};

console.error = (...args: any[]) => {
  log(`[ERROR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')}`);
};

console.warn = (...args: any[]) => {
  log(`[WARN] ${args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')}`);
};

// Global error handlers
process.on('uncaughtException', (error) => {
  log(`[UNCAUGHT EXCEPTION] ${error.name}: ${error.message}`);
  log(`Stack: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`[UNHANDLED REJECTION] ${reason}`);
});

log('Starting import of main app...');

try {
  log('Importing React...');
  const React = await import('react');
  log('React imported successfully');

  log('Importing Ink...');
  const { render } = await import('ink');
  log('Ink imported successfully');

  log('Importing App component...');
  const { App } = await import('./src/ui/App.js');
  log('App imported successfully');

  log('Rendering app...');
  
  // Wrap in error boundary at render level
  const instance = render(React.createElement(App));
  
  log('App rendered successfully');

  // Keep process alive
  process.on('SIGINT', () => {
    log('Received SIGINT, cleaning up...');
    instance.unmount();
    process.exit(0);
  });

} catch (error: any) {
  log(`[STARTUP ERROR] ${error.name}: ${error.message}`);
  log(`Stack: ${error.stack}`);
  process.exit(1);
}
