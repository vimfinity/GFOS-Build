import React, { useEffect, useState } from 'react';
import { render, Text, Box } from 'ink';
import App from './src/ui/App.js';

class ErrorCatcher extends React.Component<{children: React.ReactNode}, {error: Error | null, info: any}> {
  state = { error: null, info: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) {
    this.setState({ info });
    console.error('\n\n=== REACT ERROR ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0, 8).join('\n'));
    console.error('Component:', info?.componentStack?.split('\n').slice(0, 5).join('\n'));
  }
  render() {
    if (this.state.error) {
      return <Box flexDirection="column" padding={1}>
        <Text color="red" bold>React Error Caught!</Text>
        <Text color="yellow">{(this.state.error as Error).message}</Text>
      </Box>;
    }
    return this.props.children;
  }
}

process.env.MOCK_MODE = 'true';
console.log('Starting App test...');

try {
  const { unmount } = render(<ErrorCatcher><App /></ErrorCatcher>, { patchConsole: false });
  setTimeout(() => { 
    console.log('\nTest timeout - unmounting');
    unmount(); 
    process.exit(0); 
  }, 6000);
} catch (err: any) {
  console.error('Render failed:', err.message);
  process.exit(1);
}
