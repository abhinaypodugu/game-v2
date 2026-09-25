// App: routing between home/room/game via the store. Session rejoin from
// localStorage on mount.

import { useEffect, useState } from 'react';
import { bootstrapSessionRejoin, useStore } from './store';
import { createDemoSnapshot } from './demoState';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { GamePage } from './pages/GamePage';
import { ToastStack } from './components/Overlays';

export function App(): React.JSX.Element {
  const connect = useStore((s) => s.connect);
  const route = useStore((s) => s.route);
  const isDemo = window.location.search.includes('demo');
  const [demoBanner, setDemoBanner] = useState(isDemo);

  useEffect(() => {
    if (isDemo) {
      const snap = createDemoSnapshot();
      useStore.setState({
        game: snap,
        route: 'game',
        session: { seatIndex: 0, roomCode: 'DEMO', reconnectToken: 'demo' },
        log: [
          { type: 'gameStarted', playerCount: 4, seed: 'demo-universe-2026' },
          { type: 'turnStarted', seat: 0, turn: 5 },
          { type: 'rolled', seat: 0, die1: 4, die2: 2 },
          { type: 'produced', seat: 0, resource: 'wood', amount: 2 },
          { type: 'produced', seat: 1, resource: 'wheat', amount: 1 },
        ],
      });
      return;
    }
    bootstrapSessionRejoin();
    connect();
  }, [connect, isDemo]);
  return (
    <div className="min-h-[100dvh] bg-ocean text-ink">
      <ToastStack />
      {demoBanner ? (
        <div className="fixed top-[calc(var(--safe-top)+7.5rem)] left-1/2 z-[55] flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-line bg-cream py-1 pr-1 pl-3 text-xs font-bold text-ink shadow-lg">
          <span>Design demo</span>
          <a href="/" className="rounded-full bg-go px-3 py-1.5 text-xs font-bold text-white">
            Play real game ➜
          </a>
          <button
            type="button"
            onClick={() => setDemoBanner(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-parchment"
            aria-label="Dismiss demo banner"
          >
            ✕
          </button>
        </div>
      ) : null}
      {route === 'home' ? <HomePage /> : null}
      {route === 'room' ? <RoomPage /> : null}
      {route === 'game' ? <GamePage /> : null}
    </div>
  );
}
