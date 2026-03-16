import { useReducer, useCallback, createContext, useContext } from 'react';
import type { BracketState, BracketAction, Matchup, ScoreUpdate } from '../types/bracket';
import { createInitialBracket } from '../data/initial-bracket';
import { calculateAllProbabilities } from '../model/predictions';

/**
 * Advance a winner in a matchup and propagate to next round.
 * Returns the new matchups map.
 */
function advanceWinnerInMatchups(
  matchups: Map<string, Matchup>,
  matchupId: string,
  winner: 'top' | 'bottom',
): Map<string, Matchup> {
  const matchup = matchups.get(matchupId);
  if (!matchup) return matchups;

  const winnerTeam = winner === 'top' ? matchup.topTeam : matchup.bottomTeam;
  if (!winnerTeam) return matchups;

  // Set winner on current matchup
  matchups.set(matchupId, { ...matchup, winner });

  // Propagate to next matchup
  if (matchup.nextMatchupId) {
    const nextMatchup = matchups.get(matchup.nextMatchupId);
    if (nextMatchup) {
      const goesToTop = nextMatchup.topSourceMatchupId === matchupId;
      matchups.set(matchup.nextMatchupId, {
        ...nextMatchup,
        ...(goesToTop ? { topTeam: winnerTeam } : { bottomTeam: winnerTeam }),
      });
    }
  }

  return matchups;
}

/**
 * Clear a user pick: remove winner, remove team from next matchup slot,
 * and cascade-clear any downstream user picks.
 */
function clearUserPick(
  matchups: Map<string, Matchup>,
  matchupId: string,
  userPicks: Set<string>,
): void {
  const matchup = matchups.get(matchupId);
  if (!matchup || !matchup.winner) return;

  // Clear winner on this matchup
  matchups.set(matchupId, { ...matchup, winner: null });

  // Remove team from next matchup slot
  if (matchup.nextMatchupId) {
    const nextMatchup = matchups.get(matchup.nextMatchupId);
    if (nextMatchup) {
      const goesToTop = nextMatchup.topSourceMatchupId === matchupId;
      const clearedNext = {
        ...nextMatchup,
        ...(goesToTop ? { topTeam: null } : { bottomTeam: null }),
      };

      // If the next matchup also had a user pick, cascade-clear it
      if (userPicks.has(matchup.nextMatchupId)) {
        userPicks.delete(matchup.nextMatchupId);
        matchups.set(matchup.nextMatchupId, { ...clearedNext, winner: null });
        // Cascade further
        clearUserPick(matchups, matchup.nextMatchupId, userPicks);
      } else {
        matchups.set(matchup.nextMatchupId, clearedNext);
      }
    }
  }
}

