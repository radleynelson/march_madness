import { useMemo, useState } from 'react';
import type { BracketState, Matchup } from '../../types/bracket';
import { TOURNAMENT_DATES } from '../../data/constants';
import styles from './GamesCarousel.module.css';

interface GamesCarouselProps {
  state: BracketState;
}

interface TournamentDateOption {
  date: string;   // YYYYMMDD
  label: string;  // e.g., "March 18 (First Four)"
}

function buildDateOptions(): TournamentDateOption[] {
  const roundLabels: { key: keyof typeof TOURNAMENT_DATES; label: string }[] = [
    { key: 'FIRST_FOUR', label: 'First Four' },
    { key: 'ROUND_OF_64', label: 'Round of 64' },
    { key: 'ROUND_OF_32', label: 'Round of 32' },
    { key: 'SWEET_16', label: 'Sweet 16' },
    { key: 'ELITE_8', label: 'Elite 8' },
    { key: 'FINAL_FOUR', label: 'Final Four' },
    { key: 'CHAMPIONSHIP', label: 'Championship' },
  ];

  const options: TournamentDateOption[] = [];
  for (const { key, label } of roundLabels) {
    for (const dateStr of TOURNAMENT_DATES[key]) {
      const year = dateStr.slice(0, 4);
      const month = parseInt(dateStr.slice(4, 6), 10);
      const day = parseInt(dateStr.slice(6, 8), 10);
      const monthNames = [
        '', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      options.push({
        date: dateStr,
        label: `${monthNames[month]} ${day}, ${year} (${label})`,
      });
    }
  }
  return options;
}

function getMatchupDateStr(matchup: Matchup): string | null {
  // Map round names to approximate dates from TOURNAMENT_DATES
  const roundToKey: Record<string, keyof typeof TOURNAMENT_DATES> = {
    'First Four': 'FIRST_FOUR',
    'Round of 64': 'ROUND_OF_64',
    'Round of 32': 'ROUND_OF_32',
    'Sweet 16': 'SWEET_16',
    'Elite 8': 'ELITE_8',
    'Final Four': 'FINAL_FOUR',
    'Championship': 'CHAMPIONSHIP',
  };

  const key = roundToKey[matchup.round];
  if (!key) return null;

  const dates = TOURNAMENT_DATES[key];
  if (!dates || dates.length === 0) return null;

  // If there are two dates for this round, use position to split
  if (dates.length === 2) {
    // Even positions go to first date, odd to second (approximate)
    return matchup.position % 2 === 0 ? dates[0] : dates[1];
  }
  return dates[0];
}

function findClosestDate(options: TournamentDateOption[]): string {
  const today = new Date();
  const todayStr =
    today.getFullYear().toString() +
    (today.getMonth() + 1).toString().padStart(2, '0') +
    today.getDate().toString().padStart(2, '0');

  // Find today's date or the next upcoming date
  for (const opt of options) {
    if (opt.date >= todayStr) return opt.date;
  }
  // If all dates are past, return the last one
  return options[options.length - 1]?.date ?? options[0]?.date ?? '';
}

export function GamesCarousel({ state }: GamesCarouselProps) {
  const dateOptions = useMemo(() => buildDateOptions(), []);
  const [selectedDate, setSelectedDate] = useState(() => findClosestDate(dateOptions));

  const matchupsForDate = useMemo(() => {
    const result: Matchup[] = [];
    for (const matchup of state.matchups.values()) {
      const dateStr = getMatchupDateStr(matchup);
      if (dateStr === selectedDate) {
        result.push(matchup);
      }
    }
    // Sort by position
    result.sort((a, b) => a.position - b.position);
    return result;
  }, [state.matchups, selectedDate]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <select
          className={styles.dateSelect}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        >
          {dateOptions.map((opt) => (
            <option key={opt.date} value={opt.date}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.carouselTrack}>
        {matchupsForDate.length === 0 ? (
          <div className={styles.empty}>No games scheduled for this date</div>
        ) : (
          matchupsForDate.map((matchup) => (
            <GameCard key={matchup.id} matchup={matchup} />
          ))
        )}
      </div>
    </div>
  );
}

function GameCard({ matchup }: { matchup: Matchup }) {
  const { topTeam, bottomTeam, status, topScore, bottomScore } = matchup;
  const isFinal = status === 'final';
  const isLive = status === 'in_progress';
  const topWon = matchup.winner === 'top';
  const bottomWon = matchup.winner === 'bottom';

  return (
    <div className={`${styles.card} ${isLive ? styles.cardLive : ''}`}>
      {isLive && (
        <div className={styles.liveIndicator}>
          <span className={styles.liveDot} />
          <span className={styles.liveText}>LIVE</span>
          {matchup.clock && (
            <span className={styles.clock}>{matchup.clock}</span>
          )}
        </div>
      )}
      {isFinal && <div className={styles.finalLabel}>FINAL</div>}
      {!isFinal && !isLive && (
        <div className={styles.scheduledLabel}>SCHEDULED</div>
      )}

      {/* Top team */}
      <div className={`${styles.teamRow} ${isFinal && topWon ? styles.teamWon : ''} ${isFinal && !topWon ? styles.teamLost : ''}`}>
        <div className={styles.teamInfo}>
          {topTeam ? (
            <>
              <img
                src={topTeam.logoUrl}
                alt=""
                className={styles.teamLogo}
                width={16}
                height={16}
              />
              <span className={styles.teamSeed}>{topTeam.seed}</span>
              <span className={styles.teamCardName}>{topTeam.shortName}</span>
            </>
          ) : (
            <span className={styles.tbd}>TBD</span>
          )}
        </div>
        <div className={styles.teamData}>
          {isFinal || isLive ? (
            <span className={styles.score}>{topScore ?? 0}</span>
          ) : (
            <span className={styles.scoreDash}>&mdash;</span>
          )}
          {!isFinal && topTeam && (
            <span className={styles.winProb}>
              {Math.round(matchup.topWinProbability * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Bottom team */}
      <div className={`${styles.teamRow} ${isFinal && bottomWon ? styles.teamWon : ''} ${isFinal && !bottomWon ? styles.teamLost : ''}`}>
        <div className={styles.teamInfo}>
          {bottomTeam ? (
            <>
              <img
                src={bottomTeam.logoUrl}
                alt=""
                className={styles.teamLogo}
                width={16}
                height={16}
              />
              <span className={styles.teamSeed}>{bottomTeam.seed}</span>
              <span className={styles.teamCardName}>{bottomTeam.shortName}</span>
            </>
          ) : (
            <span className={styles.tbd}>TBD</span>
          )}
        </div>
        <div className={styles.teamData}>
          {isFinal || isLive ? (
            <span className={styles.score}>{bottomScore ?? 0}</span>
          ) : (
            <span className={styles.scoreDash}>&mdash;</span>
          )}
          {!isFinal && bottomTeam && (
            <span className={styles.winProb}>
              {Math.round(matchup.bottomWinProbability * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
