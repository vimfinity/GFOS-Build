/**
 * GFOS Build - Main Application
 */

import Layout from './components/Layout';
import OverviewView from './views/OverviewView';
import ProjectsView from './views/ProjectsView';
import BuildsView from './views/BuildsView';
import JdksView from './views/JdksView';
import SettingsView from './views/SettingsView';
import { useAppStore } from './store/useAppStore';
import './Dashboard.css';

function App() {
  const activeView = useAppStore((state) => state.activeView);

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
      default:
        return <OverviewView />;
    }
  };

  return (
    <Layout>
      {renderView()}
    </Layout>
  );
}

export default App;
