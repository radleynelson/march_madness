import { useState, useCallback, useMemo, useRef, createContext, useContext } from 'react';
import type { BracketState, Team, TeamProbabilities } from '../types/bracket';

export interface TeamPath {
  matchupIds: Set<string>;
  /** For each matchup on the path, which slot the team occupies (or would occupy) */
  matchupSlots: Map<string, 'top' | 'bottom'>;
  team: Team;
}

interface HoverContextType {
  hoveredTeamId: string | null;
  teamPath: TeamPath | null;
  setHoveredTeamId: (id: string | null) => void;
}

export const HoverContext = createContext<HoverContextType>({
  hoveredTeamId: null,
  teamPath: null,
  setHoveredTeamId: () => {},
});

export function useHoverContext() {
  return useContext(HoverContext);
}

/**
 * Compute the full path a team would take through the bracket,
 * from their first matchup all the way to the championship.
 */
export function computeTeamPath(teamId: string, state: BracketState): TeamPath | null {
  const team = state.teams.get(teamId);
  if (!team) return null;

  const matchupIds = new Set<string>();
  const matchupSlots = new Map<string, 'top' | 'bottom'>();

  // Find the EARLIEST matchup containing this team
  let startMatchupId: string | null = null;
  let startSlot: 'top' | 'bottom' | null = null;
  let startRound = Infinity;

  for (const [id, m] of state.matchups) {
    if (m.topTeam?.id === teamId && m.roundNumber < startRound) {
      startMatchupId = id;
      startSlot = 'top';
      startRound = m.roundNumber;
    }
    if (m.bottomTeam?.id === teamId && m.roundNumber < startRound) {
      startMatchupId = id;
      startSlot = 'bottom';
      startRound = m.roundNumber;
    }
  }

  if (!startMatchupId || !startSlot) return null;

  // Follow nextMatchupId chain to championship
  let currentId: string | null = startMatchupId;
  let currentSlot: 'top' | 'bottom' = startSlot;

  while (currentId) {
    matchupIds.add(currentId);
    matchupSlots.set(currentId, currentSlot);

    const matchup = state.matchups.get(currentId);
    if (!matchup?.nextMatchupId) break;

    const nextMatchup = state.matchups.get(matchup.nextMatchupId);
    if (!nextMatchup) break;

    // Determine slot in next matchup
    if (nextMatchup.topSourceMatchupId === currentId) {
      currentSlot = 'top';
    } else if (nextMatchup.bottomSourceMatchupId === currentId) {
      currentSlot = 'bottom';
    } else {
      break;
    }

    currentId = matchup.nextMatchupId;
  }

  return { matchupIds, matchupSlots, team };
}

/** Get the probability key for a given round number */
export function getProbKeyForRound(roundNumber: number): keyof TeamProbabilities | null {
  const map: Record<number, keyof TeamProbabilities> = {
    1: 'round64',
    2: 'round32',
    3: 'sweet16',
    4: 'elite8',
    5: 'finalFour',
    6: 'champion',
  };
  return map[roundNumber] ?? null;
}

export function formatProb(value: number): string {
  if (value >= 0.995) return '>99%';
  if (value <= 0) return '';
  const pct = value * 100;
  if (pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

export function useHoverState(state: BracketState) {
  const [hoveredTeamId, setHoveredTeamIdRaw] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setHoveredTeamId = useCallback((id: string | null) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (id === null) {
      // Clear immediately on mouse leave
      setHoveredTeamIdRaw(null);
    } else {
      // Small debounce on hover-in to prevent jumpiness during scrolling
      timerRef.current = setTimeout(() => {
        setHoveredTeamIdRaw(id);
      }, 150);
    }
  }, []);

  const teamPath = useMemo(() => {
    if (!hoveredTeamId) return null;
    return computeTeamPath(hoveredTeamId, state);
  }, [hoveredTeamId, state]);

  return { hoveredTeamId, teamPath, setHoveredTeamId };
}
