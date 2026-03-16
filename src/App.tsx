import { useState } from 'react';
import { useBracketState, BracketContext } from './hooks/useBracketState';
import { useTeamRatings } from './hooks/useTeamRatings';
import { useLiveScores } from './hooks/useLiveScores';
import { useHoverState, HoverContext } from './hooks/useHoverState';
import { usePreviewState, PreviewContext } from './hooks/usePreview';
import { useSettings, SettingsContext } from './hooks/useSettings';
import { Header } from './components/Header/Header';
import { Bracket } from './components/Bracket/Bracket';
import { MatchupPreview } from './components/Preview/MatchupPreview';
import { Settings } from './components/Settings/Settings';
import { BracketFill } from './components/AI/BracketFill';
import './styles/globals.css';

function AppContent() {
  const { state, dispatch, userAdvance, clearUserPicks } = useBracketState();
  const settingsState = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showBracketFill, setShowBracketFill] = useState(false);

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
              <Bracket state={state} onUserAdvance={userAdvance} />
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
