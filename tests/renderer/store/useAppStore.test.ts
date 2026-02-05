import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../../src/renderer/store/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useAppStore.setState({
      jobs: [],
      jobLogs: {},
      projects: [],
      jdks: [],
      pipelines: [],
      modulesByProject: {},
      profilesByProject: {},
      navigation: {
        currentScreen: 'HOME',
        history: [],
        params: {},
      },
      isScanning: false,
      scanStatus: null,
      selectedProjectPath: null,
      selectedJobId: null,
      selectedPipelineId: null,
    });
  });

  describe('jobs', () => {
    it('should add a job with generated ID', () => {
      const { addJob } = useAppStore.getState();

      const jobId = addJob({
        projectPath: '/test/project',
        name: 'Test Build',
        jdkPath: '/java/17',
        mavenGoals: ['clean', 'install'],
      });

      expect(jobId).toMatch(/^job-\d+-/);

      const { jobs } = useAppStore.getState();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].name).toBe('Test Build');
      expect(jobs[0].status).toBe('pending');
      expect(jobs[0].progress).toBe(0);
    });

    it('should update a job', () => {
      const { addJob, updateJob } = useAppStore.getState();

      const jobId = addJob({
        projectPath: '/test',
        name: 'Test',
        jdkPath: '/java',
        mavenGoals: ['install'],
      });

      updateJob(jobId, { status: 'running', progress: 50 });

      const { jobs } = useAppStore.getState();
      expect(jobs[0].status).toBe('running');
      expect(jobs[0].progress).toBe(50);
    });

    it('should remove a job and its logs', () => {
      const { addJob, appendJobLog, removeJob } = useAppStore.getState();

      const jobId = addJob({
        projectPath: '/test',
        name: 'Test',
        jdkPath: '/java',
        mavenGoals: ['install'],
      });

      appendJobLog(jobId, 'line 1');
      appendJobLog(jobId, 'line 2');

      removeJob(jobId);

      const { jobs, jobLogs } = useAppStore.getState();
      expect(jobs).toHaveLength(0);
      expect(jobLogs[jobId]).toBeUndefined();
    });

    it('should append job logs', () => {
      const { addJob, appendJobLog } = useAppStore.getState();

      const jobId = addJob({
        projectPath: '/test',
        name: 'Test',
        jdkPath: '/java',
        mavenGoals: ['install'],
      });

      appendJobLog(jobId, '[INFO] Building...');
      appendJobLog(jobId, '[INFO] BUILD SUCCESS');

      const { jobLogs } = useAppStore.getState();
      expect(jobLogs[jobId]).toHaveLength(2);
      expect(jobLogs[jobId][1]).toBe('[INFO] BUILD SUCCESS');
    });
  });

  describe('navigation', () => {
    it('should navigate between screens with history', () => {
      const { setScreen, goBack } = useAppStore.getState();

      setScreen('PROJECTS');
      setScreen('PROJECT_DETAIL', { projectPath: '/test' });

      let { navigation } = useAppStore.getState();
      expect(navigation.currentScreen).toBe('PROJECT_DETAIL');
      expect(navigation.history).toContain('PROJECTS');
      expect(navigation.params).toEqual({ projectPath: '/test' });

      goBack();

      ({ navigation } = useAppStore.getState());
      expect(navigation.currentScreen).toBe('PROJECTS');
    });

    it('should go back to HOME when history is empty', () => {
      const { goBack } = useAppStore.getState();

      goBack();

      const { navigation } = useAppStore.getState();
      expect(navigation.currentScreen).toBe('HOME');
    });
  });

  describe('pipelines', () => {
    it('should add a pipeline', () => {
      const { addPipeline } = useAppStore.getState();

      const id = addPipeline({
        name: 'Full Build',
        projectPath: '/test',
        steps: [
          { name: 'Clean Install', goals: ['clean', 'install'] },
        ],
      });

      expect(id).toMatch(/^pipeline-\d+-/);

      const { pipelines } = useAppStore.getState();
      expect(pipelines).toHaveLength(1);
      expect(pipelines[0].name).toBe('Full Build');
    });

    it('should update a pipeline', () => {
      const { addPipeline, updatePipeline } = useAppStore.getState();

      const id = addPipeline({
        name: 'Old Name',
        projectPath: '/test',
        steps: [],
      });

      updatePipeline(id, { name: 'New Name' });

      const { pipelines } = useAppStore.getState();
      expect(pipelines[0].name).toBe('New Name');
    });

    it('should remove a pipeline', () => {
      const { addPipeline, removePipeline } = useAppStore.getState();

      const id = addPipeline({
        name: 'Test',
        projectPath: '/test',
        steps: [],
      });

      removePipeline(id);

      const { pipelines } = useAppStore.getState();
      expect(pipelines).toHaveLength(0);
    });
  });

  describe('settings', () => {
    it('should set settings and mark as loaded', () => {
      const { setSettings } = useAppStore.getState();

      setSettings({
        scanRootPath: '/projects',
        jdkScanPaths: '/java',
        defaultMavenHome: '/maven',
        defaultMavenGoal: 'clean install',
        maxParallelBuilds: 4,
        skipTestsByDefault: true,
        offlineMode: false,
        enableThreads: true,
        threadCount: '2C',
        setupComplete: true,
      });

      const { settings, settingsLoaded } = useAppStore.getState();
      expect(settingsLoaded).toBe(true);
      expect(settings.maxParallelBuilds).toBe(4);
      expect(settings.skipTestsByDefault).toBe(true);
    });

    it('should partially update settings', () => {
      const { setSettings, updateSettings } = useAppStore.getState();

      setSettings({
        scanRootPath: '/old',
        jdkScanPaths: '/java',
        defaultMavenHome: '/maven',
        defaultMavenGoal: 'clean install',
        maxParallelBuilds: 2,
        skipTestsByDefault: false,
        offlineMode: false,
        enableThreads: false,
        threadCount: '1C',
      });

      updateSettings({ scanRootPath: '/new', maxParallelBuilds: 8 });

      const { settings } = useAppStore.getState();
      expect(settings.scanRootPath).toBe('/new');
      expect(settings.maxParallelBuilds).toBe(8);
      expect(settings.defaultMavenGoal).toBe('clean install');
    });
  });

  describe('data', () => {
    it('should set projects', () => {
      const { setProjects } = useAppStore.getState();

      setProjects([
        {
          path: '/test',
          name: 'test-project',
          isGitRepo: true,
          hasPom: true,
        },
      ]);

      const { projects } = useAppStore.getState();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('test-project');
    });

    it('should set modules per project', () => {
      const { setModules } = useAppStore.getState();

      setModules('/test', [
        {
          artifactId: 'core',
          groupId: 'com.test',
          pomPath: '/test/pom.xml',
          packaging: 'jar',
          relativePath: '.',
          displayName: 'core',
          depth: 0,
        },
      ]);

      const { modulesByProject } = useAppStore.getState();
      expect(modulesByProject['/test']).toHaveLength(1);
    });
  });
});
