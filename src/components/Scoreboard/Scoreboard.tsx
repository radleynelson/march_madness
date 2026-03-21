import { useState, useEffect, useMemo } from 'react';
import type { BracketState, Matchup } from '../../types/bracket';
import type { EspnEvent } from '../../types/espn';
import { fetchScoreboard, filterTournamentGames } from '../../api/espn';
import { TOURNAMENT_DATES, ALL_TOURNAMENT_DATES } from '../../data/constants';
import { usePreviewContext } from '../../hooks/usePreview';
import { useKalshiContext } from '../../hooks/useKalshiMarkets';
import type { MatchupPosition } from '../../hooks/useKalshiMarkets';
import { useEspnBracketContext, getPickForMatchup } from '../../hooks/useEspnBracket';
import type { EspnBracketPick } from '../../types/espn-bracket';
import { formatVolume } from '../../api/kalshi';
import styles from './Scoreboard.module.css';

interface ScoreboardProps {
  state: BracketState;
}

// ─── Date helpers ─────────────────────────────────────────

const ROUND_DATE_MAP: [string, string[]][] = [
  ['First Four', TOURNAMENT_DATES.FIRST_FOUR],
  ['Round of 64', TOURNAMENT_DATES.ROUND_OF_64],
  ['Round of 32', TOURNAMENT_DATES.ROUND_OF_32],
  ['Sweet 16', TOURNAMENT_DATES.SWEET_16],
  ['Elite 8', TOURNAMENT_DATES.ELITE_8],
  ['Final Four', TOURNAMENT_DATES.FINAL_FOUR],
  ['Championship', TOURNAMENT_DATES.CHAMPIONSHIP],
];

function formatDateLabel(dateStr: string): string {
  const y = parseInt(dateStr.slice(0, 4));
  const m = parseInt(dateStr.slice(4, 6)) - 1;
  const d = parseInt(dateStr.slice(6, 8));
  const date = new Date(y, m, d);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

function getRoundForDate(dateStr: string): string {
  for (const [round, dates] of ROUND_DATE_MAP) {
    if (dates.includes(dateStr)) return round;
  }
  return '';
}

function findClosestDate(): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  // If today is a tournament date, use it
  if (ALL_TOURNAMENT_DATES.includes(todayStr)) return todayStr;

  // Otherwise find the closest future date, or the last date
  const future = ALL_TOURNAMENT_DATES.filter(d => d >= todayStr);
  if (future.length > 0) return future[0];

  // All dates passed — return the last date
  return ALL_TOURNAMENT_DATES[ALL_TOURNAMENT_DATES.length - 1];
}

// ─── Sort events by status priority + time ────────────────

