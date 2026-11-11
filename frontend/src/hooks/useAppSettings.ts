import { useEffect, useState } from 'react';

const readBool = (key: string, fallback: boolean, urlParam?: string): boolean => {
  if (urlParam) {
    const fromUrl = new URLSearchParams(window.location.search).get(urlParam);
    if (fromUrl != null) return fromUrl === 'true';
  }
  try {
    const saved = localStorage.getItem(key);
    if (saved != null) return saved === 'true';
  } catch {}
  return fallback;
};

const save = (key: string, value: boolean) => {
  try { localStorage.setItem(key, String(value)); } catch {}
};

// Per-device toggles; auto-print, improve and landscape are mirrored in the URL for easy sharing
export const useAppSettings = () => {
  const [autoPrint, setAutoPrint] = useState(() => readBool('autoPrint', true, 'auto-print'));
  const [improveEnabled, setImproveEnabled] = useState(() => readBool('improveEnabled', false, 'improve'));
  const [landscapeMode, setLandscapeMode] = useState(() => readBool('landscapeMode', false));
  const [sfxEnabled, setSfxEnabled] = useState(() => readBool('sfxEnabled', true));

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    sp.set('auto-print', String(autoPrint));
    sp.set('improve', String(improveEnabled));
    sp.set('landscape', String(landscapeMode));
    window.history.replaceState({}, '', `${window.location.pathname}?${sp.toString()}`);
    save('autoPrint', autoPrint);
    save('improveEnabled', improveEnabled);
    save('landscapeMode', landscapeMode);
  }, [autoPrint, improveEnabled, landscapeMode]);

  useEffect(() => save('sfxEnabled', sfxEnabled), [sfxEnabled]);

  return {
    autoPrint, setAutoPrint,
    improveEnabled, setImproveEnabled,
    landscapeMode, setLandscapeMode,
    sfxEnabled, setSfxEnabled,
  };
};

export type AppSettings = ReturnType<typeof useAppSettings>;
