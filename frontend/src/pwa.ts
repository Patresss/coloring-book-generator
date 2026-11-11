import React from 'react';

// Chrome fires `beforeinstallprompt` once, early after load, so it is captured at module load
// (this file is imported from main.tsx) and kept until the user decides to install.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

let installed = isStandalone();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // we show our own button instead of Chrome's mini-infobar
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

export type InstallState = {
  canInstall: boolean; // Chrome offered installation and we can show its dialog
  installed: boolean; // running as the installed app
  secure: boolean; // installation needs HTTPS (or localhost)
  install: () => Promise<boolean>;
};

const install = async (): Promise<boolean> => {
  if (!deferredPrompt) return false;
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notify();
  await promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  return outcome === 'accepted';
};

export const usePwaInstall = (): InstallState => {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  return {
    canInstall: !!deferredPrompt && !installed,
    installed,
    secure: typeof window !== 'undefined' ? window.isSecureContext : true,
    install,
  };
};
