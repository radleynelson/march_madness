import { useState, useMemo, useRef, useEffect } from 'react';
import type { BracketState, Matchup, RoundName, RegionName } from '../../types/bracket';
import type { EspnBracketPick } from '../../types/espn-bracket';
import { ROUND_LABELS } from '../../types/bracket';
import { REGION_NAMES, REGION_COLORS } from '../../data/constants';
import { usePreviewContext } from '../../hooks/usePreview';
import { useEspnBracketContext, getPickForMatchup } from '../../hooks/useEspnBracket';
import styles from './MobileBracket.module.css';

interface MobileBracketProps {
  state: BracketState;
}

// Short labels for the round tabs
const SHORT_LABELS: Record<RoundName, string> = {
  'First Four': 'F4',
  'Round of 64': 'R64',
  'Round of 32': 'R32',
  'Sweet 16': 'S16',
  'Elite 8': 'E8',
  'Final Four': 'FF',
  'Championship': 'CHAMP',
};

// Rounds to show in tabs (skip First Four)
const TAB_ROUNDS: RoundName[] = ROUND_LABELS.filter(r => r !== 'First Four');

/** Sort by bracket position (same order as the bracket, top to bottom) */
function sortByPosition(matchups: Matchup[]): Matchup[] {
  return [...matchups].sort((a, b) => a.position - b.position);
}

// ─── Game Card ────────────────────────────────────────────

