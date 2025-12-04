/**
 * GFOS-Build - Main Entry Point
 * 
 * High-performance CLI tool for managing local Maven builds
 * across multiple JDK versions.
 */

import { getFileSystem, isMockMode, ServiceLocator } from './infrastructure';
import { WorkspaceScanner } from './core/services';
import { useAppStore } from './core/store';

async function main(): Promise<void> {
  console.log('🚀 GFOS-Build CLI');
  console.log('==================');
  console.log(`Mode: ${isMockMode() ? '🧪 MOCK' : '🔧 PRODUCTION'}`);
  console.log('');

  // Initialize services
  ServiceLocator.initialize();
  const fs = ServiceLocator.getFileSystem();
  const scanner = new WorkspaceScanner(fs);

  // Get store actions
  const { 
    loadProjects, 
    loadJdks, 
    loadModules, 
    setScanning,
    addJob,
    updateJobStatus,
    updateJobProgress,
    appendJobLog,
    setScreen,
    addNotification,
  } = useAppStore.getState();

  // Demo: Use WorkspaceScanner with Store
  if (isMockMode()) {
    console.log('📂 Scanning workspace and populating store...');
    console.log('');

    // Start scanning
    setScanning(true);

    // Find all Git repositories
    const repos = await scanner.findRepositories('C:\\dev\\quellen');
    loadProjects(repos);
    
    // Load mock JDKs
    const mockJdks = [
      { jdkHome: 'C:\\dev\\java\\jdk8', version: '1.8.0_452', majorVersion: 8 },
      { jdkHome: 'C:\\dev\\java\\jdk11', version: '11.0.27', majorVersion: 11 },
      { jdkHome: 'C:\\dev\\java\\jdk17', version: '17.0.15', majorVersion: 17 },
      { jdkHome: 'C:\\dev\\java\\jdk21', version: '21.0.7', majorVersion: 21 },
    ];
    loadJdks(mockJdks);

    // Load modules for a few projects
    for (const repo of repos.filter(r => r.hasMaven).slice(0, 3)) {
      const modules = await scanner.findMavenModules(repo.path);
      loadModules(repo.path, modules);
    }

    // Finish scanning
    setScanning(false);

    // Log store state
    const state = useAppStore.getState();
    
    console.log('📊 Store State Summary:');
    console.log('─'.repeat(50));
    console.log(`  📦 Projects loaded: ${state.scannedData.projects.length}`);
    console.log(`  ☕ JDKs available: ${state.scannedData.jdks.length}`);
    console.log(`  📋 Projects with modules: ${Object.keys(state.scannedData.modulesByProject).length}`);
    console.log(`  🖥️  Current screen: ${state.navigation.currentScreen}`);
    console.log('');

    // Demo navigation
    console.log('🧭 Navigation Demo:');
    console.log('─'.repeat(50));
    
    setScreen('REPO_LIST');
    console.log(`  → Navigate to: ${useAppStore.getState().navigation.currentScreen}`);
    
    setScreen('REPO_DETAIL', { projectPath: repos[0]?.path });
    console.log(`  → Navigate to: ${useAppStore.getState().navigation.currentScreen}`);
    console.log(`    Params: ${JSON.stringify(useAppStore.getState().navigation.params)}`);
    
    useAppStore.getState().goBack();
    console.log(`  ← Go back to: ${useAppStore.getState().navigation.currentScreen}`);
    
    useAppStore.getState().goBack();
    console.log(`  ← Go back to: ${useAppStore.getState().navigation.currentScreen}`);
    console.log('');

    // Demo job management
    console.log('🔨 Build Job Demo:');
    console.log('─'.repeat(50));
    
    // Add a job
    const jobId = addJob({
      projectPath: 'C:\\dev\\quellen\\2025\\gfosweb',
      name: 'gfosweb - clean install',
      jdkPath: 'C:\\dev\\java\\jdk21',
      mavenGoals: ['clean', 'install'],
      status: 'pending',
    });
    console.log(`  + Job created: ${jobId}`);
    console.log(`    Active jobs: ${useAppStore.getState().activeJobs.length}`);
    
    // Update status to running
    updateJobStatus(jobId, 'running');
    console.log(`  ▶ Job status: running`);
    
    // Simulate progress
    updateJobProgress(jobId, 25);
    appendJobLog(jobId, '[INFO] Scanning for projects...');
    appendJobLog(jobId, '[INFO] Building gfosweb...');
    updateJobProgress(jobId, 50);
    appendJobLog(jobId, '[INFO] Compiling sources...');
    updateJobProgress(jobId, 75);
    appendJobLog(jobId, '[INFO] Running tests...');
    
    const runningJob = useAppStore.getState().activeJobs.find(j => j.id === jobId);
    console.log(`    Progress: ${runningJob?.progress}%`);
    console.log(`    Logs: ${runningJob?.logs.length} entries`);
    
    // Complete the job
    updateJobStatus(jobId, 'success');
    console.log(`  ✅ Job completed!`);
    console.log(`    Active jobs: ${useAppStore.getState().activeJobs.length}`);
    console.log(`    Job history: ${useAppStore.getState().jobHistory.length}`);
    console.log('');

    // Demo notifications
    console.log('🔔 Notifications Demo:');
    console.log('─'.repeat(50));
    
    addNotification('info', 'Workspace scan completed');
    addNotification('success', 'Build completed successfully');
    addNotification('warning', 'JDK 8 is deprecated');
    
    const notifications = useAppStore.getState().notifications;
    for (const notif of notifications) {
      const icon = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' }[notif.type];
      console.log(`  ${icon} ${notif.message}`);
    }
    console.log('');

    // Show settings
    console.log('⚙️  Current Settings:');
    console.log('─'.repeat(50));
    const settings = useAppStore.getState().settings;
    console.log(`  Default Maven Goal: ${settings.defaultMavenGoal}`);
    console.log(`  Scan Root Path: ${settings.scanRootPath}`);
    console.log(`  Max Parallel Builds: ${settings.maxParallelBuilds}`);
    console.log(`  Skip Tests: ${settings.skipTestsByDefault}`);
    console.log('');

  } else {
    console.log('Running in production mode.');
    console.log('Use MOCK_MODE=true for development.');
  }
}

main().catch(console.error);
