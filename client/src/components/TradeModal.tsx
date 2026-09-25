// Trade sheet: bank (harbour rates) + player offers with counters,
// accept/decline. Bottom sheet on phones, centred dialog on larger screens.

import { useMemo, useState } from 'react';
import type { GameAction, GameState, Resource } from '@catan/shared';
import { bestTradeRate, RESOURCES } from '@catan/shared';
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

  // Best applicable harbour rate, mirroring the engine (specialty 2, generic 3, merchant 2, default 4).
  const bankRate = (giveResource: Resource): number => {
    return bestTradeRate(snap as unknown as GameState, mySeat, giveResource);
  };

  const totalGiveCards = RESOURCES.reduce((n, r) => n + (give[r] ?? 0), 0);
  const totalReceiveCards = RESOURCES.reduce((n, r) => n + (receive[r] ?? 0), 0);

  // Each resource given provides credits: floor(count / bankRate(r))
  const creditsByResource = useMemo(() => {
    const res: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    for (const r of RESOURCES) {
      const count = give[r] ?? 0;
      const rate = bankRate(r);
      res[r] = Math.floor(count / rate);
    }
    return res;
  }, [give, snap, mySeat]);

  const totalCredits = RESOURCES.reduce((n, r) => n + creditsByResource[r], 0);

  // Check that all given resources are exact multiples of their bank rate and player has enough
  const giveValid =
    totalCredits > 0 &&
    RESOURCES.every((r) => {
      const count = give[r] ?? 0;
      if (count === 0) return true;
      const rate = bankRate(r);
      return count % rate === 0 && count <= (snap.you.resources[r] ?? 0);
    });

  const isBankCountHidden = snap.rules.hideBankCardsCount === true || Object.values(snap.bank).some((n) => n < 0);

  // Check that receive cards match total credits, bank has enough stock (if visible), and no give/receive overlap
  const receiveValid =
    totalReceiveCards === totalCredits &&
    RESOURCES.every((r) => {
      const count = receive[r] ?? 0;
      if (count === 0) return true;
      if ((give[r] ?? 0) > 0) return false;
      return isBankCountHidden ? true : count <= (snap.bank[r] ?? 0);
    });

  const bankValid = giveValid && receiveValid;

  const submitBank = (): void => {
    if (!bankValid || !canTradeNow) return;

    // Decompose multi-trades into atomic bankTrade actions
    const giveBundles: Resource[] = [];
    for (const r of RESOURCES) {
      const bundles = creditsByResource[r];
      for (let i = 0; i < bundles; i++) {
        giveBundles.push(r);
      }
    }

    const receiveCards: Resource[] = [];
    for (const r of RESOURCES) {
      const count = receive[r] ?? 0;
      for (let i = 0; i < count; i++) {
        receiveCards.push(r);
      }
    }

    for (let i = 0; i < giveBundles.length; i++) {
      const action: GameAction = {
        type: 'bankTrade',
        give: giveBundles[i]!,
        receive: receiveCards[i]!,
      };
      sendAction(action);
    }

    setGive({});
    setReceive({});
  };

  const bankButtonText = (): string => {
    if (!canTradeNow) return 'Wait for your turn to trade';
    if (totalCredits === 0 && totalReceiveCards === 0) return 'Select resources to trade';
    if (totalCredits === 0) return 'Offer more resources to trade';
    if (totalReceiveCards < totalCredits) {
      const needed = totalCredits - totalReceiveCards;
      return `Pick ${needed} more card${needed > 1 ? 's' : ''}`;
    }
    if (totalReceiveCards > totalCredits) {
      const extra = totalReceiveCards - totalCredits;
      return `Reduce requested by ${extra}`;
    }
    return `Trade ${totalGiveCards}:${totalReceiveCards} with bank`;
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
    step: number = 1,
    subLabel?: string,
  ): React.JSX.Element => (
    <div className="flex flex-col items-center" key={`${side}-${resource}`}>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label={`Less ${resource}`}
          className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 border-line bg-white text-xl font-bold leading-none text-ink active:translate-y-px ${
            (bag[resource] ?? 0) === 0 ? 'opacity-30' : ''
          }`}
          onClick={() => {
            const current = bag[resource] ?? 0;
            const next = Math.max(0, current - step);
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
            const current = bag[resource] ?? 0;
            const next = Math.min(max, current + step);
            setBag({ ...bag, [resource]: next });
          }}
        >
          +
        </button>
      </div>
      {subLabel ? <span className="mt-0.5 text-[10px] font-semibold text-ink-soft">{subLabel}</span> : null}
    </div>
  );

  // One row per resource: card | give stepper | receive stepper (fits 360px).
  const tradeTable = (
    giveLabel: string,
    receiveLabel: string,
    giveMax: (r: Resource) => number,
    receiveMax: (r: Resource) => number,
    giveStep: (r: Resource) => number = () => 1,
    giveSubLabel?: (r: Resource) => string | undefined,
    receiveSubLabel?: (r: Resource) => string | undefined,
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
            {stepper(give, setGive, r, giveMax(r), 'give', giveStep(r), giveSubLabel?.(r))}
            {stepper(receive, setReceive, r, receiveMax(r), 'receive', 1, receiveSubLabel?.(r))}
          </div>
        ))}
      </div>
    </div>
  );

  const tabBtn = (id: 'bank' | 'player', label: string): React.JSX.Element => (
    <button
      type="button"
      onClick={() => {
        if (tab !== id) {
          setTab(id);
          setGive({});
          setReceive({});
          setCounterOf(null);
        }
      }}
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-soft">
                {totalGiveCards > 0
                  ? totalCredits > 0
                    ? totalReceiveCards === totalCredits
                      ? `Ready: ${totalGiveCards}:${totalReceiveCards} trade (${totalCredits} bundle${totalCredits > 1 ? 's' : ''})`
                      : `You have ${totalCredits} credit${totalCredits > 1 ? 's' : ''}. Choose ${totalCredits} card${totalCredits > 1 ? 's' : ''}.`
                    : 'Add more cards to complete a bundle.'
                  : 'Trade resource bundles at your harbor rates (2:1, 3:1, or 4:1).'}
              </p>
              {totalGiveCards > 0 || totalReceiveCards > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setGive({});
                    setReceive({});
                  }}
                  className="text-xs font-bold text-ink-soft underline hover:text-ink"
                >
                  Reset
                </button>
              ) : null}
            </div>
            {tradeTable(
              'Give',
              'Receive',
              (r) =>
                (receive[r] ?? 0) > 0
                  ? 0
                  : Math.floor((snap.you.resources[r] ?? 0) / bankRate(r)) * bankRate(r),
              (r) => ((give[r] ?? 0) > 0 ? 0 : isBankCountHidden ? totalCredits || 9 : Math.max(0, snap.bank[r] ?? 0)),
              (r) => bankRate(r),
              (r) => `${bankRate(r)}:1 rate`,
              (r) => (isBankCountHidden ? 'in bank: ?' : `${snap.bank[r] ?? 0} in bank`),
            )}
            <button
              type="button"
              disabled={!bankValid || !canTradeNow}
              onClick={submitBank}
              className="h-12 rounded-2xl bg-cta px-4 font-display text-base font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px disabled:opacity-40"
              data-testid="bank-submit"
            >
              {bankButtonText()}
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
