// Discard modal, robber placement mode, and victim picker.

import type { GameAction, Resource } from '@catan/shared';
import { RESOURCES } from '@catan/shared';
import { useStore } from '../store';

const RESOURCE_EMOJI: Record<Resource, string> = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰',
};

export function DiscardModal({ mySeat }: { mySeat: number }): React.JSX.Element | null {
  const snap = useStore((s) => s.game)!;
  const sendAction = useStore((s) => s.sendAction);
  const pending = snap.pendingDiscards.find((d) => d.seat === mySeat && !d.received);
  if (pending === undefined || snap.phase !== 'discard') return null;

  const mine = snap.you.resources;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid="discard-modal">
      <div className="w-[420px] rounded-xl bg-[#0a4986] p-5">
        <h2 className="mb-2 text-2xl font-bold">Discard {pending.count} cards</h2>
        <p className="mb-4 text-sm text-[#cfe0ee]">The robber struck — discard half your hand (rounded down).</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const res: Partial<Record<Resource, number>> = {};
            for (const r of RESOURCES) {
              const v = Number(fd.get(r) ?? 0);
              if (v > 0) res[r] = v;
            }
            const action: GameAction = { type: 'discard', resources: res as Record<Resource, number> };
            sendAction(action);
          }}
        >
          <div className="flex flex-col gap-3">
            {RESOURCES.map((r) => (
              <label key={r} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
                <span className="text-lg">
                  {RESOURCE_EMOJI[r]} × {mine[r]}
                </span>
                <input
                  type="number"
                  name={r}
                  min={0}
                  max={mine[r]}
                  defaultValue={0}
                  className="w-20 rounded bg-[#04182a] px-2 py-1 text-center"
                  data-testid={`discard-input-${r}`}
                />
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-[#f06800] px-4 py-2 font-bold text-white"
            data-testid="discard-submit"
          >
            Discard
          </button>
        </form>
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
  const candidates = [...seats].filter((s) => snap.players[s] !== undefined);
  if (candidates.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-xl bg-[#0a4986] p-4 shadow-2xl"
      data-testid="victim-picker"
    >
      <h3 className="mb-2 font-bold">Steal from…</h3>
      <div className="flex gap-2">
        {candidates.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              const action: GameAction = { type: 'chooseSteal', victimSeat: s };
              sendAction(action);
            }}
            className="rounded-lg bg-[#f06800] px-4 py-2 font-semibold text-white hover:brightness-110"
            data-testid={`steal-from-${s}`}
          >
            {snap.players[s]!.name} ({snap.players[s]!.resourceCount} cards)
          </button>
        ))}
      </div>
    </div>
  );
}
