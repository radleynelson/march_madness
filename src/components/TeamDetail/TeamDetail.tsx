import type { Team } from '../../types/bracket';
import styles from './TeamDetail.module.css';

interface TeamDetailProps {
  team: Team;
  position: 'above' | 'below';
  style?: React.CSSProperties;
}

const ROUND_LABELS = [
  { key: 'round64' as const, label: 'R64', fullLabel: 'Round of 64' },
  { key: 'round32' as const, label: 'R32', fullLabel: 'Round of 32' },
  { key: 'sweet16' as const, label: 'S16', fullLabel: 'Sweet 16' },
  { key: 'elite8' as const, label: 'E8', fullLabel: 'Elite 8' },
  { key: 'finalFour' as const, label: 'F4', fullLabel: 'Final Four' },
  { key: 'champion' as const, label: 'CHAMP', fullLabel: 'Champion' },
];

function formatPct(value: number): string {
  if (value <= 0) return '-';
  if (value >= 1) return '100%';
  const pct = value * 100;
  if (pct >= 99.5) return '>99%';
  if (pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

export function TeamDetail({ team, position, style }: TeamDetailProps) {
  const { probabilities } = team;

  return (
    <div className={`${styles.tooltip} ${styles[position]}`} style={style}>
      {/* Header */}
      <div className={styles.header}>
        <img
          className={styles.logo}
          src={team.logoUrl}
          alt=""
          width={28}
          height={28}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className={styles.headerText}>
          <div className={styles.teamName}>
            <span className={styles.seed}>({team.seed})</span> {team.name}
          </div>
          {team.record && (
            <div className={styles.record}>{team.record}</div>
          )}
        </div>
      </div>

      {/* Rating */}
      <div className={styles.rating}>
        <span className={styles.ratingLabel}>Power Rating</span>
        <span className={styles.ratingValue}>
          {team.rating > 0 ? '+' : ''}{team.rating.toFixed(1)}
        </span>
      </div>

      {/* Round-by-round probabilities */}
      <div className={styles.rounds}>
        <div className={styles.roundsHeader}>CHANCE OF ADVANCING TO...</div>
        {ROUND_LABELS.map(({ key, label, fullLabel }) => {
          const prob = probabilities[key];
          const pctNum = prob * 100;
          return (
            <div key={key} className={styles.roundRow}>
              <span className={styles.roundLabel} title={fullLabel}>{label}</span>
              <div className={styles.roundBarContainer}>
                <div
                  className={`${styles.roundBar} ${key === 'champion' ? styles.champBar : ''}`}
                  style={{ width: `${Math.max(pctNum, prob > 0 ? 2 : 0)}%` }}
                />
              </div>
              <span className={`${styles.roundPct} ${key === 'champion' ? styles.champPct : ''}`}>
                {formatPct(prob)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
