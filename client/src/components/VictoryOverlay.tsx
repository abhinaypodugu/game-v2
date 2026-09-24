// Victory overlay: winner, VP breakdown, confetti burst.

import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useStore } from '../store';
import { Avatar } from './PlayerStrip';

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
      particleCount: 180,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#f5a524', '#2fb344', '#4cb3e6', '#d7263d', '#ffffff'],
      disableForReducedMotion: true,
    });
  }, [winner]);

  if (snap === null || winner === null) return null;
  const winnerPlayer = snap.players[winner]!;
  const buildings = Object.values(snap.buildings).filter((b) => b.seat === winner);
  const settlements = buildings.filter((b) => b.type === 'settlement').length;
  const cities = buildings.filter((b) => b.type === 'city').length;
  const vpCards = snap.you.seat === winner ? snap.you.devHand.filter((c) => c.type === 'victoryPoint').length : undefined;
  const cell = 'rounded-xl border-2 border-line bg-white px-3 py-2';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-3" data-testid="victory-overlay">
      <div className="animate-pop-in w-full max-w-[440px] rounded-3xl border-2 border-line bg-cream p-5 text-center text-ink shadow-2xl">
        <div className="mb-2 flex justify-center">
          <Avatar name={winnerPlayer.name} color={winnerPlayer.color} />
        </div>
        <h1 className="text-3xl font-bold sm:text-4xl">{winnerPlayer.name} wins!</h1>
        <p className="mt-1 text-base text-ink-soft">
          {snap.you.seat === winner ? '🎉 Congratulations!' : 'Better luck next time.'} · First to {snap.rules.victoryPointsToWin} VP
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-left text-sm" data-testid="vp-breakdown">
          <div className={cell}>
            Settlements: <b>{settlements}</b> ({settlements} VP)
          </div>
          <div className={cell}>
            Cities: <b>{cities}</b> ({cities * 2} VP)
          </div>
          {vpCards !== undefined ? (
            <div className={cell}>
              VP cards: <b>{vpCards}</b>
            </div>
          ) : null}
          {snap.longestRoad.holder === winner ? <div className={cell}>🛣️ Longest Road (+2)</div> : null}
          {snap.largestArmy.holder === winner ? <div className={cell}>⚔️ Largest Army (+2)</div> : null}
        </div>
        <button
          type="button"
          onClick={() => {
            clearSession();
            leaveRoom();
          }}
          className="mt-5 h-12 w-full rounded-2xl bg-cta px-6 font-display text-lg font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px"
          data-testid="return-lobby"
        >
          Return to home
        </button>
      </div>
    </div>
  );
}
