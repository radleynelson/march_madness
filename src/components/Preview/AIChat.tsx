import { useState, useCallback, useRef, useEffect } from 'react';
import type { Matchup } from '../../types/bracket';
import { useSettingsContext } from '../../hooks/useSettings';
import { useBracketContext } from '../../hooks/useBracketState';
import { sendChatMessage } from '../../ai/client';
import styles from './AIChat.module.css';

interface AIChatProps {
  matchup: Matchup;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AIChat({ matchup }: AIChatProps) {
  const { settings } = useSettingsContext();
  const { state } = useBracketContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildContext = useCallback(() => {
    const top = matchup.topTeam;
    const bottom = matchup.bottomTeam;
    if (!top || !bottom) return '';

    // Build concise context from bracket state
    const lines: string[] = [
      `Matchup: ${top.name} (${top.seed} seed, ${top.region}) vs ${bottom.name} (${bottom.seed} seed, ${bottom.region})`,
      `Round: ${matchup.round}`,
      `Model Win Probability: ${top.shortName} ${Math.round(matchup.topWinProbability * 100)}% vs ${bottom.shortName} ${Math.round(matchup.bottomWinProbability * 100)}%`,
    ];

    if (top.record) lines.push(`${top.shortName} Record: ${top.record}`);
    if (bottom.record) lines.push(`${bottom.shortName} Record: ${bottom.record}`);
    lines.push(`${top.shortName} Rating (AdjEM): ${top.rating.toFixed(1)}`);
    lines.push(`${bottom.shortName} Rating (AdjEM): ${bottom.rating.toFixed(1)}`);

    // Add team advancement probabilities
    const topProbs = top.probabilities;
    const botProbs = bottom.probabilities;
    lines.push(`${top.shortName} Championship Prob: ${(topProbs.champion * 100).toFixed(1)}%`);
    lines.push(`${bottom.shortName} Championship Prob: ${(botProbs.champion * 100).toFixed(1)}%`);

    return lines.join('\n');
  }, [matchup, state]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || loading) return;

    setInput('');
    setError(null);
    const userMsg: Message = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await sendChatMessage({
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        context: buildContext(),
        provider: settings.provider!,
        apiKey: settings.apiKey || undefined,
      });

      if (response.error) {
        setError(response.error);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: response.content }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get response');
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, settings, buildContext]);

  if (!settings.aiEnabled) return null;

  const topName = matchup.topTeam?.shortName ?? 'TBD';
  const bottomName = matchup.bottomTeam?.shortName ?? 'TBD';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          AI Analysis
          <span className={styles.headerBadge}>
            {settings.provider === 'cli' ? 'Claude Max' : 'API'}
          </span>
        </span>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            Ask Claude about this matchup. Claude can search the web for the latest news, injuries, and analysis.
            <div className={styles.suggestions}>
              <button className={styles.suggestion} onClick={() => handleSend(`Who wins ${topName} vs ${bottomName} and why?`)}>
                Who wins and why?
              </button>
              <button className={styles.suggestion} onClick={() => handleSend(`What are the key matchups to watch in ${topName} vs ${bottomName}?`)}>
                Key matchups to watch
              </button>
              <button className={styles.suggestion} onClick={() => handleSend(`Any injury updates or recent news for ${topName} and ${bottomName}?`)}>
                Injury updates
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div className={styles.loading}>
            <span className={styles.spinner} />
            Claude is thinking...
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputRow}>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={`Ask about ${topName} vs ${bottomName}...`}
          disabled={loading}
        />
        <button
          className={styles.sendBtn}
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
