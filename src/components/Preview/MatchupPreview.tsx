import { useEffect, useCallback, useRef, useState } from 'react';
import type { Matchup, Team } from '../../types/bracket';
import type { TeamProfile, TeamOdds } from '../../types/preview';
import { TEAM_PROFILES } from '../../data/team-profiles';
import { TEAM_ODDS, MATCHUP_LINES } from '../../data/team-odds';
import type { MatchupLine } from '../../data/team-odds';
import { winProbability } from '../../model/predictions';
import { fetchGameSummary } from '../../api/espn';
import { AIChat } from './AIChat';
import styles from './MatchupPreview.module.css';

interface EspnOdds {
  spread: string;
  overUnder: number;
  homeML: number;
  awayML: number;
  provider: string;
}

function useEspnOdds(eventId: string | null): EspnOdds | null {
  const [odds, setOdds] = useState<EspnOdds | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    fetchGameSummary(eventId).then(summary => {
      if (cancelled) return;
      const pick = summary.pickcenter?.[0];
      if (!pick) return;

      setOdds({
        spread: pick.details || '',
        overUnder: pick.overUnder || 0,
        homeML: pick.homeTeamOdds?.moneyLine ?? 0,
        awayML: pick.awayTeamOdds?.moneyLine ?? 0,
        provider: pick.provider?.name || '',
      });
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [eventId]);

  return odds;
}

interface MatchupPreviewProps {
  matchup: Matchup;
  onClose: () => void;
}

function getProfile(team: Team): TeamProfile | null {
  return TEAM_PROFILES[team.shortName] ?? TEAM_PROFILES[team.abbreviation] ?? null;
}

function getOdds(team: Team): TeamOdds | null {
  return TEAM_ODDS[team.shortName] ?? TEAM_ODDS[team.abbreviation] ?? null;
}

function formatPct(p: number): string {
  const pct = p * 100;
  if (pct >= 99.5) return '>99%';
  if (pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

function TeamColumn({ team, prob, profile, odds }: {
  team: Team;
  prob: number;
  profile: TeamProfile | null;
  odds: TeamOdds | null;
}) {
  return (
    <div className={styles.teamCol}>
      <div className={styles.teamHeader}>
        <img
          className={styles.teamLogo}
          src={team.logoUrl}
          alt=""
          width={44}
          height={44}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className={styles.teamInfo}>
          <div className={styles.teamName}>{team.name}</div>
          <div className={styles.teamMeta}>
            <span className={styles.teamSeed} style={{ background: team.primaryColor }}>{team.seed}</span>
            {' '}{team.region} Region{team.record ? ` \u00b7 ${team.record}` : ''}
          </div>
        </div>
      </div>

      {/* Model win probability for this matchup */}
      <div className={styles.sectionLabel}>Win Probability (Model)</div>
      <div className={styles.strengthText} style={{ fontSize: '20px', fontWeight: 900, color: team.primaryColor }}>
        {formatPct(prob)}
      </div>

      {profile && (
        <>
          {/* Getting to Know */}
          <div className={styles.sectionLabel}>Getting to Know</div>
          <div className={styles.previewText}>{profile.preview}</div>

          {/* Key Players */}
          <div className={styles.sectionLabel}>Key Players</div>
          <div className={styles.playersList}>
            {profile.keyPlayers.map((p) => (
              <span key={p} className={styles.playerTag}>{p}</span>
            ))}
          </div>

          {/* Strengths */}
          <div className={styles.sectionLabel}>Strengths</div>
          <div className={styles.strengthText}>{profile.strengths}</div>

          {/* Weaknesses */}
          <div className={styles.sectionLabel}>Weaknesses</div>
          <div className={styles.weaknessText}>{profile.weaknesses}</div>
        </>
      )}

      {/* Championship Odds */}
      {odds && (
        <div className={styles.champOdds}>
          <span className={styles.champOddsLabel}>Championship Odds:</span>
          <span className={styles.champOddsValue}>{odds.championshipOdds}</span>
          <span className={styles.champOddsLabel}>({formatPct(odds.impliedProb)})</span>
        </div>
      )}
    </div>
  );
}

export function MatchupPreview({ matchup, onClose }: MatchupPreviewProps) {
  const { topTeam, bottomTeam } = matchup;
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    // Scroll modal to top on open
    modalRef.current?.scrollTo(0, 0);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  if (!topTeam || !bottomTeam) return null;

  // Calculate matchup-specific win probability
  const topWinProb = winProbability(topTeam.rating, bottomTeam.rating);
  const bottomWinProb = 1 - topWinProb;

  const topProfile = getProfile(topTeam);
  const bottomProfile = getProfile(bottomTeam);
  const topOdds = getOdds(topTeam);
  const bottomOdds = getOdds(bottomTeam);
  const line: MatchupLine | null = MATCHUP_LINES[matchup.id] ?? null;
  const espnOdds = useEspnOdds(matchup.espnEventId);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} ref={modalRef} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <img className={styles.headerLogo} src={topTeam.logoUrl} alt="" width={28} height={28}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            {topTeam.shortName}
            <span className={styles.vsText}>vs</span>
            {bottomTeam.shortName}
            <img className={styles.headerLogo} src={bottomTeam.logoUrl} alt="" width={28} height={28}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {/* Probability Bar */}
        <div className={styles.probSection}>
          <div className={styles.probHeader}>Matchup Win Probability</div>
          <div className={styles.probBar}>
            <div
              className={styles.probBarLeft}
              style={{
                width: `${Math.max(topWinProb * 100, 8)}%`,
                background: topTeam.primaryColor,
              }}
            >
              {formatPct(topWinProb)}
            </div>
            <div
              className={styles.probBarRight}
              style={{
                width: `${Math.max(bottomWinProb * 100, 8)}%`,
                background: bottomTeam.primaryColor,
              }}
            >
              {formatPct(bottomWinProb)}
            </div>
          </div>

          {/* Betting line + championship odds */}
          <div className={styles.oddsRow}>
            {espnOdds ? (
              <>
                {espnOdds.spread && (
                  <div className={styles.oddsItem}>
                    <span className={styles.oddsLabel}>Spread:</span>
                    <span className={styles.oddsValue}>{espnOdds.spread}</span>
                  </div>
                )}
                {espnOdds.overUnder > 0 && (
                  <div className={styles.oddsItem}>
                    <span className={styles.oddsLabel}>O/U:</span>
                    <span className={styles.oddsValue}>{espnOdds.overUnder}</span>
                  </div>
                )}
                {(espnOdds.homeML || espnOdds.awayML) && (
                  <div className={styles.oddsItem}>
                    <span className={styles.oddsLabel}>ML:</span>
                    <span className={styles.oddsValue}>
                      {espnOdds.homeML > 0 ? '+' : ''}{espnOdds.homeML} / {espnOdds.awayML > 0 ? '+' : ''}{espnOdds.awayML}
                    </span>
                  </div>
                )}
                {espnOdds.provider && (
                  <div className={styles.oddsItem}>
                    <span className={styles.oddsLabel} style={{ color: '#bbb', fontWeight: 400 }}>
                      {espnOdds.provider}
                    </span>
                  </div>
                )}
              </>
            ) : line ? (
              <>
                <div className={styles.oddsItem}>
                  <span className={styles.oddsLabel}>Spread:</span>
                  <span className={styles.oddsValue}>{line.favorite} {line.spread}</span>
                </div>
                <div className={styles.oddsItem}>
                  <span className={styles.oddsLabel}>O/U:</span>
                  <span className={styles.oddsValue}>{line.total}</span>
                </div>
                <div className={styles.oddsItem}>
                  <span className={styles.oddsLabel}>ML:</span>
                  <span className={styles.oddsValue}>
                    {line.favoriteML > 0 ? '+' : ''}{line.favoriteML} / +{line.underdogML}
                  </span>
                </div>
              </>
            ) : null}
            {topOdds && (
              <div className={styles.oddsItem}>
                <span className={styles.oddsLabel}>{topTeam.shortName} Title:</span>
                <span className={styles.oddsValue}>{topOdds.championshipOdds}</span>
              </div>
            )}
            {bottomOdds && (
              <div className={styles.oddsItem}>
                <span className={styles.oddsLabel}>{bottomTeam.shortName} Title:</span>
                <span className={styles.oddsValue}>{bottomOdds.championshipOdds}</span>
              </div>
            )}
          </div>
        </div>

        {/* Two-column team previews */}
        <div className={styles.teamsGrid}>
          <TeamColumn team={topTeam} prob={topWinProb} profile={topProfile} odds={topOdds} />
          <TeamColumn team={bottomTeam} prob={bottomWinProb} profile={bottomProfile} odds={bottomOdds} />
        </div>

        {/* AI Chat - only shown when AI is enabled */}
        <AIChat matchup={matchup} />

        {/* Footer */}
        <div className={styles.footer}>
          <span>
            <span className={styles.modelLabel}>Model:</span>{' '}
            Elo-derived logistic (AdjEM, 30.464 K-factor)
          </span>
          <span>Click outside or press Esc to close</span>
        </div>
      </div>
    </div>
  );
}
