import { useState, useMemo, useRef, useEffect } from 'react';
import type { BracketState, Matchup, RoundName, RegionName } from '../../types/bracket';
import type { EspnBracketPick, EspnBracketData } from '../../types/espn-bracket';
import { ROUND_LABELS } from '../../types/bracket';
import { REGION_NAMES, REGION_COLORS } from '../../data/constants';
import { usePreviewContext } from '../../hooks/usePreview';
import { useEspnBracketContext, getPickForMatchup } from '../../hooks/useEspnBracket';
import styles from './MobileBracket.module.css';

interface MobileBracketProps {
  state: BracketState;
}

// ─── Constants ────────────────────────────────────────────

const TAB_ROUNDS: RoundName[] = ROUND_LABELS.filter(r => r !== 'First Four');

const TAB_LABELS: Record<RoundName, string> = {
  'First Four': 'F4',
  'Round of 64': 'RD 1',
  'Round of 32': 'RD 2',
  'Sweet 16': 'SWEET 16',
  'Elite 8': 'ELITE 8',
  'Final Four': 'FINAL 4',
  'Championship': 'FINAL',
};

const ROUND_DATE_LABELS: Record<RoundName, string> = {
  'First Four': 'Mar 17–18',
  'Round of 64': 'Mar 19–20',
  'Round of 32': 'Mar 21–22',
  'Sweet 16': 'Mar 26–27',
  'Elite 8': 'Mar 28–29',
  'Final Four': 'Apr 4',
  'Championship': 'Apr 6',
};

