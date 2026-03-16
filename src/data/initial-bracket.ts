import type { Team, Matchup, RegionName, BracketState } from '../types/bracket';
import { getRatingForSeed } from './team-ratings';

// Team primary colors (ESPN style)
const TEAM_COLORS: Record<string, string> = {
  '150': '#003087',   // Duke - blue
  '2692': '#006747',  // Siena - green
  '194': '#BB0000',   // Ohio State - red
  '2628': '#4D1979',  // TCU - purple
  '2599': '#C8102E',  // St. John's - red
  '2460': '#4B116F',  // Northern Iowa - purple
  '2305': '#0051BA',  // Kansas - blue
  '2038': '#002554',  // Cal Baptist - navy
  '97': '#AD0000',    // Louisville - red
  '58': '#006747',    // South Florida - green
  '127': '#18453B',   // Michigan State - green
  '2449': '#009A44',  // North Dakota St - green
  '26': '#2774AE',    // UCLA - blue
  '2116': '#BA9B37',  // UCF - gold
  '41': '#0E1A3E',    // UConn - navy
  '231': '#582C83',   // Furman - purple
  '57': '#0021A5',    // Florida - blue
  '2504': '#4F2D7F',  // Prairie View - purple
  '228': '#653819',   // Lehigh - brown
  '2294c': '#F56600', // Clemson - orange
  '2294': '#FFCD00',  // Iowa - gold
  '238': '#866D4B',   // Vanderbilt - gold
  '2377': '#005CB9',  // McNeese - blue
  '158': '#E41C38',   // Nebraska - red
  '2713': '#8B2332',  // Troy - maroon
  '153': '#7BAFD4',   // North Carolina - carolina blue
  '2670': '#F8B800',  // VCU - gold
  '356': '#E84A27',   // Illinois - orange
  '219': '#011F5B',   // Penn - navy
  '2608': '#D41A2D',  // Saint Mary's - red
  '245': '#500000',   // Texas A&M - maroon
  '248': '#C8102E',   // Houston - red
  '70': '#B5A36A',    // Idaho - gold
  '12': '#CC0033',    // Arizona - red
  '112617': '#00529B',// LIU - blue
  '2907': '#00205B',  // Villanova - navy
  '328': '#00263A',   // Utah State - navy
  '275': '#C5050C',   // Wisconsin - red
  '2314': '#330072',  // High Point - purple
  '8': '#9D2235',     // Arkansas - red
  '62': '#024731',    // Hawaii - green
  '252': '#002E5D',   // BYU - navy
  '251': '#BF5700',   // Texas - burnt orange
  '152': '#CC0000',   // NC State - red
  '2250': '#002967',  // Gonzaga - navy
  '2320': '#FDBB30',  // Kennesaw St - gold
  '2390': '#F47321',  // Miami - orange
  '142': '#F1B82D',   // Missouri - gold
  '2509': '#CEB888',  // Purdue - old gold
  '2747': '#002D72',  // Queens - navy
  '130': '#00274C',   // Michigan - maize/navy
  '2750': '#000000',  // UMBC - black
  '47': '#003A63',    // Howard - blue
  '61': '#BA0C2F',    // Georgia - red
  '139': '#003DA5',   // Saint Louis - blue
  '2641': '#CC0000',  // Texas Tech - red
  '2084': '#041E42',  // Akron - navy
  '333': '#9E1B32',   // Alabama - crimson
  '2275': '#00447C',  // Hofstra - blue
  '2633': '#FF8200',  // Tennessee - orange
  '193': '#B61E2E',   // Miami (OH) - red
  '2567': '#354CA1',  // SMU - blue
  '258': '#232D4B',   // Virginia - navy
  '2790': '#007A33',  // Wright State - green
  '96': '#0033A0',    // Kentucky - blue
  '2541': '#862633',  // Santa Clara - maroon
  '66': '#C8102E',    // Iowa State - red
  '2634': '#00539F',  // Tennessee St - blue
};

// Helper to create a team with defaults
function team(
  id: string,
  shortName: string,
  abbreviation: string,
  seed: number,
  region: RegionName,
  record: string = '',
  fullName?: string,
): Team {
  return {
    id,
    name: fullName ?? shortName,
    shortName,
    abbreviation,
    seed,
    logoUrl: `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`,
    primaryColor: TEAM_COLORS[id] || '#333333',
    region,
    rating: getRatingForSeed(seed),
    record,
    probabilities: { round64: 0, round32: 0, sweet16: 0, elite8: 0, finalFour: 0, champion: 0 },
  };
}

