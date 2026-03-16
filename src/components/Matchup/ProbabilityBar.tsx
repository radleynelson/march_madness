import styles from './ProbabilityBar.module.css';

interface ProbabilityBarProps {
  topProbability: number;
  bottomProbability: number;
  isLive?: boolean;
  showLabels?: boolean;
}

export function ProbabilityBar({
  topProbability,
  bottomProbability,
  isLive = false,
  showLabels = true,
}: ProbabilityBarProps) {
  const topPct = Math.round(topProbability * 100);
  const bottomPct = Math.round(bottomProbability * 100);

  // Don't show if both are 50/50 (no meaningful prediction)
  if (topPct === 50 && bottomPct === 50 && !isLive) {
    return null;
  }

  return (
    <div className={`${styles.container} ${isLive ? styles.live : ''}`}>
      {showLabels && topPct > 0 && (
        <span className={styles.labelTop}>{topPct}%</span>
      )}
      <div className={styles.bar}>
        <div
          className={styles.topFill}
          style={{ width: `${topProbability * 100}%` }}
        />
        <div
          className={styles.bottomFill}
          style={{ width: `${bottomProbability * 100}%` }}
        />
      </div>
      {showLabels && bottomPct > 0 && (
        <span className={styles.labelBottom}>{bottomPct}%</span>
      )}
    </div>
  );
}
