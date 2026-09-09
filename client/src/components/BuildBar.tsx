// Build bar: tactile build cards with affordability states + placement arming.

import type { GameAction, Resource } from '@catan/shared';
import { BUILD_COSTS } from '@catan/shared';
import { useStore } from '../store';
import type { LegalMoves } from '../hooks/useLegalMoves';

const RESOURCE_EMOJI: Record<Resource, string> = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰',
};

function costLabel(cost: Partial<Record<Resource, number>>): string {
  return (Object.entries(cost) as Array<[Resource, number]>)
    .map(([r, n]) => `${RESOURCE_EMOJI[r]}${n}`)
    .join(' ');
}

export interface BuildBarProps {
  mySeat: number;
  canAct: boolean;
  legal: LegalMoves;
  onArm: (kind: 'settlement' | 'city' | 'road') => void;
}

export function BuildBar({ canAct, legal, onArm }: BuildBarProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const snap = useStore((s) => s.game)!;
  const placement = useStore((s) => s.ui.placement);
  const setPlacement = useStore((s) => s.setPlacement);

  const myResources = snap.you.resources;
  const canAfford = (cost: Partial<Record<Resource, number>>): boolean =>
    (Object.keys(cost) as Resource[]).every((r) => (myResources[r] ?? 0) >= (cost[r] ?? 0));

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
      cost: costLabel(BUILD_COSTS.road),
      disabled: !canAct || legal.roadEdges.size === 0 || !canAfford(BUILD_COSTS.road),
      armed: placement?.kind === 'road',
      onClick: () => onArm('road'),
    },
    {
      key: 'settlement',
      label: '🏠 Settlement',
      cost: costLabel(BUILD_COSTS.settlement),
      disabled: !canAct || legal.settlementVertices.size === 0 || !canAfford(BUILD_COSTS.settlement),
      armed: placement?.kind === 'settlement',
      onClick: () => onArm('settlement'),
    },
    {
      key: 'city',
      label: '🏛 City',
      cost: costLabel(BUILD_COSTS.city),
      disabled: !canAct || legal.cityVertices.size === 0 || !canAfford(BUILD_COSTS.city),
      armed: placement?.kind === 'city',
      onClick: () => onArm('city'),
    },
    {
      key: 'dev',
      label: '🃏 Dev Card',
      cost: costLabel(BUILD_COSTS.devCard),
      disabled: !canAct || !legal.canBuyDev || !canAfford(BUILD_COSTS.devCard),
      armed: false,
      onClick: () => {
        const action: GameAction = { type: 'buyDevCard' };
        sendAction(action);
      },
    },
  ];

  return (
    <div className="flex items-center gap-3" data-testid="build-bar">
      {buttons.map((b) => (
        <button
          key={b.key}
          type="button"
          disabled={b.disabled}
          data-testid={`build-${b.key}`}
          title={`Cost: ${b.cost}`}
          onClick={b.onClick}
          className={`flex min-w-[110px] flex-col items-center rounded-xl px-4 py-2 text-sm font-bold shadow-md transition ${
            b.armed
              ? 'scale-105 bg-[#f06800] text-white ring-2 ring-amber-300'
              : b.disabled
                ? 'bg-black/25 text-slate-500'
                : 'bg-[#13375c] text-white hover:bg-[#f06800] hover:shadow-lg'
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
          className="rounded-xl bg-[#ef3f2a] px-3 py-2 text-sm font-bold text-white shadow-md hover:brightness-110"
          data-testid="cancel-placement"
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}
