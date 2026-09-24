// Dev card modals: Monopoly resource picker & Year of Plenty selector.
import { useState } from 'react';
import type { GameAction, Resource } from '@catan/shared';
import { RESOURCES } from '@catan/shared';
import { useStore } from '../store';
import { DEV_META, RESOURCE_META, ResourceCard } from './resourceArt';

function Sheet({
  testId,
  title,
  icon,
  onClose,
  children,
}: {
  testId: string;
  title: string;
  icon: string;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" data-testid={testId}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-t-3xl border-2 border-line bg-cream p-4 pb-[max(1rem,var(--safe-bottom))] text-ink shadow-2xl sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white text-base font-bold"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="mb-1 flex items-center gap-2 pr-12">
          <span className="text-2xl">{icon}</span>
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

export interface MonopolyModalProps {
  cardId: string;
  onClose: () => void;
}

export function MonopolyModal({ cardId, onClose }: MonopolyModalProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);

  const handleSelect = (resource: Resource): void => {
    const action: GameAction = { type: 'playDevCard', cardId, payload: { resource } };
    sendAction(action);
    onClose();
  };

  return (
    <Sheet testId="monopoly-modal" title={DEV_META.monopoly.label} icon={DEV_META.monopoly.icon} onClose={onClose}>
      <p className="mb-4 text-sm text-ink-soft">
        Pick a resource. Every other player gives you all of their cards of that type.
      </p>
      <div className="grid grid-cols-5 gap-2">
        {RESOURCES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => handleSelect(r)}
            className="flex flex-col items-center gap-1 rounded-2xl border-2 border-line bg-white p-1.5 active:translate-y-px"
            data-testid={`mono-select-${r}`}
          >
            <ResourceCard resource={r} size="md" />
            <span className="text-[10px] font-bold uppercase">{RESOURCE_META[r].label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export interface YearOfPlentyModalProps {
  cardId: string;
  onClose: () => void;
}

export function YearOfPlentyModal({ cardId, onClose }: YearOfPlentyModalProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const snap = useStore((s) => s.game);
  const [counts, setCounts] = useState<Record<Resource, number>>({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });

  const totalSelected = RESOURCES.reduce((s, r) => s + counts[r], 0);

  const increment = (r: Resource): void => {
    if (totalSelected >= 2) return;
    if (counts[r] >= (snap?.bank[r] ?? 19)) return;
    setCounts((prev) => ({ ...prev, [r]: prev[r] + 1 }));
  };

  const decrement = (r: Resource): void => {
    if (counts[r] <= 0) return;
    setCounts((prev) => ({ ...prev, [r]: prev[r] - 1 }));
  };

  const handleSubmit = (): void => {
    if (totalSelected !== 2) return;
    const selected: Resource[] = [];
    for (const r of RESOURCES) for (let i = 0; i < counts[r]; i++) selected.push(r);
    const action: GameAction = { type: 'playDevCard', cardId, payload: { resources: selected } };
    sendAction(action);
    onClose();
  };

  const stepBtn =
    'flex h-11 w-11 items-center justify-center rounded-xl border-2 border-line bg-white text-xl font-bold text-ink active:translate-y-px disabled:opacity-30';

  return (
    <Sheet testId="yop-modal" title={DEV_META.yearOfPlenty.label} icon={DEV_META.yearOfPlenty.icon} onClose={onClose}>
      <p className="mb-3 text-sm text-ink-soft">Take any 2 resources from the bank ({totalSelected}/2 chosen).</p>
      <div className="mb-3 flex flex-col gap-1.5">
        {RESOURCES.map((r) => {
          const count = counts[r];
          const inBank = snap?.bank[r] ?? 0;
          return (
            <div key={r} className="flex items-center gap-2 rounded-2xl border-2 border-line bg-white px-2 py-1">
              <ResourceCard resource={r} size="sm" dim={inBank === 0} />
              <span className="flex-1 text-sm font-bold">
                {RESOURCE_META[r].label} <span className="text-xs font-normal text-ink-soft">({inBank} in bank)</span>
              </span>
              <button type="button" disabled={count <= 0} onClick={() => decrement(r)} className={stepBtn}>
                −
              </button>
              <span className="w-5 text-center font-display text-lg font-bold" data-testid={`yop-count-${r}`}>
                {count}
              </span>
              <button type="button" disabled={totalSelected >= 2 || count >= inBank} onClick={() => increment(r)} className={stepBtn}>
                +
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        disabled={totalSelected !== 2}
        onClick={handleSubmit}
        className="h-12 w-full rounded-2xl bg-cta font-display text-base font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px disabled:opacity-40"
        data-testid="yop-submit"
      >
        Take {totalSelected} of 2
      </button>
    </Sheet>
  );
}
