import { useState, useCallback, createContext, useContext } from 'react';

interface PreviewContextType {
  previewMatchupId: string | null;
  openPreview: (matchupId: string) => void;
  closePreview: () => void;
}

export const PreviewContext = createContext<PreviewContextType>({
  previewMatchupId: null,
  openPreview: () => {},
  closePreview: () => {},
});

export function usePreviewContext() {
  return useContext(PreviewContext);
}

export function usePreviewState() {
  const [previewMatchupId, setPreviewMatchupId] = useState<string | null>(null);

  const openPreview = useCallback((matchupId: string) => {
    setPreviewMatchupId(matchupId);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewMatchupId(null);
  }, []);

  return { previewMatchupId, openPreview, closePreview };
}