function bracketReducer(state: BracketState, action: BracketAction): BracketState {
  switch (action.type) {
    case 'INITIALIZE_BRACKET': {
      const newState = createInitialBracket();
      return calculateAllProbabilities(newState);
    }

    case 'SET_RATINGS': {
      const newTeams = new Map(state.teams);
      for (const [teamId, rating] of action.ratings) {
        const team = newTeams.get(teamId);
        if (team) {
          newTeams.set(teamId, { ...team, rating });
        }
      }

      // Update matchup team references with new ratings
      const newMatchups = new Map(state.matchups);
      for (const [id, matchup] of newMatchups) {
        let updated = false;
        let newTop = matchup.topTeam;
        let newBottom = matchup.bottomTeam;

        if (matchup.topTeam && newTeams.has(matchup.topTeam.id)) {
          newTop = newTeams.get(matchup.topTeam.id)!;
          updated = true;
        }
        if (matchup.bottomTeam && newTeams.has(matchup.bottomTeam.id)) {
          newBottom = newTeams.get(matchup.bottomTeam.id)!;
          updated = true;
        }
        if (updated) {
          newMatchups.set(id, { ...matchup, topTeam: newTop, bottomTeam: newBottom });
        }
      }

      const newState = {
        ...state,
        teams: newTeams,
        matchups: newMatchups,
        cachedRatings: new Map(action.ratings),
      };
      return calculateAllProbabilities(newState);
    }

    case 'UPDATE_SCORES': {
      const newMatchups = new Map(state.matchups);
      let anyLive = false;

      for (const update of action.updates) {
        let matchupId: string | undefined;

        if (update.matchupId) {
          matchupId = update.matchupId;
        } else {
          for (const [id, m] of newMatchups) {
            if (m.espnEventId === update.espnEventId) {
              matchupId = id;
              break;
            }
          }
        }

        if (!matchupId) continue;

        const existing = newMatchups.get(matchupId);
        if (!existing) continue;

        const updated: Matchup = {
          ...existing,
          espnEventId: update.espnEventId,
          status: update.status,
          topScore: update.topScore,
          bottomScore: update.bottomScore,
          clock: update.clock,
          period: update.period,
          liveTopWinProbability: update.liveTopWinProbability,
        };

        if (update.status === 'in_progress') anyLive = true;

        newMatchups.set(matchupId, updated);
      }

      // Cache score updates for replay after reset
      const newCache = [...state.cachedScoreUpdates];
      for (const update of action.updates) {
        // Replace existing cache entry for same event, or add new
        const idx = newCache.findIndex(c => c.espnEventId === update.espnEventId);
        if (idx >= 0) {
          newCache[idx] = update;
        } else {
          newCache.push(update);
        }
      }

      return {
        ...state,
        matchups: newMatchups,
        lastUpdated: new Date(),
        isLive: anyLive,
        cachedScoreUpdates: newCache,
      };
    }

    case 'ADVANCE_WINNER': {
      const newMatchups = new Map(state.matchups);
      advanceWinnerInMatchups(newMatchups, action.matchupId, action.winner);

      const newState = { ...state, matchups: newMatchups };
      return calculateAllProbabilities(newState);
    }

    case 'USER_ADVANCE': {
      const matchup = state.matchups.get(action.matchupId);
      if (!matchup) return state;

      // Don't allow user picks on final games
      if (matchup.status === 'final') return state;

      // If clicking the same winner that's already picked, unpick it
      if (matchup.winner === action.winner && state.userPicks.has(action.matchupId)) {
        const newMatchups = new Map(state.matchups);
        const newUserPicks = new Set(state.userPicks);
        clearUserPick(newMatchups, action.matchupId, newUserPicks);
        newUserPicks.delete(action.matchupId);

        const newState = { ...state, matchups: newMatchups, userPicks: newUserPicks };
        return calculateAllProbabilities(newState);
      }

      // If this matchup already had a different user pick, clear it first
      const newMatchups = new Map(state.matchups);
      const newUserPicks = new Set(state.userPicks);

      if (state.userPicks.has(action.matchupId)) {
        clearUserPick(newMatchups, action.matchupId, newUserPicks);
        newUserPicks.delete(action.matchupId);
      }

      // Advance the winner
      advanceWinnerInMatchups(newMatchups, action.matchupId, action.winner);
      newUserPicks.add(action.matchupId);

      const newState = { ...state, matchups: newMatchups, userPicks: newUserPicks };
      return calculateAllProbabilities(newState);
    }

    case 'APPLY_SIMULATION': {
      // Apply all picks atomically in round order within a single reducer call.
      // This avoids React batching issues where later-round picks fire before
      // earlier-round winners have been placed.
      const newMatchups = new Map(state.matchups);
      const newUserPicks = new Set(state.userPicks);

      // Sort picks by round order so propagation works correctly
      const roundPriority: Record<string, number> = {
        'FF-PLAY': 0, 'R64': 1, 'R32': 2, 'S16': 3, 'E8': 4, 'FF-': 5, 'CHAMP': 6,
      };
      const sortedPicks = Object.entries(action.picks).sort((a, b) => {
        const aPri = Object.entries(roundPriority).find(([k]) => a[0].includes(k))?.[1] ?? 99;
        const bPri = Object.entries(roundPriority).find(([k]) => b[0].includes(k))?.[1] ?? 99;
        return aPri - bPri;
      });

      for (const [matchupId, winner] of sortedPicks) {
        const matchup = newMatchups.get(matchupId);
        if (!matchup) continue;
        if (matchup.status === 'final') continue; // Don't override real results
        if (!matchup.topTeam && !matchup.bottomTeam) continue; // Skip if no teams yet

        // For play-in and R64 games, both teams should exist
        // For later rounds, the team may have just been placed by an earlier pick in this loop
        const winnerTeam = winner === 'top' ? matchup.topTeam : matchup.bottomTeam;
        if (!winnerTeam) continue;

        // Set winner
        newMatchups.set(matchupId, { ...newMatchups.get(matchupId)!, winner });

        // Propagate to next matchup
        if (matchup.nextMatchupId) {
          const nextMatchup = newMatchups.get(matchup.nextMatchupId);
          if (nextMatchup) {
            const goesToTop = nextMatchup.topSourceMatchupId === matchupId;
            newMatchups.set(matchup.nextMatchupId, {
              ...nextMatchup,
              ...(goesToTop ? { topTeam: winnerTeam } : { bottomTeam: winnerTeam }),
            });
          }
        }

        newUserPicks.add(matchupId);
      }

      const newState = { ...state, matchups: newMatchups, userPicks: newUserPicks };
      return calculateAllProbabilities(newState);
    }

    case 'CLEAR_USER_PICKS': {
      if (state.userPicks.size === 0) return state;

      // Rebuild from scratch: fresh bracket + ratings + live scores
      let newState: BracketState = createInitialBracket();

      // Re-apply ratings
      if (state.cachedRatings) {
        const newTeams = new Map(newState.teams);
        for (const [teamId, rating] of state.cachedRatings) {
          const team = newTeams.get(teamId);
          if (team) {
            newTeams.set(teamId, { ...team, rating });
          }
        }
        // Sync into matchups
        const newMatchups = new Map(newState.matchups);
        for (const [id, matchup] of newMatchups) {
          let updated = false;
          let newTop = matchup.topTeam;
          let newBottom = matchup.bottomTeam;
          if (matchup.topTeam && newTeams.has(matchup.topTeam.id)) {
            newTop = newTeams.get(matchup.topTeam.id)!;
            updated = true;
          }
          if (matchup.bottomTeam && newTeams.has(matchup.bottomTeam.id)) {
            newBottom = newTeams.get(matchup.bottomTeam.id)!;
            updated = true;
          }
          if (updated) {
            newMatchups.set(id, { ...matchup, topTeam: newTop, bottomTeam: newBottom });
          }
        }
        newState = { ...newState, teams: newTeams, matchups: newMatchups };
      }

      // Re-apply live score updates
      if (state.cachedScoreUpdates.length > 0) {
        const newMatchups = new Map(newState.matchups);
        for (const update of state.cachedScoreUpdates) {
          let matchupId: string | undefined = update.matchupId;
          if (!matchupId) {
            for (const [id, m] of newMatchups) {
              if (m.espnEventId === update.espnEventId) {
                matchupId = id;
                break;
              }
            }
          }
          if (!matchupId) continue;
          const existing = newMatchups.get(matchupId);
          if (!existing) continue;

          newMatchups.set(matchupId, {
            ...existing,
            espnEventId: update.espnEventId,
            status: update.status,
            topScore: update.topScore,
            bottomScore: update.bottomScore,
            clock: update.clock,
            period: update.period,
            liveTopWinProbability: update.liveTopWinProbability,
          });
        }
        newState = { ...newState, matchups: newMatchups };

        // Re-advance final game winners
        const advMatchups = new Map(newState.matchups);
        for (const update of state.cachedScoreUpdates) {
          if (update.status === 'final' && update.winner && update.matchupId) {
            advanceWinnerInMatchups(advMatchups, update.matchupId, update.winner);
          }
        }
        newState = { ...newState, matchups: advMatchups };
      }

      newState = {
        ...newState,
        cachedRatings: state.cachedRatings,
        cachedScoreUpdates: state.cachedScoreUpdates,
        lastUpdated: new Date(),
      };

      return calculateAllProbabilities(newState);
    }

    case 'RECALCULATE_PREDICTIONS': {
      return calculateAllProbabilities(state);
    }

    default:
      return state;
  }
}

