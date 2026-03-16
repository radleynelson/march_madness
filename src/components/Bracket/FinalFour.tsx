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
  const e8Prob = hoveredTeam ? hoveredTeam.probabilities.elite8 : 0;
  const pathColor = hoveredTeam?.primaryColor || '#333';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Final Four</span>
      </div>
      <div className={styles.bracket}>
        <div className={styles.semi}>
          {semifinal1 && <Matchup matchup={semifinal1} />}
          {/* FF probability label */}
          {hoveredTeam && ffProb > 0 && teamPath?.matchupIds.has('FF-0') && (
            <div className={styles.ffProbLabel} style={{ color: pathColor }}>
              {formatProb(ffProb)}
            </div>
          )}
        </div>
        <div className={styles.championship}>
          <div className={styles.champLabel}>Championship</div>
          {championship && <Matchup matchup={championship} />}

          {/* Show hovered team championship info */}
          {hoveredTeam && champProb > 0 ? (
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
                src={hoveredTeam.logoUrl}
                alt=""
                width={64}
                height={64}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className={styles.champDisplayTeam}>
                {hoveredTeam.shortName}
              </div>
            </div>
          ) : (
            /* Default champion display */
            championship?.winner && (
              <div className={styles.champion}>
                <span className={styles.championIcon}>🏆</span>
                <span className={styles.championName}>
                  {championship.winner === 'top'
                    ? championship.topTeam?.shortName
                    : championship.bottomTeam?.shortName}
                </span>
              </div>
            )
          )}
        </div>
        <div className={styles.semi}>
          {/* FF probability label - above matchup so it's between championship and semifinal */}
          {hoveredTeam && ffProb > 0 && teamPath?.matchupIds.has('FF-1') && (
            <div className={styles.ffProbLabel} style={{ color: pathColor }}>
              {formatProb(ffProb)}
            </div>
          )}
          {semifinal2 && <Matchup matchup={semifinal2} />}
        </div>
      </div>
    </div>
  );
}
