// Victory overlay: winner, VP breakdown, confetti burst.

import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useStore } from '../store';
import { PIECE_COLORS } from '../theme';

export function VictoryOverlay(): React.JSX.Element | null {
  const snap = useStore((s) => s.game);
  const clearSession = useStore((s) => s.clearSession);
  const leaveRoom = useStore((s) => s.leaveRoom);

  const winner = snap?.winner ?? null;

  useEffect(() => {
    if (winner === null) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    void confetti({
      particleCount: 220,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#f06800', '#1fab1c', '#1e90ff', '#FFD700', '#ffffff'],
    });
  }, [winner]);

  if (snap === null || winner === null) return null;
  const winnerPlayer = snap.players[winner]!;
  const buildings = Object.values(snap.buildings).filter((b) => b.seat === winner);
  const settlements = buildings.filter((b) => b.type === 'settlement').length;
  const cities = buildings.filter((b) => b.type === 'city').length;
  const vpCards = snap.you.seat === winner ? snap.you.devHand.filter((c) => c.type === 'victoryPoint').length : undefined;
  const color = PIECE_COLORS[winnerPlayer.color]?.main ?? '#f06800';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" data-testid="victory-overlay">
      <div className="w-[480px] rounded-2xl bg-[#0a4986] p-8 text-center shadow-2xl">
        <h1 className="text-4xl font-bold" style={{ color }}>
          {winnerPlayer.name} wins!
        </h1>
        <p className="mt-1 text-lg text-[#cfe0ee]">
          {snap.you.seat === winner ? '🎉 Congratulations!' : 'Better luck next time.'}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-left text-sm" data-testid="vp-breakdown">
          <div className="rounded-lg bg-black/20 px-3 py-2">Settlements: <b>{settlements}</b> ({settlements} VP)</div>
          <div className="rounded-lg bg-black/20 px-3 py-2">Cities: <b>{cities}</b> ({cities * 2} VP)</div>
          {vpCards !== undefined ? (
            <div className="rounded-lg bg-black/20 px-3 py-2">VP cards: <b>{vpCards}</b></div>
          ) : null}
          {snap.longestRoad.holder === winner ? (
            <div className="rounded-lg bg-black/20 px-3 py-2">🛣 Longest Road (+2)</div>
          ) : null}
          {snap.largestArmy.holder === winner ? (
            <div className="rounded-lg bg-black/20 px-3 py-2">⚔ Largest Army (+2)</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            clearSession();
            leaveRoom();
          }}
          className="mt-6 rounded-lg bg-[#f06800] px-6 py-3 text-lg font-bold text-white hover:bg-[#d05800]"
          data-testid="return-lobby"
        >
          Return to home
        </button>
      </div>
    </div>
  );
}
