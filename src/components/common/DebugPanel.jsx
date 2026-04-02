import { useState, useEffect } from 'react';
import useConfigStore from '../../stores/configStore';
import { apiHandler } from '../../services/api';
import styles from './DebugPanel.module.css';

/**
 * Floating debug panel — visible when debug mode is on.
 * Shows the last API request and response captured by apiHandler.lastDebugEntry.
 */
export default function DebugPanel() {
  const debugMode = useConfigStore((s) => s.app.debugMode);
  const [entry, setEntry] = useState(null);
  const [tab, setTab] = useState('request'); // 'request' | 'response' | 'error'
  const [collapsed, setCollapsed] = useState(false);

  // Poll for new debug entries while debug mode is on
  useEffect(() => {
    if (!debugMode) return;
    const interval = setInterval(() => {
      const e = apiHandler.lastDebugEntry;
      if (e && e !== entry) setEntry(e);
    }, 300);
    return () => clearInterval(interval);
  }, [debugMode, entry]);

  if (!debugMode) return null;

  function fmt(obj) {
    if (!obj) return '—';
    try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
  }

  const hasError = !!entry?.error;

  return (
    <div className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>🐛 Debug</span>
        {entry && (
          <span className={styles.timestamp}>{entry.timestamp?.slice(11, 19)}</span>
        )}
        <button className={styles.collapseBtn} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <>
          {!entry && (
            <div className={styles.empty}>No API calls yet this session.</div>
          )}
          {entry && (
            <>
              <div className={styles.tabs}>
                <button className={`${styles.tab} ${tab === 'request' ? styles.activeTab : ''}`}
                  onClick={() => setTab('request')}>Request</button>
                <button className={`${styles.tab} ${tab === 'response' ? styles.activeTab : ''}`}
                  onClick={() => setTab('response')}>Response</button>
                <button className={`${styles.tab} ${tab === 'error' ? styles.activeTab : ''} ${hasError ? styles.errorTab : ''}`}
                  onClick={() => setTab('error')}>
                  {hasError ? '⚠ Error' : 'Error'}
                </button>
              </div>
              <div className={styles.body}>
                {tab === 'request' && (
                  <>
                    <div className={styles.meta}>
                      <span className={styles.metaLabel}>Endpoint</span>
                      <span className={styles.metaValue}>{entry.endpoint}</span>
                    </div>
                    <pre className={styles.code}>{fmt(entry.requestData)}</pre>
                  </>
                )}
                {tab === 'response' && (
                  <pre className={styles.code}>{fmt(entry.responseData)}</pre>
                )}
                {tab === 'error' && (
                  <pre className={`${styles.code} ${hasError ? styles.errorCode : ''}`}>
                    {hasError ? fmt(entry.error) : 'No error on last request.'}
                  </pre>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
