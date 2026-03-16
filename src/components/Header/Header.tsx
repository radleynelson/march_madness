import type { BracketState } from '../../types/bracket';
import styles from './Header.module.css';

interface HeaderProps {
  state: BracketState;
  hasUserPicks?: boolean;
  onClearPicks?: () => void;
}

export function Header({ state, hasUserPicks, onClearPicks }: HeaderProps) {
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
