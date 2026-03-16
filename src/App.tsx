import { useBracketState, BracketContext } from './hooks/useBracketState';
import { useTeamRatings } from './hooks/useTeamRatings';
import { useLiveScores } from './hooks/useLiveScores';
import { useHoverState, HoverContext } from './hooks/useHoverState';
import { Header } from './components/Header/Header';
import { Bracket } from './components/Bracket/Bracket';
import './styles/globals.css';

function AppContent() {
  const { state, dispatch } = useBracketState();

  // Load Torvik ratings on mount
  const { error: ratingsError } = useTeamRatings({ state, dispatch });

  // Poll ESPN for live scores
  useLiveScores({ state, dispatch, enabled: true });

  // Hover state for team path highlighting
  const hoverState = useHoverState(state);

  return (
    <BracketContext.Provider value={{ state, dispatch }}>
      <HoverContext.Provider value={hoverState}>
        <div>
          <Header state={state} />
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
          <Bracket state={state} />
        </div>
      </HoverContext.Provider>
    </BracketContext.Provider>
  );
}

export default function App() {
  return <AppContent />;
}
