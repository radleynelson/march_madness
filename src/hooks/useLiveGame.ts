import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchGameSummary, fetchPlayByPlay, fetchWinProbTimeline } from '../api/espn';
import type { EspnGameSummaryResponse, EspnPlay } from '../api/espn';

interface UseLiveGameOptions {
  eventId: string | null;
  enabled: boolean;
  /** Polling interval in ms (default: 15000) */
  pollInterval?: number;
}

interface LiveGameState {
  summary: EspnGameSummaryResponse | null;
  plays: EspnPlay[];
  winProbTimeline: { homeWinPercentage: number }[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useLiveGame({ eventId, enabled, pollInterval = 15000 }: UseLiveGameOptions) {
  const [state, setState] = useState<LiveGameState>({
    summary: null,
    plays: [],
    winProbTimeline: [],
    loading: true,
    error: null,
    lastUpdated: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!eventId) return;

    try {
      const [summaryData, playsData, wpTimeline] = await Promise.all([
        fetchGameSummary(eventId),
        fetchPlayByPlay(eventId),
        fetchWinProbTimeline(eventId),
      ]);

      setState({
        summary: summaryData,
        plays: playsData.items || [],
        winProbTimeline: wpTimeline,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch game data',
      }));
    }
  }, [eventId]);

  useEffect(() => {
    if (!enabled || !eventId) return;

    setState(prev => ({ ...prev, loading: true }));
    fetchData();

    intervalRef.current = setInterval(fetchData, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, eventId, fetchData, pollInterval]);

  return {
    ...state,
    refetch: fetchData,
  };
}
