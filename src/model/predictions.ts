import type { Matchup, BracketState, Team } from '../types/bracket';

/**
 * Win probability using Elo-derived logistic function.
 * P(A beats B) = 1 / (1 + 10^(-(ratingA - ratingB) * 30.464 / 400))
 *
 * Each 1 point of AdjEM advantage ≈ 2.7% more win probability near 50/50.
 */
export function winProbability(ratingA: number, ratingB: number): number {
  const exponent = -(ratingA - ratingB) * 30.464 / 400;
  return 1 / (1 + Math.pow(10, exponent));
}

/**
 * Calculate win probabilities for a specific matchup.
 */
export function calculateMatchupProbabilities(matchup: Matchup): {
  topWinProbability: number;
  bottomWinProbability: number;
} {
  if (!matchup.topTeam || !matchup.bottomTeam) {
    return { topWinProbability: 0.5, bottomWinProbability: 0.5 };
  }

  const topWin = winProbability(matchup.topTeam.rating, matchup.bottomTeam.rating);
  return {
    topWinProbability: topWin,
    bottomWinProbability: 1 - topWin,
  };
}

/**
 * Calculate round-by-round advancement probabilities for ALL teams in the bracket.
 * Uses conditional probability (not Monte Carlo).
 *
 * For each team, compute the probability of advancing through each round by
 * considering all possible opponents:
 *
 * P(Team A reaches Round N+1) =
 *   SUM over all possible opponents B in Round N:
 *     P(A reaches Round N) * P(B reaches Round N) * P(A beats B)
 */
export function calculateAllProbabilities(state: BracketState): BracketState {
  const newState = { ...state, matchups: new Map(state.matchups), teams: new Map(state.teams) };

  // First, update all matchup probabilities for games with known teams
  for (const [id, m] of newState.matchups) {
    if (m.topTeam && m.bottomTeam && m.status === 'scheduled') {
      const probs = calculateMatchupProbabilities(m);
      newState.matchups.set(id, { ...m, ...probs });
    }
  }

  // For each region, calculate advancement probabilities through the bracket tree
  const regions: ('East' | 'South' | 'West' | 'Midwest')[] = ['East', 'South', 'West', 'Midwest'];

  for (const region of regions) {
    calculateRegionProbabilities(newState, region);
  }

  // Calculate Final Four and Championship probabilities
  calculateFinalFourProbabilities(newState);

  // Sync updated team probabilities back into matchup team references
  for (const [id, m] of newState.matchups) {
    let changed = false;
    let newTop = m.topTeam;
    let newBottom = m.bottomTeam;

    if (m.topTeam) {
      const updated = newState.teams.get(m.topTeam.id);
      if (updated && updated !== m.topTeam) {
        newTop = updated;
        changed = true;
      }
    }
    if (m.bottomTeam) {
      const updated = newState.teams.get(m.bottomTeam.id);
      if (updated && updated !== m.bottomTeam) {
        newBottom = updated;
        changed = true;
      }
    }
    if (changed) {
      newState.matchups.set(id, { ...m, topTeam: newTop, bottomTeam: newBottom });
    }
  }

  return newState;
}

/**
 * Calculate advancement probabilities for a single region (R64 through E8).
 */
