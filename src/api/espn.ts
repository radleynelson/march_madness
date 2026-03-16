import type { EspnScoreboardResponse, EspnEvent, EspnCompetitor } from '../types/espn';
import type { ScoreUpdate, GameStatus } from '../types/bracket';
import { ESPN_SCOREBOARD_URL } from '../data/constants';
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
      topScore: isNaN(score1) ? null : score1,
      bottomScore: isNaN(score2) ? null : score2,
      clock: event.status.displayClock || null,
      period: event.status.period || null,
      liveTopWinProbability: null, // Would need separate summary API call
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
