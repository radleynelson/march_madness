import type { EspnScoreboardResponse, EspnEvent, EspnCompetitor } from '../types/espn';
import type { ScoreUpdate, GameStatus } from '../types/bracket';
import { ESPN_SCOREBOARD_URL, ESPN_SUMMARY_URL } from '../data/constants';
import { cache } from './cache';

/**
 * Fetch the ESPN scoreboard for a given date (YYYYMMDD format).
 */
export async function fetchScoreboard(date: string): Promise<EspnScoreboardResponse> {
  const cacheKey = `scoreboard-${date}`;
  const cached = cache.get<EspnScoreboardResponse>(cacheKey);
  if (cached) return cached;

  const url = `${ESPN_SCOREBOARD_URL}?dates=${date}&groups=50&limit=100`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
  }

  const data: EspnScoreboardResponse = await response.json();

  // Only cache if all games are final (data won't change)
  const allFinal = data.events.every(e => e.status.type.state === 'post');
  if (allFinal) {
    cache.set(cacheKey, data, 60 * 60 * 1000); // 1 hour
  }

  return data;
}

/**
 * Filter ESPN events to only NCAA tournament games.
 * Tournament games have notes containing region/round info.
 */
export function filterTournamentGames(events: EspnEvent[]): EspnEvent[] {
  const tournamentKeywords = [
    'region',
    'first four',
    'round of 64',
    'round of 32',
    'sweet 16',
    'elite 8',
    'elite eight',
    'final four',
    'semifinal',
    'championship',
    'national championship',
    'ncaa tournament',
    'march madness',
  ];

  return events.filter(event => {
    const notes = event.competitions[0]?.notes ?? [];
    return notes.some(note => {
      const headline = note.headline?.toLowerCase() ?? '';
      return tournamentKeywords.some(keyword => headline.includes(keyword));
    });
  });
}

/**
 * Map ESPN game status to our GameStatus type.
 */
function mapGameStatus(espnStatus: EspnEvent['status']): GameStatus {
  switch (espnStatus.type.state) {
    case 'pre': return 'scheduled';
    case 'in': return 'in_progress';
    case 'post': return 'final';
    default: return 'scheduled';
  }
}

/**
 * Convert ESPN events into ScoreUpdate objects.
 */
export function eventsToScoreUpdates(events: EspnEvent[]): ScoreUpdate[] {
  return events.map(event => {
    const competition = event.competitions[0];
    if (!competition) return null;

    const competitors = competition.competitors;
    // ESPN marks higher seed as "away" and lower seed as "home" typically
    // But we need to match by team name, not by home/away
    const comp1 = competitors[0];
    const comp2 = competitors[1];

    if (!comp1 || !comp2) return null;

    const status = mapGameStatus(event.status);
    const score1 = parseInt(comp1.score, 10);
    const score2 = parseInt(comp2.score, 10);

    // Determine winner for final games
    let winner: 'top' | 'bottom' | null = null;
    if (status === 'final') {
      winner = comp1.winner ? 'top' : comp2.winner ? 'bottom' : null;
    }

    return {
      espnEventId: event.id,
      status,
      statusDetail: event.status.type.description || null,
      topScore: isNaN(score1) ? null : score1,
      bottomScore: isNaN(score2) ? null : score2,
      clock: event.status.displayClock || null,
      period: event.status.period || null,
      liveTopWinProbability: null, // Enriched later for live games
      winner,
      // Store competitor info for matching
      _competitors: [comp1, comp2],
    } as ScoreUpdate & { _competitors: EspnCompetitor[] };
  }).filter((u): u is ScoreUpdate & { _competitors: EspnCompetitor[] } => u !== null);
}

/**
 * Match an ESPN event to a bracket matchup by comparing team names.
 */
export function matchEventToMatchup(
  competitors: EspnCompetitor[],
  matchupTopTeamName: string | undefined,
  matchupBottomTeamName: string | undefined,
): boolean {
  if (!matchupTopTeamName && !matchupBottomTeamName) return false;

  const espnNames = competitors.map(c =>
    c.team.shortDisplayName?.toLowerCase() ??
    c.team.location?.toLowerCase() ?? ''
  );

  const topLower = matchupTopTeamName?.toLowerCase() ?? '';
  const bottomLower = matchupBottomTeamName?.toLowerCase() ?? '';

  // Check if both teams match (in either order)
  const topMatch = espnNames.some(n => n.includes(topLower) || topLower.includes(n));
  const bottomMatch = espnNames.some(n => n.includes(bottomLower) || bottomLower.includes(n));

  return topMatch || bottomMatch;
}

