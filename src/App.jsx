import { useState } from 'react';
import Header from './components/layout/Header';
import TabBar from './components/layout/TabBar';
import ActionBar from './components/layout/ActionBar';
import SplitPane from './components/layout/SplitPane';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const { toggleTheme, isDark } = useTheme();

  const leftPanel = activeTab === 'create'
    ? <div>Create form placeholder</div>
    : <div>Edit form placeholder</div>;

  const rightPanel = <div>Character preview placeholder</div>;

  return (
    <div className="container">
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onThemeToggle={toggleTheme}
        isDark={isDark}
        onLibraryToggle={() => setLibraryOpen((prev) => !prev)}
      />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <ActionBar />
      <SplitPane leftContent={leftPanel} rightContent={rightPanel} />
    </div>
  );
}
