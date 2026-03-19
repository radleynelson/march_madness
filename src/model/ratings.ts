import type { TorvikTeamRating, TorvikRatingsMap } from '../types/torvik';
import type { BracketState } from '../types/bracket';

/**
 * Team name aliases for matching between ESPN names and Torvik names.
 */
const NAME_ALIASES: Record<string, string[]> = {
  'uconn': ['connecticut'],
  'connecticut': ['uconn'],
  "st. john's": ["st john's", 'saint johns', 'st johns'],
  'north dakota st': ['north dakota state', 'north dakota st.', 'ndsu'],
  'michigan state': ['michigan st', 'michigan st.'],
  'ohio state': ['ohio st', 'ohio st.'],
  'iowa state': ['iowa st', 'iowa st.'],
  'nc state': ['north carolina state', 'n.c. state'],
  'tennessee st': ['tennessee state', 'tennessee st.'],
  'utah state': ['utah st', 'utah st.'],
  'cal baptist': ['california baptist'],
  'miami': ['miami fl', 'miami (fl)'],
  'miami (oh)': ['miami oh', 'miami ohio'],
  "saint mary's": ["saint mary's (ca)", "st. mary's", "st mary's"],
  'saint louis': ['st. louis', 'st louis'],
  'south florida': ['usf'],
  'prairie view': ['prairie view a&m'],
  'kennesaw st': ['kennesaw state', 'kennesaw st.'],
  'wright state': ['wright st', 'wright st.'],
  'liu': ['long island', 'long island university'],
  'high point': ['high point'],
};

/**
 * Normalize a team name for fuzzy matching.
 */
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the best match for a team name in the ratings map.
 */
export function findTeamRating(
  ratingsMap: TorvikRatingsMap,
  teamName: string,
): TorvikTeamRating | null {
  const normalized = normalizeTeamName(teamName);

  // Direct lookup
  if (ratingsMap.has(normalized)) {
    return ratingsMap.get(normalized)!;
  }

  // Try aliases
  const aliases = NAME_ALIASES[normalized] ?? [];
  for (const alias of aliases) {
    if (ratingsMap.has(normalizeTeamName(alias))) {
      return ratingsMap.get(normalizeTeamName(alias))!;
    }
  }

  // Reverse alias search
  for (const [key, aliasList] of Object.entries(NAME_ALIASES)) {
    if (aliasList.some(a => normalizeTeamName(a) === normalized)) {
      if (ratingsMap.has(normalizeTeamName(key))) {
        return ratingsMap.get(normalizeTeamName(key))!;
      }
    }
  }

  // Substring match (last resort)
  for (const [key, rating] of ratingsMap) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return rating;
    }
  }

  return null;
}

/**
 * Apply Torvik ratings to all teams in the bracket state.
 * Returns a new ratings map (teamId -> adjEM).
 */
export function applyRatings(
  state: BracketState,
  torvikRatings: TorvikRatingsMap,
): Map<string, number> {
  const ratingsMap = new Map<string, number>();

  for (const [id, team] of state.teams) {
    const rating = findTeamRating(torvikRatings, team.shortName)
      ?? findTeamRating(torvikRatings, team.name);

    if (rating) {
      ratingsMap.set(id, rating.adjEfficiency);
    } else {
      // Fallback to seed-based rating (already set on the team)
      ratingsMap.set(id, team.rating);
    }
  }

  return ratingsMap;
}

/**
 * Parse Torvik's raw JSON array data into typed ratings.
 * Torvik returns arrays where each team is a positional array.
 */
export function parseTorvikData(rawData: unknown[][]): TorvikRatingsMap {
  const map: TorvikRatingsMap = new Map();

  for (const row of rawData) {
    if (!Array.isArray(row) || row.length < 10) continue;

    try {
      const rating: TorvikTeamRating = {
        rank: Number(row[0]) || 0,
        teamName: String(row[1] ?? ''),
        conference: String(row[2] ?? ''),
        record: String(row[3] ?? ''),
        adjEfficiency: (Number(row[4]) || 0) - (Number(row[6]) || 0),
        adjOffense: Number(row[5]) || 0,
        adjOffenseRank: Number(row[6]) || 0,
        adjDefense: Number(row[7]) || 0,
        adjDefenseRank: Number(row[8]) || 0,
        barthag: Number(row[9]) || 0,
        adjTempo: Number(row[10]) || 0,
      };

      const normalizedName = normalizeTeamName(rating.teamName);
      if (normalizedName) {
        map.set(normalizedName, rating);
      }
    } catch {
      // Skip malformed rows
    }
  }

  return map;
}
