import { useState, useEffect } from 'react';
import { useBracketState, BracketContext } from './hooks/useBracketState';
import { useTeamRatings } from './hooks/useTeamRatings';
import { useLiveScores } from './hooks/useLiveScores';
import { useHoverState, HoverContext } from './hooks/useHoverState';
import { usePreviewState, PreviewContext } from './hooks/usePreview';
import { useSettings, SettingsContext } from './hooks/useSettings';
import { Header } from './components/Header/Header';
import { Bracket } from './components/Bracket/Bracket';
import { TableView } from './components/Table/TableView';
import { GamesCarousel } from './components/Table/GamesCarousel';
import { MatchupPreview } from './components/Preview/MatchupPreview';
import { Settings } from './components/Settings/Settings';
import { BracketFill } from './components/AI/BracketFill';
import './styles/globals.css';

function AppContent() {
  const { state, dispatch, userAdvance, clearUserPicks } = useBracketState();
  const settingsState = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showBracketFill, setShowBracketFill] = useState(false);
  const [view, setView] = useState<'bracket' | 'table'>(() =>
    window.innerWidth < 1024 ? 'table' : 'bracket'
  );
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1024);

  // Force table view on small screens
  useEffect(() => {
    const handleResize = () => {
      const small = window.innerWidth < 1024;
      setIsSmallScreen(small);
      if (small) setView('table');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load Torvik ratings on mount
  const { error: ratingsError } = useTeamRatings({ state, dispatch });

  // Poll ESPN for live scores
  useLiveScores({ state, dispatch, enabled: true });

  // Hover state for team path highlighting
  const hoverState = useHoverState(state);

  // Preview modal state
  const previewState = usePreviewState();
  const previewMatchup = previewState.previewMatchupId
    ? state.matchups.get(previewState.previewMatchupId) ?? null
    : null;

  return (
    <SettingsContext.Provider value={settingsState}>
      <BracketContext.Provider value={{ state, dispatch }}>
        <HoverContext.Provider value={hoverState}>
          <PreviewContext.Provider value={previewState}>
            <div>
              <Header
                state={state}
                hasUserPicks={state.userPicks.size > 0}
                onClearPicks={clearUserPicks}
                onOpenSettings={() => setShowSettings(true)}
                onOpenBracketFill={() => setShowBracketFill(true)}
                aiEnabled={settingsState.settings.aiEnabled}
                view={view}
                onSetView={isSmallScreen ? undefined : setView}
              />
              {ratingsError && (
                <div style={{
                  textAlign: 'center',
                  padding: '8px',
                  fontSize: '12px',
                  color: '#888',
                  background: '#fff8e1',
                }}>
                  {ratingsError}
                </div>
              )}
              {view === 'bracket' ? (
                <Bracket state={state} onUserAdvance={userAdvance} />
              ) : (
                <>
                  <GamesCarousel state={state} />
                  <TableView state={state} />
                </>
              )}
              {previewMatchup && (
                <MatchupPreview
                  matchup={previewMatchup}
                  onClose={previewState.closePreview}
                />
              )}
              {showSettings && (
                <Settings onClose={() => setShowSettings(false)} />
              )}
              {showBracketFill && (
                <BracketFill onClose={() => setShowBracketFill(false)} />
              )}
            </div>
          </PreviewContext.Provider>
        </HoverContext.Provider>
      </BracketContext.Provider>
    </SettingsContext.Provider>
  );
}

export default function App() {
  return <AppContent />;
}
