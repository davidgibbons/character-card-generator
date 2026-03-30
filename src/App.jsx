import { useState } from 'react';
import Header from './components/layout/Header';
import TabBar from './components/layout/TabBar';
import ActionBar from './components/layout/ActionBar';
import SplitPane from './components/layout/SplitPane';
import SettingsModal from './components/settings/SettingsModal';
import LibraryDrawer from './components/library/LibraryDrawer';
import CreatePanel from './components/create/CreatePanel';
import StreamView from './components/character/StreamView';
import CharacterEditor from './components/character/CharacterEditor';
import useGenerationStore from './stores/useGenerationStore';
import useLibraryStore from './stores/useLibraryStore';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { toggleTheme, isDark } = useTheme();

  // Right panel switching — see UI-SPEC interaction states table
  const character = useGenerationStore((s) => s.character);
  const isGenerating = useGenerationStore((s) => s.isGenerating);
  const streamText = useGenerationStore((s) => s.streamText);

  const leftPanel = activeTab === 'create'
    ? <CreatePanel />
    : <div>Edit form placeholder</div>;

  // Right panel: exactly one view at a time (per UI-SPEC)
  // character !== null → CharacterEditor
  // isGenerating OR streamText has content → StreamView
  // otherwise → CharacterEditor renders its own empty state
  const rightPanel = character !== null
    ? <CharacterEditor />
    : (isGenerating || streamText !== '')
      ? <StreamView />
      : <CharacterEditor />;  // CharacterEditor handles empty state internally

  return (
    <div className="container">
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onThemeToggle={toggleTheme}
        isDark={isDark}
        onLibraryToggle={() => useLibraryStore.getState().toggleOpen()}
      />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <ActionBar />
      <SplitPane leftContent={leftPanel} rightContent={rightPanel} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LibraryDrawer />
    </div>
  );
}
