#!/usr/bin/env bun
/**
 * Test runner with file-based logging for debugging crashes
 */
import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = '/tmp/gfos-crash.log';

// Initialize log
fs.writeFileSync(LOG_FILE, `=== GFOS-Build Crash Debug ===\n${new Date().toISOString()}\n\n`);

const log = (msg: string) => {
  const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
};

// Capture all errors
process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.name}: ${err.message}`);
  log(`Stack: ${err.stack}`);
  fs.appendFileSync(LOG_FILE, '\n=== CRASH ===\n');
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  log(`UNHANDLED REJECTION: ${reason?.message || reason}`);
  if (reason?.stack) log(`Stack: ${reason.stack}`);
});

// Patch React's console.error to capture React errors
const origError = console.error;
console.error = (...args: any[]) => {
  const msg = args.map(a => 
    typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
  ).join(' ');
  log(`CONSOLE.ERROR: ${msg}`);
  origError.apply(console, args);
};

log('Starting app...');

async function main() {
  try {
    log('Importing React...');
    const React = await import('react');
    log('React OK');
    
    log('Importing Ink...');
    const { render } = await import('ink');
    log('Ink OK');
    
    log('Importing App...');
    const { App } = await import('./src/ui/App.js');
    log('App imported');
    
    log('Creating element...');
    const element = React.createElement(App);
    log('Element created');
    
    log('Calling render()...');
    const instance = render(element);
    log('render() returned');
    
    // Exit after timeout
    setTimeout(() => {
      log('Timeout reached, unmounting...');
      instance.unmount();
      log('Unmounted');
      
      // Show log contents
      console.log('\n=== Debug Log ===');
      console.log(fs.readFileSync(LOG_FILE, 'utf-8'));
      process.exit(0);
    }, 5000);
    
  } catch (err: any) {
    log(`STARTUP ERROR: ${err.name}: ${err.message}`);
    log(`Stack: ${err.stack}`);
    console.log(fs.readFileSync(LOG_FILE, 'utf-8'));
    process.exit(1);
  }
}

main();
