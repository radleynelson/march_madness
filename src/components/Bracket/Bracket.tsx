import { useState, useEffect } from 'react';
import type { BracketState, RegionName, Matchup as MatchupType } from '../../types/bracket';
import { Region } from './Region';
import { FinalFour } from './FinalFour';
import { Matchup } from '../Matchup/Matchup';
import { REGION_COLORS } from '../../data/constants';
import styles from './Bracket.module.css';

type BracketTab = RegionName | 'Final Four';

const TABS: { key: BracketTab; label: string }[] = [
  { key: 'East', label: 'East' },
  { key: 'South', label: 'South' },
  { key: 'West', label: 'West' },
  { key: 'Midwest', label: 'Midwest' },
  { key: 'Final Four', label: 'Final Four' },
];

const TAB_COLORS: Record<BracketTab, string> = {
  ...REGION_COLORS,
  'Final Four': '#333333',
};

interface BracketProps {
  state: BracketState;
  onUserAdvance?: (matchupId: string, winner: 'top' | 'bottom') => void;
}

export function Bracket({ state, onUserAdvance }: BracketProps) {
  const { matchups, regionMatchupIds, finalFourMatchupIds, championshipMatchupId, firstFourMatchupIds } = state;
  const [activeTab, setActiveTab] = useState<BracketTab>('East');
  const [isMedium, setIsMedium] = useState(false);

  // Use tabbed layout when screen is too narrow for the full grid
  useEffect(() => {
    const check = () => {
      setIsMedium(window.innerWidth < 1400);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  // First Four section (shared between both layouts)
  const firstFourSection = firstFourMatchups.length > 0 && (
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
  );

  // ── TABBED LAYOUT (medium screens 1024–1400px) ──
  if (isMedium) {
    return (
      <div className={styles.wrapper}>
        {firstFourSection}

        {/* Tab bar */}
        <div className={styles.tabBar}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              style={activeTab === tab.key ? {
                borderBottomColor: TAB_COLORS[tab.key],
                color: TAB_COLORS[tab.key],
              } : undefined}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={styles.tabContent}>
          {activeTab === 'Final Four' ? (
            <div className={styles.tabFinalFour}>
              <FinalFour
                semifinal1={semifinal1}
                semifinal2={semifinal2}
                championship={championship}
              />
            </div>
          ) : (
            <Region
              name={activeTab}
              matchups={getRegionMatchups(activeTab)}
            />
          )}
        </div>
      </div>
    );
  }

  // ── FULL GRID LAYOUT (large screens >1400px) ──
  return (
    <div className={styles.wrapper}>
      {firstFourSection}

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
