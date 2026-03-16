import { useEffect, useState } from 'react';
import type { BracketState, BracketAction } from '../types/bracket';
import { fetchTorvikRatings } from '../api/torvik';
import { applyRatings } from '../model/ratings';

interface UseTeamRatingsOptions {
  state: BracketState;
  dispatch: React.Dispatch<BracketAction>;
}

/**
 * Hook that fetches Torvik ratings on mount and applies them to the bracket.
 */
export function useTeamRatings({ state, dispatch }: UseTeamRatingsOptions) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded) return;

    async function loadRatings() {
      try {
        const torvikRatings = await fetchTorvikRatings();

        if (torvikRatings.size === 0) {
          setError('Using seed-based fallback ratings');
          setLoaded(true);
          return;
        }

        const ratingsMap = applyRatings(state, torvikRatings);
        dispatch({ type: 'SET_RATINGS', ratings: ratingsMap });
        setLoaded(true);
      } catch (err) {
        console.error('Error loading ratings:', err);
        setError('Failed to load ratings, using seed-based fallback');
        setLoaded(true);
      }
    }

    loadRatings();
  }, [loaded, state, dispatch]);

  return { loaded, error };
}