// ============================================================================
// EAST REGION TEAMS
// ============================================================================
const eastTeams: Team[] = [
  team('150', 'Duke', 'DUKE', 1, 'East', '32-2', 'Duke Blue Devils'),
  team('2692', 'Siena', 'SIEN', 16, 'East', '', 'Siena Saints'),
  team('194', 'Ohio State', 'OSU', 8, 'East', '', 'Ohio State Buckeyes'),
  team('2628', 'TCU', 'TCU', 9, 'East', '', 'TCU Horned Frogs'),
  team('2599', "St. John's", 'SJU', 5, 'East', '28-6', "St. John's Red Storm"),
  team('2460', 'Northern Iowa', 'UNI', 12, 'East', '', 'Northern Iowa Panthers'),
  team('2305', 'Kansas', 'KU', 4, 'East', '23-10', 'Kansas Jayhawks'),
  team('2038', 'Cal Baptist', 'CBU', 13, 'East', '', 'Cal Baptist Lancers'),
  team('97', 'Louisville', 'LOU', 6, 'East', '', 'Louisville Cardinals'),
  team('58', 'South Florida', 'USF', 11, 'East', '', 'South Florida Bulls'),
  team('127', 'Michigan State', 'MSU', 3, 'East', '25-7', 'Michigan State Spartans'),
  team('2449', 'North Dakota St', 'NDSU', 14, 'East', '', 'North Dakota State Bison'),
  team('26', 'UCLA', 'UCLA', 7, 'East', '', 'UCLA Bruins'),
  team('2116', 'UCF', 'UCF', 10, 'East', '', 'UCF Knights'),
  team('41', 'UConn', 'CONN', 2, 'East', '29-5', 'UConn Huskies'),
  team('231', 'Furman', 'FUR', 15, 'East', '', 'Furman Paladins'),
];

// ============================================================================
// SOUTH REGION TEAMS
// ============================================================================
const southTeams: Team[] = [
  team('57', 'Florida', 'FLA', 1, 'South', '26-7', 'Florida Gators'),
  // 16 seed is First Four winner (Prairie View A&M / Lehigh) - placeholder
  team('2504', 'Prairie View', 'PVAM', 16, 'South', '', 'Prairie View A&M Panthers'),
  team('228', 'Lehigh', 'LEH', 16, 'South', '', 'Lehigh Mountain Hawks'),
  team('2294c', 'Clemson', 'CLEM', 8, 'South', '', 'Clemson Tigers'),
  team('2294', 'Iowa', 'IOWA', 9, 'South', '', 'Iowa Hawkeyes'),
  team('238', 'Vanderbilt', 'VAN', 5, 'South', '26-8', 'Vanderbilt Commodores'),
  team('2377', 'McNeese', 'MCNS', 12, 'South', '', 'McNeese Cowboys'),
  team('158', 'Nebraska', 'NEB', 4, 'South', '26-6', 'Nebraska Cornhuskers'),
  team('2713', 'Troy', 'TROY', 13, 'South', '', 'Troy Trojans'),
  team('153', 'North Carolina', 'UNC', 6, 'South', '', 'North Carolina Tar Heels'),
  team('2670', 'VCU', 'VCU', 11, 'South', '', 'VCU Rams'),
  team('356', 'Illinois', 'ILL', 3, 'South', '24-8', 'Illinois Fighting Illini'),
  team('219', 'Penn', 'PENN', 14, 'South', '', 'Penn Quakers'),
  team('2608', "Saint Mary's", 'SMC', 7, 'South', '', "Saint Mary's Gaels"),
  team('245', 'Texas A&M', 'TAMU', 10, 'South', '', 'Texas A&M Aggies'),
  team('248', 'Houston', 'HOU', 2, 'South', '28-6', 'Houston Cougars'),
  team('70', 'Idaho', 'IDHO', 15, 'South', '', 'Idaho Vandals'),
];

