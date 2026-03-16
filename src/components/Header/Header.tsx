import type { BracketState } from '../../types/bracket';
import styles from './Header.module.css';

interface HeaderProps {
  state: BracketState;
  hasUserPicks?: boolean;
  onClearPicks?: () => void;
  onOpenSettings?: () => void;
  onOpenBracketFill?: () => void;
  aiEnabled?: boolean;
}

export function Header({ state, hasUserPicks, onClearPicks, onOpenSettings, onOpenBracketFill, aiEnabled }: HeaderProps) {
  const { isLive, lastUpdated, teams } = state;

  // Find top championship favorites
  const teamsArray = [...teams.values()]
    .filter(t => t.probabilities.champion > 0)
    .sort((a, b) => b.probabilities.champion - a.probabilities.champion)
    .slice(0, 5);

  const timeAgo = getTimeAgo(lastUpdated);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            2026 NCAA Tournament
          </h1>
          <span className={styles.subtitle}>March Madness Predictions</span>
        </div>

        {teamsArray.length > 0 && (
          <div className={styles.favorites}>
            <span className={styles.favoritesLabel}>Championship Favorites:</span>
            {teamsArray.map((team, i) => (
              <span key={team.id} className={styles.favorite}>
                <span className={styles.favoriteSeed}>({team.seed})</span>
                <span className={styles.favoriteName}>{team.shortName}</span>
                <span className={styles.favoriteProb}>
                  {Math.round(team.probabilities.champion * 100)}%
                </span>
                {i < teamsArray.length - 1 && <span className={styles.separator}>|</span>}
              </span>
            ))}
          </div>
        )}

        <div className={styles.status}>
          {aiEnabled && (
            <button className={styles.aiFillBtn} onClick={onOpenBracketFill}>
              AI Fill Bracket
            </button>
          )}
          {hasUserPicks && (
            <button className={styles.resetBtn} onClick={onClearPicks}>
              Reset Picks
            </button>
          )}
          {isLive && (
            <span className={styles.liveTag}>
              <span className={styles.liveDot} />
              LIVE
            </span>
          )}
          {timeAgo && (
            <span className={styles.updated}>Updated {timeAgo}</span>
          )}
          <button
            className={`${styles.settingsBtn} ${aiEnabled ? styles.settingsBtnActive : ''}`}
            onClick={onOpenSettings}
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
