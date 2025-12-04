/**
 * RepoListView Demo
 * 
 * Interactive demonstration of the RepoListView component.
 * Run with: MOCK_MODE=true bun run src/ui/views/home-demo.tsx
 */

import React from 'react';
import { render, useApp, useInput } from 'ink';
import { RepoListView } from './RepoListView.js';

function App(): React.ReactElement {
  const { exit } = useApp();
  
  // Global exit handler
  useInput((input) => {
    if (input === 'x') {
      exit();
    }
  });

  return <RepoListView />;
}

// Run the demo
render(<App />);
