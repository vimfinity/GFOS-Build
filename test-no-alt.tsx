#!/usr/bin/env bun
/**
 * Test app without alternate screen to see errors
 */
import React from 'react';
import { render, Box, Text } from 'ink';
import { App } from './src/ui/App.js';

// Don't use alternate screen
process.env.FORCE_COLOR = '1';

console.log('Starting test...');

// Create a wrapped app that catches errors
function TestWrapper() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      console.error('Window error:', e.error);
      setError(e.error);
    };
    
    // Can't use window in Node, but we set up React error boundary
  }, []);

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error.message}</Text>
        <Text color="gray">{error.stack}</Text>
      </Box>
    );
  }

  return <App />;
}

try {
  const instance = render(<TestWrapper />, {
    // Don't enter alternate screen
  });
  
  console.log('Render called, waiting 5 seconds...');
  
  setTimeout(() => {
    console.log('Unmounting...');
    instance.unmount();
    process.exit(0);
  }, 5000);
  
} catch (err: any) {
  console.error('Catch error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
