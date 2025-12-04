/**
 * RepoDetailView Demo
 * 
 * Interactive demonstration of the RepoDetailView component.
 * Run with: MOCK_MODE=true bun run src/ui/views/repo-detail-demo.tsx
 */

import React, { useEffect, useState, useRef } from 'react';
import { render, useApp, useInput, Box } from 'ink';
import { RepoDetailView } from './RepoDetailView.js';
import { Spinner } from '../components/index.js';
import { useAppStore, useSelectedProject } from '../../core/store/useAppStore.js';
import { WorkspaceScanner } from '../../core/services/WorkspaceScanner.js';
import { getFileSystem } from '../../infrastructure/ServiceLocator.js';

function App(): React.ReactElement {
  const { exit } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);
  const selectProject = useAppStore((state) => state.selectProject);
  const loadProjects = useAppStore((state) => state.loadProjects);
  const setScreen = useAppStore((state) => state.setScreen);
  const currentScreen = useAppStore((state) => state.navigation.currentScreen);
  const selectedProject = useSelectedProject();

  // Initialize with a mock project
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    async function init() {
      const fs = getFileSystem();
      const scanner = new WorkspaceScanner(fs);
      
      // Scan for projects
      const projects = await scanner.findRepositories('C:\\dev\\quellen');
      loadProjects(projects);
      
      // Select gfoshg (multi-module project) for demo
      const multiModuleProject = projects.find(p => p.name === 'gfoshg' && p.path.includes('2025'));
      if (multiModuleProject) {
        selectProject(multiModuleProject.path);
        // Set screen to REPO_DETAIL to simulate navigation from HomeView
        setScreen('REPO_DETAIL', { projectPath: multiModuleProject.path });
      }
      
      setIsLoading(false);
    }
    init();
  }, [loadProjects, selectProject, setScreen]);

  // Global exit handler
  useInput((input) => {
    if (input === 'x') {
      exit();
    }
  });

  // Handle navigation - only after loading
  useEffect(() => {
    if (isLoading) return;
    
    if (currentScreen === 'HOME') {
      console.log('\n[Demo] Navigated back to HOME - exiting demo');
      exit();
    }
    if (currentScreen === 'BUILD_QUEUE') {
      console.log('\n[Demo] Navigated to BUILD_QUEUE - exiting demo');
      exit();
    }
  }, [currentScreen, exit, isLoading]);

  // Show loading while initializing
  if (isLoading || !selectedProject) {
    return (
      <Box flexDirection="column" padding={2}>
        <Spinner message="Loading project..." />
      </Box>
    );
  }

  return <RepoDetailView />;
}

// Run the demo
render(<App />);
