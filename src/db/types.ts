export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatThread {
  id: string;
  title: string;
  matchupId: string | null;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface Simulation {
  id: string;
  name: string;
  createdAt: number;
  picks: Record<string, 'top' | 'bottom'>;
  reasoning: string;
}

export interface SettingEntry {
  key: string;
  value: any;
}
