// Event log panel: compact, fixed-height, auto-scrolling feed.

import { useEffect, useRef } from 'react';
import type { GameEvent } from '@catan/shared';
import { useStore } from '../store';
import { PIECE_COLORS } from '../theme';

const RESOURCE_ICON: Record<string, string> = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰',
};

function describe(event: GameEvent, names: string[]): string {
  const name = (seat: number | null | undefined): string =>
    seat === null || seat === undefined ? '?' : (names[seat] ?? `P${seat}`);
  switch (event.type) {
    case 'gameStarted': return `Game started (${event.playerCount} players)`;
    case 'setupPlaced': return `${name(event.seat)} placed a settlement${event.second ? ' (2nd)' : ''}`;
    case 'rolled': return `${name(event.seat)} rolled ${event.die1}+${event.die2} = ${event.die1 + event.die2}`;
    case 'produced': return `${name(event.seat)} +${event.amount} ${RESOURCE_ICON[event.resource] ?? event.resource}${event.resource}`;
    case 'bankShortage': return `Bank out of ${event.resource} — nobody receives`;
    case 'roadBuilt': return `${name(event.seat)} built a road${event.free === true ? ' (free)' : ''}`;
    case 'settlementBuilt': return `${name(event.seat)} built a settlement`;
    case 'cityBuilt': return `${name(event.seat)} upgraded a city`;
    case 'devCardBought': return `${name(event.seat)} bought a dev card`;
    case 'devCardPlayed': return `${name(event.seat)} played ${event.cardType}`;
    case 'robberMoved': return `Robber moved by ${name(event.seat)}`;
    case 'stolenFrom': return `${name(event.seat)} stole from ${name(event.victim)}`;
    case 'discardRequired': return `${name(event.seat)} must discard ${event.count}`;
    case 'discarded': return `${name(event.seat)} discarded`;
    case 'tradeOffered': return `${name(event.proposer)} offered a trade`;
    case 'tradeCountered': return `${name(event.proposer)} countered`;
    case 'tradeCompleted': return `Trade: ${name(event.from)} ↔ ${name(event.to)}`;
    case 'tradeDeclined': return `${name(event.responder)} declined`;
    case 'tradeCancelled': return `${name(event.by)} cancelled a trade`;
    case 'bankTraded': return `${name(event.seat)} traded with the bank`;
    case 'longestRoadChanged': return `Longest Road (${event.length}) → ${name(event.to)}`;
    case 'largestArmyChanged': return `Largest Army (${event.knights}⚔) → ${name(event.to)}`;
    case 'specialBuildActivated': return `${name(event.seat)} special build window`;
    case 'specialBuildDone': return `${name(event.seat)} finished building`;
    case 'turnStarted': return `— ${name(event.seat)}'s turn ${event.turn} —`;
    case 'turnEnded': return `${name(event.seat)} ended turn`;
    case 'timedOut': return `${name(event.seat)} timed out (${event.autoAction})`;
    case 'victory': return `🎉 ${name(event.seat)} wins with ${event.vp} VP!`;
    default: return (event as { type: string }).type;
  }
}

export function EventLog(): React.JSX.Element {
  const log = useStore((s) => s.log);
  const game = useStore((s) => s.game);
  const ref = useRef<HTMLDivElement>(null);
  const names = game?.players.map((p) => p.name) ?? [];

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log]);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-sky-700/50 bg-[#072644]/90 p-3 shadow-lg" data-testid="event-log">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-300">Game Log</h3>
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto pr-1 text-xs leading-5">
        {log.slice(-80).map((event, i) => {
          const seat =
            'seat' in event
              ? (event as { seat: number }).seat
              : 'proposer' in event
                ? (event as { proposer: number }).proposer
                : null;
          const color = seat !== null ? PIECE_COLORS[game?.players[seat]?.color ?? '']?.main : undefined;
          return (
            <p key={i} className="py-0.5" style={color !== undefined ? { color } : undefined}>
              {describe(event, names)}
            </p>
          );
        })}
      </div>
    </div>
  );
}
