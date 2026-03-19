export interface EspnScoreboardResponse {
  leagues: EspnLeague[];
  events: EspnEvent[];
}

export interface EspnLeague {
  id: string;
  name: string;
  abbreviation: string;
}

export interface EspnEvent {
  id: string;
  date: string;
  name: string;
  shortName: string;
  status: EspnStatus;
  competitions: EspnCompetition[];
}

export interface EspnStatus {
  clock: number;
  displayClock: string;
  period: number;
  type: {
    id: string;
    name: string;
    state: 'pre' | 'in' | 'post';
    completed: boolean;
    description: string;
  };
}

export interface EspnCompetition {
  id: string;
  competitors: EspnCompetitor[];
  venue?: {
    fullName: string;
    city: string;
    state: string;
  };
  notes: { headline: string }[];
  odds?: {
    provider: { name: string };
    details: string;
    overUnder: number;
  }[];
  broadcasts?: { names: string[] }[];
}

export interface EspnCompetitor {
  id: string;
  homeAway: 'home' | 'away';
  winner: boolean;
  team: {
    id: string;
    location: string;
    name: string;
    abbreviation: string;
    displayName: string;
    shortDisplayName: string;
    logo: string;
    color?: string;
    alternateColor?: string;
  };
  score: string;
  curatedRank?: {
    current: number;
  };
  records?: { summary: string }[];
}

export interface EspnGameSummary {
  winprobability?: {
    homeWinPercentage: number;
    playId: string;
  }[];
  boxscore?: unknown;
  plays?: unknown[];
}