const ROUND_POINTS: Record<RoundName, number> = {
  'First Four': 0,
  'Round of 64': 10,
  'Round of 32': 20,
  'Sweet 16': 40,
  'Elite 8': 80,
  'Final Four': 160,
  'Championship': 320,
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function sortByPosition(matchups: Matchup[]): Matchup[] {
  return [...matchups].sort((a, b) => a.position - b.position);
}

// ─── Bracket Pair Data ────────────────────────────────────

interface BracketPairData {
  games: Matchup[];
  nextGame: Matchup | null;
}

// ─── Compact Game Card ────────────────────────────────────

function CompactCard({
  matchup,
  espnPick,
  showMyPicks,
  isNextRound = false,
}: {
  matchup: Matchup;
  espnPick: EspnBracketPick | null;
  showMyPicks: boolean;
  isNextRound?: boolean;
}) {
  const { openPreview } = usePreviewContext();
  const isLive = matchup.status === 'in_progress';
  const isFinal = matchup.status === 'final';
  const isScheduled = matchup.status === 'scheduled';

  const isHalftime = matchup.statusDetail?.toLowerCase() === 'halftime'
    || (matchup.clock === '0:00' && matchup.period === 1);

  let statusText = '';
  let statusType: 'live' | 'final' | 'time' = 'time';

  if (isLive) {
    statusType = 'live';
    if (isHalftime) {
      statusText = 'HALF';
    } else {
      const periodStr = matchup.period === 1 ? '1H'
        : matchup.period === 2 ? '2H'
        : `OT${(matchup.period ?? 3) - 2 || ''}`;
      statusText = `${matchup.clock || ''} ${periodStr}`;
    }
  } else if (isFinal) {
    statusType = 'final';
    statusText = matchup.period && matchup.period > 2
      ? `FINAL/OT${matchup.period - 2 || ''}`
      : 'FINAL';
  } else {
    statusText = matchup.statusDetail || '';
  }

  const handleClick = () => {
    if (isNextRound) return;
    if ((isLive || isFinal) && matchup.espnEventId) {
      window.location.hash = 'game/' + matchup.espnEventId;
    } else {
      openPreview(matchup.id);
    }
  };

  // TBD card
  if (!matchup.topTeam && !matchup.bottomTeam) {
    return (
      <div className={`${styles.card} ${styles.cardEmpty} ${isNextRound ? styles.cardNext : ''}`}>
        <div className={styles.teamRow}>
          <span className={styles.teamName} style={{ color: '#bbb' }}>TBD</span>
        </div>
        <div className={styles.cardDivider} />
        <div className={styles.teamRow}>
          <span className={styles.teamName} style={{ color: '#bbb' }}>TBD</span>
        </div>
      </div>
    );
  }

  const pickClass = espnPick
    ? espnPick.result === 'CORRECT' ? styles.pickCorrect
    : espnPick.result === 'INCORRECT' ? styles.pickIncorrect
    : styles.pickPending
    : '';

  return (
    <div
      className={`${styles.card} ${isLive ? styles.cardLive : ''} ${isFinal ? styles.cardFinal : ''} ${isNextRound ? styles.cardNext : ''} ${showMyPicks && espnPick ? styles.cardHasPick : ''} ${showMyPicks && espnPick ? pickClass : ''}`}
      onClick={handleClick}
      role={isNextRound ? undefined : 'button'}
      tabIndex={isNextRound ? undefined : 0}
    >
      {/* ESPN pick banner */}
      {showMyPicks && espnPick && !isNextRound && (
        <div className={`${styles.pickBanner} ${pickClass}`}>
          <span className={styles.pickLabel}>PICK</span>
          <span className={styles.pickTeam}>{espnPick.teamAbbrev}</span>
          {espnPick.result === 'CORRECT' && <span className={styles.pickIcon}>✓</span>}
          {espnPick.result === 'INCORRECT' && <span className={styles.pickIcon}>✗</span>}
          <span className={styles.pickPts}>
            {espnPick.result === 'CORRECT' ? `+${espnPick.pointValue}` : `${espnPick.pointValue} pts`}
          </span>
        </div>
      )}

      {/* Status badge */}
      {statusText && !isNextRound && (
        <div className={`${styles.statusBadge} ${statusType === 'live' ? styles.statusLive : statusType === 'final' ? styles.statusFinal : styles.statusTime}`}>
          {isLive && <span className={styles.liveDot} />}
          {statusText}
        </div>
      )}

      {/* Team rows */}
      {[
        { team: matchup.topTeam, score: matchup.topScore, side: 'top' as const },
        { team: matchup.bottomTeam, score: matchup.bottomScore, side: 'bottom' as const },
      ].map(({ team, score, side }, idx) => {
        const isWinner = isFinal && matchup.winner === side;
        const isLoser = isFinal && matchup.winner !== null && matchup.winner !== side;
        const isPicked = showMyPicks && espnPick?.side === side;

        return (
          <div key={side}>
            {idx === 1 && <div className={styles.cardDivider} />}
            <div
              className={`${styles.teamRow} ${isWinner ? styles.teamWinner : ''} ${isLoser ? styles.teamLoser : ''} ${isPicked ? styles.teamPicked : ''}`}
            >
              {team ? (
                <>
                  <img
                    className={isNextRound ? styles.teamLogoSm : styles.teamLogo}
                    src={team.logoUrl}
                    alt=""
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className={isNextRound ? styles.teamSeedSm : styles.teamSeed}>{team.seed}</span>
                  <span className={isNextRound ? styles.teamNameSm : styles.teamName}>
                    {isNextRound
                      ? (team.abbreviation || team.shortName || team.name)
                      : (team.shortName || team.name)}
                  </span>
                  {!isNextRound && !isScheduled && score !== null && (
                    <span className={`${styles.teamScore} ${isWinner ? styles.scoreWinner : ''}`}>
                      {score}
                    </span>
                  )}
                  {!isNextRound && isWinner && <span className={styles.winCheck}>✓</span>}
                </>
              ) : (
                <span className={isNextRound ? styles.teamNameSm : styles.teamName} style={{ color: '#bbb', fontStyle: 'italic' }}>TBD</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Bracket Pair View ────────────────────────────────────

function BracketPairView({
  pair,
  showMyPicks,
  espnData,
  showConnector,
}: {
  pair: BracketPairData;
  showMyPicks: boolean;
  espnData: EspnBracketData | null;
  showConnector: boolean;
}) {
  const hasTwoGames = pair.games.length >= 2;

  return (
    <div className={styles.bracketPair}>
      <div className={styles.pairSource}>
        {pair.games.map(g => (
          <CompactCard
            key={g.id}
            matchup={g}
            espnPick={getPickForMatchup(espnData, g.id)}
            showMyPicks={showMyPicks}
          />
        ))}
      </div>
      {showConnector && (
        <>
          <div className={`${styles.connector} ${!hasTwoGames ? styles.connectorFlat : ''}`} />
          <div className={styles.pairDest}>
            {pair.nextGame ? (
              <CompactCard
                matchup={pair.nextGame}
                espnPick={getPickForMatchup(espnData, pair.nextGame.id)}
                showMyPicks={showMyPicks}
                isNextRound
              />
            ) : (
              <div className={`${styles.card} ${styles.cardEmpty} ${styles.cardNext}`}>
                <div className={styles.teamRow}><span className={styles.teamNameSm} style={{ color: '#bbb' }}>TBD</span></div>
                <div className={styles.cardDivider} />
                <div className={styles.teamRow}><span className={styles.teamNameSm} style={{ color: '#bbb' }}>TBD</span></div>
              </div>
            )}
          </div>
        </>
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

  // Current active round
  const currentRound = useMemo((): RoundName => {
    for (const round of TAB_ROUNDS) {
      const hasActiveGame = Array.from(matchups.values()).some(
        m => m.round === round && m.status !== 'final'
      );
      if (hasActiveGame) return round;
    }
    for (let i = TAB_ROUNDS.length - 1; i >= 0; i--) {
      const hasGames = Array.from(matchups.values()).some(m => m.round === TAB_ROUNDS[i]);
      if (hasGames) return TAB_ROUNDS[i];
    }
    return 'Round of 64';
  }, [matchups]);

  const [selectedRound, setSelectedRound] = useState<RoundName>(currentRound);
  const isLastRound = selectedRound === 'Championship';

  // Scroll active tab into view
  useEffect(() => {
    if (!tabScrollerRef.current) return;
    const idx = TAB_ROUNDS.indexOf(selectedRound);
    const btn = tabScrollerRef.current.children[idx] as HTMLElement | undefined;
    if (btn) btn.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [selectedRound]);

  // Build bracket pairs for the selected round
  const { regionSections, ungroupedPairs } = useMemo(() => {
    // Championship: single game, no pairing
    if (selectedRound === 'Championship') {
      const m = matchups.get(championshipMatchupId);
      return {
        regionSections: [],
        ungroupedPairs: m ? [{ games: [m], nextGame: null }] : [],
      };
    }

    // Final Four: 2 games → Championship
    if (selectedRound === 'Final Four') {
      const ffGames = finalFourMatchupIds
        .map(id => matchups.get(id))
        .filter((m): m is Matchup => !!m && m.round === 'Final Four');
      const champGame = matchups.get(championshipMatchupId) || null;
      return {
        regionSections: [],
        ungroupedPairs: [{ games: sortByPosition(ffGames), nextGame: champGame }],
      };
    }

    // Elite 8: cross-region pairing by nextMatchupId
    if (selectedRound === 'Elite 8') {
      const allE8 = Array.from(matchups.values()).filter(m => m.round === 'Elite 8');
      const pairMap = new Map<string, Matchup[]>();
      for (const g of sortByPosition(allE8)) {
        const key = g.nextMatchupId || g.id;
        if (!pairMap.has(key)) pairMap.set(key, []);
        pairMap.get(key)!.push(g);
      }
      const pairs: BracketPairData[] = [];
      for (const [nextId, games] of pairMap) {
        pairs.push({ games, nextGame: matchups.get(nextId) || null });
      }
      return { regionSections: [], ungroupedPairs: pairs };
    }

    // Region rounds (R64, R32, S16): group by region, then pair within region
    const sections: { name: RegionName; color: string; pairs: BracketPairData[] }[] = [];

    for (const regionName of REGION_NAMES) {
      const ids = regionMatchupIds[regionName] || [];
      const games = ids
        .map(id => matchups.get(id))
        .filter((m): m is Matchup => !!m && m.round === selectedRound);
      if (games.length === 0) continue;

      const sorted = sortByPosition(games);
      const pairMap = new Map<string, Matchup[]>();
      for (const g of sorted) {
        const key = g.nextMatchupId || g.id;
        if (!pairMap.has(key)) pairMap.set(key, []);
        pairMap.get(key)!.push(g);
      }

      const pairs: BracketPairData[] = [];
      for (const [nextId, pairGames] of pairMap) {
        pairs.push({ games: pairGames, nextGame: matchups.get(nextId) || null });
      }

      sections.push({ name: regionName, color: REGION_COLORS[regionName], pairs });
    }

    return { regionSections: sections, ungroupedPairs: [] };
  }, [selectedRound, matchups, regionMatchupIds, finalFourMatchupIds, championshipMatchupId]);

  const hasGames = regionSections.length > 0 || ungroupedPairs.length > 0;
  const score = espnBracket.data?.score;

  return (
    <div className={styles.container}>
      {/* ESPN Score Bar */}
      {hasBracket && score && (
        <div className={styles.scoreBar}>
          <div className={styles.scoreItem}>
            <span className={styles.scoreVal}>{score.overallScore}</span>
            <span className={styles.scoreLbl}>PTS</span>
          </div>
          <div className={styles.scoreSep} />
          <div className={styles.scoreItem}>
            <span className={styles.scoreVal}>{score.record.wins}-{score.record.losses}</span>
            <span className={styles.scoreLbl}>W-L</span>
          </div>
          <div className={styles.scoreSep} />
          <div className={styles.scoreItem}>
            <span className={styles.scoreVal}>
              {score.percentile != null ? ordinal(Math.round(score.percentile)) : `#${score.rank}`}
            </span>
            <span className={styles.scoreLbl}>PCTILE</span>
          </div>
          <div className={styles.scoreSep} />
          <div className={styles.scoreItem}>
            <span className={styles.scoreVal}>{score.possiblePointsRemaining}</span>
            <span className={styles.scoreLbl}>LEFT</span>
          </div>
        </div>
      )}

      {/* My Picks toggle */}
      {hasBracket && (
        <div className={styles.picksToggle}>
          <button
            className={`${styles.picksBtn} ${!showMyPicks ? styles.picksBtnActive : ''}`}
            onClick={() => setShowMyPicks(false)}
          >
            Live Bracket
          </button>
          <button
            className={`${styles.picksBtn} ${showMyPicks ? styles.picksBtnActive : ''}`}
            onClick={() => setShowMyPicks(true)}
          >
            My Picks
          </button>
        </div>
      )}

      {/* Round tabs */}
      <div className={styles.roundBar}>
        <div className={styles.roundScroller} ref={tabScrollerRef}>
          {TAB_ROUNDS.map(round => {
            const pts = ROUND_POINTS[round];
            return (
              <button
                key={round}
                className={`${styles.roundTab} ${round === selectedRound ? styles.roundTabActive : ''}`}
                onClick={() => setSelectedRound(round)}
              >
                <span className={styles.roundLabel}>{TAB_LABELS[round]}</span>
                <span className={styles.roundDate}>{ROUND_DATE_LABELS[round]}</span>
                {pts > 0 && hasBracket && <span className={styles.roundPts}>{pts} pts</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bracket content */}
      {!hasGames ? (
        <div className={styles.emptyState}>No games in this round yet</div>
      ) : (
        <div className={styles.bracketContent}>
          {/* Region-grouped pairs */}
          {regionSections.map(section => (
            <div key={section.name} className={styles.regionSection}>
              <div className={styles.regionHeader}>
                <div className={styles.regionDot} style={{ background: section.color }} />
                <span className={styles.regionName} style={{ color: section.color }}>{section.name}</span>
                <div className={styles.regionLine} style={{ background: section.color }} />
              </div>
              {section.pairs.map((pair, i) => (
                <BracketPairView
                  key={i}
                  pair={pair}
                  showMyPicks={showMyPicks}
                  espnData={espnBracket.data}
                  showConnector={!isLastRound}
                />
              ))}
            </div>
          ))}

          {/* Ungrouped pairs (E8 / Final Four / Championship) */}
          {ungroupedPairs.length > 0 && (
            <div className={styles.ungroupedSection}>
              {selectedRound === 'Elite 8' && (
                <div className={styles.regionHeader}>
                  <span className={styles.regionName} style={{ color: '#666' }}>Semifinals</span>
                  <div className={styles.regionLine} style={{ background: '#666' }} />
                </div>
              )}
              {selectedRound === 'Final Four' && (
                <div className={styles.regionHeader}>
                  <span className={styles.regionName} style={{ color: '#666' }}>Final Four</span>
                  <div className={styles.regionLine} style={{ background: '#666' }} />
                </div>
              )}
              {ungroupedPairs.map((pair, i) => (
                <BracketPairView
                  key={i}
                  pair={pair}
                  showMyPicks={showMyPicks}
                  espnData={espnBracket.data}
                  showConnector={!isLastRound}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
