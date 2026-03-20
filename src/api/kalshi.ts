import type { KalshiMarket, KalshiGameMarket, KalshiFuturesMarket } from '../types/kalshi';

// Use proxy in dev (Vite) and production (server.mjs) to avoid CORS issues
const KALSHI_BASE = '/api/kalshi/trade-api/v2';

const SERIES = {
  GAME_WINNER: 'KXNCAAMBGAME',
  SPREAD: 'KXNCAAMBSPREAD',
  TOTAL: 'KXNCAAMBTOTAL',
  CHAMPIONSHIP: 'KXMARMAD',
};

interface KalshiMarketsResponse {
  markets: KalshiMarket[];
  cursor: string;
}

/**
 * Fetch all markets for a given series ticker.
 * Handles pagination via cursor.
 */
async function fetchSeriesMarkets(seriesTicker: string, status?: string): Promise<KalshiMarket[]> {
  const allMarkets: KalshiMarket[] = [];
  let cursor = '';
  const limit = 200;

  // Max 5 pages to avoid runaway requests
  for (let i = 0; i < 5; i++) {
    const params = new URLSearchParams({
      series_ticker: seriesTicker,
      limit: String(limit),
    });
    if (status) params.set('status', status);
    if (cursor) params.set('cursor', cursor);

    const resp = await fetch(`${KALSHI_BASE}/markets?${params}`);
    if (!resp.ok) throw new Error(`Kalshi API error: ${resp.status}`);

    const data: KalshiMarketsResponse = await resp.json();
    allMarkets.push(...data.markets);

    if (!data.cursor || data.markets.length < limit) break;
    cursor = data.cursor;
  }

  return allMarkets;
}

/** Parse a dollar string like "0.3200" to a number. Returns 0 on failure. */
function parseDollar(s: string | undefined | null): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Parse a float-point string like "183085.00" to a number. */
function parseFp(s: string | undefined | null): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

/**
 * Parse a Kalshi game market into our normalized format.
 * API v2 returns dollar strings (e.g. "0.32") not integer cents.
 */
function parseGameMarket(m: KalshiMarket): KalshiGameMarket {
  return {
    ticker: m.ticker,
    eventTicker: m.event_ticker,
    teamName: m.yes_sub_title || '',
    price: parseDollar(m.last_price_dollars),
    askPrice: parseDollar(m.yes_ask_dollars),
    bidPrice: parseDollar(m.yes_bid_dollars),
    volume: parseFp(m.volume_fp),
    volume24h: parseFp(m.volume_24h_fp),
    openInterest: parseFp(m.open_interest_fp),
    status: m.status,
  };
}

/**
 * Fetch all active game winner markets for NCAA tournament.
 * Returns an array of parsed game markets.
 */
export async function fetchGameWinnerMarkets(): Promise<KalshiGameMarket[]> {
  const markets = await fetchSeriesMarkets(SERIES.GAME_WINNER);
  return markets.map(parseGameMarket);
}

/**
 * Fetch championship futures markets.
 */
export async function fetchChampionshipFutures(): Promise<KalshiFuturesMarket[]> {
  const markets = await fetchSeriesMarkets(SERIES.CHAMPIONSHIP);
  return markets
    .map(m => ({
      ticker: m.ticker,
      teamName: m.yes_sub_title || '',
      price: parseDollar(m.last_price_dollars),
      volume: parseFp(m.volume_fp),
      openInterest: parseFp(m.open_interest_fp),
    }))
    .filter(m => m.price > 0)
    .sort((a, b) => b.price - a.price);
}

/**
 * Format a volume number for display (e.g., 3100000 → "3.1M")
 */
export function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
  return String(vol);
}

/**
 * Convert Kalshi price (0-1) to American odds string.
 * e.g., 0.58 → "-138", 0.35 → "+186"
 */
export function priceToAmericanOdds(price: number): string {
  if (price <= 0 || price >= 1) return '-';
  if (price >= 0.5) {
    const odds = Math.round(-100 * price / (1 - price));
    return String(odds);
  } else {
    const odds = Math.round(100 * (1 - price) / price);
    return `+${odds}`;
  }
}
