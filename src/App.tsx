import { useState } from 'react';
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
import { LiveGameModal } from './components/LiveGame/LiveGameModal';
import { Scoreboard } from './components/Scoreboard/Scoreboard';
import { Settings } from './components/Settings/Settings';
import { BracketFill } from './components/AI/BracketFill';
import './styles/globals.css';

function AppContent() {
  const { state, dispatch, userAdvance, clearUserPicks } = useBracketState();
  const settingsState = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showBracketFill, setShowBracketFill] = useState(false);
  // Default to table on small screens, but allow switching to bracket (tabbed)
  const [view, setView] = useState<'bracket' | 'table' | 'scores'>(() =>
    window.innerWidth < 1024 ? 'table' : 'bracket'
  );

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
                onSetView={setView}
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
              ) : view === 'scores' ? (
                <Scoreboard state={state} />
              ) : (
                <>
                  <GamesCarousel state={state} />
                  <TableView state={state} />
                </>
              )}
              {previewMatchup && (previewMatchup.status === 'in_progress' || previewMatchup.status === 'final') && previewMatchup.espnEventId ? (
                <LiveGameModal
                  matchup={previewMatchup}
                  onClose={previewState.closePreview}
                />
              ) : previewMatchup ? (
                <MatchupPreview
                  matchup={previewMatchup}
                  onClose={previewState.closePreview}
                />
              ) : null}
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
