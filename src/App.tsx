import { useState, useEffect, useCallback } from 'react';
import { useBracketState, BracketContext } from './hooks/useBracketState';
import { useTeamRatings } from './hooks/useTeamRatings';
import { useLiveScores } from './hooks/useLiveScores';
import { useHoverState, HoverContext } from './hooks/useHoverState';
import { usePreviewState, PreviewContext } from './hooks/usePreview';
import { useSettings, SettingsContext } from './hooks/useSettings';
import { useKalshiMarkets, KalshiContext } from './hooks/useKalshiMarkets';
import { Header } from './components/Header/Header';
import { Bracket } from './components/Bracket/Bracket';
import { MobileBracket } from './components/MobileBracket/MobileBracket';
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

  // View state synced with URL hash
  type View = 'bracket' | 'table' | 'scores';
  const VALID_VIEWS = new Set<View>(['bracket', 'table', 'scores']);

  /** Parse a `#game/{eventId}` hash and return the eventId, or null */
  const getGameEventIdFromHash = (): string | null => {
    const hash = window.location.hash.replace('#', '');
    const match = hash.match(/^game\/(.+)$/);
    return match ? match[1] : null;
  };

  /** Parse a `#preview/{matchupId}` hash and return the matchupId, or null */
  const getPreviewMatchupIdFromHash = (): string | null => {
    const hash = window.location.hash.replace('#', '');
    const match = hash.match(/^preview\/(.+)$/);
    return match ? match[1] : null;
  };

  const getViewFromHash = (): View => {
    const hash = window.location.hash.replace('#', '') as View;
    if (VALID_VIEWS.has(hash)) return hash;
    return window.innerWidth < 1024 ? 'table' : 'bracket';
  };

  const [view, setViewState] = useState<View>(getViewFromHash);
  const [gameEventId, setGameEventId] = useState<string | null>(getGameEventIdFromHash);
  const [previewMatchupId, setPreviewMatchupId] = useState<string | null>(getPreviewMatchupIdFromHash);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  const setView = useCallback((v: View) => {
    setViewState(v);
    window.location.hash = v;
  }, []);

  // Sync on back/forward navigation
  useEffect(() => {
    const onHashChange = () => {
      const eventId = getGameEventIdFromHash();
      const prevId = getPreviewMatchupIdFromHash();
      setGameEventId(eventId);
      setPreviewMatchupId(prevId);
      if (!eventId && !prevId) {
        setViewState(getViewFromHash());
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Track mobile breakpoint
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load Torvik ratings on mount
  const { error: ratingsError } = useTeamRatings({ state, dispatch });

  // Poll ESPN for live scores
  useLiveScores({ state, dispatch, enabled: true });

  // Hover state for team path highlighting
  const hoverState = useHoverState(state);

  // Kalshi prediction markets
  const kalshiState = useKalshiMarkets(state);

  // Preview modal state
  const previewState = usePreviewState();
  const previewMatchup = previewState.previewMatchupId
    ? state.matchups.get(previewState.previewMatchupId) ?? null
    : null;

  // Find matchup for the full-page game route (mobile #game/{eventId})
  const fullPageGameMatchup = gameEventId
    ? (() => {
        for (const m of state.matchups.values()) {
          if (m.espnEventId === gameEventId) return m;
        }
        return null;
      })()
    : null;

  // Find matchup for the full-page preview route (mobile #preview/{matchupId})
  const fullPagePreviewMatchup = previewMatchupId
    ? state.matchups.get(previewMatchupId) ?? null
    : null;

  const closeFullPage = useCallback(() => {
    window.history.back();
  }, []);

  // If a full-page preview route is active on mobile, render only the preview
  if (previewMatchupId && fullPagePreviewMatchup) {
    return (
      <SettingsContext.Provider value={settingsState}>
        <BracketContext.Provider value={{ state, dispatch }}>
          <KalshiContext.Provider value={kalshiState}>
            <HoverContext.Provider value={hoverState}>
              <PreviewContext.Provider value={previewState}>
                <MatchupPreview
                  matchup={fullPagePreviewMatchup}
                  onClose={closeFullPage}
                  fullPage
                />
              </PreviewContext.Provider>
            </HoverContext.Provider>
          </KalshiContext.Provider>
        </BracketContext.Provider>
      </SettingsContext.Provider>
    );
  }

  // If a full-page game route is active on mobile, render only the game view
  if (gameEventId && fullPageGameMatchup) {
    return (
      <SettingsContext.Provider value={settingsState}>
        <BracketContext.Provider value={{ state, dispatch }}>
          <KalshiContext.Provider value={kalshiState}>
            <HoverContext.Provider value={hoverState}>
              <PreviewContext.Provider value={previewState}>
                <LiveGameModal
                  matchup={fullPageGameMatchup}
                  onClose={closeFullPage}
                  fullPage
                />
              </PreviewContext.Provider>
            </HoverContext.Provider>
          </KalshiContext.Provider>
        </BracketContext.Provider>
      </SettingsContext.Provider>
    );
  }

  return (
    <SettingsContext.Provider value={settingsState}>
      <BracketContext.Provider value={{ state, dispatch }}>
        <KalshiContext.Provider value={kalshiState}>
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
                isMobile
                  ? <MobileBracket state={state} />
                  : <Bracket state={state} onUserAdvance={userAdvance} />
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
        </KalshiContext.Provider>
      </BracketContext.Provider>
    </SettingsContext.Provider>
  );
}

export default function App() {
  return <AppContent />;
}
