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
  /** Kalshi API key ID */
  kalshiKeyId: string;
  /** Kalshi RSA private key (PEM format) */
  kalshiPrivateKey: string;
}

interface SettingsContextType {
  settings: AISettings;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setKalshiCredentials: (keyId: string, privateKey: string) => void;
  clearKalshiCredentials: () => void;
}

const defaultSettings: AISettings = {
  apiKey: '',
  cliAvailable: false,
  provider: null,
  aiEnabled: false,
  kalshiKeyId: '',
  kalshiPrivateKey: '',
};

export const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  setApiKey: () => {},
  clearApiKey: () => {},
  setKalshiCredentials: () => {},
  clearKalshiCredentials: () => {},
});

export function useSettingsContext() {
  return useContext(SettingsContext);
}

export function useSettings(): SettingsContextType {
  const [settings, setSettings] = useState<AISettings>(() => {
    // Load API key from localStorage on init
    const stored = localStorage.getItem('mm_api_key');
    const kalshiKeyId = localStorage.getItem('mm_kalshi_key_id') ?? '';
    const kalshiPrivateKey = localStorage.getItem('mm_kalshi_private_key') ?? '';
    return {
      ...defaultSettings,
      apiKey: stored ?? '',
      kalshiKeyId,
      kalshiPrivateKey,
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

  const setKalshiCredentials = useCallback((keyId: string, privateKey: string) => {
    localStorage.setItem('mm_kalshi_key_id', keyId);
    localStorage.setItem('mm_kalshi_private_key', privateKey);
    setSettings(prev => ({
      ...prev,
      kalshiKeyId: keyId,
      kalshiPrivateKey: privateKey,
    }));
  }, []);

  const clearKalshiCredentials = useCallback(() => {
    localStorage.removeItem('mm_kalshi_key_id');
    localStorage.removeItem('mm_kalshi_private_key');
    setSettings(prev => ({
      ...prev,
      kalshiKeyId: '',
      kalshiPrivateKey: '',
    }));
  }, []);

  return { settings, setApiKey, clearApiKey, setKalshiCredentials, clearKalshiCredentials };
}
