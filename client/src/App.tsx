// App: routing between home/room/game via the store. Session rejoin from
// localStorage on mount.

import { useEffect } from 'react';
import { bootstrapSessionRejoin, useStore } from './store';
import { createDemoSnapshot } from './demoState';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { GamePage } from './pages/GamePage';

export function App(): React.JSX.Element {
  const connect = useStore((s) => s.connect);
  const route = useStore((s) => s.route);

  useEffect(() => {
    if (window.location.search.includes('demo')) {
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
  }, [connect]);
  return (
    <div className="min-h-screen bg-[#04182a] text-[#f6f8fa]">
      {route === 'home' ? <HomePage /> : null}
      {route === 'room' ? <RoomPage /> : null}
      {route === 'game' ? <GamePage /> : null}
    </div>
  );
}
