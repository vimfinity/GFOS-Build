#!/usr/bin/env bun
/**
 * Simple debug script that doesn't use ink rendering
 */
import * as fs from 'fs';

const log = (msg: string) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync('/tmp/gfos-debug.log', line);
  process.stderr.write(line);
};

// Clear log
fs.writeFileSync('/tmp/gfos-debug.log', '=== Debug Start ===\n');

log('Step 1: Testing imports...');

try {
  log('Importing theme...');
  const theme = await import('./src/ui/theme/index.js');
  log(`Theme loaded: PRIMARY_COLOR = ${theme.PRIMARY_COLOR}`);
  log(`Spinners available: ${Object.keys(theme.spinners).join(', ')}`);
  
  log('Importing hooks...');
  const hooks = await import('./src/ui/hooks/index.js');
  log('Hooks loaded OK');
  
  log('Importing primitives...');
  const primitives = await import('./src/ui/primitives/index.js');
  log('Primitives loaded OK');
  
  log('Importing views...');
  const views = await import('./src/ui/views/index.js');
  log('Views loaded OK');
  
  log('Importing App...');
  const { App } = await import('./src/ui/App.js');
  log('App loaded OK');
  
  log('All imports successful!');
  
  // Now try to render
  log('Importing React and Ink...');
  const React = await import('react');
  const { render } = await import('ink');
  
  log('Creating React element...');
  const element = React.createElement(App);
  log('Element created');
  
  log('About to render (this will open alternate buffer)...');
  
  // Short delay so we can see the logs
  await new Promise(r => setTimeout(r, 1000));
  
  const instance = render(element);
  log('Render called');
  
  // Exit after 3 seconds
  setTimeout(() => {
    log('Timeout - unmounting');
    instance.unmount();
    process.exit(0);
  }, 3000);
  
} catch (error: any) {
  log(`ERROR: ${error.name}: ${error.message}`);
  log(`Stack:\n${error.stack}`);
  process.exit(1);
}
