/** Raw Kalshi market from the API (v2 — uses dollar strings) */
export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  subtitle: string;
  yes_sub_title: string;
  no_sub_title: string;
  status: 'active' | 'settled' | 'closed';
  result: string;
  last_price_dollars: string;    // e.g. "0.3200"
  yes_bid_dollars: string;
  yes_ask_dollars: string;
  no_bid_dollars: string;
  no_ask_dollars: string;
  volume_fp: string;             // e.g. "183085.00"
  volume_24h_fp: string;
  open_interest_fp: string;
  expected_expiration_time: string;
}

export interface KalshiGameMarket {
  ticker: string;
  eventTicker: string;
  teamName: string;
  /** 0-1 implied probability from last traded price */
  price: number;
  /** 0-1 from best ask (what you'd pay to buy YES) */
  askPrice: number;
  /** 0-1 from best bid (what you'd get selling YES) */
  bidPrice: number;
  /** Total contracts ever traded on this market */
  volume: number;
  /** Contracts traded in last 24h */
  volume24h: number;
  openInterest: number;
  status: string;
}

/** Matched Kalshi data for a bracket matchup — both sides */
export interface KalshiMatchupData {
  topMarket: KalshiGameMarket;
  bottomMarket: KalshiGameMarket;
  /** Total volume across both sides */
  totalVolume: number;
  totalVolume24h: number;
}

export interface KalshiFuturesMarket {
  ticker: string;
  teamName: string;
  /** 0-1 implied probability */
  price: number;
  volume: number;
  openInterest: number;
}

/** A single position from the Kalshi portfolio API */
export interface KalshiPosition {
  ticker: string;
  market_exposure: number;
  total_traded: number;
  realized_pnl: number;
  resting_orders_count: number;
  /** Fees paid */
  fees_paid?: number;
}
