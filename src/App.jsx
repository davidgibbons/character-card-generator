import { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import TabBar from './components/layout/TabBar';
import ActionBar from './components/layout/ActionBar';
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

  const character = useGenerationStore((s) => s.character);
  const isGenerating = useGenerationStore((s) => s.isGenerating);
  const streamText = useGenerationStore((s) => s.streamText);

  // Listen for tab-switch events from CreatePanel/STBrowserPanel after generate/pull
  useEffect(() => {
    const onSwitchTab = (e) => setActiveTab(e.detail);
    window.addEventListener('gsd:switch-tab', onSwitchTab);
    return () => window.removeEventListener('gsd:switch-tab', onSwitchTab);
  }, []);

  // Show StreamView when actively streaming (generating + no character yet)
  // Non-streaming ops (revise, evaluate) set isGenerating but keep character, so they stay on current view
  const showStream = isGenerating && !character;

  // Single content area per tab — no split pane
  let content;
  if (showStream) {
    content = <StreamView />;
  } else {
    switch (activeTab) {
      case 'create':
        content = <CreatePanel />;
        break;
      case 'edit':
        content = <CharacterEditor />;
        break;
      case 'evaluate':
        content = <CharacterEditor />;
        break;
      default:
        content = <CreatePanel />;
    }
  }

  return (
    <div className="container">
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onThemeToggle={toggleTheme}
        isDark={isDark}
        onLibraryToggle={() => useLibraryStore.getState().toggleOpen()}
      />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <ActionBar activeTab={activeTab} />
      <main className="main-content">
        {content}
      </main>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LibraryDrawer />
    </div>
  );
}
