import type { BracketState, RegionName, Matchup as MatchupType } from '../../types/bracket';
import { Region } from './Region';
import { FinalFour } from './FinalFour';
import { Matchup } from '../Matchup/Matchup';
import styles from './Bracket.module.css';

interface BracketProps {
  state: BracketState;
  onUserAdvance?: (matchupId: string, winner: 'top' | 'bottom') => void;
}

export function Bracket({ state, onUserAdvance }: BracketProps) {
  const { matchups, regionMatchupIds, finalFourMatchupIds, championshipMatchupId, firstFourMatchupIds, userPicks } = state;

  // Get region matchups
  const getRegionMatchups = (region: RegionName): MatchupType[] => {
    return (regionMatchupIds[region] ?? [])
      .map(id => matchups.get(id))
      .filter((m): m is MatchupType => m !== undefined);
  };

  // Get Final Four matchups
  const semifinal1 = matchups.get(finalFourMatchupIds[0]) ?? null;
  const semifinal2 = matchups.get(finalFourMatchupIds[1]) ?? null;
  const championship = matchups.get(championshipMatchupId) ?? null;

  // Get First Four matchups
  const firstFourMatchups = firstFourMatchupIds
    .map(id => matchups.get(id))
    .filter((m): m is MatchupType => m !== undefined);

  return (
    <div className={styles.wrapper}>
      {/* First Four section */}
      {firstFourMatchups.length > 0 && (
        <div className={styles.firstFour}>
          <div className={styles.firstFourHeader}>
            <span className={styles.firstFourTitle}>First Four</span>
            <span className={styles.firstFourSubtitle}>Dayton, OH</span>
          </div>
          <div className={styles.firstFourGames}>
            {firstFourMatchups.map(m => (
              <Matchup key={m.id} matchup={m} compact />
            ))}
          </div>
        </div>
      )}

      {/* Main bracket - 2x3 grid */}
      <div className={styles.bracket}>
        <div className={styles.regionTopLeft}>
          <Region name="East" matchups={getRegionMatchups('East')} />
        </div>

        <div className={styles.center}>
          <FinalFour
            semifinal1={semifinal1}
            semifinal2={semifinal2}
            championship={championship}
          />
        </div>

        <div className={styles.regionTopRight}>
          <Region name="West" matchups={getRegionMatchups('West')} reversed />
        </div>

        <div className={styles.regionBottomLeft}>
          <Region name="South" matchups={getRegionMatchups('South')} />
        </div>

        <div className={styles.regionBottomRight}>
          <Region name="Midwest" matchups={getRegionMatchups('Midwest')} reversed />
        </div>
      </div>
    </div>
  );
}
