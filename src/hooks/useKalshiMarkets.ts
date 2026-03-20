import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import type { BracketState, Matchup } from '../types/bracket';
import type { KalshiGameMarket, KalshiMatchupData, KalshiFuturesMarket, KalshiPosition } from '../types/kalshi';
import { fetchGameWinnerMarkets, fetchChampionshipFutures, fetchPositions } from '../api/kalshi';

/** A user's position on a specific matchup, matched to a bracket game */
export interface MatchupPosition {
  /** The market ticker (e.g., KXNCAAMBGAME-...) */
  ticker: string;
  /** Which team in the matchup the position is on ('top' or 'bottom') */
  side: 'top' | 'bottom';
  /** Team name from the Kalshi market */
  teamName: string;
  /** Number of contracts (positive = YES, negative = NO) */
  contracts: number;
  /** Current market price for this side (0-1) */
  currentPrice: number;
}

interface KalshiState {
  /** Map from bracket matchupId → Kalshi market data */
  matchupMarkets: Map<string, KalshiMatchupData>;
  /** Championship futures sorted by probability */
  futures: KalshiFuturesMarket[];
  /** Whether we've done at least one successful fetch */
  loaded: boolean;
  /** Last successful fetch time */
  lastUpdated: Date | null;
  /** Map from bracket matchupId → user's position on this game */
  positions: Map<string, MatchupPosition>;
  /** Whether positions are being loaded */
  positionsLoading: boolean;
  /** Error message for positions fetch, if any */
  positionsError: string | null;
}

const INITIAL_STATE: KalshiState = {
  matchupMarkets: new Map(),
  futures: [],
  loaded: false,
  lastUpdated: null,
  positions: new Map(),
  positionsLoading: false,
  positionsError: null,
};

// ─── Name matching ────────────────────────────────────────

/** Normalize a team name for fuzzy matching */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Common name aliases for matching */
const ALIASES: Record<string, string[]> = {
  'uconn': ['connecticut'],
  'connecticut': ['uconn'],
  'unc': ['north carolina', 'tar heels'],
  'north carolina': ['unc', 'tar heels'],
  'lsu': ['louisiana state'],
  'smu': ['southern methodist'],
  'byu': ['brigham young'],
  'vcu': ['virginia commonwealth'],
  'ucf': ['central florida'],
  'liu': ['long island'],
  'niu': ['northern illinois'],
  'fau': ['florida atlantic'],
  'fiu': ['florida international'],
  'etsu': ['east tennessee state', 'east tennessee st'],
  'ndsu': ['north dakota state', 'north dakota st'],
  'sdsu': ['san diego state', 'san diego st'],
  'umbc': ['maryland baltimore county'],
  'uab': ['alabama birmingham'],
  'ole miss': ['mississippi'],
  'pitt': ['pittsburgh'],
  'cal baptist': ['california baptist'],
  'st johns': ['saint johns', 'st john\'s'],
  'saint johns': ['st johns', 'st john\'s'],
  'saint marys': ['st marys', 'saint mary\'s', 'st mary\'s'],
  'st marys': ['saint marys', 'saint mary\'s', 'st mary\'s'],
  'saint louis': ['st louis'],
  'st louis': ['saint louis'],
  'nc state': ['north carolina state'],
  'michigan st': ['michigan state'],
  'kennesaw st': ['kennesaw state'],
  'utah st': ['utah state'],
  'prairie view': ['prairie view am'],
};

function namesMatch(bracketName: string, kalshiName: string): boolean {
  const a = normalize(bracketName);
  const b = normalize(kalshiName);

  // Direct match
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  // Check aliases
  const aAliases = ALIASES[a] ?? [];
  for (const alias of aAliases) {
    if (alias === b || b.includes(alias) || alias.includes(b)) return true;
  }
  const bAliases = ALIASES[b] ?? [];
  for (const alias of bAliases) {
    if (alias === a || a.includes(alias) || alias.includes(a)) return true;
  }

  return false;
}

/**
 * Match Kalshi game markets to bracket matchups.
 *
 * Kalshi markets come in pairs (one per team per game), grouped by event_ticker.
 * We match each pair to a bracket matchup by comparing team names.
 */
function matchMarkets(
  markets: KalshiGameMarket[],
  matchups: Map<string, Matchup>,
): Map<string, KalshiMatchupData> {
  const result = new Map<string, KalshiMatchupData>();

  // Group Kalshi markets by event ticker (each event has 2 team markets)
  const byEvent = new Map<string, KalshiGameMarket[]>();
  for (const m of markets) {
    const list = byEvent.get(m.eventTicker) ?? [];
    list.push(m);
    byEvent.set(m.eventTicker, list);
  }

  // For each bracket matchup with both teams, try to find a matching Kalshi event
  for (const [matchupId, matchup] of matchups) {
    if (!matchup.topTeam || !matchup.bottomTeam) continue;

    const topName = matchup.topTeam.shortName;
    const bottomName = matchup.bottomTeam.shortName;

    for (const [, eventMarkets] of byEvent) {
      if (eventMarkets.length < 2) continue;

      // Try to find which Kalshi market corresponds to top and bottom
      let topMarket: KalshiGameMarket | null = null;
      let bottomMarket: KalshiGameMarket | null = null;

      for (const km of eventMarkets) {
        if (namesMatch(topName, km.teamName)) topMarket = km;
        else if (namesMatch(bottomName, km.teamName)) bottomMarket = km;
      }

      if (topMarket && bottomMarket) {
        result.set(matchupId, {
          topMarket,
          bottomMarket,
          totalVolume: topMarket.volume + bottomMarket.volume,
          totalVolume24h: topMarket.volume24h + bottomMarket.volume24h,
        });
        break;
      }
    }
  }

  return result;
}

