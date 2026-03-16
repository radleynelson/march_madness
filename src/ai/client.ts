/**
 * Frontend client for making AI requests to the local server.
 */

const API_BASE = '/api/ai';

export interface AIChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[];
  context: string;
  provider: 'cli' | 'api';
  apiKey?: string;
}

export interface AIChatResponse {
  content: string;
  error?: string;
}

export interface AIFillBracketRequest {
  bracketContext: string;
  provider: 'cli' | 'api';
  apiKey?: string;
  userPrompt?: string;
}

export interface AIFillBracketResponse {
  picks: Record<string, 'top' | 'bottom'>;
  reasoning: string;
  error?: string;
}

export interface AIStatusResponse {
  cliAvailable: boolean;
}

export async function checkAIStatus(): Promise<AIStatusResponse> {
  try {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) return { cliAvailable: false };
    return await res.json();
  } catch {
    return { cliAvailable: false };
  }
}

export async function sendChatMessage(req: AIChatRequest): Promise<AIChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    return { content: '', error: `AI request failed: ${res.status} - ${text}` };
  }

  return await res.json();
}

export async function fillBracket(req: AIFillBracketRequest): Promise<AIFillBracketResponse> {
  const res = await fetch(`${API_BASE}/fill-bracket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    return { picks: {}, reasoning: '', error: `AI request failed: ${res.status} - ${text}` };
  }

  return await res.json();
}
