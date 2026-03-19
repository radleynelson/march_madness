import styles from './LiveIndicator.module.css';

interface LiveIndicatorProps {
  clock: string | null;
  period: number | null;
  statusDetail?: string | null;
}

export function LiveIndicator({ clock, period, statusDetail }: LiveIndicatorProps) {
  // Detect halftime: ESPN sends description "Halftime" or clock 0:00 at end of 1st half
  const isHalftime = statusDetail?.toLowerCase() === 'halftime'
    || (clock === '0:00' && period === 1);

  if (isHalftime) {
    return (
      <div className={styles.container}>
        <span className={styles.dot} />
        <span className={styles.text}>
          <span className={styles.clock}>Halftime</span>
        </span>
      </div>
    );
  }

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
