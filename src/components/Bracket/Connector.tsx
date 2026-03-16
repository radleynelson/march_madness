import styles from './Connector.module.css';

interface ConnectorProps {
  /** Number of matchup pairs to connect (pairs from previous round that merge) */
  pairs: number;
  reversed?: boolean;
  /** Map of pair index -> which arm ('top' | 'bottom') is on the highlighted team's path */
  highlightedArms?: Map<number, 'top' | 'bottom'>;
  highlightColor?: string;
  /** Probability label to show at the highlighted junction */
  probLabel?: string;
}

/**
 * Draws bracket connector lines between two adjacent rounds.
 * For each pair of source matchups, draws lines converging to the next round's matchup.
 *
 * Visual structure for one pair (left-to-right):
 *   ─┐
 *    ├──
 *   ─┘
 */
export function Connector({ pairs, reversed = false, highlightedArms, highlightColor, probLabel }: ConnectorProps) {
  const elements: React.ReactNode[] = [];
  const hasAnyHighlight = highlightedArms && highlightedArms.size > 0;

  for (let i = 0; i < pairs; i++) {
    elements.push(
      <div key={`s-before-${i}`} className={styles.spacer} />,
    );

    const highlightArm = highlightedArms?.get(i);
    const isTopHighlighted = highlightArm === 'top';
    const isBottomHighlighted = highlightArm === 'bottom';
    const isPairHighlighted = isTopHighlighted || isBottomHighlighted;

    const armStyle = isPairHighlighted && highlightColor
      ? { borderColor: highlightColor } as React.CSSProperties
      : undefined;

    elements.push(
      <div
        key={`pair-${i}`}
        className={`${styles.pair} ${reversed ? styles.reversed : ''} ${hasAnyHighlight && !isPairHighlighted ? styles.dimmed : ''}`}
      >
        <div
          className={`${styles.topArm} ${isTopHighlighted ? styles.highlighted : ''}`}
          style={isTopHighlighted ? armStyle : undefined}
        />
        <div className={`${styles.midLine} ${isPairHighlighted ? styles.midHighlighted : ''}`}>
          <span
            className={`${styles.probLabel} ${reversed ? styles.probLabelReversed : ''}`}
            style={{
              color: highlightColor ?? '#333',
              visibility: isPairHighlighted && probLabel ? 'visible' : 'hidden',
            }}
          >
            {probLabel || '\u00A0'}
          </span>
        </div>
        <div
          className={`${styles.bottomArm} ${isBottomHighlighted ? styles.highlighted : ''}`}
          style={isBottomHighlighted ? armStyle : undefined}
        />
      </div>,
    );
  }
  elements.push(<div key="s-trailing" className={styles.spacer} />);

  return (
    <div className={styles.connector}>
      {elements}
    </div>
  );
}
