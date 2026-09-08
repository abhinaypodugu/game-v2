// Trade modal: bank + player tabs, offers with counters, accept/decline.

import { useMemo, useState } from 'react';
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

type Bag = Partial<Record<Resource, number>>;

export function TradeModal({ mySeat }: { mySeat: number }): React.JSX.Element {
  const snap = useStore((s) => s.game)!;
  const sendAction = useStore((s) => s.sendAction);
  const setTradeModal = useStore((s) => s.setTradeModal);
  const [tab, setTab] = useState<'bank' | 'player'>('bank');
  const [give, setGive] = useState<Bag>({});
  const [receive, setReceive] = useState<Bag>({});
  const [counterOf, setCounterOf] = useState<string | null>(null);

  const isMyTurn = snap.activeSeat === mySeat;
  const openOffers = useMemo(() => snap.trades.filter((t) => t.status === 'open'), [snap.trades]);

  const bagTotal = (b: Bag): number =>
    RESOURCES.reduce((n, r) => n + (b[r] ?? 0), 0);

  const makeBag = (b: Bag): Record<Resource, number> => ({
    wood: b.wood ?? 0,
    brick: b.brick ?? 0,
    sheep: b.sheep ?? 0,
    wheat: b.wheat ?? 0,
    ore: b.ore ?? 0,
  });

  const bankRate = (giveResource: Resource): number => {
    const me = snap.players[mySeat]!;
    // Best applicable harbor rate, mirroring the engine (specialty 2, generic 3).
    let rate = 4;
    for (const [eid, harbor] of Object.entries(snap.board.harbors)) {
      const [v1, v2] = snap.board.topology.edgeEndpoints[eid] as [number, number];
      const owns = [v1, v2].some((v) => snap.buildings[v]?.seat === mySeat);
      if (!owns) continue;
      if (harbor.type === 'generic') rate = Math.min(rate, 3);
      else if (harbor.resource === giveResource) rate = 2;
    }
    void me;
    return rate;
  };

  const bankGive = Object.keys(give).find((r) => (give[r as Resource] ?? 0) > 0) as Resource | undefined;
  const bankReceive = Object.keys(receive).find((r) => (receive[r as Resource] ?? 0) > 0) as Resource | undefined;
  const rate = bankGive !== undefined ? bankRate(bankGive) : 4;
  const bankValid =
    bankGive !== undefined &&
    bankReceive !== undefined &&
    bankGive !== bankReceive &&
    (snap.you.resources[bankGive] ?? 0) >= rate;

  const submitBank = (): void => {
    if (bankGive === undefined || bankReceive === undefined) return;
    const action: GameAction = { type: 'bankTrade', give: bankGive, receive: bankReceive };
    sendAction(action);
    setGive({});
    setReceive({});
  };

  const playerGiveTotal = bagTotal(give);
  const playerReceiveTotal = bagTotal(receive);
  const playerValid =
    isMyTurn &&
    playerGiveTotal > 0 &&
    playerReceiveTotal > 0 &&
    RESOURCES.every(
      (r) =>
        (give[r] ?? 0) <= (snap.you.resources[r] ?? 0) &&
        !((give[r] ?? 0) > 0 && (receive[r] ?? 0) > 0),
    );

  const submitPlayerOffer = (): void => {
    const action: GameAction = counterOf === null
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
    <div className="flex items-center gap-2" key={resource}>
      <span className="w-6 text-xl">{RESOURCE_EMOJI[resource]}</span>
      <button
        type="button"
        className="h-7 w-7 rounded bg-black/30 text-lg leading-none"
        onClick={() => {
          const next = Math.max(0, (bag[resource] ?? 0) - 1);
          setBag({ ...bag, [resource]: next });
        }}
      >
        −
      </button>
      <span className="w-6 text-center font-bold" data-testid={`count-${side}-${resource}`}>
        {bag[resource] ?? 0}
      </span>
      <button
        type="button"
        className="h-7 w-7 rounded bg-black/30 text-lg leading-none"
        onClick={() => {
          const next = Math.min(max, (bag[resource] ?? 0) + 1);
          setBag({ ...bag, [resource]: next });
        }}
      >
        +
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid="trade-modal">
      <div className="w-[560px] rounded-xl bg-[#0a4986] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[Bricolage_Grotesque,system-ui] text-2xl font-bold">Trade</h2>
          <button
            type="button"
            onClick={() => setTradeModal(false)}
            className="rounded-lg bg-black/30 px-3 py-1 text-lg"
            data-testid="close-trade"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('bank')}
            className={`rounded-lg px-4 py-1.5 font-semibold ${tab === 'bank' ? 'bg-[#1062b0]' : 'bg-black/20'}`}
          >
            Bank
          </button>
          <button
            type="button"
            onClick={() => setTab('player')}
            className={`rounded-lg px-4 py-1.5 font-semibold ${tab === 'player' ? 'bg-[#1062b0]' : 'bg-black/20'}`}
          >
            Players
          </button>
        </div>

        {tab === 'bank' ? (
          <div className="flex flex-col gap-4" data-testid="bank-tab">
            <p className="text-sm text-[#cfe0ee]">
              {bankGive !== undefined
                ? `Rate: ${rate}:1 (${snap.board.harbors !== undefined ? 'best harbor applies' : 'default 4:1'})`
                : 'Pick one resource to give and one to receive.'}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Give</h3>
                <div className="flex flex-col gap-2">
                  {RESOURCES.map((r) =>
                    stepper(give, setGive, r, r === bankReceive ? 0 : snap.you.resources[r] ?? 0, 'give'),
                  )}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Receive</h3>
                <div className="flex flex-col gap-2">
                  {RESOURCES.map((r) => stepper(receive, setReceive, r, r === bankGive ? 0 : 9, 'receive'))}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={!bankValid || !isMyTurn}
              onClick={submitBank}
              className="rounded-lg bg-[#f06800] px-4 py-2 font-bold text-white disabled:opacity-40"
              data-testid="bank-submit"
            >
              Trade {rate}:1 with bank
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4" data-testid="player-tab">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold">You give</h3>
                <div className="flex flex-col gap-2">
                  {RESOURCES.map((r) => stepper(give, setGive, r, snap.you.resources[r] ?? 0, 'give'))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">You receive</h3>
                <div className="flex flex-col gap-2">
                  {RESOURCES.map((r) => stepper(receive, setReceive, r, 9, 'receive'))}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={!playerValid}
              onClick={submitPlayerOffer}
              className="rounded-lg bg-[#f06800] px-4 py-2 font-bold text-white disabled:opacity-40"
              data-testid="offer-submit"
            >
              {counterOf !== null ? 'Send counter-offer' : 'Offer to all players'}
            </button>

            <div className="max-h-48 overflow-y-auto">
              <h3 className="mb-2 text-sm font-semibold">Open offers</h3>
              {openOffers.length === 0 ? (
                <p className="text-sm text-[#9fb8cc]">No open offers.</p>
              ) : null}
              {openOffers.map((offer) => {
                const proposer = snap.players[offer.proposer]!;
                const isMine = offer.proposer === mySeat;
                const canRespond = isMyTurn ? !isMine : true;
                const iCanPay = RESOURCES.every(
                  (r) => (offer.receive[r] ?? 0) <= (snap.you.resources[r] ?? 0),
                );
                return (
                  <div
                    key={offer.id}
                    className={`mb-2 rounded-lg bg-black/20 p-3 text-sm ${offer.counterOf !== null ? 'ml-4' : ''}`}
                    data-testid={`offer-${offer.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {proposer.name}: {RESOURCES.filter((r) => (offer.give[r] ?? 0) > 0).map((r) => `${RESOURCE_EMOJI[r]}${offer.give[r]}`).join(' ')}
                        {' → '}
                        {RESOURCES.filter((r) => (offer.receive[r] ?? 0) > 0).map((r) => `${RESOURCE_EMOJI[r]}${offer.receive[r]}`).join(' ')}
                      </span>
                      {canRespond ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!iCanPay || isMine}
                            onClick={() => {
                              const action: GameAction = { type: 'tradeRespond', offerId: offer.id, response: 'accept' };
                              sendAction(action);
                            }}
                            className="rounded bg-[#1fab1c] px-2 py-1 text-xs font-bold disabled:opacity-40"
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
                            className="rounded bg-black/40 px-2 py-1 text-xs font-bold"
                            data-testid={`decline-${offer.id}`}
                          >
                            Decline
                          </button>
                          {isMyTurn || isMine ? null : (
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
                              className="rounded bg-[#1e90ff] px-2 py-1 text-xs font-bold"
                              data-testid={`counter-${offer.id}`}
                            >
                              Counter
                            </button>
                          )}
                        </div>
                      ) : null}
                      {isMine ? (
                        <button
                          type="button"
                          onClick={() => {
                            const action: GameAction = { type: 'tradeCancel', offerId: offer.id };
                            sendAction(action);
                          }}
                          className="rounded bg-[#ef3f2a] px-2 py-1 text-xs font-bold"
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
