import { useState, useEffect } from 'react';
import useConfigStore from '../../stores/configStore';
import { apiHandler } from '../../services/api';
import styles from './DebugPanel.module.css';

/**
 * Tiny JSON syntax highlighter — no dependencies.
 * Returns an HTML string with <span> tokens.
 */
function highlight(obj) {
  if (!obj) return '<span class="jNull">—</span>';
  let json;
  try { json = JSON.stringify(obj, null, 2); } catch { return String(obj); }

  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'jNum';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'jKey' : 'jStr';
      } else if (/true|false/.test(match)) {
        cls = 'jBool';
      } else if (/null/.test(match)) {
        cls = 'jNull';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function JsonBlock({ obj, error }) {
  const html = highlight(obj);
  return (
    <pre
      className={`${styles.code} ${error ? styles.errorCode : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function DebugPanel() {
  const debugMode = useConfigStore((s) => s.app.debugMode);
  const [entry, setEntry] = useState(null);
  const [tab, setTab] = useState('request');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!debugMode) return;
    const interval = setInterval(() => {
      const e = apiHandler.lastDebugEntry;
      if (e && e !== entry) setEntry(e);
    }, 300);
    return () => clearInterval(interval);
  }, [debugMode, entry]);

  if (!debugMode) return null;

  const hasError = !!entry?.error;

  return (
    <div className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>🐛 Debug</span>
        {entry && <span className={styles.timestamp}>{entry.timestamp?.slice(11, 19)}</span>}
        <button className={styles.collapseBtn} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <>
          {!entry && <div className={styles.empty}>No API calls yet this session.</div>}
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
                    <JsonBlock obj={entry.requestData} />
                  </>
                )}
                {tab === 'response' && <JsonBlock obj={entry.responseData} />}
                {tab === 'error' && (
                  hasError
                    ? <JsonBlock obj={entry.error} error />
                    : <div className={styles.empty}>No error on last request.</div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
