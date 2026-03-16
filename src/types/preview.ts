export interface TeamProfile {
  shortName: string;
  keyPlayers: string[];
  strengths: string;
  weaknesses: string;
  preview: string;
}

export interface TeamOdds {
  championshipOdds: string;   // e.g. "+800"
  impliedProb: number;        // e.g. 0.111
}