function sortEvents(events: EspnEvent[]): EspnEvent[] {
  const statusPriority = (e: EspnEvent): number => {
    const state = e.status.type.state;
    if (state === 'in') return 0;   // Live first
    if (state === 'pre') return 1;  // Scheduled next
    return 2;                        // Final last
  };

  return [...events].sort((a, b) => {
    const pa = statusPriority(a);
    const pb = statusPriority(b);
    if (pa !== pb) return pa - pb;
    // Within same status, sort by start time
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

// ─── Find matching bracket matchup for an ESPN event ──────

function findMatchupForEvent(
  event: EspnEvent,
  matchups: Map<string, Matchup>,
): Matchup | null {
  // Try by espnEventId first
  for (const m of matchups.values()) {
    if (m.espnEventId === event.id) return m;
  }
  // Try by team ID matching
  const competitors = event.competitions?.[0]?.competitors;
  if (!competitors || competitors.length < 2) return null;
  const ids = new Set(competitors.map(c => c.team.id));

  for (const m of matchups.values()) {
    if (m.topTeam && m.bottomTeam && ids.has(m.topTeam.id) && ids.has(m.bottomTeam.id)) {
      return m;
    }
  }
  return null;
}

// ─── Game Card ────────────────────────────────────────────

function GameCard({
  event,
  matchup,
  onOpen,
  kalshiPrices,
  position,
  espnPick,
}: {
  event: EspnEvent;
  matchup: Matchup | null;
  onOpen: (matchupId: string) => void;
  kalshiPrices: { top: number; bottom: number; topName: string; bottomName: string; volume: number } | null;
  position: MatchupPosition | null;
  espnPick: EspnBracketPick | null;
}) {
  const comp = event.competitions[0];
  if (!comp) return null;

  const competitors = comp.competitors;
  const statusState = event.status.type.state;
  const isLive = statusState === 'in';
  const isFinal = statusState === 'post';
  const isScheduled = statusState === 'pre';

  // Check if teams are TBD (placeholder games for future rounds)
  const isTBDGame = competitors.every(c =>
    c.team.shortDisplayName === 'TBD' || c.team.displayName === 'TBD' || !c.team.location
  );

  // Start time for scheduled games - show TBD if teams aren't set yet
  let startTime = 'TBD';
  if (!isTBDGame) {
    const gameDate = new Date(event.date);
    // Check for placeholder times (ESPN uses midnight or late-night UTC for TBD times)
    const hours = gameDate.getUTCHours();
    const minutes = gameDate.getUTCMinutes();
    if (hours === 0 && minutes === 0) {
      startTime = 'TBD';
    } else {
      startTime = gameDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    }
  }

  // Status display
  const statusDetail = event.status.type.description;
  const isHalftime = statusDetail?.toLowerCase() === 'halftime'
    || (event.status.displayClock === '0:00' && event.status.period === 1);

  // Determine winner
  const comp1 = competitors[0];
  const comp2 = competitors[1];

  // Get win probabilities from bracket matchup
  let prob1: number | null = null;
  let prob2: number | null = null;
  if (matchup && isScheduled) {
    const m1IsTop = comp1.team.id === matchup.topTeam?.id;
    prob1 = m1IsTop ? matchup.topWinProbability : matchup.bottomWinProbability;
    prob2 = m1IsTop ? matchup.bottomWinProbability : matchup.topWinProbability;
  } else if (matchup && isLive && matchup.liveTopWinProbability !== null) {
    const m1IsTop = comp1.team.id === matchup.topTeam?.id;
    prob1 = m1IsTop ? matchup.liveTopWinProbability : (1 - matchup.liveTopWinProbability);
    prob2 = m1IsTop ? (1 - matchup.liveTopWinProbability) : matchup.liveTopWinProbability;
  }

  const handleClick = () => {
    if (!matchup) return;
    const isMobile = window.innerWidth <= 600;
    if (isMobile && (statusState === 'in' || statusState === 'post') && matchup.espnEventId) {
      window.location.hash = 'game/' + matchup.espnEventId;
    } else if (isMobile) {
      window.location.hash = 'preview/' + matchup.id;
    } else {
      onOpen(matchup.id);
    }
  };

  return (
    <div
      className={`${styles.card} ${isLive ? styles.cardLive : ''} ${isFinal ? styles.cardFinal : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      {/* Status bar */}
      <div className={styles.cardHeader}>
        <div className={styles.cardStatus}>
          {isLive && (
            <>
              <span className={styles.liveDot} />
              {isHalftime ? (
                <span className={styles.statusLive}>Halftime</span>
              ) : (
                <span className={styles.statusLive}>
                  {event.status.displayClock} · {
                    event.status.period === 1 ? '1st' :
                    event.status.period === 2 ? '2nd' :
                    `OT${event.status.period - 2 || ''}`
                  }
                </span>
              )}
            </>
          )}
          {isFinal && <span className={styles.statusFinal}>Final</span>}
          {isScheduled && <span className={styles.statusScheduled}>{startTime}</span>}
        </div>
        <div className={styles.cardHeaderRight}>
          {comp.broadcasts?.[0]?.names?.[0] && (
            <span className={styles.broadcastBadge}>{comp.broadcasts[0].names[0]}</span>
          )}
          <span className={styles.cardRound}>{getRoundForDate(event.date.slice(0, 10).replace(/-/g, ''))}</span>
        </div>
      </div>

      {/* Team rows */}
      {[comp1, comp2].map((team, idx) => {
        const score = parseInt(team.score, 10);
        const isWinner = isFinal && team.winner;
        const isLoser = isFinal && !team.winner;
        const prob = idx === 0 ? prob1 : prob2;
        const rawSeed = team.curatedRank?.current;
        const seed = rawSeed && rawSeed <= 16 ? rawSeed : null;
        const teamName = team.team.shortDisplayName || team.team.location || 'TBD';

        // Check if this team is the user's ESPN bracket pick
        const isPickedTeam = espnPick && matchup && (() => {
          const compIsTop = team.team.id === matchup.topTeam?.id;
          const compIsBottom = team.team.id === matchup.bottomTeam?.id;
          return (espnPick.side === 'top' && compIsTop) || (espnPick.side === 'bottom' && compIsBottom);
        })();

        return (
          <div
            key={team.id}
            className={`${styles.teamRow} ${isWinner ? styles.teamWinner : ''} ${isLoser ? styles.teamLoser : ''}`}
          >
            {isPickedTeam && (
              <span className={`${styles.pickDot} ${
                espnPick!.result === 'CORRECT' ? styles.pickDotCorrect :
                espnPick!.result === 'INCORRECT' ? styles.pickDotIncorrect :
                styles.pickDotPending
              }`} />
            )}
            {teamName !== 'TBD' && (
              <img
                className={styles.teamLogo}
                src={team.team.logo}
                alt=""
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            {!seed && teamName === 'TBD' ? null : (
              <span className={styles.teamSeed}>{seed ?? ''}</span>
            )}
            <span className={styles.teamName}>{teamName}</span>
            <span className={styles.teamScore}>
              {isScheduled ? '' : (isNaN(score) ? '-' : score)}
            </span>
            {prob !== null && (
              <span className={styles.teamProb} style={{ opacity: (isFinal ? 0 : 1) }}>
                {Math.round(prob * 100)}%
              </span>
            )}
            {isFinal && isWinner && <span className={styles.winnerCheck}>✓</span>}
          </div>
        );
      })}

      {/* Win probability bar for live/scheduled */}
      {prob1 !== null && prob2 !== null && !isFinal && (
        <div className={styles.probBar}>
          <div
            className={styles.probBarFill}
            style={{
              width: `${Math.max(prob1 * 100, 5)}%`,
              background: `#${competitors[0].team.color || '666'}`,
            }}
          />
          <div
            className={styles.probBarFill}
            style={{
              width: `${Math.max(prob2 * 100, 5)}%`,
              background: `#${competitors[1].team.color || '999'}`,
            }}
          />
        </div>
      )}

      {/* Betting odds for non-final games */}
      {!isFinal && comp.odds && comp.odds.length > 0 && (
        <div className={styles.oddsRow}>
          {comp.odds[0].details && (
            <span className={styles.oddsItem}>{comp.odds[0].details}</span>
          )}
          {comp.odds[0].overUnder > 0 && (
            <span className={styles.oddsItem}>O/U {comp.odds[0].overUnder}</span>
          )}
        </div>
      )}

      {/* Kalshi prediction market prices */}
      {kalshiPrices && kalshiPrices.volume > 0 && (
        <div className={styles.kalshiRow}>
          <span className={styles.kalshiBadge}>Kalshi</span>
          <span className={styles.kalshiTeam}>{kalshiPrices.topName}</span>
          <span className={styles.kalshiPrice}>{Math.round(kalshiPrices.top * 100)}¢</span>
          <span className={styles.kalshiSep}>-</span>
          <span className={styles.kalshiTeam}>{kalshiPrices.bottomName}</span>
          <span className={styles.kalshiPrice}>{Math.round(kalshiPrices.bottom * 100)}¢</span>
          <span className={styles.kalshiVol}>{formatVolume(kalshiPrices.volume)}</span>
        </div>
      )}

      {/* User's Kalshi position */}
      {position && (
        <div className={styles.positionRow}>
          <span className={styles.positionLabel}>Your position:</span>
          <span className={styles.positionContracts}>
            {position.contracts > 0 ? position.contracts : Math.abs(position.contracts)}{' '}
            {position.contracts > 0 ? 'YES' : 'NO'}
          </span>
          <span className={styles.positionTeam}>{position.teamName}</span>
          <span className={styles.positionPrice}>@ {Math.round(position.currentPrice * 100)}¢</span>
        </div>
      )}

      {/* ESPN bracket pick */}
      {espnPick && (
        <div className={`${styles.espnPickRow} ${
          espnPick.result === 'CORRECT' ? styles.espnPickCorrect :
          espnPick.result === 'INCORRECT' ? styles.espnPickIncorrect :
          styles.espnPickPending
        }`}>
          <span className={styles.espnPickLabel}>
            {espnPick.result === 'CORRECT' ? 'YOUR PICK \u2713' :
             espnPick.result === 'INCORRECT' ? 'YOUR PICK \u2717' :
             'YOUR PICK'}
          </span>
          <span className={espnPick.result === 'INCORRECT' ? styles.espnPickTeamStrike : styles.espnPickTeam}>
            {espnPick.teamName}
          </span>
          <span className={styles.espnPickPoints}>
            {espnPick.result === 'CORRECT' ? '+' : ''}{espnPick.pointValue}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Scoreboard ──────────────────────────────────────

export function Scoreboard({ state }: ScoreboardProps) {
  const [selectedDate, setSelectedDate] = useState(findClosestDate);
  const [events, setEvents] = useState<EspnEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { openPreview } = usePreviewContext();
  const kalshi = useKalshiContext();
  const espnBracket = useEspnBracketContext();

  // Fetch ESPN scoreboard for selected date
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchScoreboard(selectedDate).then(data => {
      if (cancelled) return;
      const tourney = filterTournamentGames(data.events);
      setEvents(tourney);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [selectedDate]);

  // Auto-refresh for live games
  useEffect(() => {
    const hasLive = events.some(e => e.status.type.state === 'in');
    if (!hasLive) return;

    const interval = setInterval(async () => {
      try {
        const data = await fetchScoreboard(selectedDate);
        const tourney = filterTournamentGames(data.events);
        setEvents(tourney);
      } catch { /* ignore */ }
    }, 30000);

    return () => clearInterval(interval);
  }, [events, selectedDate]);

  // Sort events
  const sortedEvents = useMemo(() => sortEvents(events), [events]);

  // Match events to bracket matchups
  const eventMatchups = useMemo(() => {
    const map = new Map<string, Matchup | null>();
    for (const event of sortedEvents) {
      map.set(event.id, findMatchupForEvent(event, state.matchups));
    }
    return map;
  }, [sortedEvents, state.matchups]);

  // Count by status
  const liveCount = events.filter(e => e.status.type.state === 'in').length;
  const finalCount = events.filter(e => e.status.type.state === 'post').length;
  const scheduledCount = events.filter(e => e.status.type.state === 'pre').length;

  return (
    <div className={styles.container}>
      {/* Date selector */}
      <div className={styles.dateBar}>
        <div className={styles.dateScroller}>
          {ALL_TOURNAMENT_DATES.map(date => {
            const round = getRoundForDate(date);
            const label = formatDateLabel(date);
            const isSelected = date === selectedDate;

            return (
              <button
                key={date}
                className={`${styles.dateBtn} ${isSelected ? styles.dateBtnActive : ''}`}
                onClick={() => setSelectedDate(date)}
              >
                <span className={styles.dateBtnDay}>{label}</span>
                <span className={styles.dateBtnRound}>{round}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status summary */}
      <div className={styles.summary}>
        <span className={styles.summaryTitle}>
          {getRoundForDate(selectedDate)} · {formatDateLabel(selectedDate)}
        </span>
        <div className={styles.summaryBadges}>
          {liveCount > 0 && (
            <span className={styles.badgeLive}>
              <span className={styles.liveDot} />
              {liveCount} Live
            </span>
          )}
          {scheduledCount > 0 && (
            <span className={styles.badgeScheduled}>{scheduledCount} Scheduled</span>
          )}
          {finalCount > 0 && (
            <span className={styles.badgeFinal}>{finalCount} Final</span>
          )}
        </div>
      </div>

      {/* ESPN bracket scoring summary */}
      {espnBracket.data && (
        <div className={styles.espnSummaryBar}>
          <span className={styles.espnSummaryName}>{espnBracket.data.entryName}</span>
          <span className={styles.espnSummaryScore}>{espnBracket.data.score.overallScore} pts</span>
          <span className={styles.espnSummaryDetail}>
            {espnBracket.data.score.record.wins}-{espnBracket.data.score.record.losses}
          </span>
          <span className={styles.espnSummaryDetail}>
            #{espnBracket.data.score.rank.toLocaleString()}
          </span>
          <span className={styles.espnSummaryDetail}>
            Top {Math.round((1 - espnBracket.data.score.percentile) * 100)}%
          </span>
        </div>
      )}

      {/* Games grid */}
      {loading ? (
        <div className={styles.loadingState}>Loading games...</div>
      ) : sortedEvents.length === 0 ? (
        <div className={styles.emptyState}>No tournament games on this date</div>
      ) : (
        <div className={styles.grid}>
          {sortedEvents.map(event => {
            const m = eventMatchups.get(event.id) ?? null;
            const kd = m ? kalshi.matchupMarkets.get(m.id) : undefined;
            const competitors = event.competitions[0]?.competitors;
            let kalshiPrices: { top: number; bottom: number; topName: string; bottomName: string; volume: number } | null = null;
            if (kd && m && competitors && competitors.length >= 2) {
              const comp1IsTop = competitors[0].team.id === m.topTeam?.id;
              const topAbbr = competitors[0].team.shortDisplayName || competitors[0].team.location || '';
              const bottomAbbr = competitors[1].team.shortDisplayName || competitors[1].team.location || '';
              kalshiPrices = {
                top: comp1IsTop ? kd.topMarket.price : kd.bottomMarket.price,
                bottom: comp1IsTop ? kd.bottomMarket.price : kd.topMarket.price,
                topName: topAbbr,
                bottomName: bottomAbbr,
                volume: kd.totalVolume,
              };
            }
            const pos = m ? kalshi.positions.get(m.id) ?? null : null;
            const pick = m ? getPickForMatchup(espnBracket.data, m.id) : null;
            return (
              <GameCard
                key={event.id}
                event={event}
                matchup={m}
                onOpen={openPreview}
                kalshiPrices={kalshiPrices}
                position={pos}
                espnPick={pick}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
