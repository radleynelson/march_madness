import type { Matchup as MatchupType } from '../../types/bracket';
import { useHoverContext, formatProb } from '../../hooks/useHoverState';
import { Matchup } from '../Matchup/Matchup';
import styles from './FinalFour.module.css';

interface FinalFourProps {
  semifinal1: MatchupType | null;
  semifinal2: MatchupType | null;
  championship: MatchupType | null;
}

export function FinalFour({ semifinal1, semifinal2, championship }: FinalFourProps) {
  const { teamPath } = useHoverContext();
  const hoveredTeam = teamPath?.team ?? null;
  const champProb = hoveredTeam ? hoveredTeam.probabilities.champion : 0;
  const ffProb = hoveredTeam ? hoveredTeam.probabilities.finalFour : 0;
  const pathColor = hoveredTeam?.primaryColor || '#333';

  const showFF0 = hoveredTeam && ffProb > 0 && teamPath?.matchupIds.has('FF-0');
  const showFF1 = hoveredTeam && ffProb > 0 && teamPath?.matchupIds.has('FF-1');
  const showChampHover = hoveredTeam && champProb > 0;
  const showChampWinner = !showChampHover && championship?.winner;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Final Four</span>
      </div>
      <div className={styles.bracket}>
        <div className={styles.semi}>
          {semifinal1 && <Matchup matchup={semifinal1} />}
          {/* FF probability label - always rendered, visibility toggled */}
          <div
            className={styles.ffProbLabel}
            style={{
              color: pathColor,
              visibility: showFF0 ? 'visible' : 'hidden',
            }}
          >
            {showFF0 ? formatProb(ffProb) : '\u00A0'}
          </div>
        </div>
        <div className={styles.championship}>
          <div className={styles.champLabel}>Championship</div>
          {championship && <Matchup matchup={championship} />}

          {/* Championship display - fixed-size container, content swapped via visibility */}
          <div className={styles.champDisplayContainer}>
            {showChampHover ? (
              <div className={styles.champDisplay}>
                <div className={styles.champDisplayLabel}>Chance of winning<br/>tournament</div>
                <div
                  className={styles.champDisplayPct}
                  style={{ color: pathColor }}
                >
                  {formatProb(champProb)}
                </div>
                <img
                  className={styles.champDisplayLogo}
                  src={hoveredTeam!.logoUrl}
                  alt=""
                  width={64}
                  height={64}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className={styles.champDisplayTeam}>
                  {hoveredTeam!.shortName}
                </div>
              </div>
            ) : showChampWinner ? (
              <div className={styles.champion}>
                <span className={styles.championIcon}>🏆</span>
                <span className={styles.championName}>
                  {championship!.winner === 'top'
                    ? championship!.topTeam?.shortName
                    : championship!.bottomTeam?.shortName}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <div className={styles.semi}>
          {/* FF probability label - always rendered, visibility toggled */}
          <div
            className={styles.ffProbLabel}
            style={{
              color: pathColor,
              visibility: showFF1 ? 'visible' : 'hidden',
            }}
          >
            {showFF1 ? formatProb(ffProb) : '\u00A0'}
          </div>
          {semifinal2 && <Matchup matchup={semifinal2} />}
        </div>
      </div>
    </div>
  );
}
