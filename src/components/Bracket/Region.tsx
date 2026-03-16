import type { Matchup as MatchupType, RegionName } from '../../types/bracket';
import { useHoverContext, getProbKeyForRound, formatProb } from '../../hooks/useHoverState';
import { Round } from './Round';
import { Connector } from './Connector';
import styles from './Region.module.css';
import { REGION_COLORS } from '../../data/constants';

interface RegionProps {
  name: RegionName;
  matchups: MatchupType[];
  reversed?: boolean;
}

export function Region({ name, matchups, reversed = false }: RegionProps) {
  const { teamPath } = useHoverContext();

  // Group matchups by round number
  const rounds = new Map<number, MatchupType[]>();
  for (const m of matchups) {
    if (!rounds.has(m.roundNumber)) {
      rounds.set(m.roundNumber, []);
    }
    rounds.get(m.roundNumber)!.push(m);
  }

  // Sort each round's matchups by position
  for (const roundMatchups of rounds.values()) {
    roundMatchups.sort((a, b) => a.position - b.position);
  }

  // Sort rounds by round number
  const sortedRounds = [...rounds.entries()].sort((a, b) => a[0] - b[0]);

  const regionColor = REGION_COLORS[name];

  // Build interleaved rounds and connectors
  const elements: React.ReactNode[] = [];
  sortedRounds.forEach(([roundNumber, roundMatchups], index) => {
    elements.push(
      <Round
        key={`round-${roundNumber}`}
        matchups={roundMatchups}
        roundNumber={roundNumber}
      />
    );

    // Add connector after each round (except the last)
    if (index < sortedRounds.length - 1) {
      const pairs = Math.max(1, Math.floor(roundMatchups.length / 2));

      // Compute highlighted arms for this connector
      let highlightedArms: Map<number, 'top' | 'bottom'> | undefined;
      let highlightColor: string | undefined;
      let probLabel: string | undefined;

      if (teamPath) {
        const arms = new Map<number, 'top' | 'bottom'>();
        for (const m of roundMatchups) {
          if (teamPath.matchupIds.has(m.id)) {
            const pairIndex = Math.floor(m.position / 2);
            const arm: 'top' | 'bottom' = m.position % 2 === 0 ? 'top' : 'bottom';
            arms.set(pairIndex, arm);
            highlightColor = teamPath.team.primaryColor;

            // Probability for this round transition
            const probKey = getProbKeyForRound(roundNumber);
            if (probKey) {
              const prob = teamPath.team.probabilities[probKey];
              probLabel = formatProb(prob);
            }
          }
        }
        if (arms.size > 0) {
          highlightedArms = arms;
        }
      }

      elements.push(
        <Connector
          key={`conn-${roundNumber}`}
          pairs={pairs}
          reversed={reversed}
          highlightedArms={highlightedArms}
          highlightColor={highlightColor}
          probLabel={probLabel}
        />
      );
    }
  });

  // E8 exit probability (chance of reaching FF)
  let e8ExitVisible = false;
  let e8ExitText = '\u00A0';
  let e8ExitColor = '#333';
  if (teamPath) {
    const lastRound = sortedRounds[sortedRounds.length - 1];
    if (lastRound) {
      const [lastRoundNum, lastRoundMatchups] = lastRound;
      const onPath = lastRoundMatchups.some(m => teamPath.matchupIds.has(m.id));
      if (onPath) {
        const probKey = getProbKeyForRound(lastRoundNum);
        if (probKey) {
          const prob = teamPath.team.probabilities[probKey];
          if (prob > 0) {
            e8ExitVisible = true;
            e8ExitText = formatProb(prob);
            e8ExitColor = teamPath.team.primaryColor;
          }
        }
      }
    }
  }

  return (
    <div className={`${styles.region} ${reversed ? styles.reversed : ''}`}>
      <div className={styles.header} style={{ borderColor: regionColor }}>
        <span className={styles.name} style={{ color: regionColor }}>{name}</span>
      </div>
      <div className={`${styles.rounds} ${reversed ? styles.roundsReversed : ''}`}>
        {elements}
        <div
          className={styles.e8ExitLabel}
          style={{
            color: e8ExitColor,
            visibility: e8ExitVisible ? 'visible' : 'hidden',
          }}
        >
          {e8ExitText}
        </div>
      </div>
    </div>
  );
}
