export type RegionName = 'East' | 'West' | 'South' | 'Midwest';

export type RoundName =
  | 'First Four'
  | 'Round of 64'
  | 'Round of 32'
  | 'Sweet 16'
  | 'Elite 8'
  | 'Final Four'
  | 'Championship';

export const ROUND_NUMBERS: Record<RoundName, number> = {
  'First Four': 0,
  'Round of 64': 1,
  'Round of 32': 2,
  'Sweet 16': 3,
  'Elite 8': 4,
  'Final Four': 5,
  'Championship': 6,
};

export const ROUND_LABELS: RoundName[] = [
  'First Four',
  'Round of 64',
  'Round of 32',
  'Sweet 16',
  'Elite 8',
  'Final Four',
  'Championship',
];

export type GameStatus = 'scheduled' | 'in_progress' | 'final' | 'delayed' | 'postponed';

export interface TeamProbabilities {
  round64: number;
  round32: number;
  sweet16: number;
  elite8: number;
  finalFour: number;
  champion: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  seed: number;
  logoUrl: string;
  primaryColor: string;
  region: RegionName;
  rating: number; // Torvik AdjEM or fallback
  record: string;
  probabilities: TeamProbabilities;
}

export interface Matchup {
  id: string;
  espnEventId: string | null;
  region: RegionName | 'Final Four';
  round: RoundName;
  roundNumber: number;
  position: number; // position within round (0-indexed)

  topTeam: Team | null;
  bottomTeam: Team | null;

  // Pre-game prediction
  topWinProbability: number;
  bottomWinProbability: number;

  // Live/final game data
  status: GameStatus;
  topScore: number | null;
  bottomScore: number | null;
  clock: string | null;
  period: number | null;
  liveTopWinProbability: number | null;

  // Bracket tree links
  nextMatchupId: string | null;
  topSourceMatchupId: string | null;
  bottomSourceMatchupId: string | null;

  winner: 'top' | 'bottom' | null;
}

export type BracketAction =
  | { type: 'INITIALIZE_BRACKET'; matchups: Matchup[]; teams: Team[] }
  | { type: 'SET_RATINGS'; ratings: Map<string, number> }
  | { type: 'UPDATE_SCORES'; updates: ScoreUpdate[] }
  | { type: 'ADVANCE_WINNER'; matchupId: string; winner: 'top' | 'bottom' }
  | { type: 'USER_ADVANCE'; matchupId: string; winner: 'top' | 'bottom' }
  | { type: 'APPLY_SIMULATION'; picks: Record<string, 'top' | 'bottom'> }
  | { type: 'CLEAR_USER_PICKS' }
  | { type: 'RECALCULATE_PREDICTIONS' };

export interface ScoreUpdate {
  espnEventId: string;
  matchupId?: string;
  status: GameStatus;
  topScore: number | null;
  bottomScore: number | null;
  clock: string | null;
  period: number | null;
  liveTopWinProbability: number | null;
  winner: 'top' | 'bottom' | null;
}

export interface BracketState {
  teams: Map<string, Team>;
  matchups: Map<string, Matchup>;
  regionMatchupIds: Record<RegionName, string[]>;
  finalFourMatchupIds: string[];
  championshipMatchupId: string;
  firstFourMatchupIds: string[];
  lastUpdated: Date;
  isLive: boolean;
  /** Matchup IDs where the user manually picked a winner (not from live results) */
  userPicks: Set<string>;
  /** Cached ratings to re-apply after reset */
  cachedRatings: Map<string, number> | null;
  /** Cached live score updates to replay after reset */
  cachedScoreUpdates: ScoreUpdate[];
}
