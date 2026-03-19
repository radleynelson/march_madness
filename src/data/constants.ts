import type { RegionName } from '../types/bracket';

export const REGION_NAMES: RegionName[] = ['East', 'South', 'West', 'Midwest'];

export const REGION_COLORS: Record<RegionName, string> = {
  East: '#1a73e8',
  South: '#e8710a',
  West: '#d93025',
  Midwest: '#0d904f',
};

export const POLLING_INTERVALS = {
  NO_GAMES: 5 * 60 * 1000,       // 5 minutes
  GAMES_SCHEDULED: 2 * 60 * 1000, // 2 minutes
  GAMES_LIVE: 30 * 1000,          // 30 seconds
  HALFTIME: 2 * 60 * 1000,        // 2 minutes
  ERROR_RETRY_1: 10 * 1000,       // 10 seconds
  ERROR_RETRY_2: 30 * 1000,       // 30 seconds
  RATE_LIMITED: 2 * 60 * 1000,    // 2 minutes
};

export const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';
export const ESPN_SCOREBOARD_URL = `${ESPN_BASE_URL}/scoreboard`;
export const ESPN_SUMMARY_URL = 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary';

// Tournament dates for 2026
export const TOURNAMENT_DATES = {
  FIRST_FOUR: ['20260317', '20260318', '20260319'],
  ROUND_OF_64: ['20260320', '20260321'],
  ROUND_OF_32: ['20260322', '20260323'],
  SWEET_16: ['20260327', '20260328'],
  ELITE_8: ['20260329', '20260330'],
  FINAL_FOUR: ['20260405'],
  CHAMPIONSHIP: ['20260407'],
};

export const ALL_TOURNAMENT_DATES = Object.values(TOURNAMENT_DATES).flat();
