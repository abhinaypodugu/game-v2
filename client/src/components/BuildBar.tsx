// Build bar: 4 build buttons with costs + placement arming.

import type { GameAction } from '@catan/shared';
import { BUILD_COSTS } from '@catan/shared';
import { useStore } from '../store';
import type { LegalMoves } from '../hooks/useLegalMoves';

const COST_LABELS: Record<string, string> = {
  road: '🪵1 🧱1',
  settlement: '🪵1 🧱1 🐑1 🌾1',
  city: '🌾2 ⛰3',
  devCard: '🐑1 🌾1 ⛰1',
};

export interface BuildBarProps {
  mySeat: number;
  canAct: boolean;
  legal: LegalMoves;
  onArm: (kind: 'settlement' | 'city' | 'road') => void;
}

export function BuildBar({ mySeat, canAct, legal, onArm }: BuildBarProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const snap = useStore((s) => s.game)!;
  const placement = useStore((s) => s.ui.placement);
  const setPlacement = useStore((s) => s.setPlacement);

  const myResources = snap.you.seat === mySeat ? snap.you.resources : { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  const canAfford = (cost: Partial<typeof myResources>): boolean =>
    Object.entries(cost).every(([r, n]) => (myResources[r as keyof typeof myResources] ?? 0) >= (n ?? 0));

  const buttons: Array<{
    key: 'road' | 'settlement' | 'city' | 'dev';
    label: string;
    cost: string;
    disabled: boolean;
    armed: boolean;
    onClick: () => void;
  }> = [
    {
      key: 'road',
      label: '🛣 Road',
      cost: COST_LABELS.road!,
      disabled: !canAct || legal.roadEdges.size === 0 || !canAfford(BUILD_COSTS.road),
      armed: placement?.kind === 'road',
      onClick: () => onArm('road'),
    },
    {
      key: 'settlement',
      label: '🏠 Settlement',
      cost: COST_LABELS.settlement!,
      disabled: !canAct || legal.settlementVertices.size === 0 || !canAfford(BUILD_COSTS.settlement),
      armed: placement?.kind === 'settlement',
      onClick: () => onArm('settlement'),
    },
    {
      key: 'city',
      label: '🏛 City',
      cost: COST_LABELS.city!,
      disabled: !canAct || legal.cityVertices.size === 0 || !canAfford(BUILD_COSTS.city),
      armed: placement?.kind === 'city',
      onClick: () => onArm('city'),
    },
    {
      key: 'dev',
      label: '🃏 Dev Card',
      cost: COST_LABELS.devCard!,
      disabled: !canAct || !legal.canBuyDev || !canAfford(BUILD_COSTS.devCard),
      armed: false,
      onClick: () => {
        const action: GameAction = { type: 'buyDevCard' };
        sendAction(action);
      },
    },
  ];

  return (
    <div className="flex items-center gap-2 rounded-xl bg-[#0a4986] p-3 shadow-[0_2px_4px_rgba(0,0,0,0.2)]" data-testid="build-bar">
      {buttons.map((b) => (
        <button
          key={b.key}
          type="button"
          disabled={b.disabled}
          data-testid={`build-${b.key}`}
          title={`Cost: ${b.cost}`}
          onClick={b.onClick}
          className={`flex flex-col items-center rounded-lg px-4 py-2 text-sm font-semibold transition ${
            b.armed
              ? 'bg-[#f06800] text-white'
              : b.disabled
                ? 'bg-black/20 text-white/40'
                : 'bg-black/20 text-white hover:bg-[#f06800]'
          }`}
        >
          <span>{b.label}</span>
          <span className="text-xs font-normal opacity-80">{b.cost}</span>
        </button>
      ))}
      {placement !== null ? (
        <button
          type="button"
          onClick={() => setPlacement(null)}
          className="ml-2 rounded-lg bg-[#ef3f2a] px-3 py-2 text-sm font-semibold text-white"
          data-testid="cancel-placement"
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}
