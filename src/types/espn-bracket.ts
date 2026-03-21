// ─── ESPN Gambit API response types ──────────────────────

/** A single pick in an ESPN bracket entry */
export interface EspnPick {
  propositionId: string;
  outcomesPicked: {
    outcomeId: string;
    result: 'CORRECT' | 'INCORRECT' | 'UNDECIDED';
    pickOrder: number;
  }[];
  periodReached: number;
}

/** Score summary for an ESPN bracket entry */
export interface EspnEntryScore {
  overallScore: number;
  rank: number;
  percentile: number;
  record: {
    wins: number;
    losses: number;
  };
  scoreByPeriod: Record<string, {
    score: number;
    invalid: boolean;
  }>;
  possiblePointsRemaining: number;
  possiblePointsMax: number;
  pointsLost: number;
  eliminated: boolean;
}

/** Raw ESPN entry response */
export interface EspnEntryResponse {
  id: string;
  name: string;
  picks: EspnPick[];
  score: EspnEntryScore;
  challengeId: number;
}

/** A possible outcome in a challenge proposition */
export interface EspnOutcome {
  id: string;
  abbrev: string;
  name: string;
  description: string;
  regionId: number;
  regionSeed: number;
  mappings: { type: string; value: string }[];
}

/** A proposition (matchup) in the challenge */
export interface EspnProposition {
  id: string;
  name: string;
  scoringPeriodId: number;
  possibleOutcomes: EspnOutcome[];
  correctOutcomes: string[];
  status: string;
}

/** Raw ESPN challenge props response */
export interface EspnChallengeResponse {
  propositions: EspnProposition[];
  scoringPeriods: {
    id: number;
    label: string;
    abbrev: string;
  }[];
}

// ─── Normalized local state ─────────────────────────────

/** A resolved pick matched to our bracket */
export interface EspnBracketPick {
  /** Our bracket matchup ID (e.g., "E-R64-0") */
  matchupId: string;
  /** Which team they picked: 'top' or 'bottom' in our bracket */
  side: 'top' | 'bottom';
  /** Picked team abbreviation from ESPN */
  teamAbbrev: string;
  /** Picked team name from ESPN */
  teamName: string;
  /** Result of the pick */
  result: 'CORRECT' | 'INCORRECT' | 'UNDECIDED';
  /** Point value for this pick (based on round) */
  pointValue: number;
  /** The round this pick is for (scoringPeriodId) */
  round: number;
}

/** Full ESPN bracket state */
export interface EspnBracketData {
  entryId: string;
  entryName: string;
  picks: Map<string, EspnBracketPick>;
  score: EspnEntryScore;
}
