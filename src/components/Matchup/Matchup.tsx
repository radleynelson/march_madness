import { useCallback } from 'react';
import type { Matchup as MatchupType } from '../../types/bracket';
import { useHoverContext } from '../../hooks/useHoverState';
import { usePreviewContext } from '../../hooks/usePreview';
import { useBracketContext } from '../../hooks/useBracketState';
import { TeamRow } from './TeamRow';
import { ProbabilityBar } from './ProbabilityBar';
import { LiveIndicator } from './LiveIndicator';
import styles from './Matchup.module.css';

interface MatchupProps {
  matchup: MatchupType;
  compact?: boolean;
}

export function Matchup({ matchup, compact = false }: MatchupProps) {
  const {
    topTeam,
    bottomTeam,
    topWinProbability,
    bottomWinProbability,
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

  const handleTeamHover = useCallback((teamId: string | undefined) => {
    if (teamId) {
      setHoveredTeamId(teamId);
    }
  }, [setHoveredTeamId]);

  const handlePreviewClick = useCallback(() => {
    if (topTeam && bottomTeam) {
      openPreview(matchup.id);
    }
  }, [topTeam, bottomTeam, matchup.id, openPreview]);

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

  // Use live win probability if available, otherwise use predicted
  const displayTopProb = isLive && liveTopWinProbability !== null
    ? liveTopWinProbability
    : topWinProbability;
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
          probability={isScheduled && !winner ? topWinProbability : undefined}
          position="top"
          isOnPath={isOnPath && pathSlot === 'top'}
          pathColor={isOnPath && pathSlot === 'top' ? pathColor : undefined}
          isUserPick={isUserPick && winner === 'top'}
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
        <LiveIndicator clock={clock} period={period} />
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
          probability={isScheduled && !winner ? bottomWinProbability : undefined}
          position="bottom"
          isOnPath={isOnPath && pathSlot === 'bottom'}
          pathColor={isOnPath && pathSlot === 'bottom' ? pathColor : undefined}
          isUserPick={isUserPick && winner === 'bottom'}
        />
      </div>

      {/* Preview button */}
      {!compact && topTeam && bottomTeam && (
        <button
          className={styles.previewBtn}
          onClick={handlePreviewClick}
          title="Game Preview"
        >
          Preview
        </button>
      )}
    </div>
  );
}
