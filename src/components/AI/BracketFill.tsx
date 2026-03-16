import { useState, useEffect, useCallback } from 'react';
import { useSettingsContext } from '../../hooks/useSettings';
import { useBracketContext } from '../../hooks/useBracketState';
import { fillBracket } from '../../ai/client';
import { initDB, saveSimulation, listSimulations, deleteSimulation } from '../../db';
import type { Simulation } from '../../db/types';
import styles from './BracketFill.module.css';

interface BracketFillProps {
  onClose: () => void;
}

export function BracketFill({ onClose }: BracketFillProps) {
  const { settings } = useSettingsContext();
  const { state, dispatch } = useBracketContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ picks: Record<string, 'top' | 'bottom'>; reasoning: string } | null>(null);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');

  // Load simulation history
  useEffect(() => {
    initDB().then(() => listSimulations()).then(setSimulations).catch(() => {});
  }, []);

  const buildBracketContext = useCallback(() => {
    const lines: string[] = ['FULL BRACKET STATE:\n'];

    const regions = ['East', 'South', 'West', 'Midwest'] as const;
    for (const region of regions) {
      lines.push(`--- ${region.toUpperCase()} REGION ---`);
      const ids = state.regionMatchupIds[region] ?? [];
      for (const id of ids) {
        const m = state.matchups.get(id);
        if (!m) continue;
        const top = m.topTeam;
        const bottom = m.bottomTeam;
        const topName = top ? `(${top.seed}) ${top.shortName}` : 'TBD';
        const botName = bottom ? `(${bottom.seed}) ${bottom.shortName}` : 'TBD';
        const status = m.winner ? `Winner: ${m.winner === 'top' ? topName : botName}` : `${m.round}`;
        lines.push(`  ${id}: ${topName} vs ${botName} [${status}]`);
        if (top && bottom && !m.winner) {
          lines.push(`    Model: ${top.shortName} ${Math.round(m.topWinProbability * 100)}% | ${bottom.shortName} ${Math.round(m.bottomWinProbability * 100)}%`);
          lines.push(`    Ratings: ${top.shortName} ${top.rating.toFixed(1)} | ${bottom.shortName} ${bottom.rating.toFixed(1)}`);
        }
      }
      lines.push('');
    }

    // Final Four + Championship
    lines.push('--- FINAL FOUR ---');
    for (const id of state.finalFourMatchupIds) {
      const m = state.matchups.get(id);
      if (!m) continue;
      const topName = m.topTeam ? `${m.topTeam.shortName}` : 'TBD';
      const botName = m.bottomTeam ? `${m.bottomTeam.shortName}` : 'TBD';
      lines.push(`  ${id}: ${topName} vs ${botName}`);
    }
    const champ = state.matchups.get(state.championshipMatchupId);
    if (champ) {
      const topName = champ.topTeam ? champ.topTeam.shortName : 'TBD';
      const botName = champ.bottomTeam ? champ.bottomTeam.shortName : 'TBD';
      lines.push(`  CHAMP: ${topName} vs ${botName}`);
    }

    // List all matchup IDs for reference
    lines.push('\nMATCHUP IDS (for picks JSON):');
    for (const [id, m] of state.matchups) {
      if (m.winner) continue; // Already decided
      const top = m.topTeam ? `(${m.topTeam.seed}) ${m.topTeam.shortName}` : 'TBD';
      const bot = m.bottomTeam ? `(${m.bottomTeam.seed}) ${m.bottomTeam.shortName}` : 'TBD';
      lines.push(`  ${id}: top=${top}, bottom=${bot}`);
    }

    return lines.join('\n');
  }, [state]);

  const handleFill = useCallback(async () => {
    if (loading || !settings.provider) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fillBracket({
        bracketContext: buildBracketContext(),
        provider: settings.provider,
        apiKey: settings.apiKey || undefined,
        userPrompt: customPrompt.trim() || undefined,
      });

      if (response.error) {
        setError(response.error);
      } else {
        setResult({ picks: response.picks, reasoning: response.reasoning });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fill bracket');
    } finally {
      setLoading(false);
    }
  }, [loading, settings, buildBracketContext]);

  const handleApply = useCallback(() => {
    if (!result) return;
    // Apply all picks atomically in a single reducer call
    dispatch({ type: 'APPLY_SIMULATION', picks: result.picks });
    onClose();
  }, [result, dispatch, onClose]);

  const handleSave = useCallback(async () => {
    if (!result) return;
    const sim: Simulation = {
      id: `sim_${Date.now()}`,
      name: `AI Bracket ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      createdAt: Date.now(),
      picks: result.picks,
      reasoning: result.reasoning,
    };
    await saveSimulation(sim);
    setSimulations(prev => [sim, ...prev]);
  }, [result]);

  const handleLoadSimulation = useCallback((sim: Simulation) => {
    setResult({ picks: sim.picks, reasoning: sim.reasoning || 'No reasoning saved for this simulation.' });
  }, []);

  const handleDeleteSimulation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSimulation(id);
    setSimulations(prev => prev.filter(s => s.id !== id));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>
            AI Bracket Fill
          </span>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.body}>
          <div className={styles.description}>
            Let Claude analyze the entire bracket using team ratings, historical data, and
            the latest news via web search. Claude will pick winners for every remaining game
            and explain the reasoning.
          </div>

          {!loading && !result && (
            <>
              <textarea
                className={styles.promptInput}
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Optional: Give Claude specific instructions... e.g., &quot;I think Duke is overrated, favor upsets in the East region&quot; or &quot;Pick heavy favorites, minimize risk&quot; or &quot;I have a gut feeling about Akron making the Sweet 16&quot;"
                rows={3}
              />
              <button className={styles.fillBtn} onClick={handleFill} disabled={!settings.provider}>
                Fill My Bracket with AI
                <span style={{ fontSize: '10px', opacity: 0.8 }}>
                  ({settings.provider === 'cli' ? 'Claude Max' : 'API'})
                </span>
              </button>
            </>
          )}

          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <div className={styles.loadingText}>Claude is analyzing the bracket...</div>
              <div className={styles.loadingSub}>
                This may take 30-60 seconds. Claude is searching the web for the latest
                news, injuries, and analysis.
              </div>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          {result && (
            <div className={styles.result}>
              <div className={styles.resultHeader}>Claude's Analysis</div>
              <div className={styles.reasoning}>{result.reasoning}</div>

              <div className={styles.resultHeader}>
                {Object.keys(result.picks).length} picks ready
                {' \u2014 '}
                {(() => {
                  const counts: Record<string, number> = {};
                  for (const id of Object.keys(result.picks)) {
                    const round = id.includes('FF-PLAY') ? 'First Four' :
                      id.includes('R64') ? 'R64' : id.includes('R32') ? 'R32' :
                      id.includes('S16') ? 'Sweet 16' : id.includes('E8') ? 'Elite 8' :
                      id.includes('FF-') ? 'Final Four' : id === 'CHAMP' ? 'Championship' : 'Other';
                    counts[round] = (counts[round] ?? 0) + 1;
                  }
                  return Object.entries(counts).map(([r, c]) => `${c} ${r}`).join(', ');
                })()}
              </div>

              <div className={styles.actions}>
                <button className={styles.applyBtn} onClick={handleApply}>
                  Apply to Bracket
                </button>
                <button className={styles.saveBtn} onClick={handleSave}>
                  Save Simulation
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Simulation History */}
        <div className={styles.historySection}>
          <div className={styles.historyTitle}>Saved Simulations</div>
          {simulations.length === 0 ? (
            <div className={styles.emptyHistory}>No saved simulations yet</div>
          ) : (
            <div className={styles.historyList}>
              {simulations.map(sim => (
                <div key={sim.id} className={styles.historyItem} onClick={() => handleLoadSimulation(sim)}>
                  <span className={styles.historyName}>{sim.name}</span>
                  <span className={styles.historyDate}>
                    {new Date(sim.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    className={styles.historyDelete}
                    onClick={(e) => handleDeleteSimulation(sim.id, e)}
                    title="Delete"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
