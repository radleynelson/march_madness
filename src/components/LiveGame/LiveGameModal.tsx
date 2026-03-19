import { useState, useEffect, useCallback, useRef } from 'react';
import type { Matchup } from '../../types/bracket';
import { useLiveGame } from '../../hooks/useLiveGame';
import type {
  EspnGameSummaryResponse,
  EspnSummaryCompetitor,
  EspnPlay,
  EspnLeaderGroup,
} from '../../api/espn';
import styles from './LiveGameModal.module.css';

type Tab = 'gamecast' | 'boxscore' | 'plays';

interface LiveGameModalProps {
  matchup: Matchup;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────

function ensureHash(color: string): string {
  if (!color) return '#333';
  return color.startsWith('#') ? color : `#${color}`;
}


function formatPeriodShort(period: number): string {
  if (!period || isNaN(period)) return '';
  if (period === 1) return '1st';
  if (period === 2) return '2nd';
  const otNum = period - 2;
  return `OT${otNum > 1 ? otNum : ''}`;
}

/** Format camelCase play type into readable text */
function formatPlayType(text: string): string {
  return text.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** Find which ESPN competitor corresponds to our bracket's top/bottom team */
function mapCompetitors(
  competitors: EspnSummaryCompetitor[],
  matchup: Matchup,
): { awayComp: EspnSummaryCompetitor; homeComp: EspnSummaryCompetitor; topIsHome: boolean } | null {
  if (competitors.length < 2) return null;
  const home = competitors.find(c => c.homeAway === 'home');
  const away = competitors.find(c => c.homeAway === 'away');
  if (!home || !away) return null;
  const topIsHome = home.team.id === matchup.topTeam?.id;
  return { homeComp: home, awayComp: away, topIsHome };
}

// ─── Scoreboard Header ───────────────────────────────────

function ScoreboardHeader({
  summary,
  matchup,
  onClose,
}: {
  summary: EspnGameSummaryResponse;
  matchup: Matchup;
  onClose: () => void;
}) {
  const comp = summary.header.competitions[0];
  if (!comp) return null;

  const mapping = mapCompetitors(comp.competitors, matchup);
  if (!mapping) return null;
  const { awayComp, homeComp } = mapping;
  const status = comp.status;
  const isLive = status.type.state === 'in';
  const broadcast = comp.broadcasts?.[0]?.media?.shortName;
  const numPeriods = Math.max(
    homeComp.linescores?.length ?? 0,
    awayComp.linescores?.length ?? 0,
    summary.format?.regulation?.periods ?? 2,
  );

  return (
    <div className={styles.scoreboard}>
      <div className={styles.scoreboardTop}>
        <span className={styles.gameNote}>{summary.header.gameNote}</span>
        <div className={styles.scoreboardRight}>
          {broadcast && <span className={styles.broadcast}>{broadcast}</span>}
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">&times;</button>
        </div>
      </div>

      <div className={styles.scoreboardMain}>
        {/* Away team */}
        <div className={styles.scoreTeam}>
          <img
            className={styles.scoreLogo}
            src={awayComp.team.logos?.[0]?.href || matchup.topTeam?.logoUrl || matchup.bottomTeam?.logoUrl}
            alt=""
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className={styles.scoreTeamInfo}>
            <div className={styles.scoreTeamName}>
              {awayComp.rank && <span className={styles.scoreSeed}>{awayComp.rank}</span>}
              {awayComp.team.location}
            </div>
            <div className={styles.scoreTeamRecord}>
              {awayComp.record?.find(r => r.type === 'total')?.summary ?? ''}
            </div>
          </div>
          <div className={styles.scoreValue}>{awayComp.score}</div>
        </div>

        {/* Clock */}
        <div className={styles.scoreClock}>
          {isLive && <span className={styles.liveDot} />}
          {status.type.state === 'post' ? (
            <span className={styles.clockTime}>Final</span>
          ) : status.type.detail?.toLowerCase().includes('halftime') || (status.displayClock === '0:00' && status.period === 1) ? (
            <span className={styles.clockTime}>Halftime</span>
          ) : (
            <>
              <span className={styles.clockTime}>{status.displayClock}</span>
              <span className={styles.clockPeriod}>{status.type.shortDetail?.split(' - ')[1] || formatPeriodShort(status.period)}</span>
            </>
          )}
        </div>

        {/* Home team - DOM order matches visual: name, score, logo */}
        <div className={styles.scoreTeam}>
          <div className={styles.scoreTeamInfo} style={{ textAlign: 'right' }}>
            <div className={`${styles.scoreTeamName} ${styles.scoreTeamNameRight}`}>
              {homeComp.team.location}
              {homeComp.rank && <span className={styles.scoreSeed}>{homeComp.rank}</span>}
            </div>
            <div className={styles.scoreTeamRecord}>
              {homeComp.record?.find(r => r.type === 'total')?.summary ?? ''}
            </div>
          </div>
          <div className={styles.scoreValue}>{homeComp.score}</div>
          <img
            className={styles.scoreLogo}
            src={homeComp.team.logos?.[0]?.href || matchup.topTeam?.logoUrl || matchup.bottomTeam?.logoUrl}
            alt=""
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      </div>

      {/* Line scores */}
      {(homeComp.linescores?.length ?? 0) > 0 && (
        <div className={styles.lineScores}>
          <table className={styles.lineScoreTable}>
            <thead>
              <tr>
                <th></th>
                {Array.from({ length: numPeriods }, (_, i) => (
                  <th key={i}>{formatPeriodShort(i + 1)}</th>
                ))}
                <th>T</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.lineScoreTeam}>{awayComp.team.abbreviation}</td>
                {Array.from({ length: numPeriods }, (_, i) => (
                  <td key={i}>{awayComp.linescores?.[i]?.displayValue ?? '-'}</td>
                ))}
                <td className={styles.lineScoreTotal}>{awayComp.score}</td>
              </tr>
              <tr>
                <td className={styles.lineScoreTeam}>{homeComp.team.abbreviation}</td>
                {Array.from({ length: numPeriods }, (_, i) => (
                  <td key={i}>{homeComp.linescores?.[i]?.displayValue ?? '-'}</td>
                ))}
                <td className={styles.lineScoreTotal}>{homeComp.score}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Win Probability Chart ────────────────────────────────

function WinProbChart({
  data,
  homeColor,
  awayColor,
  homeAbbr,
  awayAbbr,
}: {
  data: { homeWinPercentage: number }[];
  homeColor: string;
  awayColor: string;
  homeAbbr: string;
  awayAbbr: string;
}) {
  if (data.length < 2) return null;

  const width = 500;
  const height = 160;
  const padTop = 20;
  const padBottom = 20;
  const padLeft = 40;
  const padRight = 10;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const midY = padTop + chartH / 2;

  // Y mapping: line UP = away team winning, line DOWN = home team winning
  // homeWinPct near 0 → y near top (away winning)
  // homeWinPct near 1 → y near bottom (home winning)
  const points = data.map((d, i) => ({
    x: padLeft + (i / (data.length - 1)) * chartW,
    y: padTop + d.homeWinPercentage * chartH,
  }));

  const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Area path: line then back along midY
  const areaD = `${lineD} L${points[points.length - 1].x.toFixed(1)},${midY.toFixed(1)} L${points[0].x.toFixed(1)},${midY.toFixed(1)} Z`;

  const lastPt = points[points.length - 1];
  const lastPct = data[data.length - 1].homeWinPercentage;
  const awayPct = ((1 - lastPct) * 100).toFixed(1);
  const homePct = (lastPct * 100).toFixed(1);

  return (
    <div className={styles.winProbSection}>
      <div className={styles.sectionTitle}>Win Probability</div>
      <div className={styles.winProbLabels}>
        <span style={{ color: ensureHash(awayColor), fontWeight: 800 }}>{awayAbbr} {awayPct}%</span>
        <span style={{ color: ensureHash(homeColor), fontWeight: 800 }}>{homeAbbr} {homePct}%</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.winProbSvg}>
        <defs>
          {/* Above midline = away team territory */}
          <clipPath id="away-area">
            <rect x={padLeft} y={0} width={chartW} height={midY} />
          </clipPath>
          {/* Below midline = home team territory */}
          <clipPath id="home-area">
            <rect x={padLeft} y={midY} width={chartW} height={chartH / 2 + padBottom} />
          </clipPath>
        </defs>

        {/* 50% line */}
        <line x1={padLeft} y1={midY} x2={width - padRight} y2={midY}
          stroke="#ccc" strokeWidth={1} strokeDasharray="4,3" />

        {/* Away team area (above midline = away winning) */}
        <path d={areaD} fill={ensureHash(awayColor)} opacity={0.2} clipPath="url(#away-area)" />

        {/* Home team area (below midline = home winning) */}
        <path d={areaD} fill={ensureHash(homeColor)} opacity={0.2} clipPath="url(#home-area)" />

        {/* Line */}
        <path d={lineD} fill="none" stroke="#555" strokeWidth={2} strokeLinejoin="round" />

        {/* Current point */}
        <circle cx={lastPt.x} cy={lastPt.y} r={4.5} fill="#e53935" stroke="#fff" strokeWidth={1.5} />

        {/* Y-axis labels: away team at top (line up = away winning), home at bottom */}
        <text x={padLeft - 4} y={padTop + 4} fontSize={10} fill={ensureHash(awayColor)} fontWeight="700" textAnchor="end">{awayAbbr}</text>
        <text x={padLeft - 4} y={height - padBottom} fontSize={10} fill={ensureHash(homeColor)} fontWeight="700" textAnchor="end">{homeAbbr}</text>
        <text x={padLeft - 4} y={midY + 3} fontSize={9} fill="#bbb" textAnchor="end">50%</text>
      </svg>
    </div>
  );
}

// ─── Game Leaders ─────────────────────────────────────────

function GameLeaders({
  leaders,
  homeTeamId,
  awayTeamId,
  homeColor,
  awayColor,
}: {
  leaders: EspnLeaderGroup[];
  homeTeamId: string;
  awayTeamId: string;
  homeColor: string;
  awayColor: string;
}) {
  if (!leaders || leaders.length < 2) return null;

  const homeLeaders = leaders.find(l => l.team.id === homeTeamId);
  const awayLeaders = leaders.find(l => l.team.id === awayTeamId);
  if (!homeLeaders || !awayLeaders) return null;

  const statTypes = ['points', 'rebounds', 'assists'];

  return (
    <div className={styles.leadersSection}>
      <div className={styles.sectionTitle}>Game Leaders</div>
      <div className={styles.leadersGrid}>
        {statTypes.map(statName => {
          const homeStat = homeLeaders.leaders.find(l => l.name === statName);
          const awayStat = awayLeaders.leaders.find(l => l.name === statName);
          const homePlayer = homeStat?.leaders?.[0];
          const awayPlayer = awayStat?.leaders?.[0];
          if (!homePlayer && !awayPlayer) return null;

          return (
            <div key={statName} className={styles.leaderRow}>
              {/* Away player */}
              <div className={styles.leaderPlayer}>
                {awayPlayer?.athlete?.headshot?.href && (
                  <img className={styles.leaderHeadshot} src={awayPlayer.athlete.headshot.href} alt=""
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <div className={styles.leaderInfo}>
                  <span className={styles.leaderName}>{awayPlayer?.athlete?.shortName ?? '-'}</span>
                  <span className={styles.leaderSummary}>{awayPlayer?.summary ?? ''}</span>
                </div>
                <span className={styles.leaderValue} style={{ color: ensureHash(awayColor) }}>
                  {awayPlayer?.displayValue ?? '-'}
                </span>
              </div>

              {/* Stat label */}
              <div className={styles.leaderStatLabel}>
                {statName.charAt(0).toUpperCase() + statName.slice(1)}
              </div>

              {/* Home player */}
              <div className={`${styles.leaderPlayer} ${styles.leaderPlayerReverse}`}>
                <span className={styles.leaderValue} style={{ color: ensureHash(homeColor) }}>
                  {homePlayer?.displayValue ?? '-'}
                </span>
                <div className={styles.leaderInfo} style={{ textAlign: 'right' }}>
                  <span className={styles.leaderName}>{homePlayer?.athlete?.shortName ?? '-'}</span>
                  <span className={styles.leaderSummary}>{homePlayer?.summary ?? ''}</span>
                </div>
                {homePlayer?.athlete?.headshot?.href && (
                  <img className={styles.leaderHeadshot} src={homePlayer.athlete.headshot.href} alt=""
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Team Stats Comparison ────────────────────────────────

const STAT_DISPLAY_MAP: Record<string, string> = {
  'fieldGoalsMade-fieldGoalsAttempted': 'Field Goals',
  'fieldGoalPct': 'FG%',
  'threePointFieldGoalsMade-threePointFieldGoalsAttempted': '3-Pointers',
  'threePointFieldGoalPct': '3PT%',
  'freeThrowsMade-freeThrowsAttempted': 'Free Throws',
  'freeThrowPct': 'FT%',
  'totalRebounds': 'Rebounds',
  'offensiveRebounds': 'Off. Rebounds',
  'assists': 'Assists',
  'turnovers': 'Turnovers',
  'steals': 'Steals',
  'blocks': 'Blocks',
  'pointsInPaint': 'Pts in Paint',
  'fouls': 'Fouls',
  'largestLead': 'Largest Lead',
};

const STAT_ORDER = Object.keys(STAT_DISPLAY_MAP);

function TeamStats({
  summary,
  homeTeamId,
  homeColor,
  awayColor,
  homeAbbr,
  awayAbbr,
}: {
  summary: EspnGameSummaryResponse;
  homeTeamId: string;
  homeColor: string;
  awayColor: string;
  homeAbbr: string;
  awayAbbr: string;
}) {
  const teams = summary.boxscore?.teams;
  if (!teams || teams.length < 2) return null;

  const homeTeam = teams.find(t => t.team.id === homeTeamId);
  const awayTeam = teams.find(t => t.team.id !== homeTeamId);
  if (!homeTeam || !awayTeam) return null;

  const statMap = (team: typeof homeTeam) => {
    const map: Record<string, string> = {};
    for (const s of team.statistics) map[s.name] = s.displayValue;
    return map;
  };
  const homeStats = statMap(homeTeam);
  const awayStats = statMap(awayTeam);

  // Parse numeric value for bar widths
  const parseNum = (v: string): number => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  return (
    <div className={styles.teamStatsSection}>
      <div className={styles.sectionTitle}>Team Stats</div>
      <div className={styles.teamStatsHeader}>
        <span style={{ color: ensureHash(awayColor), fontWeight: 700 }}>{awayAbbr}</span>
        <span style={{ color: ensureHash(homeColor), fontWeight: 700 }}>{homeAbbr}</span>
      </div>
      {STAT_ORDER.map(statKey => {
        const awayVal = awayStats[statKey];
        const homeVal = homeStats[statKey];
        if (awayVal === undefined && homeVal === undefined) return null;

        const label = STAT_DISPLAY_MAP[statKey];
        const awayNum = parseNum(awayVal ?? '0');
        const homeNum = parseNum(homeVal ?? '0');
        const max = Math.max(awayNum, homeNum, 1);

        return (
          <div key={statKey} className={styles.statRow}>
            <span className={styles.statValue}>{awayVal ?? '-'}</span>
            <div className={styles.statBarContainer}>
              <div className={styles.statBarOuter}>
                <div
                  className={styles.statBarAway}
                  style={{
                    width: `${(awayNum / max) * 100}%`,
                    background: ensureHash(awayColor),
                  }}
                />
              </div>
              <span className={styles.statLabel}>{label}</span>
              <div className={styles.statBarOuter}>
                <div
                  className={styles.statBarHome}
                  style={{
                    width: `${(homeNum / max) * 100}%`,
                    background: ensureHash(homeColor),
                  }}
                />
              </div>
            </div>
            <span className={styles.statValue}>{homeVal ?? '-'}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Recent Plays (for Gamecast tab) ─────────────────────

function RecentPlays({
  plays,
  homeTeamId,
  homeColor,
  awayColor,
  homeAbbr,
  awayAbbr,
  limit = 8,
}: {
  plays: EspnPlay[];
  homeTeamId: string;
  homeColor: string;
  awayColor: string;
  homeAbbr: string;
  awayAbbr: string;
  limit?: number;
}) {
  if (!plays || plays.length === 0) return null;

  // Sort by sequence descending (most recent first)
  const sorted = [...plays]
    .sort((a, b) => parseInt(b.sequenceNumber) - parseInt(a.sequenceNumber))
    .slice(0, limit);

  return (
    <div className={styles.recentPlaysSection}>
      <div className={styles.sectionTitle}>Recent Plays</div>
      <div className={styles.playsList}>
        {sorted.map(play => {
          const isHome = play.team?.id === homeTeamId;
          const teamColor = isHome ? ensureHash(homeColor) : ensureHash(awayColor);

          return (
            <div
              key={play.id}
              className={`${styles.playItem} ${play.scoringPlay ? styles.scoringPlay : ''}`}
            >
              <div className={styles.playLeft}>
                <span className={styles.playClock}>{play.clock?.displayValue}</span>
                <span className={styles.playPeriod}>{formatPeriodShort(play.period?.number)}</span>
              </div>
              <div className={styles.playContent}>
                {play.scoringPlay && (
                  <span className={styles.playScoreTag} style={{ background: teamColor }}>
                    +{play.scoreValue}
                  </span>
                )}
                <span className={styles.playText}>{play.text}</span>
              </div>
              <div className={styles.playScore}>
                <span>{play.awayScore}</span>
                <span className={styles.playScoreSep}>-</span>
                <span>{play.homeScore}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Box Score Tab ────────────────────────────────────────

function BoxScoreTab({
  summary,
  homeTeamId,
}: {
  summary: EspnGameSummaryResponse;
  homeTeamId: string;
}) {
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const players = summary.boxscore?.players;
  if (!players || players.length === 0) return <div className={styles.emptyState}>Box score not available yet</div>;

  // Sort: away team first (index 0), home team second (index 1)
  const sorted = [...players].sort((a, b) => {
    if (a.team.id === homeTeamId) return 1;
    if (b.team.id === homeTeamId) return -1;
    return 0;
  });

  const teamData = sorted[selectedTeamIdx];
  if (!teamData?.statistics?.[0]) return null;

  const stat = teamData.statistics[0];
  const headers = stat.names;
  const starters = stat.athletes.filter(a => a.starter && !a.didNotPlay);
  const hasPlayedBench = stat.athletes.filter(a => !a.starter && !a.didNotPlay && a.stats?.some(s => s !== '' && s !== '0'));
  const noStatsBench = stat.athletes.filter(a => !a.starter && !a.didNotPlay && (!a.stats || a.stats.every(s => s === '' || s === '0')));
  const dnp = stat.athletes.filter(a => a.didNotPlay);

  return (
    <div className={styles.boxScoreTab}>
      <div className={styles.boxScoreTeamTabs}>
        {sorted.map((t, i) => (
          <button
            key={t.team.id}
            className={`${styles.boxScoreTeamBtn} ${i === selectedTeamIdx ? styles.boxScoreTeamBtnActive : ''}`}
            onClick={() => setSelectedTeamIdx(i)}
            style={i === selectedTeamIdx ? { borderColor: ensureHash(t.team.color) } : undefined}
          >
            <img src={t.team.logo} alt="" className={styles.boxScoreTeamLogo}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            {t.team.abbreviation}
          </button>
        ))}
      </div>

      <div className={styles.boxScoreTableWrap}>
        <table className={styles.boxScoreTable}>
          <thead>
            <tr>
              <th className={styles.boxPlayerCol}>Player</th>
              {headers.map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {/* Starters */}
            {starters.length > 0 && (
              <tr className={styles.boxSectionRow}>
                <td colSpan={headers.length + 1}>Starters</td>
              </tr>
            )}
            {starters.map(p => (
              <tr key={p.athlete.id}>
                <td className={styles.boxPlayerCol}>
                  <span className={styles.boxPlayerName}>{p.athlete.shortName}</span>
                  <span className={styles.boxPlayerPos}>#{p.athlete.jersey} {p.athlete.position.abbreviation}</span>
                </td>
                {p.stats.map((s, i) => (
                  <td key={i} className={headers[i] === 'PTS' ? styles.boxHighlight : undefined}>{s}</td>
                ))}
              </tr>
            ))}

            {/* Bench (with stats) */}
            {(hasPlayedBench.length > 0 || noStatsBench.length > 0) && (
              <tr className={styles.boxSectionRow}>
                <td colSpan={headers.length + 1}>Bench</td>
              </tr>
            )}
            {hasPlayedBench.map(p => (
              <tr key={p.athlete.id}>
                <td className={styles.boxPlayerCol}>
                  <span className={styles.boxPlayerName}>{p.athlete.shortName}</span>
                  <span className={styles.boxPlayerPos}>#{p.athlete.jersey} {p.athlete.position.abbreviation}</span>
                </td>
                {p.stats.map((s, i) => (
                  <td key={i} className={headers[i] === 'PTS' ? styles.boxHighlight : undefined}>{s}</td>
                ))}
              </tr>
            ))}
            {/* Bench (no stats yet) */}
            {noStatsBench.map(p => (
              <tr key={p.athlete.id} className={styles.boxDnp}>
                <td className={styles.boxPlayerCol}>
                  <span className={styles.boxPlayerName}>{p.athlete.shortName}</span>
                  <span className={styles.boxPlayerPos}>#{p.athlete.jersey} {p.athlete.position.abbreviation}</span>
                </td>
                {headers.map((_, i) => <td key={i}>-</td>)}
              </tr>
            ))}

            {/* DNP */}
            {dnp.length > 0 && (
              <tr className={styles.boxSectionRow}>
                <td colSpan={headers.length + 1}>Did Not Play</td>
              </tr>
            )}
            {dnp.map(p => (
              <tr key={p.athlete.id} className={styles.boxDnp}>
                <td className={styles.boxPlayerCol}>
                  <span className={styles.boxPlayerName}>{p.athlete.shortName}</span>
                </td>
                <td colSpan={headers.length}>DNP</td>
              </tr>
            ))}

            {/* Totals */}
            <tr className={styles.boxTotalsRow}>
              <td className={styles.boxPlayerCol}>Totals</td>
              {stat.totals.map((t, i) => (
                <td key={i} className={headers[i] === 'PTS' ? styles.boxHighlight : undefined}>{t}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Play-by-Play Tab ─────────────────────────────────────

function PlayByPlayTab({
  plays,
  homeTeamId,
  homeColor,
  awayColor,
}: {
  plays: EspnPlay[];
  homeTeamId: string;
  homeColor: string;
  awayColor: string;
}) {
  const [filterPeriod, setFilterPeriod] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  if (!plays || plays.length === 0) {
    return <div className={styles.emptyState}>Play-by-play not available yet</div>;
  }

  // Get unique periods
  const periods = [...new Set(plays.map(p => p.period?.number))].sort((a, b) => a - b);

  // Filter by period if selected
  const filtered = filterPeriod !== null
    ? plays.filter(p => p.period?.number === filterPeriod)
    : plays;

  // Sort by sequence descending (most recent first)
  const sorted = [...filtered].sort(
    (a, b) => parseInt(b.sequenceNumber) - parseInt(a.sequenceNumber)
  );

  return (
    <div className={styles.pbpTab}>
      <div className={styles.pbpFilters}>
        <button
          className={`${styles.pbpFilterBtn} ${filterPeriod === null ? styles.pbpFilterActive : ''}`}
          onClick={() => setFilterPeriod(null)}
        >
          All
        </button>
        {periods.map(p => (
          <button
            key={p}
            className={`${styles.pbpFilterBtn} ${filterPeriod === p ? styles.pbpFilterActive : ''}`}
            onClick={() => setFilterPeriod(p)}
          >
            {formatPeriodShort(p)}
          </button>
        ))}
      </div>

      <div className={styles.pbpHeader}>
        <span>{awayAbbr}</span>
        <span>{homeAbbr}</span>
      </div>

      <div className={styles.pbpList} ref={listRef}>
        {sorted.map(play => {
          const isHome = play.team?.id === homeTeamId;
          const teamColor = play.team ? (isHome ? ensureHash(homeColor) : ensureHash(awayColor)) : '#666';

          return (
            <div
              key={play.id}
              className={`${styles.pbpItem} ${play.scoringPlay ? styles.pbpScoring : ''}`}
            >
              <div className={styles.pbpTime}>
                <span className={styles.pbpClock}>{play.clock?.displayValue}</span>
                <span className={styles.pbpPeriod}>{formatPeriodShort(play.period?.number)}</span>
              </div>
              <div className={styles.pbpScoreCol}>{play.awayScore}</div>
              <div className={styles.pbpContent}>
                {play.scoringPlay && (
                  <span className={styles.pbpScoreTag} style={{ background: teamColor }}>
                    +{play.scoreValue}
                  </span>
                )}
                <div className={styles.pbpText}>
                  {play.type?.text && (
                    <span className={styles.pbpType}>{formatPlayType(play.type.text)}</span>
                  )}
                  <span>{play.text}</span>
                </div>
              </div>
              <div className={styles.pbpScoreCol}>{play.homeScore}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Live Odds Section ────────────────────────────────────

function LiveOdds({ summary }: { summary: EspnGameSummaryResponse }) {
  const picks = summary.pickcenter;
  if (!picks || picks.length === 0) return null;

  const pick = picks[0]; // Use first provider (usually DraftKings)
  const liveSpreadHome = pick.pointSpread?.home?.live;
  const liveTotal = pick.total?.over?.live;
  const liveMLHome = pick.moneyline?.home?.live;
  const liveMLAway = pick.moneyline?.away?.live;

  const hasLive = liveSpreadHome || liveTotal || liveMLHome;

  return (
    <div className={styles.oddsSection}>
      <div className={styles.sectionTitle}>
        Odds
        {hasLive && <span className={styles.liveBadge}>LIVE</span>}
      </div>
      <div className={styles.oddsGrid}>
        {pick.details && (
          <div className={styles.oddsItem}>
            <span className={styles.oddsLabel}>Spread</span>
            <span className={styles.oddsValue}>
              {liveSpreadHome ? `${liveSpreadHome.line} (${liveSpreadHome.odds})` : pick.details}
            </span>
          </div>
        )}
        <div className={styles.oddsItem}>
          <span className={styles.oddsLabel}>O/U</span>
          <span className={styles.oddsValue}>
            {liveTotal ? liveTotal.line : pick.overUnder}
          </span>
        </div>
        {(liveMLHome || pick.homeTeamOdds?.moneyLine) && (
          <div className={styles.oddsItem}>
            <span className={styles.oddsLabel}>ML</span>
            <span className={styles.oddsValue}>
              {liveMLHome?.odds ?? pick.homeTeamOdds?.moneyLine} / {liveMLAway?.odds ?? `${pick.awayTeamOdds?.moneyLine > 0 ? '+' : ''}${pick.awayTeamOdds?.moneyLine}`}
            </span>
          </div>
        )}
        <div className={styles.oddsProvider}>
          {pick.provider?.name}
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────

export function LiveGameModal({ matchup, onClose }: LiveGameModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('gamecast');
  const modalRef = useRef<HTMLDivElement>(null);

  const isFinalGame = matchup.status === 'final';
  const { summary, plays, winProbTimeline, loading, error, lastUpdated } = useLiveGame({
    eventId: matchup.espnEventId,
    enabled: true,
    pollInterval: isFinalGame ? 0 : 15000, // No polling for final games
  });

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    modalRef.current?.scrollTo(0, 0);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // Derive team info from summary
  const comp = summary?.header?.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const homeComp = competitors.find((c: EspnSummaryCompetitor) => c.homeAway === 'home');
  const awayComp = competitors.find((c: EspnSummaryCompetitor) => c.homeAway === 'away');
  const homeTeamId = homeComp?.team?.id ?? '';
  const awayTeamId = awayComp?.team?.id ?? '';
  const homeColor = homeComp?.team?.color ?? '333333';
  const awayColor = awayComp?.team?.color ?? '666666';
  const homeAbbr = homeComp?.team?.abbreviation ?? 'HOME';
  const awayAbbr = awayComp?.team?.abbreviation ?? 'AWAY';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} ref={modalRef} onClick={e => e.stopPropagation()}>
        {/* Loading state */}
        {loading && !summary && (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner} />
            <span>Loading live game data...</span>
          </div>
        )}

        {/* Error state */}
        {error && !summary && (
          <div className={styles.errorState}>
            <span>Failed to load game data</span>
            <span className={styles.errorDetail}>{error}</span>
            <button className={styles.closeBtn} onClick={onClose}>Close</button>
          </div>
        )}

        {/* Main content */}
        {summary && (
          <>
            <ScoreboardHeader summary={summary} matchup={matchup} onClose={onClose} />

            {/* Tab navigation */}
            <div className={styles.tabBar}>
              {(['gamecast', 'boxscore', 'plays'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'gamecast' ? 'Gamecast' : tab === 'boxscore' ? 'Box Score' : 'Play-by-Play'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className={styles.tabContent}>
              {activeTab === 'gamecast' && (
                <>
                  <WinProbChart
                    data={winProbTimeline.length > 0 ? winProbTimeline : (summary.winprobability ?? [])}
                    homeColor={homeColor}
                    awayColor={awayColor}
                    homeAbbr={homeAbbr}
                    awayAbbr={awayAbbr}
                  />
                  <GameLeaders
                    leaders={summary.leaders ?? []}
                    homeTeamId={homeTeamId}
                    awayTeamId={awayTeamId}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                  <LiveOdds summary={summary} />
                  <TeamStats
                    summary={summary}
                    homeTeamId={homeTeamId}
                    homeColor={homeColor}
                    awayColor={awayColor}
                    homeAbbr={homeAbbr}
                    awayAbbr={awayAbbr}
                  />
                  <RecentPlays
                    plays={plays}
                    homeTeamId={homeTeamId}
                    homeColor={homeColor}
                    awayColor={awayColor}
                    homeAbbr={homeAbbr}
                    awayAbbr={awayAbbr}
                  />
                </>
              )}

              {activeTab === 'boxscore' && (
                <BoxScoreTab summary={summary} homeTeamId={homeTeamId} />
              )}

              {activeTab === 'plays' && (
                <PlayByPlayTab
                  plays={plays}
                  homeTeamId={homeTeamId}
                  homeColor={homeColor}
                  awayColor={awayColor}
                />
              )}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              {isFinalGame ? (
                <span className={styles.footerTime}>Game Final</span>
              ) : (
                <span className={styles.footerLive}>
                  <span className={styles.liveDotSmall} />
                  Auto-updating every 15s
                </span>
              )}
              {lastUpdated && (
                <span className={styles.footerTime}>
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <span className={styles.footerHint}>Esc to close</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
