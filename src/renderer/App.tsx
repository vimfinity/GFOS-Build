/**
 * GFOS Build - Main Application
 */

import { useEffect } from 'react';
import Layout from './components/Layout';
import OverviewView from './views/OverviewView';
import ProjectsView from './views/ProjectsView';
import BuildsView from './views/BuildsView';
import JdksView from './views/JdksView';
import SettingsView from './views/SettingsView';
import PipelinesView from './views/PipelinesView';
import PipelineEditorView from './views/PipelineEditorView';
import SetupWizardView from './views/SetupWizardView';
import JobLogView from './views/JobLogView';
import SearchModal from './components/SearchModal';
import ShortcutsHelpOverlay from './components/ShortcutsHelpOverlay';
import { useAppStore } from './store/useAppStore';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './Dashboard.css';

function App() {
  const activeView = useAppStore((state) => state.activeView);
  const settings = useAppStore((state) => state.settings);
  
  // Initialize theme
  useTheme();
  
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Redirect to setup wizard if not completed
  useEffect(() => {
    if (!settings.setupComplete) {
      useAppStore.getState().setActiveView('setup-wizard');
    }
  }, [settings.setupComplete]);

  const renderView = () => {
    switch (activeView) {
      case 'overview':
        return <OverviewView />;
      case 'projects':
        return <ProjectsView />;
      case 'builds':
        return <BuildsView />;
      case 'jdks':
        return <JdksView />;
      case 'settings':
        return <SettingsView />;
      case 'pipelines':
        return <PipelinesView />;
      case 'pipeline-editor':
        return <PipelineEditorView />;
      case 'setup-wizard':
        return <SetupWizardView />;
      case 'job-log':
        return <JobLogView />;
      default:
        return <OverviewView />;
    }
  };

  // Setup wizard gets its own layout
  if (activeView === 'setup-wizard') {
    return (
      <>
        <SetupWizardView />
        <SearchModal />
        <ShortcutsHelpOverlay />
      </>
    );
  }

  return (
    <>
      <Layout>
        {renderView()}
      </Layout>
      <SearchModal />
      <ShortcutsHelpOverlay />
    </>
  );
}

export default App;