function calculateRegionProbabilities(state: BracketState, region: string): void {
  const regionCode = { East: 'E', South: 'S', West: 'W', Midwest: 'MW' }[region] ?? region;

  // Get all R64 teams with their initial probability of being in R64 (1.0 for known teams)
  // Structure: position in R64 -> { team, probability of being here }
  type TeamProb = { team: Team; prob: number };
  const r64Slots: (TeamProb | null)[] = [];

  for (let i = 0; i < 8; i++) {
    const m = state.matchups.get(`${regionCode}-R64-${i}`);
    if (!m) {
      r64Slots.push(null, null);
      continue;
    }
    r64Slots.push(
      m.topTeam ? { team: m.topTeam, prob: 1.0 } : null,
      m.bottomTeam ? { team: m.bottomTeam, prob: 1.0 } : null,
    );
  }

  // If a game is already final, the winner has prob 1.0 and loser has prob 0.0
  // Then propagate through R32, S16, E8

  // R64 winners feed into R32
  // R64-0 winner and R64-1 winner -> R32-0
  // R64-2 winner and R64-3 winner -> R32-1
  // etc.

  // For each R64 matchup, determine the probability each team advances
  const r64Winners: Map<string, { team: Team; prob: number }[]> = new Map();

  for (let i = 0; i < 8; i++) {
    const m = state.matchups.get(`${regionCode}-R64-${i}`);
    if (!m) continue;

    const winners: { team: Team; prob: number }[] = [];

    if (m.winner === 'top' && m.topTeam) {
      winners.push({ team: m.topTeam, prob: 1.0 });
      updateTeamProb(state, m.topTeam.id, 'round64', 1.0);
      if (m.bottomTeam) updateTeamProb(state, m.bottomTeam.id, 'round64', 0.0);
    } else if (m.winner === 'bottom' && m.bottomTeam) {
      winners.push({ team: m.bottomTeam, prob: 1.0 });
      updateTeamProb(state, m.bottomTeam.id, 'round64', 1.0);
      if (m.topTeam) updateTeamProb(state, m.topTeam.id, 'round64', 0.0);
    } else if (m.topTeam && m.bottomTeam) {
      const topWin = winProbability(m.topTeam.rating, m.bottomTeam.rating);
      winners.push(
        { team: m.topTeam, prob: topWin },
        { team: m.bottomTeam, prob: 1 - topWin },
      );
      updateTeamProb(state, m.topTeam.id, 'round64', topWin);
      updateTeamProb(state, m.bottomTeam.id, 'round64', 1 - topWin);
    } else if (m.topTeam) {
      // Only one team known (e.g. First Four not yet played)
      winners.push({ team: m.topTeam, prob: 1.0 });
      updateTeamProb(state, m.topTeam.id, 'round64', 1.0);
    }

    r64Winners.set(`${regionCode}-R64-${i}`, winners);
  }

  // R32: combine R64 winners
  const r32Winners: Map<string, { team: Team; prob: number }[]> = new Map();

  for (let i = 0; i < 4; i++) {
    const m = state.matchups.get(`${regionCode}-R32-${i}`);
    if (!m) continue;

    // Check if game already has a winner
    if (m.winner && (m.winner === 'top' ? m.topTeam : m.bottomTeam)) {
      const winnerTeam = m.winner === 'top' ? m.topTeam! : m.bottomTeam!;
      r32Winners.set(`${regionCode}-R32-${i}`, [{ team: winnerTeam, prob: 1.0 }]);
      updateTeamProb(state, winnerTeam.id, 'round32', 1.0);
      continue;
    }

    const topCandidates = r64Winners.get(`${regionCode}-R64-${i * 2}`) ?? [];
    const bottomCandidates = r64Winners.get(`${regionCode}-R64-${i * 2 + 1}`) ?? [];
    const winners: { team: Team; prob: number }[] = [];

    for (const tc of topCandidates) {
      let totalProb = 0;
      for (const bc of bottomCandidates) {
        totalProb += bc.prob * winProbability(tc.team.rating, bc.team.rating);
      }
      // If no bottom candidates, team advances by default
      if (bottomCandidates.length === 0) totalProb = 1.0;
      const advProb = tc.prob * totalProb;
      winners.push({ team: tc.team, prob: advProb });
      updateTeamProb(state, tc.team.id, 'round32', advProb);
    }

    for (const bc of bottomCandidates) {
      let totalProb = 0;
      for (const tc of topCandidates) {
        totalProb += tc.prob * winProbability(bc.team.rating, tc.team.rating);
      }
      if (topCandidates.length === 0) totalProb = 1.0;
      const advProb = bc.prob * totalProb;
      winners.push({ team: bc.team, prob: advProb });
      updateTeamProb(state, bc.team.id, 'round32', advProb);
    }

    r32Winners.set(`${regionCode}-R32-${i}`, winners);
  }

  // Sweet 16: combine R32 winners
  const s16Winners: Map<string, { team: Team; prob: number }[]> = new Map();

  for (let i = 0; i < 2; i++) {
    const m = state.matchups.get(`${regionCode}-S16-${i}`);
    if (!m) continue;

    if (m.winner && (m.winner === 'top' ? m.topTeam : m.bottomTeam)) {
      const winnerTeam = m.winner === 'top' ? m.topTeam! : m.bottomTeam!;
      s16Winners.set(`${regionCode}-S16-${i}`, [{ team: winnerTeam, prob: 1.0 }]);
      updateTeamProb(state, winnerTeam.id, 'sweet16', 1.0);
      continue;
    }

    const topCandidates = r32Winners.get(`${regionCode}-R32-${i * 2}`) ?? [];
    const bottomCandidates = r32Winners.get(`${regionCode}-R32-${i * 2 + 1}`) ?? [];
    const winners = computeRoundWinners(state, topCandidates, bottomCandidates, 'sweet16');
    s16Winners.set(`${regionCode}-S16-${i}`, winners);
  }

  // Elite 8
  const m = state.matchups.get(`${regionCode}-E8-0`);
  if (m) {
    if (m.winner && (m.winner === 'top' ? m.topTeam : m.bottomTeam)) {
      const winnerTeam = m.winner === 'top' ? m.topTeam! : m.bottomTeam!;
      updateTeamProb(state, winnerTeam.id, 'elite8', 1.0);
      // Store for Final Four calculation
      (state as any)[`${regionCode}_e8_winners`] = [{ team: winnerTeam, prob: 1.0 }];
    } else {
      const topCandidates = s16Winners.get(`${regionCode}-S16-0`) ?? [];
      const bottomCandidates = s16Winners.get(`${regionCode}-S16-1`) ?? [];
      const winners = computeRoundWinners(state, topCandidates, bottomCandidates, 'elite8');
      (state as any)[`${regionCode}_e8_winners`] = winners;
    }
  }
}

