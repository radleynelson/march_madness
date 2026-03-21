import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import type { BracketState } from '../types/bracket';
import type { EspnBracketData, EspnBracketPick, EspnEntryScore } from '../types/espn-bracket';
import { parseEntryId, fetchEspnEntry, fetchEspnChallengeProps, matchPicksToBracket } from '../api/espn-bracket';

// ─── State ───────────────────────────────────────────────

export interface EspnBracketState {
  data: EspnBracketData | null;
  loading: boolean;
  error: string | null;
  /** Actions */
  importBracket: (input: string) => Promise<void>;
  clearBracket: () => void;
  refreshBracket: () => Promise<void>;
}

const INITIAL_STATE: EspnBracketState = {
  data: null,
  loading: false,
  error: null,
  importBracket: async () => {},
  clearBracket: () => {},
  refreshBracket: async () => {},
};

const STORAGE_KEY = 'mm_espn_entry_id';
const REFRESH_INTERVAL = 60_000; // 60 seconds

// ─── Hook ────────────────────────────────────────────────

export function useEspnBracket(state: BracketState): EspnBracketState {
  const [data, setData] = useState<EspnBracketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const entryIdRef = useRef<string | null>(null);

  const doImport = useCallback(async (entryId: string) => {
    setLoading(true);
    setError(null);

    try {
      const [entry, challenge] = await Promise.all([
        fetchEspnEntry(entryId),
        fetchEspnChallengeProps(),
      ]);

      const picks = matchPicksToBracket(entry, challenge, stateRef.current);

      setData({
        entryId,
        entryName: entry.name,
        picks,
        score: entry.score,
      });
      entryIdRef.current = entryId;
      localStorage.setItem(STORAGE_KEY, entryId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import bracket';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const importBracket = useCallback(async (input: string) => {
    const entryId = parseEntryId(input);
    if (!entryId) {
      setError('Invalid ESPN bracket URL or entry ID');
      return;
    }
    await doImport(entryId);
  }, [doImport]);

  const clearBracket = useCallback(() => {
    setData(null);
    setError(null);
    entryIdRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refreshBracket = useCallback(async () => {
    const id = entryIdRef.current;
    if (!id) return;
    await doImport(id);
  }, [doImport]);

  // Restore from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      doImport(savedId);
    }
  }, [doImport]);

  // Auto-refresh when there are undecided picks and we have data
  useEffect(() => {
    if (!data) return;

    const hasUndecided = Array.from(data.picks.values()).some(
      p => p.result === 'UNDECIDED',
    );
    if (!hasUndecided) return;

    const interval = setInterval(() => {
      const id = entryIdRef.current;
      if (id) doImport(id);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [data, doImport]);

  return {
    data,
    loading,
    error,
    importBracket,
    clearBracket,
    refreshBracket,
  };
}

// ─── Context ─────────────────────────────────────────────

export const EspnBracketContext = createContext<EspnBracketState>(INITIAL_STATE);

export function useEspnBracketContext(): EspnBracketState {
  return useContext(EspnBracketContext);
}

// ─── Helpers for consumers ───────────────────────────────

/** Get the pick for a specific matchup ID, if any */
export function getPickForMatchup(
  data: EspnBracketData | null,
  matchupId: string,
): EspnBracketPick | null {
  return data?.picks.get(matchupId) ?? null;
}

/** Format score for display */
export function formatEspnScore(score: EspnEntryScore): string {
  return `${score.overallScore} pts`;
}

/** Format percentile for display */
export function formatPercentile(score: EspnEntryScore): string {
  const pct = Math.round(score.percentile * 100);
  return `Top ${100 - pct}%`;
}
