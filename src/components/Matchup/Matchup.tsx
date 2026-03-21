import { useCallback, useMemo, createContext, useContext } from 'react';
import type { Matchup as MatchupType } from '../../types/bracket';
import { useHoverContext } from '../../hooks/useHoverState';
import { usePreviewContext } from '../../hooks/usePreview';
import { useBracketContext } from '../../hooks/useBracketState';
import { useEspnBracketContext, getPickForMatchup } from '../../hooks/useEspnBracket';
import { winProbability } from '../../model/predictions';
import { TeamRow } from './TeamRow';
import { ProbabilityBar } from './ProbabilityBar';
import { LiveIndicator } from './LiveIndicator';
import styles from './Matchup.module.css';

/** Context to toggle "My Picks" mode on bracket views */
export const ShowMyPicksContext = createContext(false);
export function useShowMyPicks() { return useContext(ShowMyPicksContext); }

interface MatchupProps {
  matchup: MatchupType;
  compact?: boolean;
}

export function Matchup({ matchup, compact = false }: MatchupProps) {
  const {
    topTeam,
    bottomTeam,
    topWinProbability,
    status,
    topScore,
    bottomScore,
    clock,
    period,
    liveTopWinProbability,
    winner,
  } = matchup;

  const { hoveredTeamId, teamPath, setHoveredTeamId } = useHoverContext();
  const { openPreview } = usePreviewContext();
  const { state, dispatch } = useBracketContext();
  const isUserPick = state.userPicks.has(matchup.id);
  const showMyPicks = useShowMyPicks();
  const espnBracket = useEspnBracketContext();
  const espnPick = showMyPicks ? getPickForMatchup(espnBracket.data, matchup.id) : null;

  const handleTeamHover = useCallback((teamId: string | undefined) => {
    if (teamId) {
      setHoveredTeamId(teamId);
    }
  }, [setHoveredTeamId]);

  const handlePreviewClick = useCallback(() => {
    if (topTeam && bottomTeam) {
      const isMobile = window.innerWidth <= 600;
      if (isMobile && (status === 'in_progress' || status === 'final') && matchup.espnEventId) {
        window.location.hash = 'game/' + matchup.espnEventId;
      } else if (isMobile) {
        window.location.hash = 'preview/' + matchup.id;
      } else {
        openPreview(matchup.id);
      }
    }
  }, [topTeam, bottomTeam, matchup.id, matchup.espnEventId, status, openPreview]);

  const handleMouseLeave = useCallback(() => {
    setHoveredTeamId(null);
  }, [setHoveredTeamId]);

  const handleTeamClick = useCallback((slot: 'top' | 'bottom') => {
    const team = slot === 'top' ? topTeam : bottomTeam;
    if (!team) return;
    // Only allow user picks on non-final, non-live games
    if (status === 'final' || status === 'in_progress') return;
    dispatch({ type: 'USER_ADVANCE', matchupId: matchup.id, winner: slot });
  }, [topTeam, bottomTeam, status, matchup.id, dispatch]);

  const isLive = status === 'in_progress';
  const isFinal = status === 'final';
  const isScheduled = status === 'scheduled';
  const canPick = !isFinal && !isLive && topTeam !== null && bottomTeam !== null;

  // Determine winner status for each team
  const topIsWinner = winner === 'top' ? true : winner === 'bottom' ? false : null;
  const bottomIsWinner = winner === 'bottom' ? true : winner === 'top' ? false : null;

  // Compute weighted probability when one team is TBD (from a play-in game).
  // Instead of showing 50/50, estimate odds vs the expected play-in winner.
  const adjustedTopProb = useMemo(() => {
    // If both teams exist or neither does, use model probability as-is
    if ((topTeam && bottomTeam) || (!topTeam && !bottomTeam)) return topWinProbability;
    // If one team is TBD due to a source play-in matchup, compute weighted prob
    const knownTeam = topTeam ?? bottomTeam;
    const knownIsTop = !!topTeam;
    const sourceId = knownIsTop ? matchup.bottomSourceMatchupId : matchup.topSourceMatchupId;
    if (!sourceId || !knownTeam) return topWinProbability;
    const sourceMatchup = state.matchups.get(sourceId);
    if (!sourceMatchup?.topTeam || !sourceMatchup?.bottomTeam) return topWinProbability;
    // Weighted probability: P(known beats source.top) * P(source.top wins) + P(known beats source.bottom) * P(source.bottom wins)
    const pSourceTop = sourceMatchup.topWinProbability;
    const pKnownVsSourceTop = winProbability(knownTeam.rating, sourceMatchup.topTeam.rating);
    const pKnownVsSourceBot = winProbability(knownTeam.rating, sourceMatchup.bottomTeam.rating);
    const pKnownWins = pKnownVsSourceTop * pSourceTop + pKnownVsSourceBot * (1 - pSourceTop);
    return knownIsTop ? pKnownWins : 1 - pKnownWins;
  }, [topTeam, bottomTeam, topWinProbability, matchup, state.matchups]);

  // Use live win probability if available, otherwise use predicted (or adjusted)
  const displayTopProb = isLive && liveTopWinProbability !== null
    ? liveTopWinProbability
    : adjustedTopProb;
  const displayBottomProb = 1 - displayTopProb;

  // Path highlighting
  const isOnPath = teamPath?.matchupIds.has(matchup.id) ?? false;
  const pathActive = hoveredTeamId !== null;
  const pathSlot = teamPath?.matchupSlots.get(matchup.id);
  const pathColor = teamPath?.team.primaryColor ?? '#333';

  return (
    <div
      className={`${styles.matchup} ${isLive ? styles.live : ''} ${isFinal ? styles.final : ''} ${compact ? styles.compact : ''} ${isOnPath ? styles.onPath : ''} ${pathActive && !isOnPath ? styles.dimmed : ''} ${isUserPick ? styles.userPick : ''}`}
      style={isOnPath ? { borderColor: pathColor, borderWidth: '2px' } as React.CSSProperties : undefined}
      onMouseLeave={handleMouseLeave}
    >
      <div
        onMouseEnter={() => handleTeamHover(topTeam?.id)}
        onClick={() => handleTeamClick('top')}
        className={canPick ? styles.clickable : undefined}
      >
        <TeamRow
          team={topTeam}
          score={status !== 'scheduled' ? topScore : null}
          isWinner={topIsWinner}
          isLive={isLive}
          probability={isScheduled && !winner ? adjustedTopProb : undefined}
          position="top"
          isOnPath={isOnPath && pathSlot === 'top'}
          pathColor={isOnPath && pathSlot === 'top' ? pathColor : undefined}
          isUserPick={isUserPick && winner === 'top'}
          espnPick={espnPick ?? undefined}
          showMyPicks={showMyPicks}
        />
      </div>

      {!compact && topTeam && bottomTeam && !isUserPick && (
        <ProbabilityBar
          topProbability={displayTopProb}
          bottomProbability={displayBottomProb}
          isLive={isLive}
        />
      )}

      {isLive && (
        <LiveIndicator clock={clock} period={period} statusDetail={matchup.statusDetail} />
      )}

      <div
        onMouseEnter={() => handleTeamHover(bottomTeam?.id)}
        onClick={() => handleTeamClick('bottom')}
        className={canPick ? styles.clickable : undefined}
      >
        <TeamRow
          team={bottomTeam}
          score={status !== 'scheduled' ? bottomScore : null}
          isWinner={bottomIsWinner}
          isLive={isLive}
          probability={isScheduled && !winner ? (1 - adjustedTopProb) : undefined}
          position="bottom"
          isOnPath={isOnPath && pathSlot === 'bottom'}
          pathColor={isOnPath && pathSlot === 'bottom' ? pathColor : undefined}
          isUserPick={isUserPick && winner === 'bottom'}
          espnPick={espnPick ?? undefined}
          showMyPicks={showMyPicks}
        />
      </div>

      {/* Preview/Live button - shown on all matchups with both teams */}
      {topTeam && bottomTeam && (
        <button
          className={`${styles.previewBtn} ${isLive ? styles.liveBtn : ''}`}
          onClick={handlePreviewClick}
          title={isLive ? 'Live Game' : isFinal ? 'Game Recap' : 'Game Preview'}
        >
          {isLive ? 'Live' : isFinal ? 'Recap' : 'Preview'}
        </button>
      )}
    </div>
  );
}