/**
 * Calculate Final Four and Championship probabilities.
 */
function calculateFinalFourProbabilities(state: BracketState): void {
  // FF-0: East winner vs South winner
  const eastWinners: { team: Team; prob: number }[] = (state as any)['E_e8_winners'] ?? [];
  const southWinners: { team: Team; prob: number }[] = (state as any)['S_e8_winners'] ?? [];
  const ff0 = state.matchups.get('FF-0');

  let ff0Winners: { team: Team; prob: number }[] = [];
  if (ff0?.winner && (ff0.winner === 'top' ? ff0.topTeam : ff0.bottomTeam)) {
    const winnerTeam = ff0.winner === 'top' ? ff0.topTeam! : ff0.bottomTeam!;
    ff0Winners = [{ team: winnerTeam, prob: 1.0 }];
    updateTeamProb(state, winnerTeam.id, 'finalFour', 1.0);
  } else {
    ff0Winners = computeRoundWinners(state, eastWinners, southWinners, 'finalFour');
  }

  // FF-1: West winner vs Midwest winner
  const westWinners: { team: Team; prob: number }[] = (state as any)['W_e8_winners'] ?? [];
  const midwestWinners: { team: Team; prob: number }[] = (state as any)['MW_e8_winners'] ?? [];
  const ff1 = state.matchups.get('FF-1');

  let ff1Winners: { team: Team; prob: number }[] = [];
  if (ff1?.winner && (ff1.winner === 'top' ? ff1.topTeam : ff1.bottomTeam)) {
    const winnerTeam = ff1.winner === 'top' ? ff1.topTeam! : ff1.bottomTeam!;
    ff1Winners = [{ team: winnerTeam, prob: 1.0 }];
    updateTeamProb(state, winnerTeam.id, 'finalFour', 1.0);
  } else {
    ff1Winners = computeRoundWinners(state, westWinners, midwestWinners, 'finalFour');
  }

  // Championship
  const champ = state.matchups.get('CHAMP');
  if (champ?.winner && (champ.winner === 'top' ? champ.topTeam : champ.bottomTeam)) {
    const winnerTeam = champ.winner === 'top' ? champ.topTeam! : champ.bottomTeam!;
    updateTeamProb(state, winnerTeam.id, 'champion', 1.0);
  } else {
    computeRoundWinners(state, ff0Winners, ff1Winners, 'champion');
  }

  // Clean up temp properties
  delete (state as any)['E_e8_winners'];
  delete (state as any)['S_e8_winners'];
  delete (state as any)['W_e8_winners'];
  delete (state as any)['MW_e8_winners'];
}

/**
 * Compute winners for a round given two sets of candidates.
 */
function computeRoundWinners(
  state: BracketState,
  topCandidates: { team: Team; prob: number }[],
  bottomCandidates: { team: Team; prob: number }[],
  roundKey: keyof Team['probabilities'],
): { team: Team; prob: number }[] {
  const winners: { team: Team; prob: number }[] = [];

  for (const tc of topCandidates) {
    let totalProb = 0;
    for (const bc of bottomCandidates) {
      totalProb += bc.prob * winProbability(tc.team.rating, bc.team.rating);
    }
    if (bottomCandidates.length === 0) totalProb = 1.0;
    const advProb = tc.prob * totalProb;
    winners.push({ team: tc.team, prob: advProb });
    updateTeamProb(state, tc.team.id, roundKey, advProb);
  }

  for (const bc of bottomCandidates) {
    let totalProb = 0;
    for (const tc of topCandidates) {
      totalProb += tc.prob * winProbability(bc.team.rating, tc.team.rating);
    }
    if (topCandidates.length === 0) totalProb = 1.0;
    const advProb = bc.prob * totalProb;
    winners.push({ team: bc.team, prob: advProb });
    updateTeamProb(state, bc.team.id, roundKey, advProb);
  }

  return winners;
}

/**
 * Update a team's probability for a given round.
 */
function updateTeamProb(
  state: BracketState,
  teamId: string,
  roundKey: keyof Team['probabilities'],
  prob: number,
): void {
  const team = state.teams.get(teamId);
  if (!team) return;
  const updatedTeam = {
    ...team,
    probabilities: { ...team.probabilities, [roundKey]: prob },
  };
  state.teams.set(teamId, updatedTeam);
}
