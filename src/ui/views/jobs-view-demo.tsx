/**
 * JobsView Demo
 * 
 * Demonstrates the job queue UI with live updates from BuildRunner.
 */

import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import { JobsView } from './JobsView.js';
import { getBuildRunner } from '../../core/services/BuildRunner.js';
import { useAppStore } from '../../core/store/useAppStore.js';
import { Header } from '../components/index.js';
import { colors } from '../theme.js';

function JobsViewDemo(): React.ReactElement {
  const { exit } = useApp();
  const [buildsStarted, setBuildsStarted] = useState(false);
  
  // Start some builds when pressing 's'
  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }
    
    // Start builds with 's'
    if ((input === 's' || input === 'S') && !buildsStarted) {
      startDemoBuilds();
      setBuildsStarted(true);
    }
  });
  
  // Optionally auto-start builds
  useEffect(() => {
    // Start builds automatically after a short delay
    const timer = setTimeout(() => {
      if (!buildsStarted) {
        startDemoBuilds();
        setBuildsStarted(true);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [buildsStarted]);
  
  return (
    <JobsView onBack={() => exit()} />
  );
}

/**
 * Start multiple demo builds to showcase the queue.
 */
async function startDemoBuilds() {
  const runner = getBuildRunner();
  
  // Start first build
  runner.startBuild({
    projectPath: 'C:\\dev\\quellen\\2025\\gfoshg',
    name: 'gfoshg',
    goals: ['clean', 'install'],
    environment: {
      JAVA_HOME: 'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.2.13-hotspot',
    },
  });
  
  // Start second build with slight delay
  setTimeout(() => {
    runner.startBuild({
      projectPath: 'C:\\dev\\quellen\\2025\\gfosmm',
      name: 'gfosmm',
      goals: ['clean', 'package'],
      environment: {
        JAVA_HOME: 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.9.9-hotspot',
      },
      skipTests: true,
    });
  }, 1000);
  
  // Start third build
  setTimeout(() => {
    runner.startBuild({
      projectPath: 'C:\\dev\\quellen\\2024\\legacy-app',
      name: 'legacy-app',
      goals: ['compile'],
      environment: {
        JAVA_HOME: 'C:\\Program Files\\Eclipse Adoptium\\jdk-11.0.21.9-hotspot',
      },
    });
  }, 2000);
}

// Run the demo
render(<JobsViewDemo />);
