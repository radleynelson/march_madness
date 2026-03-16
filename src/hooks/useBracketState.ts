import { useReducer, useCallback, createContext, useContext } from 'react';
import type { BracketState, BracketAction, Matchup, Team } from '../types/bracket';
import { createInitialBracket } from '../data/initial-bracket';
import { calculateAllProbabilities } from '../model/predictions';

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

      const newState = { ...state, teams: newTeams, matchups: newMatchups };
      return calculateAllProbabilities(newState);
    }

    case 'UPDATE_SCORES': {
      const newMatchups = new Map(state.matchups);
      let anyLive = false;

      for (const update of action.updates) {
        // Find the matchup either by espnEventId or by matchupId
        let matchupId: string | undefined;

        if (update.matchupId) {
          matchupId = update.matchupId;
        } else {
          // Search by espnEventId
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

      return {
        ...state,
        matchups: newMatchups,
        lastUpdated: new Date(),
        isLive: anyLive,
      };
    }

    case 'ADVANCE_WINNER': {
      const newMatchups = new Map(state.matchups);
      const matchup = newMatchups.get(action.matchupId);
      if (!matchup) return state;

      const winnerTeam = action.winner === 'top' ? matchup.topTeam : matchup.bottomTeam;
      if (!winnerTeam) return state;

      // Update the current matchup with the winner
      newMatchups.set(action.matchupId, { ...matchup, winner: action.winner });

      // Advance winner to the next matchup
      if (matchup.nextMatchupId) {
        const nextMatchup = newMatchups.get(matchup.nextMatchupId);
        if (nextMatchup) {
          // Determine if winner goes to top or bottom slot
          const goesToTop = nextMatchup.topSourceMatchupId === action.matchupId;
          const updated: Matchup = {
            ...nextMatchup,
            ...(goesToTop ? { topTeam: winnerTeam } : { bottomTeam: winnerTeam }),
          };
          newMatchups.set(matchup.nextMatchupId, updated);
        }
      }

      const newState = { ...state, matchups: newMatchups };
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

  const recalculate = useCallback(() => {
    dispatch({ type: 'RECALCULATE_PREDICTIONS' });
  }, []);

  return { state, dispatch, setRatings, advanceWinner, recalculate };
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
