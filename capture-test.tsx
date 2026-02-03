#!/usr/bin/env bun
/**
 * Capture Ink output using inkRender's patchConsole option
 */
import React from 'react';
import { render } from 'ink';
import { App } from './src/ui/App.js';
import * as fs from 'fs';

const LOG = '/tmp/ink-output.log';
fs.writeFileSync(LOG, '=== Ink Output Capture ===\n');

const log = (msg: string) => {
  fs.appendFileSync(LOG, `${msg}\n`);
};

// Capture console
const origLog = console.log;
const origError = console.error;
const origWarn = console.warn;

console.log = (...args) => {
  log(`[LOG] ${args.join(' ')}`);
};
console.error = (...args) => {
  log(`[ERROR] ${args.join(' ')}`);
  origError.apply(console, args);
};
console.warn = (...args) => {
  log(`[WARN] ${args.join(' ')}`);
};

log('Starting render...');

// Capture errors
process.on('uncaughtException', (err) => {
  log(`[UNCAUGHT] ${err.name}: ${err.message}`);
  log(err.stack || '');
});

process.on('unhandledRejection', (reason: any) => {
  log(`[REJECTION] ${reason?.message || reason}`);
});

try {
  const instance = render(React.createElement(App), {
    patchConsole: false, // Don't let Ink patch console
  });
  
  log('Render returned');
  
  // Check for React errors periodically
  let tick = 0;
  const interval = setInterval(() => {
    tick++;
    log(`Tick ${tick}`);
    
    if (tick >= 10) {
      clearInterval(interval);
      log('Unmounting...');
      instance.unmount();
      
      // Print the log
      origLog('\n=== Captured Log ===');
      origLog(fs.readFileSync(LOG, 'utf-8'));
      process.exit(0);
    }
  }, 500);
  
} catch (err: any) {
  log(`[CATCH] ${err.name}: ${err.message}`);
  log(err.stack || '');
  origError(fs.readFileSync(LOG, 'utf-8'));
  process.exit(1);
}