/**
 * Get all tournament dates that have games for today or in the future.
 */
export function getTournamentDatesForToday(): string[] {
  const today = new Date();

  // Check today and the next 2 days for games
  const dates: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(formatDate(d));
  }

  return dates;
}

/**
 * Format a Date as YYYYMMDD.
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Fetch the live ESPN win probability for a game, mapped to the bracket's top team.
 * Uses the core API probabilities endpoint (paginated) to get the most recent entry.
 * Also needs the scoreboard to determine which team is home.
 * Returns a value between 0 and 1, or null if unavailable.
 */
export async function fetchLiveWinProbability(
  eventId: string,
  topTeamId: string,
): Promise<number | null> {
  try {
    const CORE_PROB_URL = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/events/${eventId}/competitions/${eventId}/probabilities`;

    // First fetch to get page count
    const firstResp = await fetch(`${CORE_PROB_URL}?limit=25&page=1`);
    if (!firstResp.ok) return null;
    const firstData = await firstResp.json();
    const pageCount: number = firstData.pageCount ?? 1;

    // Fetch the last page to get the most recent probability
    let items = firstData.items;
    if (pageCount > 1) {
      const lastResp = await fetch(`${CORE_PROB_URL}?limit=25&page=${pageCount}`);
      if (!lastResp.ok) return null;
      const lastData = await lastResp.json();
      items = lastData.items;
    }

    if (!items || items.length === 0) return null;

    // Get the entry with the highest sequence number (most recent)
    const latest = items.reduce((best: any, item: any) => {
      const seq = parseInt(item.sequenceNumber ?? '0', 10);
      const bestSeq = parseInt(best.sequenceNumber ?? '0', 10);
      return seq > bestSeq ? item : best;
    }, items[0]);

    const homeWinPct: number = latest.homeWinPercentage;
    if (typeof homeWinPct !== 'number') return null;

    // The core API uses $ref links for teams. The home team ID is always
    // deterministic from the scoreboard, but we can also extract it from the $ref URL.
    // Home team $ref contains the team ID: .../teams/{ID}
    const homeRef: string = latest.homeTeam?.$ref ?? '';
    const homeIdMatch = homeRef.match(/teams\/(\d+)/);
    const homeTeamId = homeIdMatch?.[1];

    if (!homeTeamId) {
      // Fallback: fetch scoreboard to determine home team
      return null;
    }

    const topIsHome = homeTeamId === topTeamId;
    return topIsHome ? homeWinPct : (1 - homeWinPct);
  } catch {
    return null;
  }
}

/**
 * Fetch the full win probability timeline from the core API (all pages).
 * Returns array of { homeWinPercentage, sequenceNumber } sorted by sequence.
 */
export async function fetchWinProbTimeline(eventId: string): Promise<{ homeWinPercentage: number }[]> {
  try {
    const base = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/events/${eventId}/competitions/${eventId}/probabilities`;

    // Fetch first page to get total page count
    const firstResp = await fetch(`${base}?limit=100&page=1`);
    if (!firstResp.ok) return [];
    const firstData = await firstResp.json();
    const pageCount: number = firstData.pageCount ?? 1;

    let allItems = [...(firstData.items || [])];

    // Fetch remaining pages in parallel
    if (pageCount > 1) {
      const pagePromises = [];
      for (let p = 2; p <= pageCount; p++) {
        pagePromises.push(
          fetch(`${base}?limit=100&page=${p}`)
            .then(r => r.ok ? r.json() : { items: [] })
            .then(d => d.items || [])
        );
      }
      const pageResults = await Promise.all(pagePromises);
      for (const items of pageResults) {
        allItems = allItems.concat(items);
      }
    }

    // Sort by sequence number and extract homeWinPercentage
    return allItems
      .sort((a: any, b: any) => parseInt(a.sequenceNumber ?? '0') - parseInt(b.sequenceNumber ?? '0'))
      .map((item: any) => ({ homeWinPercentage: item.homeWinPercentage as number }));
  } catch {
    return [];
  }
}

