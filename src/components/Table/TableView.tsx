import { useMemo } from 'react';
import type { BracketState, Team } from '../../types/bracket';
import styles from './TableView.module.css';

interface TableViewProps {
  state: BracketState;
  onTeamClick?: (team: Team) => void;
}

const ROUND_COLUMNS = [
  { key: 'round64' as const, label: 'R64' },
  { key: 'round32' as const, label: 'R32' },
  { key: 'sweet16' as const, label: 'S16' },
  { key: 'elite8' as const, label: 'E8' },
  { key: 'finalFour' as const, label: 'FF' },
  { key: 'champion' as const, label: 'CHAMP.' },
];

function isEliminated(team: Team): boolean {
  const p = team.probabilities;
  return (
    p.round64 === 0 &&
    p.round32 === 0 &&
    p.sweet16 === 0 &&
    p.elite8 === 0 &&
    p.finalFour === 0 &&
    p.champion === 0
  );
}

/**
 * Check if a team has actually won a round (game is decided, not just prob=1.0).
 * A team with prob=1.0 might just be the only known team in a matchup awaiting
 * a play-in opponent, which isn't the same as having won.
 */
function isRoundCompleted(team: Team, roundKey: string, state: BracketState): boolean {
  const prob = team.probabilities[roundKey as keyof typeof team.probabilities];
  if (prob !== 1.0) return false;

  // Find a matchup where this team won in this round
  const roundNumber = { round64: 1, round32: 2, sweet16: 3, elite8: 4, finalFour: 5, champion: 6 }[roundKey] ?? 0;
  for (const [, matchup] of state.matchups) {
    if (matchup.roundNumber !== roundNumber) continue;
    if (!matchup.winner) continue;
    const winnerTeam = matchup.winner === 'top' ? matchup.topTeam : matchup.bottomTeam;
    if (winnerTeam?.id === team.id) return true;
  }
  return false;
}

function formatProb(value: number): string {
  const pct = value * 100;
  if (pct >= 99.5 && pct < 100) return '>99%';
  if (pct > 0 && pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

export function TableView({ state, onTeamClick }: TableViewProps) {
  const sortedTeams = useMemo(() => {
    return [...state.teams.values()]
      .sort((a, b) => {
        // Primary: championship probability descending
        const diff = b.probabilities.champion - a.probabilities.champion;
        if (diff !== 0) return diff;
        // Secondary: rating descending
        return b.rating - a.rating;
      });
  }, [state.teams]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th className={styles.thTeam}>TEAM</th>
              <th className={styles.thRegion}>REGION</th>
              <th className={styles.thRating}>RATING</th>
              {ROUND_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${styles.thRound} ${col.key === 'champion' ? styles.thWin : ''}`}
                >
                  {col.label}
                </th>
              ))}
              <th className={`${styles.thRound} ${styles.thWin}`}>WIN</th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team) => {
              const eliminated = isEliminated(team);
              return (
                <tr
                  key={team.id}
                  className={`${styles.row} ${eliminated ? styles.rowEliminated : ''}`}
                  onClick={() => onTeamClick?.(team)}
                >
                  <td className={styles.tdTeam}>
                    <img
                      src={team.logoUrl}
                      alt=""
                      className={styles.logo}
                      width={16}
                      height={16}
                    />
                    <span className={styles.teamName}>{team.shortName}</span>
                    <span className={styles.seed}>{team.seed}</span>
                  </td>
                  <td className={styles.tdRegion}>{team.region}</td>
                  <td className={styles.tdRating}>{team.rating.toFixed(1)}</td>
                  {ROUND_COLUMNS.map((col) => {
                    const prob = team.probabilities[col.key];
                    const completed = isRoundCompleted(team, col.key, state);
                    return (
                      <td
                        key={col.key}
                        className={`${styles.tdProb} ${col.key === 'champion' ? styles.tdChamp : ''}`}
                        style={{
                          backgroundColor: eliminated
                            ? undefined
                            : `rgba(249, 115, 22, ${prob * 0.85})`,
                        }}
                      >
                        {completed ? (
                          <span className={styles.checkmark}>&#10003;</span>
                        ) : prob > 0 ? (
                          formatProb(prob)
                        ) : eliminated ? (
                          <span className={styles.dash}>&mdash;</span>
                        ) : (
                          formatProb(prob)
                        )}
                      </td>
                    );
                  })}
                  <td
                    className={`${styles.tdProb} ${styles.tdWin}`}
                    style={{
                      backgroundColor: eliminated
                        ? undefined
                        : `rgba(249, 115, 22, ${team.probabilities.champion * 0.85})`,
                    }}
                  >
                    {eliminated ? (
                      <span className={styles.dash}>&mdash;</span>
                    ) : (
                      formatProb(team.probabilities.champion)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
