import type { BracketState, Matchup, Team, RegionName } from '../types/bracket';
import type {
  EspnEntryResponse,
  EspnChallengeResponse,
  EspnProposition,
  EspnOutcome,
  EspnBracketPick,
} from '../types/espn-bracket';

// ─── Constants ───────────────────────────────────────────

const GAMBIT_BASE = '/api/espn-bracket';
const POINTS_PER_ROUND: Record<number, number> = {
  1: 10, 2: 20, 3: 40, 4: 80, 5: 160, 6: 320,
};

/** ESPN regionId → our RegionName */
const REGION_MAP: Record<number, RegionName> = {
  1: 'East',
  2: 'South',
  3: 'West',
  4: 'Midwest',
};

/** ESPN scoringPeriodId → our round number (used in matchup IDs) */
const PERIOD_TO_ROUND: Record<number, number> = {
  1: 1, // R64
  2: 2, // R32
  3: 3, // S16
  4: 4, // E8
  5: 5, // FF
  6: 6, // Championship
};

// ─── URL parsing ─────────────────────────────────────────

/** Extract entry ID from an ESPN bracket URL or raw ID string */
export function parseEntryId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try to extract from URL: ...bracket?id=UUID or ...bracket?entryID=UUID
  const urlMatch = trimmed.match(/[?&](?:id|entryID)=([a-f0-9-]+)/i);
  if (urlMatch) return urlMatch[1];

  // Check if it looks like a UUID directly
  const uuidMatch = trimmed.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
  if (uuidMatch) return uuidMatch[0];

  return null;
}

// ─── API fetchers ────────────────────────────────────────

export async function fetchEspnEntry(entryId: string): Promise<EspnEntryResponse> {
  const resp = await fetch(`${GAMBIT_BASE}/entries/${entryId}`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ESPN entry: ${resp.status}`);
  }
  return resp.json();
}

let cachedChallenge: EspnChallengeResponse | null = null;

export async function fetchEspnChallengeProps(): Promise<EspnChallengeResponse> {
  if (cachedChallenge) return cachedChallenge;

  const resp = await fetch(`${GAMBIT_BASE}/challenge?includeAllProps=true`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ESPN challenge: ${resp.status}`);
  }
  const data = await resp.json();
  cachedChallenge = data;
  return data;
}

// ─── Name matching ───────────────────────────────────────

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Check if an ESPN abbreviation or name matches a bracket team */
function teamMatches(team: Team, espnAbbrev: string, espnName: string): boolean {
  const ta = team.abbreviation.toLowerCase();
  const ts = normalize(team.shortName);
  const tn = normalize(team.name);
  const ea = espnAbbrev.toLowerCase().replace(/-/g, '');
  const en = normalize(espnName);

  if (ta === ea) return true;
  if (ts === en || tn === en) return true;
  if (en.includes(ts) || ts.includes(en)) return true;
  if (tn.includes(en) || en.includes(tn)) return true;

  return false;
}

// ─── Pick matching ───────────────────────────────────────

/**
 * Match ESPN entry picks to our bracket matchups.
 *
 * Strategy:
 * 1. Build a lookup from ESPN propositionId -> proposition details
 * 2. For each pick, find which team was picked (via outcomeId)
 * 3. For R64 picks, match by region + seed pair to our bracket matchups
 * 4. For later rounds, match by finding the bracket matchup at the right
 *    round that could contain the picked team (tracing the bracket tree)
 */
