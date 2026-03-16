import { useCallback } from 'react';
import type { Matchup as MatchupType } from '../../types/bracket';
import { useHoverContext } from '../../hooks/useHoverState';
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

  const handleTeamHover = useCallback((teamId: string | undefined) => {
    if (teamId) {
      setHoveredTeamId(teamId);
    }
  }, [setHoveredTeamId]);

  const handleMouseLeave = useCallback(() => {
    setHoveredTeamId(null);
  }, [setHoveredTeamId]);

  const isLive = status === 'in_progress';
  const isFinal = status === 'final';
  const isScheduled = status === 'scheduled';

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
      className={`${styles.matchup} ${isLive ? styles.live : ''} ${isFinal ? styles.final : ''} ${compact ? styles.compact : ''} ${isOnPath ? styles.onPath : ''} ${pathActive && !isOnPath ? styles.dimmed : ''}`}
      style={isOnPath ? { borderColor: pathColor, borderWidth: '2px' } as React.CSSProperties : undefined}
      onMouseLeave={handleMouseLeave}
    >
      <div onMouseEnter={() => handleTeamHover(topTeam?.id)}>
        <TeamRow
          team={topTeam}
          score={status !== 'scheduled' ? topScore : null}
          isWinner={topIsWinner}
          isLive={isLive}
          probability={isScheduled ? topWinProbability : undefined}
          position="top"
          isOnPath={isOnPath && pathSlot === 'top'}
          pathColor={isOnPath && pathSlot === 'top' ? pathColor : undefined}
        />
      </div>

      {!compact && topTeam && bottomTeam && (
        <ProbabilityBar
          topProbability={displayTopProb}
          bottomProbability={displayBottomProb}
          isLive={isLive}
        />
      )}

      {isLive && (
        <LiveIndicator clock={clock} period={period} />
      )}

      <div onMouseEnter={() => handleTeamHover(bottomTeam?.id)}>
        <TeamRow
          team={bottomTeam}
          score={status !== 'scheduled' ? bottomScore : null}
          isWinner={bottomIsWinner}
          isLive={isLive}
          probability={isScheduled ? bottomWinProbability : undefined}
          position="bottom"
          isOnPath={isOnPath && pathSlot === 'bottom'}
          pathColor={isOnPath && pathSlot === 'bottom' ? pathColor : undefined}
        />
      </div>
    </div>
  );
}
