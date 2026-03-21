import { useState, useEffect, useCallback } from 'react';
import { useSettingsContext } from '../../hooks/useSettings';
import { useEspnBracketContext } from '../../hooks/useEspnBracket';
import styles from './Settings.module.css';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { settings, setApiKey, clearApiKey, setKalshiCredentials, clearKalshiCredentials } = useSettingsContext();
  const espnBracket = useEspnBracketContext();
  const [inputKey, setInputKey] = useState(settings.apiKey);
  const [kalshiKeyId, setKalshiKeyId] = useState(settings.kalshiKeyId);
  const [kalshiPk, setKalshiPk] = useState(settings.kalshiPrivateKey);
  const [espnInput, setEspnInput] = useState('');

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

  const handleSaveKalshi = useCallback(() => {
    setKalshiCredentials(kalshiKeyId.trim(), kalshiPk.trim());
  }, [kalshiKeyId, kalshiPk, setKalshiCredentials]);

  const handleClearKalshi = useCallback(() => {
    setKalshiKeyId('');
    setKalshiPk('');
    clearKalshiCredentials();
  }, [clearKalshiCredentials]);

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
              Enter your API key from console.anthropic.com to enable AI features. Your key is only sent directly to Anthropic.
              {settings.cliAvailable && ' Since Claude CLI is available, AI features will use your Max subscription by default.'}
              {' '}By entering an API key, you acknowledge that you are responsible for all usage and billing associated with your Anthropic account.
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Kalshi API Key (read-only)</div>
            <div className={styles.statusRow}>
              <span className={`${styles.statusDot} ${settings.kalshiKeyId ? styles.statusActive : styles.statusInactive}`} />
              <span className={styles.statusLabel}>Kalshi Positions</span>
              <span className={styles.statusValue}>
                {settings.kalshiKeyId ? 'Connected' : 'Not configured'}
              </span>
            </div>
            <div className={styles.inputGroup}>
              <input
                className={styles.input}
                type="text"
                placeholder="Key ID"
                value={kalshiKeyId}
                onChange={e => setKalshiKeyId(e.target.value)}
              />
            </div>
            <textarea
              className={styles.textarea}
              placeholder="RSA Private Key (PEM format)"
              value={kalshiPk}
              onChange={e => setKalshiPk(e.target.value)}
              rows={4}
            />
            <div className={styles.inputGroup} style={{ marginTop: 8 }}>
              <button className={styles.saveBtn} onClick={handleSaveKalshi}>Save</button>
              {settings.kalshiKeyId && (
                <button className={styles.clearBtn} onClick={handleClearKalshi}>Clear</button>
              )}
            </div>
            <div className={styles.hint}>
              Add your Kalshi API key to see your positions on games. Your key is stored locally on this device and is only used to sign requests. The private key never leaves your browser.
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>ESPN Bracket</div>
            <div className={styles.statusRow}>
              <span className={`${styles.statusDot} ${espnBracket.data ? styles.statusActive : styles.statusInactive}`} />
              <span className={styles.statusLabel}>Bracket Import</span>
              <span className={styles.statusValue}>
                {espnBracket.data
                  ? `${espnBracket.data.entryName} - ${espnBracket.data.score.overallScore} pts`
                  : 'Not imported'}
              </span>
            </div>
            {espnBracket.data && (
              <div className={styles.statusRow}>
                <span className={`${styles.statusDot} ${styles.statusActive}`} />
                <span className={styles.statusLabel}>Record</span>
                <span className={styles.statusValue}>
                  {espnBracket.data.score.record.wins}-{espnBracket.data.score.record.losses} · Rank #{espnBracket.data.score.rank.toLocaleString()} · Top {Math.round((1 - espnBracket.data.score.percentile) * 100)}%
                </span>
              </div>
            )}
            <div className={styles.inputGroup}>
              <input
                className={styles.input}
                type="text"
                placeholder="ESPN bracket URL or entry ID"
                value={espnInput}
                onChange={e => setEspnInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && espnInput.trim() && espnBracket.importBracket(espnInput)}
              />
              <button
                className={styles.saveBtn}
                onClick={() => espnBracket.importBracket(espnInput)}
                disabled={espnBracket.loading || !espnInput.trim()}
              >
                {espnBracket.loading ? 'Loading...' : 'Import'}
              </button>
              {espnBracket.data && (
                <button className={styles.clearBtn} onClick={() => { espnBracket.clearBracket(); setEspnInput(''); }}>Clear</button>
              )}
            </div>
            {espnBracket.error && (
              <div className={styles.hint} style={{ color: '#dc2626' }}>
                {espnBracket.error}
              </div>
            )}
            <div className={styles.hint}>
              Paste your ESPN Tournament Challenge bracket URL to see your picks on the scoreboard. Find it at fantasy.espn.com/games/tournament-challenge-bracket-2026.
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
