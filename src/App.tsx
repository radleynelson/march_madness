import { useBracketState, BracketContext } from './hooks/useBracketState';
import { useTeamRatings } from './hooks/useTeamRatings';
import { useLiveScores } from './hooks/useLiveScores';
import { useHoverState, HoverContext } from './hooks/useHoverState';
import { usePreviewState, PreviewContext } from './hooks/usePreview';
import { Header } from './components/Header/Header';
import { Bracket } from './components/Bracket/Bracket';
import { MatchupPreview } from './components/Preview/MatchupPreview';
import './styles/globals.css';

function AppContent() {
  const { state, dispatch, userAdvance, clearUserPicks } = useBracketState();

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
    <BracketContext.Provider value={{ state, dispatch }}>
      <HoverContext.Provider value={hoverState}>
        <PreviewContext.Provider value={previewState}>
          <div>
            <Header
              state={state}
              hasUserPicks={state.userPicks.size > 0}
              onClearPicks={clearUserPicks}
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
          </div>
        </PreviewContext.Provider>
      </HoverContext.Provider>
    </BracketContext.Provider>
  );
}

export default function App() {
  return <AppContent />;
}
