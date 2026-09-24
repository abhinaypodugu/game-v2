// Discard sheet (seven rolled) and robber victim picker.

import { useState } from 'react';
import type { GameAction, Resource } from '@catan/shared';
import { RESOURCES } from '@catan/shared';
import { useStore } from '../store';
import { RESOURCE_META, ResourceCard } from './resourceArt';
import { Avatar } from './PlayerStrip';

export function DiscardModal({ mySeat }: { mySeat: number }): React.JSX.Element | null {
  const snap = useStore((s) => s.game)!;
  const pending = snap.pendingDiscards.find((d) => d.seat === mySeat && !d.received);
  if (pending === undefined || snap.phase !== 'discard') return null;
  // Fresh picker state per seven: keyed by turn so an earlier discard's picks never carry over.
  return <DiscardSheet key={snap.turn} count={pending.count} />;
}

function DiscardSheet({ count }: { count: number }): React.JSX.Element {
  const snap = useStore((s) => s.game)!;
  const sendAction = useStore((s) => s.sendAction);
  const [picked, setPicked] = useState<Partial<Record<Resource, number>>>({});
  const pending = { count };

  const mine = snap.you.resources;
  // Clamp to the current hand in case it changed since a card was picked.
  const pickedOf = (r: Resource): number => Math.min(picked[r] ?? 0, mine[r] ?? 0);
  const sum = RESOURCES.reduce((n, r) => n + pickedOf(r), 0);
  const full = sum >= pending.count;
  const bump = (r: Resource, delta: number): void =>
    setPicked((p) => ({ ...p, [r]: Math.max(0, Math.min(mine[r] ?? 0, (p[r] ?? 0) + delta)) }));
  const stepBtn =
    'grid h-11 w-11 place-items-center rounded-xl border-2 border-line bg-cream font-display text-xl font-bold text-ink active:translate-y-px disabled:opacity-30';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" data-testid="discard-modal">
      <div className="w-full max-w-[420px] rounded-t-3xl border-2 border-line bg-cream p-4 pb-[max(1rem,var(--safe-bottom))] text-ink shadow-2xl sm:rounded-3xl">
        <h2 className="text-2xl font-bold">Discard {pending.count} cards</h2>
        <p className="mb-3 text-sm text-ink-soft">
          A 7 was rolled and you hold more than {snap.rules.discardLimit} cards. Choose half your hand to discard.
        </p>
        <div className="flex flex-col gap-1.5">
          {RESOURCES.map((r) => {
            const have = mine[r] ?? 0;
            const n = pickedOf(r);
            return (
              <div key={r} className="flex items-center gap-2 rounded-2xl border-2 border-line bg-white px-2 py-1.5">
                <ResourceCard resource={r} count={have} size="sm" dim={have === 0} />
                <span className="flex-1 text-sm font-bold">{RESOURCE_META[r].label}</span>
                <button type="button" className={stepBtn} disabled={n === 0} onClick={() => bump(r, -1)} aria-label={`Discard one less ${r}`} data-testid={`discard-minus-${r}`}>
                  −
                </button>
                <span className="w-7 text-center font-display text-lg font-bold tabular-nums" data-testid={`discard-count-${r}`}>
                  {n}
                </span>
                <button type="button" className={stepBtn} disabled={n >= have || full} onClick={() => bump(r, 1)} aria-label={`Discard one more ${r}`} data-testid={`discard-plus-${r}`}>
                  +
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          disabled={sum !== pending.count}
          onClick={() => {
            const res: Partial<Record<Resource, number>> = {};
            for (const r of RESOURCES) if (pickedOf(r) > 0) res[r] = pickedOf(r);
            const action: GameAction = { type: 'discard', resources: res };
            sendAction(action);
          }}
          className="mt-3 h-12 w-full rounded-2xl bg-cta px-4 font-display text-base font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px disabled:opacity-50"
          data-testid="discard-submit"
        >
          Discard {pending.count} cards ({sum}/{pending.count} chosen)
        </button>
      </div>
    </div>
  );
}

export function VictimPicker({ mySeat }: { mySeat: number }): React.JSX.Element | null {
  const snap = useStore((s) => s.game)!;
  const sendAction = useStore((s) => s.sendAction);
  if (snap.phase !== 'robberSteal' || snap.activeSeat !== mySeat) return null;

  // Candidates: opponents with a building adjacent to the robber hex.
  const seats = new Set<number>();
  for (const v of snap.board.topology.hexVertices[snap.robber] ?? []) {
    const b = snap.buildings[v];
    if (b !== undefined && b.seat !== mySeat) seats.add(b.seat);
  }
  const candidates = [...seats].filter(
    (s) => snap.players[s] !== undefined && (snap.players[s]!.resourceCount > 0 || seats.size === 1),
  );
  if (candidates.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-2 pb-[max(0.5rem,var(--safe-bottom))]" data-testid="victim-picker">
      <div className="animate-pop-in w-full max-w-md rounded-3xl border-2 border-line bg-cream p-3 text-ink shadow-2xl">
        <h3 className="mb-2 text-lg font-bold">Steal a card from…</h3>
        <div className="flex flex-col gap-1.5">
          {candidates.map((s) => {
            const p = snap.players[s]!;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const action: GameAction = { type: 'chooseSteal', victimSeat: s };
                  sendAction(action);
                }}
                className="flex h-12 items-center gap-2 rounded-2xl border-2 border-line bg-white px-3 text-left font-bold active:translate-y-px"
                data-testid={`steal-from-${s}`}
              >
                <Avatar name={p.name} color={p.color} size="sm" />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-sm text-ink-soft">{p.resourceCount} cards</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
