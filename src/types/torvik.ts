export interface TorvikTeamRating {
  rank: number;
  teamName: string;
  conference: string;
  record: string;
  adjEfficiency: number; // adjusted efficiency margin (key rating)
  adjOffense: number;
  adjOffenseRank: number;
  adjDefense: number;
  adjDefenseRank: number;
  barthag: number; // win probability vs average team
  adjTempo: number;
}

export type TorvikRatingsMap = Map<string, TorvikTeamRating>;
