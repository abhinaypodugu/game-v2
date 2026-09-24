// Trade offer banner: the open player-trade offer (gives / wants cards,
// responder status) with accept / decline / counter or cancel actions.
// Renders nothing when no trade is open.

import { memo } from 'react';
import type { GameAction, Resource } from '@catan/shared';
import { RESOURCES } from '@catan/shared';
import type { PersonalSnapshot } from '../types';
import { useStore } from '../store';
import { ResourceCard } from './resourceArt';
import { Avatar } from './PlayerStrip';

function Bag({ bag }: { bag: Partial<Record<Resource, number>> }): React.JSX.Element {
  const shown = RESOURCES.filter((r) => (bag[r] ?? 0) > 0);
  return (
    <div className="flex items-center gap-0.5">
      {shown.map((r) => (
        <ResourceCard key={r} resource={r} count={bag[r]} size="sm" />
      ))}
    </div>
  );
}

export const ColonistTradeBanner = memo(function ColonistTradeBanner({
  snap,
}: {
  snap: PersonalSnapshot;
}): React.JSX.Element | null {
  const sendAction = useStore((s) => s.sendAction);
  const setTradeModal = useStore((s) => s.setTradeModal);

  const { trades, you, players, activeSeat } = snap;
  const mySeat = you.seat;
  const open = trades.filter((t) => t.status === 'open');
  // The offer that needs this player's attention:
  //  - active player: a counter-offer made to them, else their own offer;
  //  - everyone else: the active player's offer, else their own counter.
  const activeTrade =
    mySeat === activeSeat
      ? open.find((t) => t.proposer !== mySeat && !t.declinedBy.includes(mySeat)) ?? open.find((t) => t.proposer === mySeat)
      : open.find((t) => t.proposer === activeSeat) ?? open.find((t) => t.proposer === mySeat);
  if (activeTrade === undefined) return null;

  const isProposer = activeTrade.proposer === mySeat;
  const isCounter = activeTrade.counterOf !== null;
  const proposer = players[activeTrade.proposer]!;
  const isDeclined = activeTrade.declinedBy.includes(mySeat);
  const canPay = RESOURCES.every((r) => (activeTrade.receive[r] ?? 0) <= (you.resources[r] ?? 0));
  const respond = (response: 'accept' | 'decline'): void => {
    const action: GameAction = { type: 'tradeRespond', offerId: activeTrade.id, response };
    sendAction(action);
  };

  return (
    <div
      className="animate-pop-in flex flex-col gap-1 rounded-2xl border-2 border-line bg-white p-1.5 shadow-[0_2px_0_rgba(0,0,0,0.12)]"
      data-testid="colonist-trade-banner"
    >
      <div className="flex items-center gap-1.5 px-0.5">
        <Avatar name={proposer.name} color={proposer.color} size="sm" />
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink">
          {isProposer
            ? isCounter
              ? 'Your counter-offer'
              : 'Your trade offer'
            : isCounter
              ? `${proposer.name} counter-offers`
              : `${proposer.name} wants to trade`}
        </span>
        <div className="flex flex-none items-center gap-0.5">
          {players
            // Root offers are answered by everyone else; counters only by the active player.
            .filter((p) => (isCounter ? p.seat === activeSeat : p.seat !== activeTrade.proposer))
            .map((p) => {
              const dec = activeTrade.declinedBy.includes(p.seat);
              return (
                <span
                  key={p.seat}
                  className={`relative ${dec ? 'opacity-40' : ''}`}
                  title={`${p.name}: ${dec ? 'declined' : 'pending'}`}
                >
                  <Avatar name={p.name} color={p.color} size="sm" />
                  {dec ? (
                    <span className="absolute -right-0.5 -bottom-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[#d7263d] text-[8px] font-bold text-white">
                      ✕
                    </span>
                  ) : null}
                </span>
              );
            })}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold uppercase text-ink-soft">{isProposer ? 'Give' : 'Get'}</span>
          <Bag bag={activeTrade.give} />
          <span className="px-0.5 text-sm font-bold text-ink-soft">⇄</span>
          <span className="text-[10px] font-bold uppercase text-ink-soft">{isProposer ? 'Get' : 'Give'}</span>
          <Bag bag={activeTrade.receive} />
        </div>

        {isProposer ? (
          isCounter ? (
            <span className="flex h-11 flex-none items-center px-2 text-xs font-bold text-ink-soft">Waiting…</span>
          ) : (
            <button
              type="button"
              onClick={() => {
                const action: GameAction = { type: 'tradeCancel', offerId: activeTrade.id };
                sendAction(action);
              }}
              className="h-11 flex-none rounded-xl bg-[#d7263d] px-3 text-xs font-bold text-white shadow-[0_2px_0_#8a1424] active:translate-y-px"
            >
              Cancel
            </button>
          )
        ) : (
          <div className="flex flex-none items-center gap-1">
            {isCounter ? null : (
              <button
                type="button"
                onClick={() => setTradeModal(true)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-line bg-cream text-base active:translate-y-px"
                title="Counter offer"
                aria-label="Counter offer"
              >
                ✏️
              </button>
            )}
            <button
              type="button"
              onClick={() => respond('decline')}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fcd5d5] text-lg font-bold text-[#8a1424] active:translate-y-px"
              title="Decline"
              aria-label="Decline offer"
            >
              ✕
            </button>
            <button
              type="button"
              disabled={isDeclined || !canPay}
              onClick={() => respond('accept')}
              className="flex h-11 min-w-11 items-center justify-center rounded-xl bg-go px-2.5 text-lg font-bold text-white shadow-[0_2px_0_#1d7a2c] active:translate-y-px disabled:opacity-40"
              title={canPay ? 'Accept' : "You can't afford this trade"}
              aria-label="Accept offer"
            >
              ✓
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
