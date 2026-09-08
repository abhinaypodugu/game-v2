// App: routing between home/room/game via the store. Session rejoin from
// localStorage on mount.

import { useEffect } from 'react';
import { bootstrapSessionRejoin, useStore } from './store';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { GamePage } from './pages/GamePage';

export function App(): React.JSX.Element {
  const connect = useStore((s) => s.connect);
  const route = useStore((s) => s.route);

  useEffect(() => {
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
