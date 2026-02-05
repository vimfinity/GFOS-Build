import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../../src/renderer/store/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store to a clean state (preserving structure but clearing data)
    useAppStore.setState({
      activeView: 'overview',
      previousView: null,
      theme: 'system',
      resolvedTheme: 'light',
      projects: [],
      selectedProject: null,
      jdks: [],
      buildJobs: [],
      selectedJobId: null,
      jobLogs: {},
      pipelines: [],
      selectedPipelineId: null,
      settings: {
        mavenPath: '',
        defaultGoals: 'clean install',
        parallelBuilds: 1,
        autoScan: false,
        scanPaths: [],
        setupComplete: false,
      },
      searchQuery: '',
      isSearchOpen: false,
      searchResults: [],
      isShortcutsHelpOpen: false,
      isLoading: false,
      notifications: [],
    });
  });

  describe('navigation', () => {
    it('should change active view', () => {
      const { setActiveView } = useAppStore.getState();

      setActiveView('projects');

      const { activeView, previousView } = useAppStore.getState();
      expect(activeView).toBe('projects');
      expect(previousView).toBe('overview');
    });

    it('should go back to previous view', () => {
      const { setActiveView, goBack } = useAppStore.getState();

      setActiveView('projects');
      setActiveView('builds');

      goBack();

      const { activeView } = useAppStore.getState();
      expect(activeView).toBe('projects');
    });

    it('should go to overview when no previous view exists', () => {
      const { goBack } = useAppStore.getState();

      goBack();

      const { activeView } = useAppStore.getState();
      expect(activeView).toBe('overview');
    });
  });

  describe('projects', () => {
    it('should add a project', () => {
      const { addProject } = useAppStore.getState();

      addProject({
        id: 'p1',
        name: 'test-project',
        path: '/test/project',
        branch: 'main',
        jdk: 'JDK 21',
      });

      const { projects } = useAppStore.getState();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('test-project');
    });

    it('should update a project', () => {
      const { addProject, updateProject } = useAppStore.getState();

      addProject({
        id: 'p1',
        name: 'test-project',
        path: '/test/project',
        branch: 'main',
        jdk: 'JDK 21',
      });

      updateProject('p1', { branch: 'develop' });

      const { projects } = useAppStore.getState();
      expect(projects[0].branch).toBe('develop');
    });

    it('should remove a project', () => {
      const { addProject, removeProject } = useAppStore.getState();

      addProject({
        id: 'p1',
        name: 'test-project',
        path: '/test/project',
        branch: 'main',
        jdk: 'JDK 21',
      });

      removeProject('p1');

      const { projects } = useAppStore.getState();
      expect(projects).toHaveLength(0);
    });
  });

  describe('jdks', () => {
    it('should add a JDK', () => {
      const { addJdk } = useAppStore.getState();

      addJdk({
        id: 'jdk1',
        version: '21.0.2',
        vendor: 'Eclipse Temurin',
        path: '/java/jdk21',
      });

      const { jdks } = useAppStore.getState();
      expect(jdks).toHaveLength(1);
      expect(jdks[0].version).toBe('21.0.2');
    });

    it('should remove a JDK', () => {
      const { addJdk, removeJdk } = useAppStore.getState();

      addJdk({
        id: 'jdk1',
        version: '21.0.2',
        vendor: 'Eclipse Temurin',
        path: '/java/jdk21',
      });

      removeJdk('jdk1');

      const { jdks } = useAppStore.getState();
      expect(jdks).toHaveLength(0);
    });

    it('should set default JDK', () => {
      const { addJdk, setDefaultJdk } = useAppStore.getState();

      addJdk({ id: 'jdk1', version: '21', vendor: 'Test', path: '/jdk21' });
      addJdk({ id: 'jdk2', version: '17', vendor: 'Test', path: '/jdk17' });

      setDefaultJdk('jdk2');

      const { jdks } = useAppStore.getState();
      expect(jdks.find(j => j.id === 'jdk2')?.isDefault).toBe(true);
      expect(jdks.find(j => j.id === 'jdk1')?.isDefault).toBeFalsy();
    });
  });

  describe('build jobs', () => {
    it('should add a build job', () => {
      const { addBuildJob } = useAppStore.getState();

      addBuildJob({
        id: 'job1',
        projectId: 'p1',
        projectName: 'test',
        status: 'pending',
        progress: 0,
        startTime: 'now',
        jdk: 'JDK 21',
        goals: 'clean install',
      });

      const { buildJobs } = useAppStore.getState();
      expect(buildJobs).toHaveLength(1);
      expect(buildJobs[0].projectName).toBe('test');
    });

    it('should update a build job', () => {
      const { addBuildJob, updateBuildJob } = useAppStore.getState();

      addBuildJob({
        id: 'job1',
        projectId: 'p1',
        projectName: 'test',
        status: 'pending',
        progress: 0,
        startTime: 'now',
        jdk: 'JDK 21',
        goals: 'clean install',
      });

      updateBuildJob('job1', { status: 'running', progress: 50 });

      const { buildJobs } = useAppStore.getState();
      expect(buildJobs[0].status).toBe('running');
      expect(buildJobs[0].progress).toBe(50);
    });

    it('should cancel a build job', () => {
      const { addBuildJob, cancelBuildJob } = useAppStore.getState();

      addBuildJob({
        id: 'job1',
        projectId: 'p1',
        projectName: 'test',
        status: 'running',
        progress: 50,
        startTime: 'now',
        jdk: 'JDK 21',
        goals: 'clean install',
      });

      cancelBuildJob('job1');

      const { buildJobs } = useAppStore.getState();
      expect(buildJobs[0].status).toBe('cancelled');
    });

    it('should clear completed jobs', () => {
      const { addBuildJob, clearCompletedJobs } = useAppStore.getState();

      addBuildJob({
        id: 'job1',
        projectId: 'p1',
        projectName: 'test1',
        status: 'success',
        progress: 100,
        startTime: 'now',
        jdk: 'JDK 21',
        goals: 'clean install',
      });
      addBuildJob({
        id: 'job2',
        projectId: 'p2',
        projectName: 'test2',
        status: 'running',
        progress: 50,
        startTime: 'now',
        jdk: 'JDK 21',
        goals: 'clean install',
      });

      clearCompletedJobs();

      const { buildJobs } = useAppStore.getState();
      expect(buildJobs).toHaveLength(1);
      expect(buildJobs[0].id).toBe('job2');
    });
  });

  describe('pipelines', () => {
    it('should add a pipeline', () => {
      const { addPipeline } = useAppStore.getState();

      const id = addPipeline('Full Build', 'p1', [
        { id: 's1', name: 'Clean Install', goals: ['clean', 'install'] },
      ]);

      expect(id).toBeTruthy();

      const { pipelines } = useAppStore.getState();
      expect(pipelines).toHaveLength(1);
      expect(pipelines[0].name).toBe('Full Build');
    });

    it('should update a pipeline', () => {
      const { addPipeline, updatePipeline } = useAppStore.getState();

      const id = addPipeline('Old Name', 'p1', []);

      updatePipeline(id, { name: 'New Name' });

      const { pipelines } = useAppStore.getState();
      expect(pipelines[0].name).toBe('New Name');
    });

    it('should remove a pipeline', () => {
      const { addPipeline, removePipeline } = useAppStore.getState();

      const id = addPipeline('Test', 'p1', []);

      removePipeline(id);

      const { pipelines } = useAppStore.getState();
      expect(pipelines).toHaveLength(0);
    });
  });

  describe('settings', () => {
    it('should update settings partially', () => {
      const { updateSettings } = useAppStore.getState();

      updateSettings({ parallelBuilds: 4, autoScan: true });

      const { settings } = useAppStore.getState();
      expect(settings.parallelBuilds).toBe(4);
      expect(settings.autoScan).toBe(true);
      expect(settings.defaultGoals).toBe('clean install'); // unchanged
    });
  });

  describe('notifications', () => {
    it('should add a notification', () => {
      const { addNotification } = useAppStore.getState();

      addNotification('success', 'Build completed');

      const { notifications } = useAppStore.getState();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('success');
      expect(notifications[0].message).toBe('Build completed');
    });

    it('should remove a notification', () => {
      const { addNotification } = useAppStore.getState();

      addNotification('info', 'Test');
      
      const { notifications: after } = useAppStore.getState();
      const id = after[0].id;

      const { removeNotification } = useAppStore.getState();
      removeNotification(id);

      const { notifications } = useAppStore.getState();
      expect(notifications).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('should open and close search', () => {
      const { setIsSearchOpen } = useAppStore.getState();

      setIsSearchOpen(true);
      expect(useAppStore.getState().isSearchOpen).toBe(true);

      setIsSearchOpen(false);
      expect(useAppStore.getState().isSearchOpen).toBe(false);
    });

    it('should set search query', () => {
      const { setSearchQuery } = useAppStore.getState();

      setSearchQuery('test query');

      expect(useAppStore.getState().searchQuery).toBe('test query');
    });
  });

  describe('theme', () => {
    it('should set theme', () => {
      const { setTheme } = useAppStore.getState();

      setTheme('dark');

      expect(useAppStore.getState().theme).toBe('dark');
    });

    it('should set resolved theme', () => {
      const { setResolvedTheme } = useAppStore.getState();

      setResolvedTheme('dark');

      expect(useAppStore.getState().resolvedTheme).toBe('dark');
    });
  });
});
