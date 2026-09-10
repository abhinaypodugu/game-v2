// Colonist.io-style Bottom Dock HUD:
// - Left: Player's Resource Hand (compact cards with color backgrounds, icons, count badges)
// - Right: Build Actions Tray:
//   * Trade button (circulating arrows)
//   * Dev Card buy button
//   * Road build button (with roads left count)
//   * Settlement build button (with settlements left count)
//   * City build button (with cities left count)
//   * Roll Dice / End Turn button with turn timer countdown
// - Fully responsive on mobile with compact scrollable tray

import { memo } from 'react';
import type { DevCardType, GameAction, Resource } from '@catan/shared';
import { BUILD_COSTS, canAfford } from '@catan/shared';
import type { PersonalSnapshot } from '../types';
import type { LegalMoves } from '../hooks/useLegalMoves';
import { useStore, type PlacementMode } from '../store';
import { TurnTimer } from './Overlays';

export interface ColonistBottomDockProps {
  snap: PersonalSnapshot;
  legal: LegalMoves;
  canAct: boolean;
  placement: PlacementMode | null;
  onArm: (kind: 'settlement' | 'city' | 'road') => void;
  rolling: boolean;
}

const RESOURCE_CARD_BG: Record<Resource, { bg: string; border: string; text: string; icon: string }> = {
  wood: { bg: 'bg-[#15803d]', border: 'border-[#166534]', text: 'text-white', icon: '🌲' },
  brick: { bg: 'bg-[#dc2626]', border: 'border-[#b91c1c]', text: 'text-white', icon: '🧱' },
  sheep: { bg: 'bg-[#65a30d]', border: 'border-[#4d7c0f]', text: 'text-white', icon: '🐑' },
  wheat: { bg: 'bg-[#ca8a04]', border: 'border-[#a16207]', text: 'text-white', icon: '🌾' },
  ore: { bg: 'bg-[#475569]', border: 'border-[#334155]', text: 'text-white', icon: '⛰' },
};

const DEV_ICONS: Record<DevCardType, string> = {
  knight: '⚔',
  victoryPoint: '🏆',
  roadBuilding: '🛣',
  monopoly: '👑',
  yearOfPlenty: '🎁',
};

