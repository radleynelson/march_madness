import type { BracketState, Matchup, RegionName, Team } from '../types/bracket.ts';
import type { MatchupLine } from '../data/team-odds.ts';
import { TEAM_PROFILES } from '../data/team-profiles.ts';
import { TEAM_ODDS, MATCHUP_LINES } from '../data/team-odds.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function teamSummary(team: Team): string {
  const odds = TEAM_ODDS[team.name];
  const profile = TEAM_PROFILES[team.name];

  let out = `${team.name} (${team.seed}-seed, ${team.record}, ${team.region} region, rating ${team.rating.toFixed(1)})`;
  if (odds) {
    out += `\n  Championship odds: ${odds.championshipOdds} (implied ${pct(odds.impliedProb)})`;
  }
  if (profile) {
    out += `\n  Key players: ${profile.keyPlayers.join(', ')}`;
    out += `\n  Strengths: ${profile.strengths}`;
    out += `\n  Weaknesses: ${profile.weaknesses}`;
  }
  return out;
}

function lineSummary(line: MatchupLine): string {
  return (
    `Spread: ${line.favorite} ${line.spread}, O/U ${line.total}, ` +
    `ML ${line.favoriteML}/${line.underdogML > 0 ? '+' : ''}${line.underdogML}`
  );
}