// ============================================================================
// WEST REGION TEAMS
// ============================================================================
const westTeams: Team[] = [
  team('12', 'Arizona', 'ARIZ', 1, 'West', '32-2', 'Arizona Wildcats'),
  team('112617', 'LIU', 'LIU', 16, 'West', '', 'LIU Sharks'),
  team('2907', 'Villanova', 'NOVA', 8, 'West', '', 'Villanova Wildcats'),
  team('328', 'Utah State', 'USU', 9, 'West', '', 'Utah State Aggies'),
  team('275', 'Wisconsin', 'WIS', 5, 'West', '', 'Wisconsin Badgers'),
  team('2314', 'High Point', 'HPU', 12, 'West', '', 'High Point Panthers'),
  team('8', 'Arkansas', 'ARK', 4, 'West', '26-8', 'Arkansas Razorbacks'),
  team('62', 'Hawaii', 'HAW', 13, 'West', '', 'Hawaii Rainbow Warriors'),
  team('252', 'BYU', 'BYU', 6, 'West', '', 'BYU Cougars'),
  // 11 seed is First Four winner (Texas / NC State) - placeholder
  team('251', 'Texas', 'TEX', 11, 'West', '', 'Texas Longhorns'),
  team('152', 'NC State', 'NCST', 11, 'West', '', 'NC State Wolfpack'),
  team('2250', 'Gonzaga', 'GONZ', 3, 'West', '30-3', 'Gonzaga Bulldogs'),
  team('2320', 'Kennesaw St', 'KENN', 14, 'West', '', 'Kennesaw State Owls'),
  team('2390', 'Miami', 'MIA', 7, 'West', '', 'Miami Hurricanes'),
  team('142', 'Missouri', 'MIZ', 10, 'West', '', 'Missouri Tigers'),
  team('2509', 'Purdue', 'PUR', 2, 'West', '27-8', 'Purdue Boilermakers'),
  team('2747', 'Queens', 'QUEE', 15, 'West', '', 'Queens Royals'),
];

// ============================================================================
// MIDWEST REGION TEAMS
// ============================================================================
const midwestTeams: Team[] = [
  team('130', 'Michigan', 'MICH', 1, 'Midwest', '31-3', 'Michigan Wolverines'),
  // 16 seed is First Four winner (UMBC / Howard) - placeholder
  team('2750', 'UMBC', 'UMBC', 16, 'Midwest', '', 'UMBC Retrievers'),
  team('47', 'Howard', 'HOW', 16, 'Midwest', '', 'Howard Bison'),
  team('61', 'Georgia', 'UGA', 8, 'Midwest', '', 'Georgia Bulldogs'),
  team('139', 'Saint Louis', 'SLU', 9, 'Midwest', '', 'Saint Louis Billikens'),
  team('2641', 'Texas Tech', 'TTU', 5, 'Midwest', '22-10', 'Texas Tech Red Raiders'),
  team('2084', 'Akron', 'AKR', 12, 'Midwest', '', 'Akron Zips'),
  team('333', 'Alabama', 'ALA', 4, 'Midwest', '23-9', 'Alabama Crimson Tide'),
  team('2275', 'Hofstra', 'HOF', 13, 'Midwest', '', 'Hofstra Pride'),
  team('2633', 'Tennessee', 'TENN', 6, 'Midwest', '', 'Tennessee Volunteers'),
  // 11 seed is First Four winner (Miami OH / SMU) - placeholder
  team('193', 'Miami (OH)', 'MIOH', 11, 'Midwest', '31-1', 'Miami (OH) RedHawks'),
  team('2567', 'SMU', 'SMU', 11, 'Midwest', '', 'SMU Mustangs'),
  team('258', 'Virginia', 'UVA', 3, 'Midwest', '29-5', 'Virginia Cavaliers'),
  team('2790', 'Wright State', 'WRST', 14, 'Midwest', '', 'Wright State Raiders'),
  team('96', 'Kentucky', 'UK', 7, 'Midwest', '', 'Kentucky Wildcats'),
  team('2541', 'Santa Clara', 'SCU', 10, 'Midwest', '', 'Santa Clara Broncos'),
  team('66', 'Iowa State', 'ISU', 2, 'Midwest', '27-7', 'Iowa State Cyclones'),
  team('2634', 'Tennessee St', 'TNST', 15, 'Midwest', '', 'Tennessee State Tigers'),
];

// ============================================================================
// MATCHUP HELPERS
// ============================================================================
function matchup(
  id: string,
  region: RegionName | 'Final Four',
  round: Matchup['round'],
  roundNumber: number,
  position: number,
  topTeam: Team | null,
  bottomTeam: Team | null,
  nextMatchupId: string | null,
  topSourceMatchupId: string | null = null,
  bottomSourceMatchupId: string | null = null,
): Matchup {
  return {
    id,
    espnEventId: null,
    region,
    round,
    roundNumber,
    position,
    topTeam,
    bottomTeam,
    topWinProbability: 0.5,
    bottomWinProbability: 0.5,
    status: 'scheduled',
    topScore: null,
    bottomScore: null,
    clock: null,
    period: null,
    liveTopWinProbability: null,
    nextMatchupId,
    topSourceMatchupId,
    bottomSourceMatchupId,
    winner: null,
  };
}