function GameCard({ matchup, espnPick, showMyPicks }: { matchup: Matchup; espnPick: EspnBracketPick | null; showMyPicks: boolean }) {
  const { openPreview } = usePreviewContext();

  const isLive = matchup.status === 'in_progress';
  const isFinal = matchup.status === 'final';
  const isScheduled = matchup.status === 'scheduled';

  // Determine win probabilities
  let topProb: number | null = null;
  let bottomProb: number | null = null;
  if (isScheduled && matchup.topTeam && matchup.bottomTeam) {
    topProb = matchup.topWinProbability;
    bottomProb = matchup.bottomWinProbability;
  } else if (isLive && matchup.liveTopWinProbability !== null) {
    topProb = matchup.liveTopWinProbability;
    bottomProb = 1 - matchup.liveTopWinProbability;
  }

  // Status display
  const isHalftime = matchup.statusDetail?.toLowerCase() === 'halftime'
    || (matchup.clock === '0:00' && matchup.period === 1);

  let statusText = '';
  if (isLive) {
    if (isHalftime) {
      statusText = 'Halftime';
    } else {
      const periodStr = matchup.period === 1 ? '1st'
        : matchup.period === 2 ? '2nd'
        : `OT${(matchup.period ?? 3) - 2 || ''}`;
      statusText = `${matchup.clock || ''} · ${periodStr}`;
    }
  } else if (isFinal) {
    statusText = 'Final';
  } else if (isScheduled && matchup.statusDetail) {
    // Parse start time from statusDetail
    statusText = matchup.statusDetail;
  }

  const handleClick = () => {
    if ((isLive || isFinal) && matchup.espnEventId) {
      window.location.hash = 'game/' + matchup.espnEventId;
    } else {
      openPreview(matchup.id);
    }
  };

  // If both teams are null, show TBD card
  if (!matchup.topTeam && !matchup.bottomTeam) {
    return (
      <div className={styles.emptyCard}>
        TBD
      </div>
    );
  }

  return (
    <div
      className={`${styles.card} ${isLive ? styles.cardLive : ''} ${isFinal ? styles.cardFinal : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      {/* Status header */}
      <div className={styles.cardHeader}>
        <div className={styles.cardStatus}>
          {isLive && (
            <>
              <span className={styles.liveDot} />
              <span className={styles.statusLive}>{statusText}</span>
            </>
          )}
          {isFinal && <span className={styles.statusFinal}>{statusText}</span>}
          {isScheduled && <span className={styles.statusScheduled}>{statusText || 'Scheduled'}</span>}
        </div>
      </div>

      {/* Team rows */}
      {[
        { team: matchup.topTeam, score: matchup.topScore, side: 'top' as const, prob: topProb },
        { team: matchup.bottomTeam, score: matchup.bottomScore, side: 'bottom' as const, prob: bottomProb },
      ].map(({ team, score, side, prob }) => {
        const isWinner = isFinal && matchup.winner === side;
        const isLoser = isFinal && matchup.winner !== null && matchup.winner !== side;
        const isPickedTeam = showMyPicks && espnPick && espnPick.side === side;

        if (!team) {
          return (
            <div key={side} className={styles.teamRow}>
              <span className={styles.teamName} style={{ color: '#aaa' }}>TBD</span>
            </div>
          );
        }

        return (
          <div
            key={side}
            className={`${styles.teamRow} ${isWinner ? styles.teamWinner : ''} ${isLoser ? styles.teamLoser : ''}`}
          >
            {isPickedTeam && (
              <span className={`${styles.pickDot} ${
                espnPick!.result === 'CORRECT' ? styles.pickCorrect :
                espnPick!.result === 'INCORRECT' ? styles.pickIncorrect :
                styles.pickPending
              }`} />
            )}
            <img
              className={styles.teamLogo}
              src={team.logoUrl}
              alt=""
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className={styles.teamSeed}>{team.seed}</span>
            <span className={styles.teamName}>{team.shortName || team.name}</span>
            {!isScheduled && (
              <span className={styles.teamScore}>
                {score !== null ? score : '-'}
              </span>
            )}
            {prob !== null && !isFinal && (
              <span className={styles.teamProb}>
                {Math.round(prob * 100)}%
              </span>
            )}
            {isWinner && <span className={styles.winnerCheck}>✓</span>}
          </div>
        );
      })}

      {/* Win probability bar for live/scheduled */}
      {topProb !== null && bottomProb !== null && !isFinal && matchup.topTeam && matchup.bottomTeam && (
        <div className={styles.probBar}>
          <div
            className={styles.probBarFill}
            style={{
              width: `${Math.max(topProb * 100, 5)}%`,
              background: `#${matchup.topTeam.primaryColor || '666'}`,
            }}
          />
          <div
            className={styles.probBarFill}
            style={{
              width: `${Math.max(bottomProb * 100, 5)}%`,
              background: `#${matchup.bottomTeam.primaryColor || '999'}`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────

export function MobileBracket({ state }: MobileBracketProps) {
  const { matchups, regionMatchupIds, finalFourMatchupIds, championshipMatchupId } = state;
  const tabScrollerRef = useRef<HTMLDivElement>(null);
  const [showMyPicks, setShowMyPicks] = useState(false);
  const espnBracket = useEspnBracketContext();
  const hasBracket = espnBracket.data !== null;

  // Determine the current/active round (earliest round with non-final games)
  const currentRound = useMemo((): RoundName => {
    for (const round of TAB_ROUNDS) {
      const hasActiveGame = Array.from(matchups.values()).some(
        m => m.round === round && m.status !== 'final'
      );
      if (hasActiveGame) return round;
    }
    // All games final - show the last round that has games
    for (let i = TAB_ROUNDS.length - 1; i >= 0; i--) {
      const hasGames = Array.from(matchups.values()).some(m => m.round === TAB_ROUNDS[i]);
      if (hasGames) return TAB_ROUNDS[i];
    }
    return 'Round of 64';
  }, [matchups]);

  const [selectedRound, setSelectedRound] = useState<RoundName>(currentRound);

  // Scroll active tab into view on mount
  useEffect(() => {
    if (!tabScrollerRef.current) return;
    const idx = TAB_ROUNDS.indexOf(selectedRound);
    const btn = tabScrollerRef.current.children[idx] as HTMLElement | undefined;
    if (btn) {
      btn.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }, [selectedRound]);

  // Get matchups for the selected round, grouped by region
  const roundData = useMemo(() => {
    const isFinalFourRound = selectedRound === 'Final Four';
    const isChampionship = selectedRound === 'Championship';

    if (isChampionship) {
      const m = matchups.get(championshipMatchupId);
      return { regions: [], ungrouped: m ? [m] : [] };
    }

    if (isFinalFourRound) {
      const games = finalFourMatchupIds
        .map(id => matchups.get(id))
        .filter((m): m is Matchup => m !== undefined && m.round === 'Final Four');
      return { regions: [], ungrouped: sortByPosition(games) };
    }

    // Regular rounds - group by region
    const regions: { name: RegionName; color: string; games: Matchup[] }[] = [];

    for (const regionName of REGION_NAMES) {
      const ids = regionMatchupIds[regionName] || [];
      const games = ids
        .map(id => matchups.get(id))
        .filter((m): m is Matchup => m !== undefined && m.round === selectedRound);

      if (games.length > 0) {
        regions.push({
          name: regionName,
          color: REGION_COLORS[regionName],
          games: sortByPosition(games),
        });
      }
    }

    return { regions, ungrouped: [] };
  }, [selectedRound, matchups, regionMatchupIds, finalFourMatchupIds, championshipMatchupId]);

  const hasGames = roundData.regions.length > 0 || roundData.ungrouped.length > 0;

  return (
    <div className={styles.container}>
      {/* My Picks toggle */}
      {hasBracket && (
        <div className={styles.picksToggle}>
          <button
            className={`${styles.picksToggleBtn} ${!showMyPicks ? styles.picksToggleBtnActive : ''}`}
            onClick={() => setShowMyPicks(false)}
          >
            Live Bracket
          </button>
          <button
            className={`${styles.picksToggleBtn} ${showMyPicks ? styles.picksToggleBtnActive : ''}`}
            onClick={() => setShowMyPicks(true)}
          >
            My Picks
          </button>
        </div>
      )}

      {/* Round tabs */}
      <div className={styles.tabBar}>
        <div className={styles.tabScroller} ref={tabScrollerRef}>
          {TAB_ROUNDS.map(round => (
            <button
              key={round}
              className={`${styles.tabBtn} ${round === selectedRound ? styles.tabBtnActive : ''}`}
              onClick={() => setSelectedRound(round)}
            >
              {SHORT_LABELS[round]}
            </button>
          ))}
        </div>
      </div>

      {/* Games */}
      {!hasGames ? (
        <div className={styles.emptyState}>No games in this round yet</div>
      ) : (
        <>
          {/* Region-grouped games */}
          {roundData.regions.map(region => (
            <div key={region.name}>
              <div className={styles.regionHeader}>
                <span className={styles.regionName} style={{ color: region.color }}>
                  {region.name}
                </span>
                <div className={styles.regionBar} style={{ background: region.color }} />
              </div>
              {region.games.map(m => (
                <GameCard
                  key={m.id}
                  matchup={m}
                  espnPick={getPickForMatchup(espnBracket.data, m.id)}
                  showMyPicks={showMyPicks}
                />
              ))}
            </div>
          ))}

          {/* Ungrouped games (Final Four / Championship) */}
          {roundData.ungrouped.map(m => (
            <GameCard
              key={m.id}
              matchup={m}
              espnPick={getPickForMatchup(espnBracket.data, m.id)}
              showMyPicks={showMyPicks}
            />
          ))}
        </>
      )}
    </div>
  );
}
