import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { checkAIStatus } from '../ai/client';

export interface AISettings {
  /** User-provided Anthropic API key (empty = not set) */
  apiKey: string;
  /** Whether the local Claude CLI is available */
  cliAvailable: boolean;
  /** Which provider to use */
  provider: 'cli' | 'api' | null;
  /** Whether AI features should be shown */
  aiEnabled: boolean;
}

interface SettingsContextType {
  settings: AISettings;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

const defaultSettings: AISettings = {
  apiKey: '',
  cliAvailable: false,
  provider: null,
  aiEnabled: false,
};

export const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  setApiKey: () => {},
  clearApiKey: () => {},
});

export function useSettingsContext() {
  return useContext(SettingsContext);
}

export function useSettings(): SettingsContextType {
  const [settings, setSettings] = useState<AISettings>(() => {
    // Load API key from localStorage on init
    const stored = localStorage.getItem('mm_api_key');
    return {
      ...defaultSettings,
      apiKey: stored ?? '',
    };
  });

  // Check CLI availability on mount
  useEffect(() => {
    checkAIStatus().then(status => {
      setSettings(prev => {
        const cliAvailable = status.cliAvailable;
        const hasApiKey = prev.apiKey.length > 0;
        const provider = cliAvailable ? 'cli' : hasApiKey ? 'api' : null;
        return {
          ...prev,
          cliAvailable,
          provider,
          aiEnabled: cliAvailable || hasApiKey,
        };
      });
    });
  }, []);

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem('mm_api_key', key);
    setSettings(prev => ({
      ...prev,
      apiKey: key,
      provider: prev.cliAvailable ? 'cli' : key.length > 0 ? 'api' : null,
      aiEnabled: prev.cliAvailable || key.length > 0,
    }));
  }, []);

  const clearApiKey = useCallback(() => {
    localStorage.removeItem('mm_api_key');
    setSettings(prev => ({
      ...prev,
      apiKey: '',
      provider: prev.cliAvailable ? 'cli' : null,
      aiEnabled: prev.cliAvailable,
    }));
  }, []);

  return { settings, setApiKey, clearApiKey };
}
