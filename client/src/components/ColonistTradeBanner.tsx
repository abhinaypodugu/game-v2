// Colonist.io-style Top-Center Trade & Turn Banner:
// - Shows active trade proposal with Give/Want resource cards, accept/reject/counter actions,
//   and player response status badges.
// - Collapses to turn indicator & dice display when no trade is active.

import { memo } from 'react';
import type { GameAction, Resource } from '@catan/shared';
import type { PersonalSnapshot } from '../types';
import { useStore } from '../store';
import { ThreeDiceDisplay } from './ThreeDiceDisplay';
import { PIECE_COLORS } from '../theme';

export interface ColonistTradeBannerProps {
  snap: PersonalSnapshot;
  rolling: boolean;
}

const RESOURCE_EMOJI: Record<Resource, string> = {
  wood: '🌲',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰',
};

const RESOURCE_BG: Record<Resource, string> = {
  wood: 'bg-[#15803d]',
  brick: 'bg-[#dc2626]',
  sheep: 'bg-[#65a30d]',
  wheat: 'bg-[#ca8a04]',
  ore: 'bg-[#475569]',
};

export const ColonistTradeBanner = memo(function ColonistTradeBanner({
  snap,
  rolling,
}: ColonistTradeBannerProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const setTradeModal = useStore((s) => s.setTradeModal);

  const { trades, you, activeSeat, players } = snap;
  const mySeat = you.seat;
  const activeTrade = trades.find((t) => t.status === 'open');
  const activePlayer = players[activeSeat]!;
  const myTurn = activeSeat === mySeat;

  if (activeTrade) {
    const isProposer = activeTrade.proposer === mySeat;
    const proposer = players[activeTrade.proposer]!;
    const proposerColor = PIECE_COLORS[proposer.color]?.main ?? '#64748b';
    const isDeclined = activeTrade.declinedBy.includes(mySeat);

    return (
      <div
        className="pointer-events-auto flex flex-col items-center rounded-2xl border border-slate-300 bg-white/95 p-2 shadow-2xl backdrop-blur-md"
        data-testid="colonist-trade-banner"
      >
        {/* Trade Header */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5 w-full justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <span
              className="inline-block h-3.5 w-3.5 rounded-full border border-black/30"
              style={{ backgroundColor: proposerColor }}
            />
            <span>{isProposer ? 'Your Trade Offer' : `${proposer.name}'s Offer`}</span>
          </div>

          {/* Player Response Badges */}
          <div className="flex items-center gap-1">
            {players
              .filter((p) => p.seat !== activeTrade.proposer)
              .map((p) => {
                const dec = activeTrade.declinedBy.includes(p.seat);
                const col = PIECE_COLORS[p.color]?.main ?? '#64748b';

                return (
                  <div
                    key={p.seat}
                    className="relative flex h-5 w-5 items-center justify-center rounded-full border border-black/40 text-[9px] font-bold text-white shadow-xs"
                    style={{ backgroundColor: col }}
                    title={`${p.name}: ${dec ? 'Declined' : 'Pending'}`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                    {dec ? (
                      <span className="absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[7px] text-white">
                        ✕
                      </span>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Trade Exchange Cards (Give vs Want) */}
        <div className="flex items-center gap-3 py-1.5">
          {/* Gives */}
          <div className="flex items-center gap-1">
            <span className="text-emerald-600 font-bold text-sm">↓</span>
            {(['wood', 'brick', 'sheep', 'wheat', 'ore'] as const).map((r) => {
              const count = activeTrade.give[r] ?? 0;
              if (count === 0) return null;
              return (
                <div
                  key={r}
                  className={`flex h-10 w-7 flex-col items-center justify-between rounded border border-black/20 ${RESOURCE_BG[r]} p-0.5 text-white shadow-xs`}
                  title={`Gives ${count} ${r}`}
                >
                  <span className="text-[9px] font-black">{count}</span>
                  <span className="text-xs">{RESOURCE_EMOJI[r]}</span>
                </div>
              );
            })}
          </div>

          <span className="text-slate-400 font-bold text-xs">for</span>

          {/* Wants */}
          <div className="flex items-center gap-1">
            <span className="text-red-500 font-bold text-sm">↑</span>
            {(['wood', 'brick', 'sheep', 'wheat', 'ore'] as const).map((r) => {
              const count = activeTrade.receive[r] ?? 0;
              if (count === 0) return null;
              return (
                <div
                  key={r}
                  className={`flex h-10 w-7 flex-col items-center justify-between rounded border border-black/20 ${RESOURCE_BG[r]} p-0.5 text-white shadow-xs`}
                  title={`Wants ${count} ${r}`}
                >
                  <span className="text-[9px] font-black">{count}</span>
                  <span className="text-xs">{RESOURCE_EMOJI[r]}</span>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
            {isProposer ? (
              <button
                type="button"
                onClick={() => {
                  const action: GameAction = { type: 'tradeCancel', offerId: activeTrade.id };
                  sendAction(action);
                }}
                className="flex h-8 px-2.5 items-center justify-center rounded-lg bg-red-500 text-white font-bold text-xs shadow-xs hover:bg-red-600 transition"
                title="Cancel Trade Offer"
              >
                ✕ Cancel
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setTradeModal(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 shadow-xs"
                  title="Counter Offer (Pencil)"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const action: GameAction = { type: 'tradeRespond', offerId: activeTrade.id, response: 'decline' };
                    sendAction(action);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-700 hover:bg-red-200 shadow-xs font-bold"
                  title="Decline Offer"
                >
                  ✕
                </button>
                <button
                  type="button"
                  disabled={isDeclined}
                  onClick={() => {
                    const action: GameAction = { type: 'tradeRespond', offerId: activeTrade.id, response: 'accept' };
                    sendAction(action);
                  }}
                  className={`flex h-8 px-3 items-center justify-center rounded-lg font-bold text-xs shadow-xs text-white transition ${
                    isDeclined ? 'bg-emerald-700 opacity-60' : 'bg-emerald-500 hover:bg-emerald-600'
                  }`}
                  title="Accept Offer"
                >
                  ✓ Accept
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard Turn & Dice Indicator Pill
  return (
    <div
      className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-slate-300/80 bg-white/95 px-3.5 py-1.5 shadow-xl backdrop-blur-md"
      data-testid="colonist-turn-banner"
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full border border-black/30 shadow-xs"
        style={{ backgroundColor: PIECE_COLORS[activePlayer.color]?.main }}
      />
      <div className="flex flex-col">
        <span className="text-xs font-bold text-slate-800 leading-tight">
          {myTurn ? 'Your Turn' : `${activePlayer.name}'s Turn`}
        </span>
        <span className="text-[9px] font-semibold text-amber-700 uppercase tracking-wider">
          {snap.phase === 'specialBuild'
            ? `Special Build: ${snap.specialBuildSeat !== null ? snap.players[snap.specialBuildSeat]!.name : 'passing'}`
            : snap.phase.replace(/([A-Z])/g, ' $1')}
        </span>
      </div>

      <div className="h-5 w-px bg-slate-200 mx-0.5" />

      {/* 3D Dice Display */}
      <ThreeDiceDisplay
        die1={snap.dice?.die1 ?? null}
        die2={snap.dice?.die2 ?? null}
        rolling={rolling}
      />
    </div>
  );
});
