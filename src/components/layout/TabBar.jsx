import styles from './TabBar.module.css';

const TABS = [
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'evaluate', label: 'Evaluate' },
];

export default function TabBar({ activeTab, onTabChange }) {
  return (
    <div className={styles.tabBar} role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`${styles.tabBtn} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
