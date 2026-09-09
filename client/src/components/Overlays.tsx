// Reconnect banner + toast stack + turn-timer countdown ring.

import { useEffect, useState } from 'react';
import { useStore } from '../store';

export function ReconnectBanner(): React.JSX.Element | null {
  const connected = useStore((s) => s.connected);
  const session = useStore((s) => s.session);
  if (connected || session?.roomCode === 'DEMO' || !session) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] bg-[#ef3f2a] py-2 text-center font-bold text-white"
      data-testid="reconnect-banner"
    >
      Reconnecting…
    </div>
  );
}
export function ToastStack(): React.JSX.Element | null {
  const toasts = useStore((s) => s.ui.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2" data-testid="toast-stack">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg px-4 py-2 font-medium text-white shadow-xl ${
            t.kind === 'error' ? 'bg-[#ef3f2a]' : 'bg-[#1fab1c]'
          }`}
          data-testid={`toast-${t.id}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function TurnTimer(): React.JSX.Element | null {
  const timer = useStore((s) => s.timer);
  const game = useStore((s) => s.game);

  const [now, setNow] = useState(0);
  useEffect(() => {
    const update = (): void => {
      setNow(Date.now());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (timer === null || game === null || game.phase === 'finished') return null;
  const remaining = Math.max(0, Math.round((timer.deadlineUnixMs - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const urgent = remaining <= 10;

  return (
    <span
      className={`rounded-lg px-3 py-1 font-mono font-bold tabular-nums ${
        urgent ? 'bg-[#ef3f2a] text-white' : 'bg-black/30 text-[#cfe0ee]'
      }`}
      data-testid="turn-timer"
    >
      {minutes}:{String(seconds).padStart(2, '0')}
    </span>
  );
}
