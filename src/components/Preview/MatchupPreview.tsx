import { useEffect, useCallback, useRef, useState } from 'react';
import type { Matchup, Team } from '../../types/bracket';
import type { TeamProfile, TeamOdds } from '../../types/preview';
import { TEAM_PROFILES } from '../../data/team-profiles';
import { TEAM_ODDS, MATCHUP_LINES } from '../../data/team-odds';
import type { MatchupLine } from '../../data/team-odds';
import { winProbability } from '../../model/predictions';
import { fetchGameSummary } from '../../api/espn';
import { useKalshiContext } from '../../hooks/useKalshiMarkets';
import type { KalshiFuturesMarket } from '../../types/kalshi';
import { formatVolume, priceToAmericanOdds } from '../../api/kalshi';
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
  fullPage?: boolean;
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

function TeamColumn({ team, prob, profile, odds, kalshiFuture }: {
  team: Team;
  prob: number;
  profile: TeamProfile | null;
  odds: TeamOdds | null;
  kalshiFuture: KalshiFuturesMarket | null;
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
      {kalshiFuture ? (
        <div className={styles.champOdds}>
          <span className={styles.champOddsLabel}>Title (Kalshi):</span>
          <span className={styles.champOddsValue}>{priceToAmericanOdds(kalshiFuture.price)}</span>
          <span className={styles.champOddsLabel}>({formatPct(kalshiFuture.price)})</span>
        </div>
      ) : odds ? (
        <div className={styles.champOdds}>
          <span className={styles.champOddsLabel}>Championship Odds:</span>
          <span className={styles.champOddsValue}>{odds.championshipOdds}</span>
          <span className={styles.champOddsLabel}>({formatPct(odds.impliedProb)})</span>
        </div>
      ) : null}
    </div>
  );
}

export function MatchupPreview({ matchup, onClose, fullPage = false }: MatchupPreviewProps) {
  const { topTeam, bottomTeam } = matchup;
  const modalRef = useRef<HTMLDivElement>(null);
  const kalshi = useKalshiContext();
  const kalshiData = kalshi.matchupMarkets.get(matchup.id) ?? null;

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    if (fullPage) {
      window.scrollTo(0, 0);
    } else {
      document.body.style.overflow = 'hidden';
      modalRef.current?.scrollTo(0, 0);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (!fullPage) {
        document.body.style.overflow = '';
      }
    };
  }, [handleKeyDown, fullPage]);

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

  // Find Kalshi championship futures for each team
  const findFuture = (team: Team): KalshiFuturesMarket | null => {
    const name = team.shortName.toLowerCase();
    return kalshi.futures.find(f => {
      const fn = f.teamName.toLowerCase();
      return fn.includes(name) || name.includes(fn);
    }) ?? null;
  };
  const topFuture = findFuture(topTeam);
  const bottomFuture = findFuture(bottomTeam);

  const overlayClass = fullPage ? styles.overlayFullPage : styles.overlay;
  const modalClass = fullPage ? styles.modalFullPage : styles.modal;

  const content = (
    <div className={modalClass} ref={modalRef} onClick={fullPage ? undefined : (e) => e.stopPropagation()}>
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
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">{fullPage ? '←' : '×'}</button>
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

          {/* Kalshi Prediction Market */}
          {kalshiData && (
            <div className={styles.kalshiSection}>
              <div className={styles.kalshiHeader}>
                <span className={styles.kalshiTitle}>Kalshi Prediction Market</span>
                <span className={styles.kalshiLive}>LIVE</span>
              </div>
              <div className={styles.probBar}>
                <div
                  className={styles.probBarLeft}
                  style={{
                    width: `${Math.max(kalshiData.topMarket.price * 100, 8)}%`,
                    background: topTeam.primaryColor,
                    opacity: 0.7,
                  }}
                >
                  {Math.round(kalshiData.topMarket.price * 100)}¢
                </div>
                <div
                  className={styles.probBarRight}
                  style={{
                    width: `${Math.max(kalshiData.bottomMarket.price * 100, 8)}%`,
                    background: bottomTeam.primaryColor,
                    opacity: 0.7,
                  }}
                >
                  {Math.round(kalshiData.bottomMarket.price * 100)}¢
                </div>
              </div>
              <div className={styles.kalshiDetails}>
                <div className={styles.kalshiOddsItem}>
                  <span className={styles.oddsLabel}>{topTeam.shortName}:</span>
                  <span className={styles.oddsValue}>{priceToAmericanOdds(kalshiData.topMarket.price)}</span>
                </div>
                <div className={styles.kalshiOddsItem}>
                  <span className={styles.oddsLabel}>{bottomTeam.shortName}:</span>
                  <span className={styles.oddsValue}>{priceToAmericanOdds(kalshiData.bottomMarket.price)}</span>
                </div>
                <div className={styles.kalshiOddsItem}>
                  <span className={styles.oddsLabel}>Volume:</span>
                  <span className={styles.oddsValue}>{formatVolume(kalshiData.totalVolume)}</span>
                </div>
                <div className={styles.kalshiOddsItem}>
                  <span className={styles.oddsLabel}>24h:</span>
                  <span className={styles.oddsValue}>{formatVolume(kalshiData.totalVolume24h)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Two-column team previews */}
        <div className={styles.teamsGrid}>
          <TeamColumn team={topTeam} prob={topWinProb} profile={topProfile} odds={topOdds} kalshiFuture={topFuture} />
          <TeamColumn team={bottomTeam} prob={bottomWinProb} profile={bottomProfile} odds={bottomOdds} kalshiFuture={bottomFuture} />
        </div>

        {/* AI Chat - only shown when AI is enabled */}
        <AIChat matchup={matchup} />

        {/* Footer */}
        <div className={styles.footer}>
          <span>
            <span className={styles.modelLabel}>Model:</span>{' '}
            Elo-derived logistic (AdjEM, 30.464 K-factor)
          </span>
          {!fullPage && <span>Click outside or press Esc to close</span>}
        </div>
      </div>
  );

  if (fullPage) return content;

  return (
    <div className={overlayClass} onClick={onClose}>
      {content}
    </div>
  );
}