// Create initial state
function createInitialState(): BracketState {
  const bracket = createInitialBracket();
  return calculateAllProbabilities(bracket);
}

export function useBracketState() {
  const [state, dispatch] = useReducer(bracketReducer, null, createInitialState);

  const setRatings = useCallback((ratings: Map<string, number>) => {
    dispatch({ type: 'SET_RATINGS', ratings });
  }, []);

  const updateScores = useCallback((updates: BracketAction extends { type: 'UPDATE_SCORES' } ? BracketAction : never) => {
    dispatch(updates);
  }, []);

  const advanceWinner = useCallback((matchupId: string, winner: 'top' | 'bottom') => {
    dispatch({ type: 'ADVANCE_WINNER', matchupId, winner });
  }, []);

  const userAdvance = useCallback((matchupId: string, winner: 'top' | 'bottom') => {
    dispatch({ type: 'USER_ADVANCE', matchupId, winner });
  }, []);

  const clearUserPicks = useCallback(() => {
    dispatch({ type: 'CLEAR_USER_PICKS' });
  }, []);

  const recalculate = useCallback(() => {
    dispatch({ type: 'RECALCULATE_PREDICTIONS' });
  }, []);

  return { state, dispatch, setRatings, advanceWinner, userAdvance, clearUserPicks, recalculate };
}

// Context for bracket state
interface BracketContextType {
  state: BracketState;
  dispatch: React.Dispatch<BracketAction>;
}

export const BracketContext = createContext<BracketContextType | null>(null);

export function useBracketContext(): BracketContextType {
  const ctx = useContext(BracketContext);
  if (!ctx) throw new Error('useBracketContext must be used within BracketProvider');
  return ctx;
}
