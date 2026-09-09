// Realistic playing cards and bottom hand tray with hover elevation,
// dev card hand, and attached build actions.

import { memo } from 'react';
import { motion } from 'framer-motion';
import type { DevCardType, GameAction, Resource } from '@catan/shared';
import { BUILD_COSTS } from '@catan/shared';
import { useStore } from '../store';
import type { LegalMoves } from '../hooks/useLegalMoves';

export interface CardHandTrayProps {
  canAct: boolean;
  legal: LegalMoves;
  onArm: (kind: 'settlement' | 'city' | 'road') => void;
}

interface CardSpec {
  res: Resource;
  title: string;
  icon: string;
  gradient: string;
  borderColor: string;
  accentColor: string;
}

const CARD_SPECS: Record<Resource, CardSpec> = {
  wood: {
    res: 'wood',
    title: 'Lumber',
    icon: '🌲',
    gradient: 'from-[#14532d] via-[#166534] to-[#052e16]',
    borderColor: 'border-emerald-500/60',
    accentColor: '#4ade80',
  },
  brick: {
    res: 'brick',
    title: 'Brick',
    icon: '🧱',
    gradient: 'from-[#9a3412] via-[#c2410c] to-[#431407]',
    borderColor: 'border-amber-600/60',
    accentColor: '#fb923c',
  },
  sheep: {
    res: 'sheep',
    title: 'Wool',
    icon: '🐑',
    gradient: 'from-[#15803d] via-[#22c55e] to-[#14532d]',
    borderColor: 'border-lime-500/60',
    accentColor: '#86efac',
  },
  wheat: {
    res: 'wheat',
    title: 'Grain',
    icon: '🌾',
    gradient: 'from-[#b45309] via-[#d97706] to-[#451a03]',
    borderColor: 'border-amber-400/60',
    accentColor: '#fde047',
  },
  ore: {
    res: 'ore',
    title: 'Ore',
    icon: '⛰',
    gradient: 'from-[#334155] via-[#475569] to-[#0f172a]',
    borderColor: 'border-slate-400/60',
    accentColor: '#94a3b8',
  },
};

const DEV_ICONS: Record<DevCardType, string> = {
  knight: '⚔',
  victoryPoint: '🏆',
  roadBuilding: '🛣',
  monopoly: '👑',
  yearOfPlenty: '🎁',
};