export function matchPicksToBracket(
  entry: EspnEntryResponse,
  challenge: EspnChallengeResponse,
  state: BracketState,
): Map<string, EspnBracketPick> {
  const result = new Map<string, EspnBracketPick>();

  // Build proposition lookup
  const propMap = new Map<string, EspnProposition>();
  for (const prop of challenge.propositions) {
    propMap.set(prop.id, prop);
  }

  // Build outcome lookup
  const outcomeMap = new Map<string, { prop: EspnProposition; outcome: EspnOutcome }>();
  for (const prop of challenge.propositions) {
    for (const outcome of prop.possibleOutcomes) {
      outcomeMap.set(outcome.id, { prop, outcome });
    }
  }

  // Build team lookup by ESPN ID (from COMPETITOR_ID mapping)
  const espnIdToTeam = new Map<string, Team>();
  for (const team of state.teams.values()) {
    espnIdToTeam.set(team.id, team);
  }

  // Index matchups by round for fast lookup
  const matchupsByRound = new Map<number, Matchup[]>();
  for (const m of state.matchups.values()) {
    const list = matchupsByRound.get(m.roundNumber) ?? [];
    list.push(m);
    matchupsByRound.set(m.roundNumber, list);
  }

  for (const pick of entry.picks) {
    const prop = propMap.get(pick.propositionId);
    if (!prop) continue;

    const pickedOutcomeId = pick.outcomesPicked[0]?.outcomeId;
    if (!pickedOutcomeId) continue;

    const pickedInfo = outcomeMap.get(pickedOutcomeId);
    if (!pickedInfo) continue;

    const { outcome: pickedOutcome } = pickedInfo;
    const round = PERIOD_TO_ROUND[prop.scoringPeriodId];
    if (!round) continue;

    // Find the ESPN competitor ID
    const competitorMapping = pickedOutcome.mappings?.find(m => m.type === 'COMPETITOR_ID');
    const espnTeamId = competitorMapping?.value ?? null;

    // Find the team in our bracket
    let pickedTeam: Team | null = null;
    if (espnTeamId) {
      pickedTeam = espnIdToTeam.get(espnTeamId) ?? null;
    }
    if (!pickedTeam) {
      // Fallback: match by abbreviation/name
      for (const team of state.teams.values()) {
        if (teamMatches(team, pickedOutcome.abbrev, pickedOutcome.name)) {
          pickedTeam = team;
          break;
        }
      }
    }

    if (!pickedTeam) continue;

    // Find the bracket matchup this pick corresponds to
    const matchup = findMatchupForPick(
      pickedTeam,
      round,
      REGION_MAP[pickedOutcome.regionId] ?? null,
      state,
      matchupsByRound,
    );

    if (!matchup) continue;

    // Determine which side the picked team is on
    let side: 'top' | 'bottom' | null = null;
    if (matchup.topTeam?.id === pickedTeam.id) {
      side = 'top';
    } else if (matchup.bottomTeam?.id === pickedTeam.id) {
      side = 'bottom';
    } else {
      // For later rounds, the team might not be seated yet.
      // Check which source subtree the team belongs to.
      side = findSideForTeam(pickedTeam, matchup, state);
    }

    if (!side) continue;

    result.set(matchup.id, {
      matchupId: matchup.id,
      side,
      teamAbbrev: pickedOutcome.abbrev,
      teamName: pickedOutcome.name,
      result: pick.outcomesPicked[0].result,
      pointValue: POINTS_PER_ROUND[prop.scoringPeriodId] ?? 0,
      round: prop.scoringPeriodId,
    });
  }

  return result;
}

/**
 * Find the bracket matchup that corresponds to a pick for a given team at a
 * given round. For R64, we match by the team being directly in the matchup.
 * For later rounds, we find the matchup at that round where the team could
 * appear (by tracing the source subtree).
 */
function findMatchupForPick(
  team: Team,
  round: number,
  region: RegionName | null,
  state: BracketState,
  matchupsByRound: Map<number, Matchup[]>,
): Matchup | null {
  const roundMatchups = matchupsByRound.get(round) ?? [];

  // For R64, try direct team match
  if (round === 1) {
    for (const m of roundMatchups) {
      if (m.topTeam?.id === team.id || m.bottomTeam?.id === team.id) {
        return m;
      }
    }
  }

  // For any round, find matchup whose source subtree contains this team
  for (const m of roundMatchups) {
    // Quick region filter for rounds before Final Four
    if (round <= 4 && region && m.region !== region && m.region !== 'Final Four') continue;

    if (subtreeContainsTeam(m, team, state)) {
      return m;
    }
  }

  return null;
}

/** Check if a matchup's source subtree contains a given team */
function subtreeContainsTeam(matchup: Matchup, team: Team, state: BracketState): boolean {
  if (matchup.topTeam?.id === team.id || matchup.bottomTeam?.id === team.id) return true;

  if (matchup.topSourceMatchupId) {
    const src = state.matchups.get(matchup.topSourceMatchupId);
    if (src && subtreeContainsTeam(src, team, state)) return true;
  }
  if (matchup.bottomSourceMatchupId) {
    const src = state.matchups.get(matchup.bottomSourceMatchupId);
    if (src && subtreeContainsTeam(src, team, state)) return true;
  }

  return false;
}

/** Determine if a team would come from the top or bottom source of a matchup */
function findSideForTeam(team: Team, matchup: Matchup, state: BracketState): 'top' | 'bottom' | null {
  if (matchup.topSourceMatchupId) {
    const src = state.matchups.get(matchup.topSourceMatchupId);
    if (src && subtreeContainsTeam(src, team, state)) return 'top';
  }
  if (matchup.bottomSourceMatchupId) {
    const src = state.matchups.get(matchup.bottomSourceMatchupId);
    if (src && subtreeContainsTeam(src, team, state)) return 'bottom';
  }
  return null;
}