/**
 * Match user positions to bracket matchups using market ticker and the
 * already-matched market data.
 */
function matchPositions(
  rawPositions: KalshiPosition[],
  matchupMarkets: Map<string, KalshiMatchupData>,
): Map<string, MatchupPosition> {
  const result = new Map<string, MatchupPosition>();

  // Build a reverse map from market ticker → (matchupId, side)
  const tickerMap = new Map<string, { matchupId: string; side: 'top' | 'bottom'; teamName: string; price: number }>();
  for (const [matchupId, kd] of matchupMarkets) {
    tickerMap.set(kd.topMarket.ticker, {
      matchupId,
      side: 'top',
      teamName: kd.topMarket.teamName,
      price: kd.topMarket.price,
    });
    tickerMap.set(kd.bottomMarket.ticker, {
      matchupId,
      side: 'bottom',
      teamName: kd.bottomMarket.teamName,
      price: kd.bottomMarket.price,
    });
  }

  for (const pos of rawPositions) {
    const match = tickerMap.get(pos.ticker);
    if (match) {
      result.set(match.matchupId, {
        ticker: pos.ticker,
        side: match.side,
        teamName: match.teamName,
        contracts: Math.round(parseFloat(pos.position_fp || '0')),
        currentPrice: match.price,
      });
    }
  }

  return result;
}

// ─── Hook ─────────────────────────────────────────────────

const POLL_INTERVAL = 30_000; // 30 seconds (Kalshi CDN caches for 15s)
const FUTURES_INTERVAL = 5 * 60_000; // 5 minutes for futures (less volatile)

export function useKalshiMarkets(state: BracketState, kalshiKeyId: string, kalshiPrivateKey: string): KalshiState {
  const [kalshiState, setKalshiState] = useState<KalshiState>(INITIAL_STATE);
  const matchupsRef = useRef(state.matchups);
  matchupsRef.current = state.matchups;
  const hasKalshiCreds = kalshiKeyId.length > 0 && kalshiPrivateKey.length > 0;

  // Keep a ref to the latest matchupMarkets for position matching
  const matchupMarketsRef = useRef(kalshiState.matchupMarkets);
  matchupMarketsRef.current = kalshiState.matchupMarkets;

  const fetchGames = useCallback(async () => {
    try {
      const markets = await fetchGameWinnerMarkets();
      const matched = matchMarkets(markets, matchupsRef.current);
      matchupMarketsRef.current = matched;
      setKalshiState(prev => ({
        ...prev,
        matchupMarkets: matched,
        loaded: true,
        lastUpdated: new Date(),
      }));
    } catch (err) {
      console.warn('Kalshi game markets fetch failed:', err);
    }
  }, []);

  const fetchFutures = useCallback(async () => {
    try {
      const futures = await fetchChampionshipFutures();
      setKalshiState(prev => ({ ...prev, futures }));
    } catch (err) {
      console.warn('Kalshi futures fetch failed:', err);
    }
  }, []);

  const fetchUserPositions = useCallback(async () => {
    if (!hasKalshiCreds) return;
    try {
      setKalshiState(prev => ({ ...prev, positionsLoading: prev.positions.size === 0 }));
      const rawPositions = await fetchPositions(kalshiKeyId, kalshiPrivateKey);
      const matched = matchPositions(rawPositions, matchupMarketsRef.current);
      setKalshiState(prev => ({
        ...prev,
        positions: matched,
        positionsLoading: false,
        positionsError: null,
      }));
    } catch (err) {
      console.warn('Kalshi positions fetch failed:', err);
      setKalshiState(prev => ({
        ...prev,
        positionsLoading: false,
        positionsError: err instanceof Error ? err.message : 'Failed to fetch positions',
      }));
    }
  }, [hasKalshiCreds, kalshiKeyId, kalshiPrivateKey]);

  // Combined fetch: games first, then positions (needs market data for matching)
  const fetchGamesAndPositions = useCallback(async () => {
    await fetchGames();
    if (hasKalshiCreds) {
      await fetchUserPositions();
    }
  }, [fetchGames, fetchUserPositions, hasKalshiCreds]);

  // Initial fetch + polling
  useEffect(() => {
    fetchGamesAndPositions();
    fetchFutures();

    const gameInterval = setInterval(fetchGamesAndPositions, POLL_INTERVAL);
    const futuresInterval = setInterval(fetchFutures, FUTURES_INTERVAL);

    return () => {
      clearInterval(gameInterval);
      clearInterval(futuresInterval);
    };
  }, [fetchGamesAndPositions, fetchFutures]);

  // Clear positions when credentials are removed
  useEffect(() => {
    if (!hasKalshiCreds) {
      setKalshiState(prev => ({
        ...prev,
        positions: new Map(),
        positionsLoading: false,
        positionsError: null,
      }));
    }
  }, [hasKalshiCreds]);

  return kalshiState;
}

// ─── Context ──────────────────────────────────────────────

export const KalshiContext = createContext<KalshiState>(INITIAL_STATE);

export function useKalshiContext(): KalshiState {
  return useContext(KalshiContext);
}