function matchupOneLiner(m: Matchup): string {
  const top = m.topTeam ? `(${m.topTeam.seed}) ${m.topTeam.name}` : 'TBD';
  const bot = m.bottomTeam ? `(${m.bottomTeam.seed}) ${m.bottomTeam.name}` : 'TBD';
  let s = `${top} vs ${bot}`;
  if (m.topTeam && m.bottomTeam) {
    s += ` [${pct(m.topWinProbability)} / ${pct(m.bottomWinProbability)}]`;
  }
  if (m.status === 'final') {
    s += ` => FINAL ${m.topScore}-${m.bottomScore}, winner: ${m.winner === 'top' ? top : bot}`;
  } else if (m.status === 'in_progress') {
    s += ` => LIVE ${m.topScore}-${m.bottomScore} (${m.clock ?? ''} P${m.period ?? ''})`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// 1. buildMatchupContext
// ---------------------------------------------------------------------------

export function buildMatchupContext(matchup: Matchup, _state: BracketState): string {
  const parts: string[] = [];

  parts.push(`=== Matchup: ${matchup.round} (${matchup.region}) ===`);
  parts.push('');

  if (matchup.topTeam) {
    parts.push('TOP TEAM');
    parts.push(teamSummary(matchup.topTeam));
    parts.push('');
  }
  if (matchup.bottomTeam) {
    parts.push('BOTTOM TEAM');
    parts.push(teamSummary(matchup.bottomTeam));
    parts.push('');
  }

  // Win probabilities from model
  if (matchup.topTeam && matchup.bottomTeam) {
    parts.push(
      `Model win probabilities: ${matchup.topTeam.name} ${pct(matchup.topWinProbability)} | ${matchup.bottomTeam.name} ${pct(matchup.bottomWinProbability)}`,
    );
  }

  // Betting line
  const line = MATCHUP_LINES[matchup.id];
  if (line) {
    parts.push(`Betting line: ${lineSummary(line)}`);
  }

  // Live / final status
  if (matchup.status === 'final') {
    parts.push(
      `Result: FINAL ${matchup.topScore}-${matchup.bottomScore}, winner: ${matchup.winner === 'top' ? matchup.topTeam?.name : matchup.bottomTeam?.name}`,
    );
  } else if (matchup.status === 'in_progress') {
    parts.push(
      `Live: ${matchup.topScore}-${matchup.bottomScore} (${matchup.clock ?? ''} P${matchup.period ?? ''})`,
    );
    if (matchup.liveTopWinProbability != null && matchup.topTeam) {
      parts.push(
        `Live win prob: ${matchup.topTeam.name} ${pct(matchup.liveTopWinProbability)}`,
      );
    }
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// 2. buildFullBracketContext
// ---------------------------------------------------------------------------

export function buildFullBracketContext(state: BracketState): string {
  const parts: string[] = [];

  parts.push('=== 2026 NCAA Tournament Bracket ===');
  parts.push('');

  // Regions
  const regionNames: RegionName[] = ['East', 'West', 'South', 'Midwest'];
  for (const region of regionNames) {
    parts.push(`--- ${region.toUpperCase()} REGION ---`);

    const ids = state.regionMatchupIds[region] ?? [];
    // Group by round
    const byRound = new Map<number, Matchup[]>();
    for (const id of ids) {
      const m = state.matchups.get(id);
      if (!m) continue;
      const list = byRound.get(m.roundNumber) ?? [];
      list.push(m);
      byRound.set(m.roundNumber, list);
    }

    const sortedRounds = [...byRound.keys()].sort((a, b) => a - b);
    for (const rn of sortedRounds) {
      const matchups = byRound.get(rn)!;
      const roundLabel = matchups[0].round;
      parts.push(`  ${roundLabel}:`);
      for (const m of matchups.sort((a, b) => a.position - b.position)) {
        const picked = state.userPicks.has(m.id);
        let line = `    ${matchupOneLiner(m)}`;
        if (picked && m.winner) {
          const pickedTeam = m.winner === 'top' ? m.topTeam?.name : m.bottomTeam?.name;
          line += ` [USER PICK: ${pickedTeam ?? m.winner}]`;
        }
        parts.push(line);
      }
    }
    parts.push('');
  }

  // Final Four
  parts.push('--- FINAL FOUR ---');
  parts.push('Structure: East vs West, South vs Midwest');
  for (const id of state.finalFourMatchupIds) {
    const m = state.matchups.get(id);
    if (!m) continue;
    const picked = state.userPicks.has(m.id);
    let line = `  ${matchupOneLiner(m)}`;
    if (picked && m.winner) {
      const pickedTeam = m.winner === 'top' ? m.topTeam?.name : m.bottomTeam?.name;
      line += ` [USER PICK: ${pickedTeam ?? m.winner}]`;
    }
    parts.push(line);
  }
  parts.push('');

  // Championship
  const champM = state.matchups.get(state.championshipMatchupId);
  if (champM) {
    parts.push('--- CHAMPIONSHIP ---');
    const picked = state.userPicks.has(champM.id);
    let line = `  ${matchupOneLiner(champM)}`;
    if (picked && champM.winner) {
      const pickedTeam = champM.winner === 'top' ? champM.topTeam?.name : champM.bottomTeam?.name;
      line += ` [USER PICK: ${pickedTeam ?? champM.winner}]`;
    }
    parts.push(line);
    parts.push('');
  }

  // First Four (if any)
  if (state.firstFourMatchupIds.length > 0) {
    parts.push('--- FIRST FOUR ---');
    for (const id of state.firstFourMatchupIds) {
      const m = state.matchups.get(id);
      if (!m) continue;
      parts.push(`  ${matchupOneLiner(m)}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// 3. buildFillBracketSystemPrompt
// ---------------------------------------------------------------------------

export function buildFillBracketSystemPrompt(): string {
  return [
    'You are an expert NCAA March Madness bracket analyst.',
    'The user will provide the current state of the 2026 NCAA Tournament bracket including all matchups, team seeds, records, ratings, model win probabilities, championship odds, and any games already decided.',
    '',
    'Your task:',
    '1. Analyze every undecided matchup in the bracket.',
    '2. Consider team ratings, historical seed performance, matchup dynamics, model probabilities, betting lines, and current-season trajectory.',
    '3. You may use web search to find the latest news, injuries, suspensions, or other factors that could affect outcomes.',
    '4. Return your picks for EVERY undecided game, propagating winners through subsequent rounds up to and including the championship.',
    '',
    'Respond with ONLY valid JSON in this exact format (no markdown fences, no extra text):',
    '{',
    '  "picks": {',
    '    "<matchupId>": "top" | "bottom",',
    '    ... (one entry per undecided matchup)',
    '  },',
    '  "reasoning": "A brief overall summary of your bracket strategy and key picks."',
    '}',
    '',
    'Rules:',
    '- Every undecided matchup must have an entry in "picks".',
    '- Use "top" or "bottom" to indicate which team you pick to win.',
    '- For later-round matchups where teams are TBD, base your pick on who you chose in earlier rounds.',
    '- Do not include matchups that already have a final result.',
    '- Do not include any text outside the JSON object.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 4. buildMatchupChatSystemPrompt
// ---------------------------------------------------------------------------

export function buildMatchupChatSystemPrompt(): string {
  return [
    'You are a knowledgeable and insightful March Madness analyst helping a user understand a specific NCAA Tournament matchup.',
    'You will be provided with detailed information about both teams including seeds, records, ratings, key players, strengths, weaknesses, model win probabilities, championship odds, and betting lines.',
    '',
    'Guidelines:',
    '- Provide concise, insightful analysis. Avoid filler.',
    '- Highlight the most important factors that will decide the game (matchup advantages, tempo, key player battles, stylistic contrasts).',
    '- Reference specific players, stats, and tendencies from the provided data.',
    '- You may use web search to find the latest information such as injuries, lineup changes, recent form, or breaking news that could affect the matchup.',
    '- When the user asks for a pick, give a clear recommendation with reasoning.',
    '- Keep responses focused and conversational -- this is a chat, not an essay.',
  ].join('\n');
}
