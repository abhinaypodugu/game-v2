// Home: create a room, quick-play vs bots, or join with a code — plus the
// offline mode (one phone hosts, others pair over Wi-Fi/hotspot via QR).

import { useState } from 'react';
import { useStore } from '../store';
import { getCustomServerUrl, switchServerUrl } from '../socket';
import { GuestPairingSheet } from '../components/OfflinePairing';

const inputClass =
  'h-12 rounded-2xl border-2 border-line bg-white px-4 text-lg font-bold text-ink outline-none placeholder:font-normal placeholder:text-ink-soft focus:border-cta';

export function HomePage(): React.JSX.Element {
  const connected = useStore((s) => s.connected);
  const createRoom = useStore((s) => s.createRoom);
  const joinRoom = useStore((s) => s.joinRoom);
  const startQuickPlay = useStore((s) => s.startQuickPlay);
  const startOfflineHost = useStore((s) => s.startOfflineHost);
  const resumeOfflineHost = useStore((s) => s.resumeOfflineHost);
  const [canResume] = useState(() => useStore.getState().canResumeOfflineHost());
  const [name, setName] = useState('');
  const [code, setCode] = useState(() => {
    const hash = window.location.hash;
    const match = hash.match(/[#/=]([A-Za-z]{4})(?:[/?#]|$)/);
    return match && match[1] ? match[1].toUpperCase() : '';
  });
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState<'host' | 'resume' | null>(null);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [guestPairing, setGuestPairing] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const trimmedName = name.trim();

  const runOffline = (kind: 'host' | 'resume', start: () => Promise<void>): void => {
    setOfflineBusy(kind);
    setOfflineError(null);
    start().then(
      () => setOfflineBusy(null),
      (err: unknown) => {
        setOfflineBusy(null);
        setOfflineError(err instanceof Error ? err.message : 'Could not start the offline game.');
      },
    );
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-ocean px-4 pt-[max(1.5rem,var(--safe-top))] pb-[max(1.5rem,var(--safe-bottom))] text-ink">
      <div className="text-center">
        <div className="mx-auto mb-2 flex justify-center gap-1" aria-hidden="true">
          {['#2f8a3a', '#e8b31c', '#cf5b2e', '#8cc63f', '#7b8794'].map((c) => (
            <svg key={c} viewBox="0 0 24 26" className="h-8 w-8 drop-shadow-[0_2px_0_rgba(0,0,0,0.2)]">
              <path d="M12 1 L23 7 V19 L12 25 L1 19 V7 Z" fill={c} stroke="#1f2a37" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          ))}
        </div>
        <h1 className="font-display text-6xl font-bold tracking-tight text-white drop-shadow-[0_3px_0_rgba(31,42,55,0.45)]">
          Catan
        </h1>
        <p className="mt-1 text-base font-bold text-white/90">Settle, trade and build with friends — right in your browser.</p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3 rounded-3xl border-2 border-line bg-cream p-4 shadow-[0_4px_0_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex items-center justify-between text-xs font-bold text-ink-soft">
          <span>Mode:</span>
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Online server connected
              </span>
            ) : (
              <span
                className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-amber-800"
                title="Running in browser without a central server"
              >
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Standalone / Offline
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowServerModal(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-white text-xs hover:border-cta transition active:scale-95"
              title="Online Server Settings"
              aria-label="Online Server Settings"
              data-testid="server-settings-btn"
            >
              ⚙️
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink-soft">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="e.g. Alice"
            autoComplete="nickname"
            className={inputClass}
            data-testid="name-input"
          />
        </label>

        <button
          type="button"
          disabled={quickBusy || offlineBusy !== null || creating}
          onClick={async () => {
            setQuickBusy(true);
            try {
              await startQuickPlay(name.trim() || 'Player');
            } finally {
              setQuickBusy(false);
            }
          }}
          className="h-14 rounded-2xl bg-go px-4 font-display text-lg font-bold text-white shadow-[0_4px_0_#1d7a2c] active:translate-y-px disabled:opacity-50"
          data-testid="quick-play"
        >
          {quickBusy ? 'Starting game…' : '🤖 Quick play vs bots'}
        </button>
        <button
          type="button"
          disabled={trimmedName.length === 0 || creating || quickBusy || offlineBusy !== null}
          onClick={async () => {
            setCreating(true);
            try {
              await createRoom(trimmedName);
            } finally {
              setCreating(false);
            }
          }}
          className="h-14 rounded-2xl bg-cta px-4 font-display text-lg font-bold text-ink shadow-[0_4px_0_#a86d08] active:translate-y-px disabled:opacity-50"
          data-testid="create-room"
        >
          {creating ? 'Creating room…' : 'Create room'}
        </button>

        <div className="flex items-center gap-3 text-sm font-bold text-ink-soft">
          <span className="h-0.5 flex-1 rounded bg-line" />
          or join friends
          <span className="h-0.5 flex-1 rounded bg-line" />
        </div>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="CODE"
            autoCapitalize="characters"
            className={`${inputClass} w-28 text-center tracking-widest`}
            data-testid="join-code-input"
          />
          <button
            type="button"
            disabled={code.length !== 4 || trimmedName.length === 0 || joining}
            onClick={async () => {
              setJoining(true);
              try {
                await joinRoom(code, trimmedName);
              } finally {
                setJoining(false);
              }
            }}
            className="h-12 flex-1 rounded-2xl bg-ocean-deep px-4 font-display text-lg font-bold text-white shadow-[0_4px_0_#1f6f99] active:translate-y-px disabled:opacity-50"
            data-testid="join-room"
          >
            {joining ? 'Joining…' : 'Join room'}
          </button>
        </div>
      </div>

      <section
        className="flex w-full max-w-md flex-col gap-3 rounded-3xl border-2 border-line bg-cream p-4 shadow-[0_4px_0_rgba(0,0,0,0.18)] sm:p-6"
        aria-labelledby="offline-heading"
        data-testid="offline-section"
      >
        <div>
          <h2 id="offline-heading" className="font-display text-xl font-bold">
            📡 Play offline / peer-to-peer
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            One phone taps <b>Host a game</b>. Other players can join instantly by entering the 4-letter room code above or scanning the host's QR code once (0 return scans!). Pure offline 2-way scan is available if you have zero signal.
          </p>
        </div>
        {canResume ? (
          <button
            type="button"
            disabled={offlineBusy !== null}
            onClick={() => runOffline('resume', resumeOfflineHost)}
            className="h-14 rounded-2xl bg-go px-4 font-display text-lg font-bold text-white shadow-[0_4px_0_#1d7a2c] active:translate-y-px disabled:opacity-50"
            data-testid="offline-resume"
          >
            {offlineBusy === 'resume' ? 'Resuming…' : '↩ Resume hosted game'}
          </button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={trimmedName.length === 0 || offlineBusy !== null}
            onClick={() => runOffline('host', () => startOfflineHost(trimmedName))}
            className="flex min-h-16 flex-col items-center justify-center rounded-2xl bg-cta px-3 py-2 font-display text-lg leading-tight font-bold text-ink shadow-[0_4px_0_#a86d08] active:translate-y-px disabled:opacity-50"
            data-testid="offline-host"
          >
            <span aria-hidden="true">👑</span>
            {offlineBusy === 'host' ? 'Starting…' : 'Host a game'}
          </button>
          <button
            type="button"
            disabled={trimmedName.length === 0 || offlineBusy !== null}
            onClick={() => setGuestPairing(true)}
            className="flex min-h-16 flex-col items-center justify-center rounded-2xl bg-ocean-deep px-3 py-2 font-display text-lg leading-tight font-bold text-white shadow-[0_4px_0_#1f6f99] active:translate-y-px disabled:opacity-50"
            data-testid="offline-join"
          >
            <span aria-hidden="true">📷</span>
            Join a game
          </button>
        </div>
        {trimmedName.length === 0 ? (
          <p className="text-center text-xs font-bold text-ink-soft">Enter your name above to host or join.</p>
        ) : null}
        {offlineError !== null ? (
          <p className="rounded-xl bg-[#fdecee] px-3 py-2 text-sm font-bold text-[#8a1424]" role="alert">
            {offlineError}
          </p>
        ) : null}
      </section>

      {guestPairing ? (
        <GuestPairingSheet
          name={trimmedName}
          leaveOnCancel
          onClose={() => {
            setGuestPairing(false);
          }}
        />
      ) : null}

      {showServerModal ? <ServerSettingsModal onClose={() => setShowServerModal(false)} /> : null}
    </div>
  );
}

function ServerSettingsModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const current = getCustomServerUrl() ?? '';
  const [url, setUrl] = useState(current);
  const connected = useStore((s) => s.connected);

  const save = (newUrl: string | null): void => {
    const trimmed = newUrl ? newUrl.trim() : null;
    switchServerUrl(trimmed || null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-label="Online Server Settings"
      data-testid="server-settings-modal"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border-2 border-line bg-cream p-5 shadow-2xl text-ink">
        <div className="flex items-center justify-between border-b-2 border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌐</span>
            <h3 className="font-display text-xl font-bold">Online Server Settings</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-parchment font-bold text-ink active:scale-95"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-ink-soft font-bold leading-relaxed">
          To play with friends anywhere across the internet using 4-letter room codes, connect to a hosted Catan Socket.IO server (e.g. deployed on Render, Railway, or Fly.io).
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink-soft">Server URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. https://my-catan-server.onrender.com"
            className="h-12 rounded-xl border-2 border-line bg-white px-3 font-mono text-sm text-ink outline-none focus:border-cta"
            data-testid="server-url-input"
          />
        </label>

        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-ink-soft">Current connection:</span>
          {connected ? (
            <span className="text-emerald-700 font-bold">● Connected</span>
          ) : (
            <span className="text-amber-800 font-bold">● Disconnected / Standalone</span>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          {current ? (
            <button
              type="button"
              onClick={() => save(null)}
              className="h-12 flex-1 rounded-xl bg-parchment px-3 font-bold text-xs text-ink active:scale-95"
              data-testid="reset-server-url"
            >
              Reset to Default
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => save(url)}
            className="h-12 flex-1 rounded-xl bg-go px-4 font-display text-base font-bold text-white shadow-[0_3px_0_#1d7a2c] active:translate-y-px"
            data-testid="save-server-url"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
}
