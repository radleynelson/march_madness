import { useState, useEffect, useCallback } from 'react';
import { useSettingsContext } from '../../hooks/useSettings';
import styles from './Settings.module.css';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { settings, setApiKey, clearApiKey } = useSettingsContext();
  const [inputKey, setInputKey] = useState(settings.apiKey);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = useCallback(() => {
    setApiKey(inputKey.trim());
  }, [inputKey, setApiKey]);

  const handleClear = useCallback(() => {
    setInputKey('');
    clearApiKey();
  }, [clearApiKey]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>AI Status</div>
            <div className={styles.statusRow}>
              <span className={`${styles.statusDot} ${settings.cliAvailable ? styles.statusActive : styles.statusInactive}`} />
              <span className={styles.statusLabel}>Local Claude CLI</span>
              <span className={styles.statusValue}>
                {settings.cliAvailable ? 'Available (Max subscription)' : 'Not detected'}
              </span>
            </div>
            <div className={styles.statusRow}>
              <span className={`${styles.statusDot} ${settings.apiKey ? styles.statusActive : styles.statusInactive}`} />
              <span className={styles.statusLabel}>Anthropic API Key</span>
              <span className={styles.statusValue}>
                {settings.apiKey ? `${settings.apiKey.slice(0, 10)}...` : 'Not set'}
              </span>
            </div>
            {settings.aiEnabled && (
              <div className={styles.statusRow}>
                <span className={`${styles.statusDot} ${styles.statusActive}`} />
                <span className={styles.statusLabel}>AI Features</span>
                <span className={styles.statusValue}>
                  Active via {settings.provider === 'cli' ? 'Claude CLI' : 'API Key'}
                </span>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Anthropic API Key</div>
            <div className={styles.inputGroup}>
              <input
                className={styles.input}
                type="password"
                placeholder="sk-ant-..."
                value={inputKey}
                onChange={e => setInputKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
              <button className={styles.saveBtn} onClick={handleSave}>Save</button>
              {settings.apiKey && (
                <button className={styles.clearBtn} onClick={handleClear}>Clear</button>
              )}
            </div>
            <div className={styles.hint}>
              Enter your API key from console.anthropic.com to enable AI features.
              {settings.cliAvailable && ' Since Claude CLI is available, AI features will use your Max subscription by default.'}
              {' '}Your key is stored in localStorage and only sent to Anthropic.
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          {settings.aiEnabled
            ? 'AI features are enabled. Look for AI buttons in matchup previews and the header.'
            : 'Set an API key or install Claude CLI to unlock AI-powered analysis, bracket filling, and more.'}
        </div>
      </div>
    </div>
  );
}
