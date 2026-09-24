// Service worker registration (production builds only) plus a tiny status
// store so the UI can react to "offline ready" / "update available".

export interface PwaStatus {
  /** The app shell is precached: the installed app starts with no network. */
  offlineReady: boolean;
  /** A newer build took over; reload (applyUpdate) to run it. */
  updateAvailable: boolean;
}

let status: PwaStatus = { offlineReady: false, updateAvailable: false };
const listeners = new Set<(status: PwaStatus) => void>();

function setStatus(patch: Partial<PwaStatus>): void {
  status = { ...status, ...patch };
  for (const listener of listeners) listener(status);
}

/** Shaped for `useSyncExternalStore(pwaStatus.subscribe, pwaStatus.get)`. */
export const pwaStatus = {
  get: (): PwaStatus => status,
  subscribe(listener: (status: PwaStatus) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Reload into the new build (the new worker already controls the page). */
export function applyUpdate(): void {
  window.location.reload();
}

let toastEl: HTMLDivElement | null = null;

/** Small bottom toast; `action` adds a button. Replaces any previous toast. */
function showToast(message: string, action?: { label: string; run: () => void }): void {
  toastEl?.remove();
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.className =
    'fixed left-1/2 bottom-[calc(var(--safe-bottom)+16px)] z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg';
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.className = 'rounded-full bg-cta px-3 py-1 font-bold text-ink';
    button.addEventListener('click', action.run);
    el.append(button);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.className = 'px-1 text-lg leading-none text-white/70';
  close.addEventListener('click', () => el.remove());
  el.append(close);
  document.body.append(el);
  toastEl = el;
  if (!action) setTimeout(() => el.remove(), 4000);
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const sw = navigator.serviceWorker;
  // First install: the worker claims the page (controllerchange) but that is
  // not an update. Only a change while already controlled means a new build.
  let controlled = sw.controller !== null;
  sw.addEventListener('controllerchange', () => {
    if (controlled) {
      setStatus({ updateAvailable: true });
      showToast('A new version is ready', { label: 'Reload', run: applyUpdate });
    }
    controlled = true;
  });

  const firstInstall = !controlled;
  // `ready` resolves once a worker is active, i.e. after its install step
  // finished precaching every asset.
  void sw.ready.then(() => {
    setStatus({ offlineReady: true });
    if (firstInstall) showToast('Ready to play offline');
  });

  const register = (): void => {
    sw.register(`${import.meta.env.BASE_URL}sw.js`).then(
      (registration) => {
        // Long hosting sessions: look for a new build whenever the app returns to the foreground.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {});
        });
      },
      (err: unknown) => console.warn('service worker registration failed', err),
    );
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register);
  }
}
