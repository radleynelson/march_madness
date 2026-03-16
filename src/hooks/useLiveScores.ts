import { useEffect, useRef, useCallback } from 'react';
import type { BracketState, BracketAction, ScoreUpdate } from '../types/bracket';
import { fetchScoreboard, filterTournamentGames, eventsToScoreUpdates, formatDate } from '../api/espn';
import { POLLING_INTERVALS, ALL_TOURNAMENT_DATES } from '../data/constants';
import type { EspnCompetitor } from '../types/espn';

interface UseLiveScoresOptions {
  state: BracketState;
  dispatch: React.Dispatch<BracketAction>;
  enabled?: boolean;
}

/**
 * Hook that polls ESPN for live scores and updates the bracket state.
 */
export function useLiveScores({ state, dispatch, enabled = true }: UseLiveScoresOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorCountRef = useRef(0);

  const pollScores = useCallback(async () => {
    if (!enabled) return;

    try {
      // Get today's date
      const today = formatDate(new Date());

      // Check if today is a tournament date
      if (!ALL_TOURNAMENT_DATES.includes(today)) {
        return;
      }

      const data = await fetchScoreboard(today);
      const tourneyGames = filterTournamentGames(data.events);

      if (tourneyGames.length === 0) return;

      // Convert to score updates
      const rawUpdates = eventsToScoreUpdates(tourneyGames) as (ScoreUpdate & { _competitors?: EspnCompetitor[] })[];

      // Match updates to bracket matchups
      const matchedUpdates: ScoreUpdate[] = [];

      for (const update of rawUpdates) {
        const competitors = update._competitors;
        if (!competitors) continue;

        // Try to find matching matchup by espnEventId first
        let matched = false;
        for (const [matchupId, matchup] of state.matchups) {
          if (matchup.espnEventId === update.espnEventId) {
            matchedUpdates.push({ ...update, matchupId });
            matched = true;
            break;
          }
        }

        if (matched) continue;

        // Try to match by team names
        const espnTeamNames = competitors.map(c =>
          (c.team.shortDisplayName ?? c.team.location ?? '').toLowerCase()
        );

        for (const [matchupId, matchup] of state.matchups) {
          if (matchup.espnEventId) continue; // Already matched

          const topName = matchup.topTeam?.shortName?.toLowerCase() ?? '';
          const bottomName = matchup.bottomTeam?.shortName?.toLowerCase() ?? '';

          if (!topName && !bottomName) continue;

          const topMatch = espnTeamNames.some(n => n.includes(topName) || topName.includes(n));
          const bottomMatch = espnTeamNames.some(n => n.includes(bottomName) || bottomName.includes(n));

          if (topMatch && bottomMatch) {
            // Determine which ESPN competitor is "top" and which is "bottom"
            const comp0Name = (competitors[0].team.shortDisplayName ?? competitors[0].team.location ?? '').toLowerCase();
            const comp0IsTop = comp0Name.includes(topName) || topName.includes(comp0Name);

            const topScore = comp0IsTop ? parseInt(competitors[0].score, 10) : parseInt(competitors[1].score, 10);
            const bottomScore = comp0IsTop ? parseInt(competitors[1].score, 10) : parseInt(competitors[0].score, 10);

            let winner: 'top' | 'bottom' | null = null;
            if (update.status === 'final') {
              if (comp0IsTop) {
                winner = competitors[0].winner ? 'top' : 'bottom';
              } else {
                winner = competitors[1].winner ? 'top' : 'bottom';
              }
            }

            matchedUpdates.push({
              espnEventId: update.espnEventId,
              matchupId,
              status: update.status,
              topScore: isNaN(topScore) ? null : topScore,
              bottomScore: isNaN(bottomScore) ? null : bottomScore,
              clock: update.clock,
              period: update.period,
              liveTopWinProbability: update.liveTopWinProbability,
              winner,
            });
            break;
          }
        }
      }

      if (matchedUpdates.length > 0) {
        dispatch({ type: 'UPDATE_SCORES', updates: matchedUpdates });

        // Auto-advance winners
        for (const update of matchedUpdates) {
          if (update.status === 'final' && update.winner && update.matchupId) {
            dispatch({ type: 'ADVANCE_WINNER', matchupId: update.matchupId, winner: update.winner });
          }
        }
      }

      // Determine next poll interval
      const anyLive = tourneyGames.some(g => g.status.type.state === 'in');
      const anyScheduled = tourneyGames.some(g => g.status.type.state === 'pre');
      const allFinal = tourneyGames.every(g => g.status.type.state === 'post');

      let newInterval: number;
      if (anyLive) {
        newInterval = POLLING_INTERVALS.GAMES_LIVE;
      } else if (anyScheduled) {
        newInterval = POLLING_INTERVALS.GAMES_SCHEDULED;
      } else if (allFinal) {
        newInterval = POLLING_INTERVALS.NO_GAMES;
      } else {
        newInterval = POLLING_INTERVALS.NO_GAMES;
      }

      // Reset error count on success
      errorCountRef.current = 0;

      // Update interval if changed
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(pollScores, newInterval);
      }
    } catch (error) {
      console.error('Error polling ESPN:', error);
      errorCountRef.current++;

      // Back off on errors
      const backoffInterval = errorCountRef.current <= 2
        ? POLLING_INTERVALS.ERROR_RETRY_1
        : POLLING_INTERVALS.ERROR_RETRY_2;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(pollScores, backoffInterval);
      }
    }
  }, [enabled, state.matchups, dispatch]);

  useEffect(() => {
    if (!enabled) return;

    // Initial poll
    pollScores();

    // Set up polling interval (start with games scheduled interval)
    intervalRef.current = setInterval(pollScores, POLLING_INTERVALS.GAMES_SCHEDULED);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollScores]);
}
