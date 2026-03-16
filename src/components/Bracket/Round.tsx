import type { Matchup as MatchupType } from '../../types/bracket';
import { Matchup } from '../Matchup/Matchup';
import styles from './Round.module.css';

interface RoundProps {
  matchups: MatchupType[];
  roundNumber: number;
  compact?: boolean;
}

export function Round({ matchups, roundNumber, compact = false }: RoundProps) {
  // Build a flex layout: spacer, matchup, spacer, matchup, spacer...
  // Each spacer has flex-grow:1, creating even distribution that
  // naturally centers each later-round matchup between its two source matchups.
  const elements: React.ReactNode[] = [];

  matchups.forEach((m, i) => {
    // Leading spacer
    elements.push(<div key={`s-before-${i}`} className={styles.spacer} />);
    // Matchup
    elements.push(
      <div key={m.id} className={styles.matchupWrapper}>
        <Matchup matchup={m} compact={compact} />
      </div>
    );
  });
  // Trailing spacer
  elements.push(<div key="s-trailing" className={styles.spacer} />);

  return (
    <div className={styles.round} data-round={roundNumber}>
      {elements}
    </div>
  );
}