// Helper to find a team by shortName from a team list
function findTeam(teams: Team[], shortName: string): Team | null {
  return teams.find(t => t.shortName === shortName) ?? null;
}

// ============================================================================
// BUILD REGION MATCHUPS
// ============================================================================
function buildRegionMatchups(
  regionCode: string,
  region: RegionName,
  teams: Team[],
  seeds: [string, string][], // 8 pairs of [topShortName, bottomShortName] in bracket order
  firstFourSlots: { position: number; slot: 'top' | 'bottom'; matchupId: string }[] = [],
): Matchup[] {
  const t = (name: string) => findTeam(teams, name);
  const matchups: Matchup[] = [];

  // Round of 64 (8 matchups)
  for (let i = 0; i < 8; i++) {
    const r32Pos = Math.floor(i / 2);
    const nextId = `${regionCode}-R32-${r32Pos}`;

    let topTeam = t(seeds[i][0]);
    let bottomTeam = t(seeds[i][1]);

    // Check if this slot is fed by a First Four game
    const ffSlot = firstFourSlots.find(ff => ff.position === i);
    if (ffSlot) {
      if (ffSlot.slot === 'top') topTeam = null;
      else bottomTeam = null;
    }

    const m = matchup(
      `${regionCode}-R64-${i}`,
      region,
      'Round of 64',
      1,
      i,
      topTeam,
      bottomTeam,
      nextId,
    );

    // Link First Four source
    if (ffSlot) {
      if (ffSlot.slot === 'top') m.topSourceMatchupId = ffSlot.matchupId;
      else m.bottomSourceMatchupId = ffSlot.matchupId;
    }

    matchups.push(m);
  }

  // Round of 32 (4 matchups)
  for (let i = 0; i < 4; i++) {
    const s16Pos = Math.floor(i / 2);
    matchups.push(matchup(
      `${regionCode}-R32-${i}`,
      region,
      'Round of 32',
      2,
      i,
      null,
      null,
      `${regionCode}-S16-${s16Pos}`,
      `${regionCode}-R64-${i * 2}`,
      `${regionCode}-R64-${i * 2 + 1}`,
    ));
  }

  // Sweet 16 (2 matchups)
  for (let i = 0; i < 2; i++) {
    matchups.push(matchup(
      `${regionCode}-S16-${i}`,
      region,
      'Sweet 16',
      3,
      i,
      null,
      null,
      `${regionCode}-E8-0`,
      `${regionCode}-R32-${i * 2}`,
      `${regionCode}-R32-${i * 2 + 1}`,
    ));
  }

  // Elite 8 (1 matchup)
  const ffMapping: Record<string, string> = {
    'E': 'FF-0',
    'S': 'FF-0',
    'W': 'FF-1',
    'MW': 'FF-1',
  };
  matchups.push(matchup(
    `${regionCode}-E8-0`,
    region,
    'Elite 8',
    4,
    0,
    null,
    null,
    ffMapping[regionCode],
    `${regionCode}-S16-0`,
    `${regionCode}-S16-1`,
  ));

  return matchups;
}

