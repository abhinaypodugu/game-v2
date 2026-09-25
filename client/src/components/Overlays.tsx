// Reconnect / host-lost banner, offline hosting banner, toast stack and
// turn-timer countdown pill.

import { useEffect, useState } from 'react';
import { sounds } from '../sound';
import { useStore } from '../store';
import { GuestPairingSheet, HostPairingSheet } from './OfflinePairing';

export function ReconnectBanner(): React.JSX.Element | null {
  const connected = useStore((s) => s.connected);
  const session = useStore((s) => s.session);
  const hostLost = useStore((s) => s.offline.hostLost);
  const myName = useStore(
    (s) =>
      s.room?.players.find((p) => p.seatIndex === s.session?.seatIndex)?.name ??
      s.game?.players.find((p) => p.seat === s.session?.seatIndex)?.name ??
      'Player',
  );
  const [rescanning, setRescanning] = useState(false);

  if (session?.roomCode === 'DEMO' || !session) return null;
  if (hostLost || rescanning) {
    return (
      <>
        {hostLost ? (
          <div
            className="fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-[max(0.5rem,var(--safe-top))]"
            data-testid="host-lost-banner"
          >
            <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border-2 border-[#a61b2d] bg-[#fdecee] py-2 pr-2 pl-3 shadow-lg" role="alert">
              <span className="min-w-0 flex-1 text-sm font-bold text-[#8a1424]">
                Lost connection to host — ask the host to tap Add player and re-scan
              </span>
              <button
                type="button"
                onClick={() => setRescanning(true)}
                className="h-12 flex-none rounded-xl bg-[#d7263d] px-4 text-sm font-bold text-white shadow-[0_3px_0_#8a1424] active:translate-y-px"
                data-testid="rescan-host"
              >
                📷 Re-scan
              </button>
            </div>
          </div>
        ) : null}
        {rescanning ? (
          <GuestPairingSheet
            name={myName}
            leaveOnCancel={false}
            onClose={() => setRescanning(false)}
            onConnected={() => setRescanning(false)}
          />
        ) : null}
      </>
    );
  }
  if (connected) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center pt-[max(0.5rem,var(--safe-top))]"
      data-testid="reconnect-banner"
    >
      <span className="rounded-full bg-[#d7263d] px-4 py-1.5 text-sm font-bold text-white shadow-lg">
        Reconnecting…
      </span>
    </div>
  );
}

const HOST_BANNER_KEY = 'lc.hostBannerDismissed';

/**
 * Offline host reminder: the game runs on this phone, so it must stay awake
 * and in the foreground. Rendered in document flow; the reminder is
 * dismissible for the browser session. With `repair` (in-game, where the
 * lobby's Add player button is gone) it also offers re-pairing whenever a
 * human seat has dropped — that part is never dismissed.
 */
export function OfflineHostBanner({ repair = false }: { repair?: boolean }): React.JSX.Element | null {
  const isHost = useStore((s) => s.offline.role === 'host');
  const dropped = useStore(
    (s) =>
      s.room?.players
        .filter((p) => !p.isBot && !p.connected)
        .map((p) => p.name)
        .join(', ') ?? '',
  );
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(HOST_BANNER_KEY) === '1');
  const [pairing, setPairing] = useState(false);
  if (!isHost) return null;
  const showRepair = repair && dropped.length > 0;
  return (
    <>
      {!dismissed ? (
        <div
          className="flex w-full items-center gap-2 rounded-full border-2 border-[#1f8a33] bg-[#eaf8ec] py-0.5 pr-0.5 pl-3 text-xs font-bold text-[#16692a] shadow-[0_2px_0_rgba(0,0,0,0.12)] sm:text-sm"
          role="status"
          data-testid="offline-host-banner"
        >
          <span aria-hidden="true">📡</span>
          <span className="min-w-0 flex-1">You are hosting — keep this screen open</span>
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(HOST_BANNER_KEY, '1');
              setDismissed(true);
            }}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/80 text-sm"
            aria-label="Dismiss hosting reminder"
          >
            ✕
          </button>
        </div>
      ) : null}
      {showRepair ? (
        <div
          className="flex w-full items-center gap-2 rounded-full border-2 border-[#e0b44c] bg-[#fff6dc] py-0.5 pr-0.5 pl-3 text-xs font-bold text-ink shadow-[0_2px_0_rgba(0,0,0,0.12)] sm:text-sm"
          role="status"
          data-testid="offline-repair-banner"
        >
          <span className="min-w-0 flex-1 truncate">{dropped} lost connection</span>
          <button
            type="button"
            onClick={() => setPairing(true)}
            className="h-9 flex-none rounded-full bg-cta px-3 text-xs font-bold text-ink sm:text-sm"
            data-testid="btn-repair-player"
          >
            📷 Add player
          </button>
        </div>
      ) : null}
      {pairing ? <HostPairingSheet onClose={() => setPairing(false)} /> : null}
    </>
  );
}

export function ToastStack(): React.JSX.Element | null {
  const toasts = useStore((s) => s.ui.toasts);
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+7.5rem)] z-[70] flex flex-col items-center gap-2 px-3 lg:top-auto lg:right-4 lg:bottom-4 lg:left-auto lg:items-end"
      data-testid="toast-stack"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-pop-in max-w-sm rounded-xl border-2 px-4 py-2 text-sm font-bold shadow-xl ${
            t.kind === 'error'
              ? 'border-[#a61b2d] bg-[#fdecee] text-[#8a1424]'
              : 'border-[#1f8a33] bg-[#eaf8ec] text-[#16692a]'
          }`}
          data-testid={`toast-${t.id}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

/** Seconds left on the server's turn deadline, ticking once per second. */
export function TurnTimer({ className = '' }: { className?: string }): React.JSX.Element | null {
  const timer = useStore((s) => s.timer);
  const phase = useStore((s) => s.game?.phase ?? null);

  const [now, setNow] = useState(0);
  useEffect(() => {
    const update = (): void => {
      setNow(Date.now());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeSeat = useStore((s) => s.game?.activeSeat ?? null);
  const mySeat = useStore((s) => s.session?.seatIndex ?? s.game?.you.seat ?? null);
  const isMyTurn = activeSeat !== null && activeSeat === mySeat;

  if (timer === null || phase === null || phase === 'finished' || now === 0) return null;
  const remaining = Math.max(0, Math.round((timer.deadlineUnixMs - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const urgent = remaining <= 10;

  useEffect(() => {
    if (isMyTurn && urgent && remaining > 0) {
      sounds.timerTick();
    }
  }, [isMyTurn, urgent, remaining]);

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 font-bold leading-none tabular-nums ${
        urgent ? 'bg-[#d7263d] text-white' : 'bg-white text-ink'
      } ${className}`}
      data-testid="turn-timer"
      aria-label={`${remaining} seconds left`}
    >
      ⏱ {minutes}:{String(seconds).padStart(2, '0')}
    </span>
  );
}
