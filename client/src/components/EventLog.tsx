// Event log: auto-scrolling feed of game events, colour-coded per player.

import { memo, useEffect, useRef } from 'react';
import type { GameEvent } from '@catan/shared';
import { useStore } from '../store';
import { playerColor } from './PlayerStrip';
import { DEV_META, RESOURCE_META } from './resourceArt';

function describe(event: GameEvent, names: string[]): string {
  const name = (seat: number | null | undefined): string =>
    seat === null || seat === undefined ? 'Nobody' : (names[seat] ?? `P${seat + 1}`);
  const res = (r: keyof typeof RESOURCE_META): string => RESOURCE_META[r].label.toLowerCase();
  switch (event.type) {
    case 'gameStarted': return `Game started with ${event.playerCount} players`;
    case 'setupPlaced': return `${name(event.seat)} placed a ${event.second ? 'second ' : ''}settlement and road`;
    case 'rolled': return `${name(event.seat)} rolled ${event.die1} + ${event.die2} = ${event.die1 + event.die2}`;
    case 'produced': return `${name(event.seat)} got ${event.amount} ${res(event.resource)}`;
    case 'bankShortage': return `Bank is out of ${res(event.resource)} — nobody receives`;
    case 'roadBuilt': return `${name(event.seat)} built a road${event.free === true ? ' (free)' : ''}`;
    case 'settlementBuilt': return `${name(event.seat)} built a settlement`;
    case 'cityBuilt': return `${name(event.seat)} upgraded to a city`;
    case 'devCardBought': return `${name(event.seat)} bought a development card`;
    case 'devCardPlayed': {
      const label = (DEV_META as Record<string, { label: string } | undefined>)[event.cardType]?.label ?? event.cardType;
      return `${name(event.seat)} played ${label}`;
    }
    case 'robberMoved': return `${name(event.seat)} moved the robber`;
    case 'stolenFrom':
      return `${name(event.seat)} stole ${event.resource !== null ? `1 ${res(event.resource)}` : 'a card'} from ${name(event.victim)}`;
    case 'discardRequired': return `${name(event.seat)} must discard ${event.count}`;
    case 'discarded': return `${name(event.seat)} discarded cards`;
    case 'tradeOffered': return `${name(event.proposer)} offered a trade`;
    case 'tradeCountered': return `${name(event.proposer)} made a counter-offer`;
    case 'tradeCompleted': return `${name(event.from)} traded with ${name(event.to)}`;
    case 'tradeDeclined': return `${name(event.responder)} declined the trade`;
    case 'tradeCancelled': return `${name(event.by)} cancelled a trade`;
    case 'bankTraded': return `${name(event.seat)} traded ${event.giveAmount} ${res(event.give)} for 1 ${res(event.receive)}`;
    case 'longestRoadChanged': return `${name(event.to)} holds Longest Road (${event.length})`;
    case 'largestArmyChanged': return `${name(event.to)} holds Largest Army (${event.knights})`;
    case 'specialBuildActivated': return `${name(event.seat)} may special-build`;
    case 'specialBuildDone': return `${name(event.seat)} finished special building`;
    case 'turnStarted': return `${name(event.seat)}'s turn ${event.turn}`;
    case 'turnEnded': return `${name(event.seat)} ended their turn`;
    case 'tokensSwapped': return `${name(event.seat)} swapped number tokens (${event.token1} ⇄ ${event.token2})`;
    case 'harborsSwapped': return `${name(event.seat)} swapped 2 coastal harbors`;
    case 'fortified': return `${name(event.seat)} fortified their empire`;
    case 'taxCollected': return `${name(event.seat)} collected ${event.totalCards} cards in taxes`;
    case 'timedOut': return `${name(event.seat)} ran out of time (${event.autoAction})`;
    case 'victory': return `${name(event.seat)} wins with ${event.vp} VP!`;
    default: return (event as { type: string }).type;
  }
}

function seatOf(event: GameEvent): number | null {
  if ('seat' in event && typeof event.seat === 'number') return event.seat;
  if ('proposer' in event) return event.proposer;
  if ('from' in event && typeof event.from === 'number' && event.type === 'tradeCompleted') return event.from;
  if ('by' in event) return event.by;
  if ('responder' in event) return event.responder;
  return null;
}

export const EventLog = memo(function EventLog(): React.JSX.Element {
  const log = useStore((s) => s.log);
  const players = useStore((s) => s.game?.players);
  const ref = useRef<HTMLDivElement>(null);
  const names = players?.map((p) => p.name) ?? [];

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-line bg-white" data-testid="event-log">
      <h3 className="border-b-2 border-line bg-parchment px-3 py-1.5 text-sm font-bold text-ink">Game log</h3>
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto px-2 py-1 text-xs leading-5 text-ink">
        {log.length === 0 ? <p className="py-1 text-ink-soft italic">Game events will appear here…</p> : null}
        {log.slice(-120).map((event, i) => {
          const seat = seatOf(event);
          const p = seat !== null ? players?.[seat] : undefined;
          const turnLine = event.type === 'turnStarted';
          return (
            <p
              key={i}
              className={`flex items-start gap-1.5 py-0.5 ${turnLine ? 'mt-1 border-t border-line pt-1 font-bold' : ''} ${
                event.type === 'victory' ? 'font-bold text-[#a15c00]' : ''
              }`}
            >
              <span
                className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full border border-ink/40"
                style={{ background: p !== undefined ? playerColor(p.color).main : 'transparent' }}
              />
              <span className="min-w-0 break-words">{describe(event, names)}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
});
