// Trade sheet: bank (harbour rates) + player offers with counters,
// accept/decline. Bottom sheet on phones, centred dialog on larger screens.

import { useMemo, useState } from 'react';
import type { GameAction, Resource } from '@catan/shared';
import { RESOURCES } from '@catan/shared';
import { useStore } from '../store';
import { RESOURCE_META, ResourceCard } from './resourceArt';
import { Avatar } from './PlayerStrip';

type Bag = Partial<Record<Resource, number>>;

function BagCards({ bag }: { bag: Bag }): React.JSX.Element {
  return (
    <span className="flex items-center gap-0.5">
      {RESOURCES.filter((r) => (bag[r] ?? 0) > 0).map((r) => (
        <ResourceCard key={r} resource={r} count={bag[r]} size="sm" />
      ))}
    </span>
  );
}

export function TradeModal({ mySeat }: { mySeat: number }): React.JSX.Element {
  const snap = useStore((s) => s.game)!;
  const sendAction = useStore((s) => s.sendAction);
  const setTradeModal = useStore((s) => s.setTradeModal);
  const [tab, setTab] = useState<'bank' | 'player'>('bank');
  const [give, setGive] = useState<Bag>({});
  const [receive, setReceive] = useState<Bag>({});
  const [counterOf, setCounterOf] = useState<string | null>(null);

  const isMyTurn = snap.activeSeat === mySeat;
  const canTradeNow = isMyTurn && snap.phase === 'turnMain';
  const openOffers = useMemo(() => snap.trades.filter((t) => t.status === 'open'), [snap.trades]);

  const bagTotal = (b: Bag): number => RESOURCES.reduce((n, r) => n + (b[r] ?? 0), 0);

  const makeBag = (b: Bag): Record<Resource, number> => ({
    wood: b.wood ?? 0,
    brick: b.brick ?? 0,
    sheep: b.sheep ?? 0,
    wheat: b.wheat ?? 0,
    ore: b.ore ?? 0,
  });

  // Best applicable harbour rate, mirroring the engine (specialty 2, generic 3).
  const bankRate = (giveResource: Resource): number => {
    let rate = 4;
    for (const [eid, harbor] of Object.entries(snap.board.harbors)) {
      const [v1, v2] = snap.board.topology.edgeEndpoints[eid] as [number, number];
      const owns = [v1, v2].some((v) => snap.buildings[v]?.seat === mySeat);
      if (!owns) continue;
      if (harbor.type === 'generic') rate = Math.min(rate, 3);
      else if (harbor.resource === giveResource) rate = 2;
    }
    return rate;
  };

  const bankGive = RESOURCES.find((r) => (give[r] ?? 0) > 0);
  const bankReceive = RESOURCES.find((r) => (receive[r] ?? 0) > 0);
  const rate = bankGive !== undefined ? bankRate(bankGive) : 4;
  const bankValid =
    bankGive !== undefined &&
    bankReceive !== undefined &&
    bankGive !== bankReceive &&
    (snap.you.resources[bankGive] ?? 0) >= rate &&
    (snap.bank[bankReceive] ?? 0) > 0;

  const submitBank = (): void => {
    if (bankGive === undefined || bankReceive === undefined) return;
    const action: GameAction = { type: 'bankTrade', give: bankGive, receive: bankReceive };
    sendAction(action);
    setGive({});
    setReceive({});
  };

  const playerValid =
    isMyTurn &&
    bagTotal(give) > 0 &&
    bagTotal(receive) > 0 &&
    RESOURCES.every(
      (r) => (give[r] ?? 0) <= (snap.you.resources[r] ?? 0) && !((give[r] ?? 0) > 0 && (receive[r] ?? 0) > 0),
    );
  const counterValid = counterOf !== null && bagTotal(give) > 0 && bagTotal(receive) > 0;

  const submitPlayerOffer = (): void => {
    const action: GameAction =
      counterOf === null
        ? { type: 'tradeOffer', give: makeBag(give), receive: makeBag(receive) }
        : { type: 'tradeCounter', offerId: counterOf, give: makeBag(give), receive: makeBag(receive) };
    sendAction(action);
    setGive({});
    setReceive({});
    setCounterOf(null);
  };

  const stepper = (
    bag: Bag,
    setBag: (b: Bag) => void,
    resource: Resource,
    max: number,
    side: 'give' | 'receive',
  ): React.JSX.Element => (
    <div className="flex items-center gap-0.5" key={`${side}-${resource}`}>
      <button
        type="button"
        aria-label={`Less ${resource}`}
        className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 border-line bg-white text-xl font-bold leading-none text-ink active:translate-y-px ${
          (bag[resource] ?? 0) === 0 ? 'opacity-30' : ''
        }`}
        onClick={() => {
          const next = Math.max(0, (bag[resource] ?? 0) - 1);
          setBag({ ...bag, [resource]: next });
        }}
      >
        −
      </button>
      <span className="w-5 text-center font-display text-lg font-bold tabular-nums text-ink" data-testid={`count-${side}-${resource}`}>
        {bag[resource] ?? 0}
      </span>
      <button
        type="button"
        aria-label={`More ${resource}`}
        className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 border-line bg-white text-xl font-bold leading-none text-ink active:translate-y-px ${
          (bag[resource] ?? 0) >= max ? 'opacity-30' : ''
        }`}
        onClick={() => {
          const next = Math.min(max, (bag[resource] ?? 0) + 1);
          setBag({ ...bag, [resource]: next });
        }}
      >
        +
      </button>
    </div>
  );

  // One row per resource: card | give stepper | receive stepper (fits 360px).
  const tradeTable = (
    giveLabel: string,
    receiveLabel: string,
    giveMax: (r: Resource) => number,
    receiveMax: (r: Resource) => number,
  ): React.JSX.Element => (
    <div className="rounded-2xl border-2 border-line bg-white p-2">
      <div className="mb-1 grid grid-cols-[28px_1fr_1fr] items-center gap-1 text-center text-xs font-bold uppercase text-ink-soft">
        <span />
        <span>{giveLabel}</span>
        <span>{receiveLabel}</span>
      </div>
      <div className="flex flex-col gap-1">
        {RESOURCES.map((r) => (
          <div key={r} className="grid grid-cols-[28px_1fr_1fr] items-center justify-items-center gap-1">
            <ResourceCard resource={r} size="sm" count={snap.you.resources[r] ?? 0} title={RESOURCE_META[r].label} />
            {stepper(give, setGive, r, giveMax(r), 'give')}
            {stepper(receive, setReceive, r, receiveMax(r), 'receive')}
          </div>
        ))}
      </div>
    </div>
  );

  const tabBtn = (id: 'bank' | 'player', label: string): React.JSX.Element => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`h-11 flex-1 rounded-xl text-sm font-bold ${tab === id ? 'bg-ink text-white' : 'bg-parchment text-ink'}`}
      aria-pressed={tab === id}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      data-testid="trade-modal"
      onClick={() => setTradeModal(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trade"
        className="flex max-h-[92dvh] w-full max-w-[560px] flex-col gap-3 overflow-y-auto rounded-t-3xl border-2 border-line bg-cream p-3 pb-[max(0.75rem,var(--safe-bottom))] text-ink shadow-2xl sm:rounded-3xl sm:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Trade</h2>
          <button
            type="button"
            onClick={() => setTradeModal(false)}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white text-base font-bold"
            aria-label="Close trade"
            data-testid="close-trade"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2">
          {tabBtn('bank', 'Bank')}
          {tabBtn('player', 'Players')}
        </div>

        {tab === 'bank' ? (
          <div className="flex flex-col gap-3" data-testid="bank-tab">
            <p className="text-sm text-ink-soft">
              {bankGive !== undefined
                ? `Your rate for ${RESOURCE_META[bankGive].label.toLowerCase()}: ${rate}:1`
                : 'Pick one resource to give and one to receive. Harbours improve your rate.'}
            </p>
            {tradeTable(
              'Give',
              'Receive',
              (r) => (r === bankReceive ? 0 : (snap.you.resources[r] ?? 0)),
              (r) => (r === bankGive ? 0 : 9),
            )}
            <button
              type="button"
              disabled={!bankValid || !canTradeNow}
              onClick={submitBank}
              className="h-12 rounded-2xl bg-cta px-4 font-display text-base font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px disabled:opacity-40"
              data-testid="bank-submit"
            >
              Trade {rate}:1 with bank
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3" data-testid="player-tab">
            {tradeTable('You give', 'You get', (r) => snap.you.resources[r] ?? 0, () => 9)}
            <button
              type="button"
              disabled={counterOf !== null ? !counterValid : !playerValid}
              onClick={submitPlayerOffer}
              className="h-12 rounded-2xl bg-cta px-4 font-display text-base font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px disabled:opacity-40"
              data-testid="offer-submit"
            >
              {counterOf !== null ? 'Send counter-offer' : 'Offer to all players'}
            </button>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-bold">Open offers</h3>
              {openOffers.length === 0 ? <p className="text-sm text-ink-soft">No open offers.</p> : null}
              {openOffers.map((offer) => {
                const proposer = snap.players[offer.proposer]!;
                const isMine = offer.proposer === mySeat;
                // Others answer the active player's offers; the active player answers counters.
                const canRespond = !isMine && (isMyTurn ? offer.proposer !== mySeat : offer.proposer === snap.activeSeat);
                const iCanPay = RESOURCES.every((r) => (offer.receive[r] ?? 0) <= (snap.you.resources[r] ?? 0));
                const smallBtn = 'h-11 rounded-xl px-3 text-xs font-bold active:translate-y-px disabled:opacity-40';
                return (
                  <div
                    key={offer.id}
                    className={`flex flex-col gap-1.5 rounded-2xl border-2 border-line bg-white p-2 text-sm ${offer.counterOf !== null ? 'ml-4' : ''}`}
                    data-testid={`offer-${offer.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Avatar name={proposer.name} color={proposer.color} size="sm" />
                      <span className="font-bold">{isMine ? 'You' : proposer.name}</span>
                      <BagCards bag={offer.give} />
                      <span className="font-bold text-ink-soft">⇄</span>
                      <BagCards bag={offer.receive} />
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {canRespond ? (
                        <>
                          <button
                            type="button"
                            disabled={!iCanPay || isMine}
                            onClick={() => {
                              const action: GameAction = { type: 'tradeRespond', offerId: offer.id, response: 'accept' };
                              sendAction(action);
                            }}
                            className={`${smallBtn} bg-go text-white`}
                            data-testid={`accept-${offer.id}`}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const action: GameAction = { type: 'tradeRespond', offerId: offer.id, response: 'decline' };
                              sendAction(action);
                            }}
                            className={`${smallBtn} border-2 border-line bg-parchment text-ink`}
                            data-testid={`decline-${offer.id}`}
                          >
                            Decline
                          </button>
                          {isMyTurn || offer.counterOf !== null ? null : (
                            <button
                              type="button"
                              onClick={() => {
                                setGive(
                                  Object.fromEntries(
                                    RESOURCES.filter((r) => (offer.receive[r] ?? 0) > 0).map((r) => [r, offer.receive[r]]),
                                  ) as Bag,
                                );
                                setReceive(
                                  Object.fromEntries(
                                    RESOURCES.filter((r) => (offer.give[r] ?? 0) > 0).map((r) => [r, offer.give[r]]),
                                  ) as Bag,
                                );
                                setCounterOf(offer.id);
                                setTab('player');
                              }}
                              className={`${smallBtn} bg-[#2f93c9] text-white`}
                              data-testid={`counter-${offer.id}`}
                            >
                              Counter
                            </button>
                          )}
                        </>
                      ) : null}
                      {isMine ? (
                        <button
                          type="button"
                          onClick={() => {
                            const action: GameAction = { type: 'tradeCancel', offerId: offer.id };
                            sendAction(action);
                          }}
                          className={`${smallBtn} bg-[#d7263d] text-white`}
                          data-testid={`cancel-offer-${offer.id}`}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