// ============================================================================
// BUILD COMPLETE BRACKET
// ============================================================================
export function createInitialBracket(): BracketState {
  const allTeams: Team[] = [
    ...eastTeams, ...southTeams, ...westTeams, ...midwestTeams,
  ];

  // First Four matchups
  const firstFourMatchups: Matchup[] = [
    matchup('FF-PLAY-0', 'Midwest', 'First Four', 0, 0,
      findTeam(midwestTeams, 'UMBC'), findTeam(midwestTeams, 'Howard'),
      'MW-R64-0'), // winner goes to Midwest 1 vs 16 slot
    matchup('FF-PLAY-1', 'South', 'First Four', 0, 1,
      findTeam(southTeams, 'Prairie View'), findTeam(southTeams, 'Lehigh'),
      'S-R64-0'), // winner goes to South 1 vs 16 slot
    matchup('FF-PLAY-2', 'West', 'First Four', 0, 2,
      findTeam(westTeams, 'Texas'), findTeam(westTeams, 'NC State'),
      'W-R64-4'), // winner goes to West 6 vs 11 slot
    matchup('FF-PLAY-3', 'Midwest', 'First Four', 0, 3,
      findTeam(midwestTeams, 'Miami (OH)'), findTeam(midwestTeams, 'SMU'),
      'MW-R64-4'), // winner goes to Midwest 6 vs 11 slot
  ];

  // East Region matchups (bracket order: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15)
  const eastMatchups = buildRegionMatchups('E', 'East', eastTeams, [
    ['Duke', 'Siena'],
    ['Ohio State', 'TCU'],
    ["St. John's", 'Northern Iowa'],
    ['Kansas', 'Cal Baptist'],
    ['Louisville', 'South Florida'],
    ['Michigan State', 'North Dakota St'],
    ['UCLA', 'UCF'],
    ['UConn', 'Furman'],
  ]);

  // South Region matchups
  const southMatchups = buildRegionMatchups('S', 'South', southTeams, [
    ['Florida', 'Prairie View'],  // 16 is TBD (First Four)
    ['Clemson', 'Iowa'],
    ['Vanderbilt', 'McNeese'],
    ['Nebraska', 'Troy'],
    ['North Carolina', 'VCU'],
    ['Illinois', 'Penn'],
    ["Saint Mary's", 'Texas A&M'],
    ['Houston', 'Idaho'],
  ], [
    { position: 0, slot: 'bottom', matchupId: 'FF-PLAY-1' },
  ]);

  // West Region matchups
  const westMatchups = buildRegionMatchups('W', 'West', westTeams, [
    ['Arizona', 'LIU'],
    ['Villanova', 'Utah State'],
    ['Wisconsin', 'High Point'],
    ['Arkansas', 'Hawaii'],
    ['BYU', 'Texas'],  // 11 is TBD (First Four)
    ['Gonzaga', 'Kennesaw St'],
    ['Miami', 'Missouri'],
    ['Purdue', 'Queens'],
  ], [
    { position: 4, slot: 'bottom', matchupId: 'FF-PLAY-2' },
  ]);

  // Midwest Region matchups
  const midwestMatchups = buildRegionMatchups('MW', 'Midwest', midwestTeams, [
    ['Michigan', 'UMBC'],  // 16 is TBD (First Four)
    ['Georgia', 'Saint Louis'],
    ['Texas Tech', 'Akron'],
    ['Alabama', 'Hofstra'],
    ['Tennessee', 'Miami (OH)'],  // 11 is TBD (First Four)
    ['Virginia', 'Wright State'],
    ['Kentucky', 'Santa Clara'],
    ['Iowa State', 'Tennessee St'],
  ], [
    { position: 0, slot: 'bottom', matchupId: 'FF-PLAY-0' },
    { position: 4, slot: 'bottom', matchupId: 'FF-PLAY-3' },
  ]);

  // Final Four matchups
  // East winner vs South winner (Semi 1)
  // West winner vs Midwest winner (Semi 2)
  const finalFourMatchups: Matchup[] = [
    matchup('FF-0', 'Final Four', 'Final Four', 5, 0, null, null, 'CHAMP', 'E-E8-0', 'S-E8-0'),
    matchup('FF-1', 'Final Four', 'Final Four', 5, 1, null, null, 'CHAMP', 'W-E8-0', 'MW-E8-0'),
  ];

  // Championship
  const championshipMatchup = matchup(
    'CHAMP', 'Final Four', 'Championship', 6, 0, null, null, null, 'FF-0', 'FF-1',
  );

  // Combine all matchups
  const allMatchups: Matchup[] = [
    ...firstFourMatchups,
    ...eastMatchups,
    ...southMatchups,
    ...westMatchups,
    ...midwestMatchups,
    ...finalFourMatchups,
    championshipMatchup,
  ];

  // Build maps
  const teamsMap = new Map<string, Team>();
  allTeams.forEach(t => teamsMap.set(t.id, t));

  const matchupsMap = new Map<string, Matchup>();
  allMatchups.forEach(m => matchupsMap.set(m.id, m));

  // Build region -> matchup ID lookups (only region-round matchups, not First Four or Final Four)
  const regionMatchupIds: Record<RegionName, string[]> = {
    East: eastMatchups.map(m => m.id),
    South: southMatchups.map(m => m.id),
    West: westMatchups.map(m => m.id),
    Midwest: midwestMatchups.map(m => m.id),
  };

  return {
    teams: teamsMap,
    matchups: matchupsMap,
    regionMatchupIds,
    finalFourMatchupIds: finalFourMatchups.map(m => m.id),
    championshipMatchupId: 'CHAMP',
    firstFourMatchupIds: firstFourMatchups.map(m => m.id),
    lastUpdated: new Date(),
    isLive: false,
  };
}