export const ColonistBottomDock = memo(function ColonistBottomDock({
  snap,
  legal,
  canAct,
  placement,
  onArm,
  rolling,
}: ColonistBottomDockProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const setTradeModal = useStore((s) => s.setTradeModal);

  const { you, activeSeat, players, phase, specialBuildSeat } = snap;
  const mySeat = you.seat;
  const myTurn = activeSeat === mySeat;
  const sbpWindow = specialBuildSeat === mySeat;
  const player = players[mySeat]!;

  const canRoad = canAct && legal.roadEdges.size > 0 && player.roadsLeft > 0;
  const canSettlement = canAct && legal.settlementVertices.size > 0 && player.settlementsLeft > 0;
  const canCity = canAct && legal.cityVertices.size > 0 && player.citiesLeft > 0;
  const canDevCard = canAct && canAfford(you.resources, BUILD_COSTS.devCard) && snap.devDeckCount > 0;

  return (
    <div
      className="pointer-events-auto fixed bottom-2 left-2 right-2 lg:bottom-3 lg:left-3 lg:right-84 z-30 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-1.5 overflow-x-auto scrollbar-none pb-0.5 max-w-full"
      data-testid="colonist-bottom-dock"
    >
      {/* ============================================================ */}
      {/* 1. BOTTOM LEFT: PLAYER'S RESOURCE CARDS HAND                 */}
      {/* ============================================================ */}
      <div className="flex items-center gap-1.5 rounded-2xl border border-slate-300/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-md">
        {(['wood', 'brick', 'sheep', 'wheat', 'ore'] as const).map((res) => {
          const count = you.resources[res] ?? 0;
          const spec = RESOURCE_CARD_BG[res];
          const hasCards = count > 0;

          return (
            <div
              key={res}
              className={`flex h-13 w-8 sm:h-16 sm:w-11 lg:h-18 lg:w-12 flex-col items-center justify-between rounded-lg sm:rounded-xl border ${
                spec.bg
              } ${spec.border} p-0.5 sm:p-1 shadow-sm transition transform hover:-translate-y-0.5 ${
                hasCards ? 'opacity-100' : 'opacity-40 grayscale-50'
              }`}
              title={`${res}: you have ${count}`}
            >
              {/* Count Badge at Top */}
              <div className="flex h-3.5 min-w-[14px] sm:h-5 sm:min-w-[18px] items-center justify-center rounded-full bg-black/40 px-0.5 text-[8px] sm:text-[10px] font-black text-white shadow-xs">
                {count}
              </div>

              {/* Resource Icon */}
              <span className="text-xs sm:text-base">{spec.icon}</span>

              {/* Resource Label */}
              <span className="text-[7px] sm:text-[9px] font-bold text-white uppercase tracking-wider leading-none">
                {res.slice(0, 3)}
              </span>
            </div>
          );
        })}

        {/* Playable Dev Cards In Hand */}
        {you.devHand.length > 0 ? (
          <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5 ml-1">
            {you.devHand
              .filter((c) => !c.played)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (canAct && c.boughtOnTurn < snap.turn) {
                      const action: GameAction = { type: 'playDevCard', cardId: c.id };
                      sendAction(action);
                    }
                  }}
                  className="flex h-16 w-11 sm:h-20 sm:w-13 flex-col items-center justify-between rounded-xl border border-purple-800 bg-purple-700 p-1 text-white shadow-sm transition hover:-translate-y-1 hover:brightness-110"
                  title={`Play ${c.type}`}
                >
                  <span className="text-[9px] font-bold leading-none">PLAY</span>
                  <span className="text-base sm:text-lg">{DEV_ICONS[c.type as DevCardType] ?? '🎴'}</span>
                  <span className="text-[8px] font-bold uppercase truncate max-w-[40px] leading-none">
                    {c.type.slice(0, 4)}
                  </span>
                </button>
              ))}
          </div>
        ) : null}
      </div>

      {/* ============================================================ */}
      {/* 2. BOTTOM RIGHT: COLONIST ACTION & BUILD DOCK                */}
      {/* ============================================================ */}
      {/* 2. BOTTOM RIGHT: COLONIST ACTION & BUILD DOCK */}
      <div className="flex items-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl border border-slate-300/80 bg-white/95 p-1 sm:p-1.5 shadow-xl backdrop-blur-md overflow-x-auto max-w-full">
        <button
          type="button"
          onClick={() => setTradeModal(true)}
          className="flex h-14 w-12 sm:h-16 sm:w-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-sky-400 bg-sky-50 text-slate-800 shadow-xs transition hover:scale-105 hover:bg-sky-100 active:scale-95"
          title="Open Trade Window (Player & Bank Trading)"
          data-testid="bottom-trade-btn"
        >
          <span className="text-xl leading-none">🔁</span>
          <span className="text-[9px] font-bold uppercase text-sky-800">Trade</span>
        </button>

        {/* Buy Dev Card Button */}
        <button
          type="button"
          disabled={!canDevCard}
          onClick={() => {
            const action: GameAction = { type: 'buyDevCard' };
            sendAction(action);
          }}
          className={`flex h-14 w-12 sm:h-16 sm:w-14 flex-col items-center justify-center gap-0.5 rounded-xl border p-0.5 shadow-xs transition ${
            canDevCard
              ? 'border-purple-400 bg-purple-50 text-slate-800 hover:scale-105 hover:bg-purple-100 active:scale-95'
              : 'border-slate-200 bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
          }`}
          title="Buy Dev Card (🐑 + 🌾 + ⛰)"
        >
          <span className="text-lg leading-none">🎴</span>
          <span className="text-[9px] font-bold uppercase text-purple-900 leading-none">Dev</span>
        </button>

        {/* Build Road Button (with Roads Left Badge) */}
        <button
          type="button"
          disabled={!canRoad && placement?.kind !== 'road'}
          onClick={() => onArm('road')}
          className={`relative flex h-14 w-12 sm:h-16 sm:w-14 flex-col items-center justify-center gap-0.5 rounded-xl border p-0.5 shadow-xs transition ${
            placement?.kind === 'road'
              ? 'border-amber-500 bg-amber-100 ring-2 ring-amber-400 font-black'
              : canRoad
                ? 'border-slate-300 bg-white hover:scale-105 hover:bg-amber-50'
                : 'border-slate-200 bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
          }`}
          title={`Build Road (🌲 + 🧱) — ${player.roadsLeft} left`}
          data-testid="btn-build-road"
        >
          <span className="absolute top-1 right-1 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-slate-800 px-1 text-[9px] font-black text-white">
            {player.roadsLeft}
          </span>
          <span className="text-lg leading-none">🛣</span>
          <span className="text-[9px] font-bold text-slate-700 leading-none">Road</span>
        </button>

        {/* Build Settlement Button (with Settlements Left Badge) */}
        <button
          type="button"
          disabled={!canSettlement && placement?.kind !== 'settlement'}
          onClick={() => onArm('settlement')}
          className={`relative flex h-14 w-12 sm:h-16 sm:w-14 flex-col items-center justify-center gap-0.5 rounded-xl border p-0.5 shadow-xs transition ${
            placement?.kind === 'settlement'
              ? 'border-emerald-500 bg-emerald-100 ring-2 ring-emerald-400 font-black'
              : canSettlement
                ? 'border-slate-300 bg-white hover:scale-105 hover:bg-emerald-50'
                : 'border-slate-200 bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
          }`}
          title={`Build Settlement (🌲 + 🧱 + 🐑 + 🌾) — ${player.settlementsLeft} left`}
          data-testid="btn-build-settlement"
        >
          <span className="absolute top-1 right-1 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-slate-800 px-1 text-[9px] font-black text-white">
            {player.settlementsLeft}
          </span>
          <span className="text-lg leading-none">🏠</span>
          <span className="text-[9px] font-bold text-slate-700 leading-none">Settle</span>
        </button>

        {/* Upgrade City Button (with Cities Left Badge) */}
        <button
          type="button"
          disabled={!canCity && placement?.kind !== 'city'}
          onClick={() => onArm('city')}
          className={`relative flex h-14 w-12 sm:h-16 sm:w-14 flex-col items-center justify-center gap-0.5 rounded-xl border p-0.5 shadow-xs transition ${
            placement?.kind === 'city'
              ? 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-400 font-black'
              : canCity
                ? 'border-slate-300 bg-white hover:scale-105 hover:bg-indigo-50'
                : 'border-slate-200 bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
          }`}
          title={`Upgrade to City (🌾🌾 + ⛰⛰⛰) — ${player.citiesLeft} left`}
          data-testid="btn-build-city"
        >
          <span className="absolute top-1 right-1 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-slate-800 px-1 text-[9px] font-black text-white">
            {player.citiesLeft}
          </span>
          <span className="text-lg leading-none">🏰</span>
          <span className="text-[9px] font-bold text-slate-700 leading-none">City</span>
        </button>

        {/* Turn Action Button: Roll Dice OR End Turn with Timer countdown */}
        {myTurn && phase === 'turnPreroll' ? (
          <button
            type="button"
            disabled={rolling}
            onClick={() => {
              const action: GameAction = { type: 'rollDice' };
              sendAction(action);
            }}
            className="flex h-14 min-w-[70px] sm:h-16 sm:min-w-[86px] flex-col items-center justify-center rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-3 text-slate-950 shadow-md font-bold transition hover:scale-105 hover:brightness-105 active:scale-95"
            data-testid="roll-button"
          >
            <span className="text-xl leading-none">🎲</span>
            <span className="text-xs font-black uppercase mt-0.5">Roll</span>
          </button>
        ) : myTurn && phase === 'turnMain' ? (
          <button
            type="button"
            onClick={() => {
              const action: GameAction = { type: 'endTurn' };
              sendAction(action);
            }}
            className="flex h-14 min-w-[70px] sm:h-16 sm:min-w-[86px] flex-col items-center justify-center rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-3 text-white shadow-md font-bold transition hover:scale-105 hover:brightness-105 active:scale-95"
            data-testid="end-turn"
          >
            <span className="text-sm font-black uppercase leading-tight">End</span>
            <span className="text-[10px] font-extrabold uppercase leading-tight">Turn ➜</span>
            <TurnTimer />
          </button>
        ) : sbpWindow ? (
          <button
            type="button"
            onClick={() => {
              const action: GameAction = { type: 'specialBuildDone' };
              sendAction(action);
            }}
            className="flex h-14 min-w-[70px] sm:h-16 sm:min-w-[86px] flex-col items-center justify-center rounded-xl bg-gradient-to-b from-red-500 to-red-600 px-2 text-white shadow-md font-bold transition hover:scale-105"
            data-testid="sbp-done"
          >
            <span className="text-[10px] font-black uppercase leading-tight">Pass</span>
            <span className="text-[9px] font-bold leading-tight">Window</span>
          </button>
        ) : (
          <div className="flex h-14 min-w-[60px] sm:h-16 sm:min-w-[72px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-100/90 px-2 text-slate-600 shadow-2xs">
            <span className="text-base leading-none">⏳</span>
            <TurnTimer />
          </div>
        )}
      </div>
    </div>
  );
});
