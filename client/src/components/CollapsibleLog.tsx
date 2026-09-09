// Collapsible sleek event log drawer for bottom-right cockpit.

import { memo, useEffect, useRef, useState } from 'react';
import type { GameEvent } from '@catan/shared';
import { useStore } from '../store';
import { PIECE_COLORS } from '../theme';

const RESOURCE_ICON: Record<string, string> = {
  wood: '🌲',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰',
};

function describeEvent(event: GameEvent, names: string[]): string {
  const name = (seat: number | null | undefined): string =>
    seat === null || seat === undefined ? '?' : (names[seat] ?? `P${seat}`);
  switch (event.type) {
    case 'gameStarted': return `Game started (${event.playerCount} players)`;
    case 'setupPlaced': return `${name(event.seat)} placed a settlement${event.second ? ' (2nd)' : ''}`;
    case 'rolled': return `${name(event.seat)} rolled ${event.die1}+${event.die2} = ${event.die1 + event.die2}`;
    case 'produced': return `${name(event.seat)} +${event.amount} ${RESOURCE_ICON[event.resource] ?? event.resource} ${event.resource}`;
    case 'bankShortage': return `Bank out of ${event.resource}`;
    case 'roadBuilt': return `${name(event.seat)} built a road`;
    case 'settlementBuilt': return `${name(event.seat)} built a settlement`;
    case 'cityBuilt': return `${name(event.seat)} upgraded to city`;
    case 'devCardBought': return `${name(event.seat)} bought a dev card`;
    case 'devCardPlayed': return `${name(event.seat)} played ${event.cardType}`;
    case 'robberMoved': return `${name(event.seat)} moved the robber`;
    case 'stolenFrom': return `${name(event.seat)} stole from ${name(event.victim)}`;
    case 'discardRequired': return `${name(event.seat)} must discard ${event.count} cards`;
    case 'discarded': return `${name(event.seat)} discarded`;
    case 'tradeOffered': return `${name(event.proposer)} offered a trade`;
    case 'tradeCompleted': return `Trade: ${name(event.from)} ↔ ${name(event.to)}`;
    case 'bankTraded': return `${name(event.seat)} traded with bank`;
    case 'longestRoadChanged': return `Longest Road → ${name(event.to)}`;
    case 'largestArmyChanged': return `Largest Army → ${name(event.to)}`;
    case 'turnStarted': return `— ${name(event.seat)}'s Turn ${event.turn} —`;
    case 'turnEnded': return `${name(event.seat)} ended turn`;
    case 'victory': return `🎉 ${name(event.seat)} wins with ${event.vp} VP!`;
    default: return (event as { type: string }).type;
  }
}

export const CollapsibleLog = memo(function CollapsibleLog(): React.JSX.Element {
  const log = useStore((s) => s.log);
  const game = useStore((s) => s.game);
  const [open, setOpen] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const names = game?.players.map((p) => p.name) ?? [];

  useEffect(() => {
    if (open) {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
    }
  }, [log, open]);

  return (
    <div className="pointer-events-auto flex flex-col items-end" data-testid="collapsible-log">
      {open ? (
        <div className="mb-2 flex h-64 w-80 flex-col rounded-2xl border border-sky-500/30 bg-[#031422]/90 p-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-sky-800/60 pb-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">Game Events</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-sky-300 hover:text-white"
            >
              ✕ Close
            </button>
          </div>
          <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto pr-1 text-xs leading-5">
            {log.slice(-60).map((event, i) => {
              const seat =
                'seat' in event
                  ? (event as { seat: number }).seat
                  : 'proposer' in event
                    ? (event as { proposer: number }).proposer
                    : null;
              const color = seat !== null ? PIECE_COLORS[game?.players[seat]?.color ?? '']?.main : undefined;
              return (
                <p key={i} className="py-0.5" style={color !== undefined ? { color } : undefined}>
                  {describeEvent(event, names)}
                </p>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Pill Toggle Button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-[#031422]/85 px-3 py-1.5 text-xs font-bold text-sky-200 shadow-xl backdrop-blur-md transition hover:border-sky-400 hover:text-white"
      >
        <span>📜 Event Log</span>
        <span className="rounded-full bg-sky-900/80 px-1.5 py-0.2 text-[10px] font-mono text-amber-300">
          {log.length}
        </span>
      </button>
    </div>
  );
});