/**
 * Fetch game summary from ESPN (box score, leaders, win probability, header, odds).
 */
export async function fetchGameSummary(eventId: string): Promise<EspnGameSummaryResponse> {
  const url = `${ESPN_SUMMARY_URL}?event=${eventId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ESPN summary error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch play-by-play data from ESPN core API.
 */
export async function fetchPlayByPlay(eventId: string): Promise<EspnPlayByPlayResponse> {
  const url = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/events/${eventId}/competitions/${eventId}/plays?limit=300`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ESPN plays error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// --- Types for summary/play-by-play responses ---

export interface EspnGameSummaryResponse {
  boxscore: {
    teams: EspnBoxScoreTeam[];
    players: EspnBoxScorePlayers[];
  };
  header: {
    id: string;
    competitions: EspnSummaryCompetition[];
    gameNote: string;
  };
  leaders: EspnLeaderGroup[];
  winprobability: { homeWinPercentage: number; playId: string }[];
  pickcenter: EspnPickcenterEntry[];
  gameInfo: {
    venue?: { fullName: string; address?: { city: string; state: string } };
    officials?: { fullName: string }[];
  };
  format: {
    regulation: { periods: number };
  };
}

export interface EspnSummaryCompetition {
  id: string;
  competitors: EspnSummaryCompetitor[];
  status: {
    displayClock: string;
    period: number;
    type: {
      state: 'pre' | 'in' | 'post';
      detail: string;
      shortDetail: string;
    };
  };
  broadcasts: {
    media: { shortName: string };
  }[];
}

export interface EspnSummaryCompetitor {
  id: string;
  homeAway: 'home' | 'away';
  team: {
    id: string;
    location: string;
    name: string;
    abbreviation: string;
    displayName: string;
    color: string;
    logos: { href: string }[];
  };
  score: string;
  rank?: number;
  record: { type: string; summary: string; displayValue: string }[];
  linescores: { displayValue: string }[];
  possession: boolean;
}

export interface EspnBoxScoreTeam {
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    color: string;
    logo: string;
  };
  statistics: { name: string; displayValue: string; label: string }[];
  homeAway: string;
}

export interface EspnBoxScorePlayers {
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    color: string;
    logo: string;
  };
  statistics: {
    names: string[];
    athletes: {
      athlete: {
        id: string;
        displayName: string;
        shortName: string;
        jersey: string;
        headshot?: { href: string };
        position: { abbreviation: string };
      };
      starter: boolean;
      didNotPlay: boolean;
      stats: string[];
    }[];
    totals: string[];
  }[];
}

export interface EspnLeaderGroup {
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    logo: string;
  };
  leaders: {
    name: string;
    displayName: string;
    leaders: {
      displayValue: string;
      athlete: {
        displayName: string;
        shortName: string;
        jersey: string;
        headshot?: { href: string };
        position: { abbreviation: string };
      };
      summary: string;
    }[];
  }[];
}

export interface EspnPickcenterEntry {
  provider: { name: string };
  details: string;
  overUnder: number;
  spread: number;
  homeTeamOdds: { moneyLine: number; favorite: boolean };
  awayTeamOdds: { moneyLine: number; favorite: boolean };
  pointSpread?: {
    home: { live?: { line: string; odds: string } };
    away: { live?: { line: string; odds: string } };
  };
  total?: {
    over: { live?: { line: string; odds: string } };
    under: { live?: { line: string; odds: string } };
  };
  moneyline?: {
    home: { live?: { odds: string } };
    away: { live?: { odds: string } };
  };
}

export interface EspnPlayByPlayResponse {
  items: EspnPlay[];
  count: number;
  pageIndex: number;
  pageCount: number;
}

export interface EspnPlay {
  id: string;
  sequenceNumber: string;
  type: { id: string; text: string };
  text: string;
  shortText?: string;
  awayScore: number;
  homeScore: number;
  period: { number: number; displayValue: string };
  clock: { value: number; displayValue: string };
  scoringPlay: boolean;
  shootingPlay: boolean;
  scoreValue: number;
  team?: { id?: string; $ref?: string };
  wallclock: string;
  coordinate?: { x: number; y: number };
}
