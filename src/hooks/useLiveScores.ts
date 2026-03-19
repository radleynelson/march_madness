import { useEffect, useRef, useCallback } from 'react';
import type { BracketState, BracketAction, ScoreUpdate } from '../types/bracket';
import { fetchScoreboard, filterTournamentGames, eventsToScoreUpdates, formatDate, fetchLiveWinProbability } from '../api/espn';
import { POLLING_INTERVALS, ALL_TOURNAMENT_DATES } from '../data/constants';
import type { EspnCompetitor } from '../types/espn';

interface UseLiveScoresOptions {
  state: BracketState;
  dispatch: React.Dispatch<BracketAction>;
  enabled?: boolean;
}

/**
 * Once we know which ESPN competitor is "top" (our bracket's top slot)
 * and which is "bottom", build the ScoreUpdate with correct score/winner mapping.
 */
function buildMatchedUpdate(
  update: ScoreUpdate,
  matchupId: string,
  competitors: EspnCompetitor[],
  comp0IsTop: boolean,
): ScoreUpdate {
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

  return {
    espnEventId: update.espnEventId,
    matchupId,
    status: update.status,
    statusDetail: update.statusDetail,
    topScore: isNaN(topScore) ? null : topScore,
    bottomScore: isNaN(bottomScore) ? null : bottomScore,
    clock: update.clock,
    period: update.period,
    liveTopWinProbability: update.liveTopWinProbability,
    winner,
  };
}

/**
 * Match ESPN game events to bracket matchups and produce ScoreUpdates.
 *
 * Three-tier matching strategy:
 *   1. espnEventId — cached from a prior match, instant and exact
 *   2. ESPN team ID — compares competitor.team.id to our team.id (both are ESPN IDs)
 *   3. Fuzzy team name — substring match on shortName (fallback)
 */
