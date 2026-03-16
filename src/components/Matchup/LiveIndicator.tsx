import styles from './LiveIndicator.module.css';

interface LiveIndicatorProps {
  clock: string | null;
  period: number | null;
}

export function LiveIndicator({ clock, period }: LiveIndicatorProps) {
  const periodLabel = period === 1 ? '1st' : period === 2 ? '2nd' : period ? `OT${period - 2 || ''}` : '';

  return (
    <div className={styles.container}>
      <span className={styles.dot} />
      <span className={styles.text}>
        {clock && <span className={styles.clock}>{clock}</span>}
        {periodLabel && <span className={styles.period}>{periodLabel}</span>}
      </span>
    </div>
  );
}
