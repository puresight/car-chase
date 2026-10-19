export interface InstallPromptState {
  isAvailable: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;

const listeners = new Set<(state: InstallPromptState) => void>();

function notify(): void {
  const state = getState();
  listeners.forEach((fn) => fn(state));
}

export function getState(): InstallPromptState {
  return {
    isAvailable: deferredPrompt !== null,
    isInstalled: installed,
    promptInstall: async () => {
      if (!deferredPrompt) return 'unavailable';
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      notify();
      return choice.outcome;
    },
  };
}

export function onInstallStateChange(fn: (state: InstallPromptState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  if (window.matchMedia('(display-mode: standalone)').matches) {
    installed = true;
  } else if ('getInstalledRelatedApps' in navigator) {
    (navigator as Navigator & { getInstalledRelatedApps: () => Promise<Array<unknown>> })
      .getInstalledRelatedApps()
      .then((apps) => {
        if (apps.length > 0) {
          installed = true;
          notify();
        }
      })
      .catch(() => {
        /* detection is best-effort only */
      });
  }

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}