function matchGamesToUpdates(
  rawUpdates: (ScoreUpdate & { _competitors?: EspnCompetitor[] })[],
  matchups: Map<string, import('../types/bracket').Matchup>,
): ScoreUpdate[] {
  const matchedUpdates: ScoreUpdate[] = [];

  for (const update of rawUpdates) {
    const competitors = update._competitors;
    if (!competitors || competitors.length < 2) continue;

    // Tier 1: Match by espnEventId (cached from a prior match)
    let matched = false;
    for (const [matchupId, matchup] of matchups) {
      if (matchup.espnEventId === update.espnEventId) {
        // Re-map scores to bracket top/bottom order (ESPN competitor order may differ)
        const topId = matchup.topTeam?.id;
        const comp0IsTop = competitors[0].team.id === topId;
        matchedUpdates.push(buildMatchedUpdate(update, matchupId, competitors, comp0IsTop));
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const espnId0 = competitors[0].team.id;
    const espnId1 = competitors[1].team.id;

    // Tier 2: Match by ESPN team IDs (deterministic, no ambiguity)
    for (const [matchupId, matchup] of matchups) {
      if (matchup.espnEventId) continue; // Already linked to a different event

      const topId = matchup.topTeam?.id;
      const bottomId = matchup.bottomTeam?.id;
      if (!topId && !bottomId) continue;

      // Check if both ESPN competitors match our top/bottom teams (in either order)
      const comp0IsTop = espnId0 === topId;
      const comp0IsBottom = espnId0 === bottomId;
      const comp1IsTop = espnId1 === topId;
      const comp1IsBottom = espnId1 === bottomId;

      if ((comp0IsTop && comp1IsBottom) || (comp0IsBottom && comp1IsTop)) {
        matchedUpdates.push(buildMatchedUpdate(update, matchupId, competitors, comp0IsTop));
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Tier 3: Fuzzy team name match (fallback for edge cases)
    const espnTeamNames = competitors.map(c =>
      (c.team.shortDisplayName ?? c.team.location ?? '').toLowerCase()
    );

    for (const [matchupId, matchup] of matchups) {
      if (matchup.espnEventId) continue;

      const topName = matchup.topTeam?.shortName?.toLowerCase() ?? '';
      const bottomName = matchup.bottomTeam?.shortName?.toLowerCase() ?? '';
      if (!topName && !bottomName) continue;

      const topMatch = espnTeamNames.some(n => n.includes(topName) || topName.includes(n));
      const bottomMatch = espnTeamNames.some(n => n.includes(bottomName) || bottomName.includes(n));

      if (topMatch && bottomMatch) {
        const comp0Name = (competitors[0].team.shortDisplayName ?? competitors[0].team.location ?? '').toLowerCase();
        const comp0IsTop = comp0Name.includes(topName) || topName.includes(comp0Name);
        matchedUpdates.push(buildMatchedUpdate(update, matchupId, competitors, comp0IsTop));
        break;
      }
    }
  }

  return matchedUpdates;
}

/**
 * Hook that polls ESPN for live scores and updates the bracket state.
 *
 * On initial load, fetches ALL past tournament dates in chronological order
 * to backfill results (R64 before R32, etc.), ensuring the bracket is fully
 * populated regardless of when the user visits.
 *
 * After backfill, polls only today's date for live updates.
 */
export function useLiveScores({ state, dispatch, enabled = true }: UseLiveScoresOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorCountRef = useRef(0);
  const backfillDoneRef = useRef(false);
  // Use a ref for matchups so the polling callback doesn't re-create on every state change
  const matchupsRef = useRef(state.matchups);
  matchupsRef.current = state.matchups;

  /**
   * Process a single day's ESPN data: fetch, match, dispatch updates, advance winners.
   * Returns true if any live games were found.
   */
  const processDayScores = useCallback(async (date: string): Promise<{ anyLive: boolean; anyScheduled: boolean }> => {
    const data = await fetchScoreboard(date);
    const tourneyGames = filterTournamentGames(data.events);

    if (tourneyGames.length === 0) return { anyLive: false, anyScheduled: false };

    const rawUpdates = eventsToScoreUpdates(tourneyGames) as (ScoreUpdate & { _competitors?: EspnCompetitor[] })[];
    const matchedUpdates = matchGamesToUpdates(rawUpdates, matchupsRef.current);

    // Enrich live games with ESPN win probabilities
    const liveMatched = matchedUpdates.filter(u => u.status === 'in_progress' && u.matchupId);
    if (liveMatched.length > 0) {
      const wpResults = await Promise.all(liveMatched.map(async (update) => {
        const matchup = matchupsRef.current.get(update.matchupId!);
        if (!matchup?.topTeam?.id || !update.espnEventId) return null;
        const wp = await fetchLiveWinProbability(update.espnEventId, matchup.topTeam.id);
        return wp !== null ? { matchupId: update.matchupId!, wp } : null;
      }));

      for (const result of wpResults) {
        if (!result) continue;
        const update = matchedUpdates.find(u => u.matchupId === result.matchupId);
        if (update) update.liveTopWinProbability = result.wp;
      }
    }

    if (matchedUpdates.length > 0) {
      dispatch({ type: 'UPDATE_SCORES', updates: matchedUpdates });

      // Auto-advance winners for final games
      for (const update of matchedUpdates) {
        if (update.status === 'final' && update.winner && update.matchupId) {
          dispatch({ type: 'ADVANCE_WINNER', matchupId: update.matchupId, winner: update.winner });
        }
      }
    }

    const anyLive = tourneyGames.some(g => g.status.type.state === 'in');
    const anyScheduled = tourneyGames.some(g => g.status.type.state === 'pre');
    return { anyLive, anyScheduled };
  }, [dispatch]);

  /**
   * Backfill all past tournament dates, then start polling today.
   */
  const backfillAndPoll = useCallback(async () => {
    if (!enabled) return;

    try {
      const today = formatDate(new Date());

      // Get all tournament dates up to and including today, in chronological order.
      // Processing in order ensures R64 winners are placed before R32 matching, etc.
      const pastAndTodayDates = ALL_TOURNAMENT_DATES
        .filter(d => d <= today)
        .sort();

      if (pastAndTodayDates.length === 0) return;

      // Process each day sequentially (order matters for winner propagation).
      // The setTimeout(0) between iterations forces a macrotask boundary so React
      // flushes pending dispatches and updates matchupsRef before the next day's
      // games try to match against later-round matchup slots.
      let anyLive = false;
      let anyScheduled = false;
      for (const date of pastAndTodayDates) {
        try {
          const result = await processDayScores(date);
          // Yield to let React flush state updates (winners placed in next-round slots)
          await new Promise(r => setTimeout(r, 0));
          if (date === today) {
            anyLive = result.anyLive;
            anyScheduled = result.anyScheduled;
          }
        } catch (error) {
          console.warn(`Failed to fetch scores for ${date}:`, error);
          // Continue with other dates even if one fails
        }
      }

      backfillDoneRef.current = true;
      errorCountRef.current = 0;

      // Set polling interval based on today's game state
      let pollInterval: number;
      if (anyLive) {
        pollInterval = POLLING_INTERVALS.GAMES_LIVE;
      } else if (anyScheduled) {
        pollInterval = POLLING_INTERVALS.GAMES_SCHEDULED;
      } else {
        pollInterval = POLLING_INTERVALS.NO_GAMES;
      }

      // Start polling only today's date going forward
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(pollToday, pollInterval);
    } catch (error) {
      console.error('Error during backfill:', error);
      errorCountRef.current++;
      const backoff = errorCountRef.current <= 2
        ? POLLING_INTERVALS.ERROR_RETRY_1
        : POLLING_INTERVALS.ERROR_RETRY_2;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(backfillAndPoll, backoff);
    }
  }, [enabled, processDayScores]);

  /**
   * Poll only today's date for live/ongoing updates.
   */
  const pollToday = useCallback(async () => {
    if (!enabled) return;

    try {
      const today = formatDate(new Date());
      if (!ALL_TOURNAMENT_DATES.includes(today)) return;

      const { anyLive, anyScheduled } = await processDayScores(today);

      errorCountRef.current = 0;

      // Adjust poll interval
      let newInterval: number;
      if (anyLive) {
        newInterval = POLLING_INTERVALS.GAMES_LIVE;
      } else if (anyScheduled) {
        newInterval = POLLING_INTERVALS.GAMES_SCHEDULED;
      } else {
        newInterval = POLLING_INTERVALS.NO_GAMES;
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(pollToday, newInterval);
      }
    } catch (error) {
      console.error('Error polling ESPN:', error);
      errorCountRef.current++;
      const backoff = errorCountRef.current <= 2
        ? POLLING_INTERVALS.ERROR_RETRY_1
        : POLLING_INTERVALS.ERROR_RETRY_2;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(pollToday, backoff);
      }
    }
  }, [enabled, processDayScores]);

  useEffect(() => {
    if (!enabled) return;

    // On mount: backfill all past tournament dates, then start polling today
    backfillAndPoll();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, backfillAndPoll]);
}