export const CardHandTray = memo(function CardHandTray({
  canAct,
  legal,
  onArm,
}: CardHandTrayProps): React.JSX.Element {
  const snap = useStore((s) => s.game)!;
  const placement = useStore((s) => s.ui.placement);
  const setPlacement = useStore((s) => s.setPlacement);
  const sendAction = useStore((s) => s.sendAction);

  const myResources = snap.you.resources;
  const canAfford = (cost: Partial<Record<Resource, number>>): boolean =>
    (Object.keys(cost) as Resource[]).every((r) => (myResources[r] ?? 0) >= (cost[r] ?? 0));

  const buildItems = [
    {
      key: 'road' as const,
      label: 'Road',
      icon: '🛣',
      cost: '🪵1 🧱1',
      disabled: !canAct || legal.roadEdges.size === 0 || !canAfford(BUILD_COSTS.road),
      armed: placement?.kind === 'road',
      onClick: () => onArm('road'),
    },
    {
      key: 'settlement' as const,
      label: 'Settlement',
      icon: '🏠',
      cost: '🪵1 🧱1 🐑1 🌾1',
      disabled:
        !canAct || legal.settlementVertices.size === 0 || !canAfford(BUILD_COSTS.settlement),
      armed: placement?.kind === 'settlement',
      onClick: () => onArm('settlement'),
    },
    {
      key: 'city' as const,
      label: 'City',
      icon: '🏛',
      cost: '🌾2 ⛰3',
      disabled: !canAct || legal.cityVertices.size === 0 || !canAfford(BUILD_COSTS.city),
      armed: placement?.kind === 'city',
      onClick: () => onArm('city'),
    },
    {
      key: 'dev' as const,
      label: 'Dev Card',
      icon: '🃏',
      cost: '🐑1 🌾1 ⛰1',
      disabled: !canAct || !legal.canBuyDev || !canAfford(BUILD_COSTS.devCard),
      armed: false,
      onClick: () => {
        const action: GameAction = { type: 'buyDevCard' };
        sendAction(action);
      },
    },
  ];

  return (
    <div className="pointer-events-auto flex items-end justify-center gap-4">
      {/* 1. RESOURCE PLAYING CARDS */}
      <div className="flex items-end gap-2.5 rounded-2xl border border-sky-500/25 bg-[#031422]/85 p-3 shadow-2xl backdrop-blur-md">
        {(Object.keys(CARD_SPECS) as Resource[]).map((res) => {
          const spec = CARD_SPECS[res];
          const count = myResources[res] ?? 0;
          const hasCards = count > 0;

          return (
            <motion.div
              key={res}
              whileHover={hasCards ? { y: -16, scale: 1.05 } : {}}
              transition={{ type: 'spring', stiffness: 350, damping: 20 }}
              className={`relative flex h-32 w-20 flex-col justify-between rounded-xl border-2 p-2 shadow-lg transition select-none ${
                spec.borderColor
              } bg-gradient-to-b ${spec.gradient} ${
                hasCards ? 'cursor-pointer opacity-100' : 'opacity-40 grayscale'
              }`}
              data-testid={`card-${res}`}
            >
              {/* Top Row: Mini Icon & Count Badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm">{spec.icon}</span>
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 font-mono text-xs font-bold text-white shadow"
                  style={{ color: spec.accentColor }}
                >
                  {count}
                </span>
              </div>

              {/* Card Centerpiece Illustration */}
              <div className="flex flex-col items-center justify-center py-1">
                <span className="text-3xl drop-shadow-md">{spec.icon}</span>
              </div>

              {/* Bottom Label */}
              <div className="text-center font-[Rubik,system-ui] text-[11px] font-bold tracking-wide text-white/90 drop-shadow">
                {spec.title}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 2. ATTACHED BUILD ACTIONS MENU */}
      <div
        className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-[#031422]/85 p-2.5 shadow-2xl backdrop-blur-md"
        data-testid="build-menu"
      >
        {buildItems.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={item.disabled}
            onClick={item.onClick}
            data-testid={`build-${item.key}`}
            className={`group relative flex h-24 w-24 flex-col items-center justify-between rounded-xl border p-2 transition select-none ${
              item.armed
                ? 'scale-105 border-amber-400 bg-gradient-to-b from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)] ring-2 ring-amber-300'
                : item.disabled
                  ? 'border-slate-700/50 bg-slate-900/40 text-slate-500 opacity-50'
                  : 'border-sky-500/40 bg-gradient-to-b from-sky-950/80 to-[#07243e] text-white hover:scale-102 hover:border-sky-400 hover:shadow-lg'
            }`}
          >
            <span className="text-2xl drop-shadow-sm">{item.icon}</span>
            <span className="font-[Rubik,system-ui] text-xs font-bold">{item.label}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                item.armed ? 'bg-black/20 text-slate-950' : 'bg-black/40 text-sky-200'
              }`}
            >
              {item.cost}
            </span>
          </button>
        ))}

        {placement !== null ? (
          <button
            type="button"
            onClick={() => setPlacement(null)}
            className="flex h-24 w-16 flex-col items-center justify-center gap-1 rounded-xl border border-red-500/60 bg-gradient-to-b from-red-600 to-red-800 text-xs font-bold text-white shadow-lg transition hover:scale-105"
            data-testid="cancel-placement"
          >
            <span className="text-lg">✕</span>
            <span>Cancel</span>
          </button>
        ) : null}
      </div>

      {/* 3. DEV CARDS HAND (if any) */}
      {snap.you.devHand.length > 0 ? (
        <div className="flex items-end gap-1.5 rounded-2xl border border-purple-500/30 bg-[#031422]/85 p-3 shadow-2xl backdrop-blur-md">
          {snap.you.devHand.map((card) => {
            const icon = DEV_ICONS[card.type as DevCardType] ?? '🃏';
            const disabled =
              !canAct || card.type === 'victoryPoint' || card.boughtOnTurn === snap.turn;

            return (
              <button
                key={card.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const action: GameAction = { type: 'playDevCard', cardId: card.id };
                  sendAction(action);
                }}
                className={`relative flex h-32 w-20 flex-col justify-between rounded-xl border-2 p-2 shadow-lg transition select-none ${
                  disabled
                    ? 'border-purple-950/40 bg-purple-950/20 text-purple-400 opacity-60'
                    : 'cursor-pointer border-purple-400/70 bg-gradient-to-b from-purple-800 to-indigo-950 text-white hover:-translate-y-3 hover:shadow-purple-500/30'
                }`}
                data-testid={`dev-${card.id}`}
                title={
                  card.boughtOnTurn === snap.turn
                    ? 'Purchased this turn — playable next turn'
                    : card.type
                }
              >
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-purple-300">DEV</span>
                  <span className="text-sm">{icon}</span>
                </div>
                <div className="text-center text-3xl">{icon}</div>
                <div className="text-center font-[Rubik,system-ui] text-[10px] font-bold text-purple-200 uppercase">
                  {card.type.replace(/([A-Z])/g, ' $1')}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});
