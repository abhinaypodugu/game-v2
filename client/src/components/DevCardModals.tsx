import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { DevCardType, GameAction, Resource } from '@catan/shared';
import { RESOURCES } from '@catan/shared';
import { useStore } from '../store';
import type { PersonalSnapshot, PublicPlayer } from '../types';
import { Avatar } from './PlayerStrip';
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
  if (typeof document === 'undefined') return <></>;
  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4 pt-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] backdrop-blur-xs"
      data-testid={testId}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop-in relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-line bg-cream p-5 text-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white text-base font-bold active:translate-y-px"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="mb-2 flex items-center gap-2 pr-12">
          <span className="text-2xl">{icon}</span>
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        {children}
      </div>
    </div>,
    document.body,
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

export interface DevCardConfirmModalProps {
  card: {
    id: string;
    type: DevCardType;
    playable?: boolean;
    reason?: string;
  };
  onConfirm: () => void;
  onClose: () => void;
}

export const DEV_DESCRIPTIONS: Record<DevCardType, { title: string; desc: string; confirmLabel: string }> = {
  knight: {
    title: 'Knight',
    desc: 'Move the robber to any tile and steal 1 card from an adjacent player. Contributes toward Largest Army (3+ knights = 2 VP).',
    confirmLabel: 'Play Knight',
  },
  roadBuilding: {
    title: 'Road Building',
    desc: 'Place 2 free roads immediately without spending any wood or brick. Great for expanding or claiming Longest Road.',
    confirmLabel: 'Place 2 Roads',
  },
  yearOfPlenty: {
    title: 'Year of Plenty',
    desc: 'Take any 2 resource cards of your choice directly from the bank into your hand. Can be 2 of the same or 2 different resources.',
    confirmLabel: 'Choose Resources',
  },
  monopoly: {
    title: 'Monopoly',
    desc: 'Name 1 resource (Wood, Brick, Sheep, Wheat, or Ore). All other players must surrender all cards of that resource to you.',
    confirmLabel: 'Choose Resource',
  },
  victoryPoint: {
    title: 'Victory Point Card',
    desc: 'Victory Point cards stay hidden in your hand and automatically count toward your victory points to win the game (1 VP).',
    confirmLabel: 'OK',
  },
};

export function DevCardConfirmModal({ card, onConfirm, onClose }: DevCardConfirmModalProps): React.JSX.Element {
  const meta = DEV_META[card.type];
  const info = DEV_DESCRIPTIONS[card.type];
  const isPlayable = card.playable !== false;
  const isVp = card.type === 'victoryPoint';

  return (
    <Sheet testId="dev-card-confirm-modal" title={isPlayable && !isVp ? `Play ${info.title}?` : info.title} icon={meta.icon} onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <div className={`rounded-2xl border-2 p-3.5 shadow-xs ${isVp ? 'border-[#a87a07] bg-[#fffbf0]' : 'border-line bg-white'}`}>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <div className="text-base font-bold text-ink">{meta.label}</div>
              <div className="text-xs font-bold text-ink-soft uppercase tracking-wide">
                {isVp ? '⭐ +1 Victory Point' : 'Action Development Card'}
              </div>
            </div>
          </div>
          <p className="text-sm font-medium text-ink-soft leading-relaxed">{info.desc}</p>
        </div>

        {isVp ? (
          <div className="rounded-xl border border-[#a87a07]/30 bg-[#fff8e6] p-2.5 text-center text-xs font-semibold text-[#8a6300]">
            🏛️ Victory point cards are kept hidden in your hand and count automatically toward winning the game!
          </div>
        ) : isPlayable ? (
          <p className="text-xs text-ink-soft font-semibold text-center">
            ⚠️ Only 1 development card can be played per turn (before or after rolling).
          </p>
        ) : (
          <div className="rounded-xl border border-line bg-parchment p-2.5 text-center text-xs font-semibold text-ink-soft">
            {card.reason ?? '⏳ You cannot play this card right now. Wait for your turn!'}
          </div>
        )}

        <div className={`grid ${isPlayable && !isVp ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5 pt-1`}>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 items-center justify-center rounded-2xl border-2 border-line bg-parchment px-3 font-display text-sm font-bold text-ink shadow-[0_2px_0_#d9cfb8] active:translate-y-px"
            data-testid="dev-confirm-cancel"
          >
            {isPlayable && !isVp ? 'Cancel' : 'Close'}
          </button>
          {isPlayable && !isVp ? (
            <button
              type="button"
              onClick={onConfirm}
              className="flex h-12 items-center justify-center rounded-2xl bg-cta px-3 font-display text-sm font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px"
              data-testid="dev-confirm-play"
            >
              {info.confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

export function DevCardsGuideModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const types: DevCardType[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint'];
  return (
    <Sheet testId="dev-cards-guide-modal" title="Development Cards Guide" icon="🎴" onClose={onClose}>
      <p className="mb-3 text-xs text-ink-soft">
        Development cards cost <b>1 Wheat, 1 Sheep, 1 Ore</b>. You can play 1 dev card per turn (before or after rolling). Cards cannot be played on the turn purchased (except Victory Points).
      </p>
      <div className="flex flex-col gap-2.5 max-h-[58dvh] overflow-y-auto pr-1">
        {types.map((type) => {
          const meta = DEV_META[type];
          const info = DEV_DESCRIPTIONS[type];
          const isVp = type === 'victoryPoint';
          return (
            <div key={type} className={`rounded-2xl border-2 p-3 ${isVp ? 'border-[#a87a07] bg-[#fffbf0]' : 'border-line bg-white'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <h4 className="font-bold text-sm text-ink">{meta.label}</h4>
                  <span className="text-[10px] uppercase font-bold text-ink-soft">
                    {isVp ? '⭐ 1 Victory Point' : 'Action Card'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-ink-soft leading-relaxed">{info.desc}</p>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-3.5 h-12 w-full rounded-2xl bg-cta font-display text-sm font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px"
      >
        Got it!
      </button>
    </Sheet>
  );
}

export interface PlayerInspectModalProps {
  player: PublicPlayer;
  snap: PersonalSnapshot;
  onClose: () => void;
  onOpenGuide: () => void;
  onInspectCard?: (card: { id: string; type: DevCardType; playable?: boolean; reason?: string }) => void;
}

export function PlayerInspectModal({
  player,
  snap,
  onClose,
  onOpenGuide,
  onInspectCard,
}: PlayerInspectModalProps): React.JSX.Element {
  const isYou = player.seat === snap.you.seat;
  const isFinished = snap.winner !== null || snap.phase === 'finished';
  const vp = isYou ? snap.you.totalVp : (player.totalVp ?? player.publicVp);

  const buildings = Object.values(snap.buildings).filter((b) => b.seat === player.seat);
  const settlements = buildings.filter((b) => b.type === 'settlement').length;
  const cities = buildings.filter((b) => b.type === 'city').length;
  const roads = 15 - player.roadsLeft;
  const hasLongestRoad = snap.longestRoad.holder === player.seat;
  const hasLargestArmy = snap.largestArmy.holder === player.seat;

  const vpCards = isYou
    ? snap.you.devHand.filter((c) => c.type === 'victoryPoint').length
    : (player.devCards?.filter((c) => c.type === 'victoryPoint').length ?? 0);

  const ownCards = isYou ? snap.you.devHand : [];
  const revealedCards = isFinished ? (player.devCards ?? []) : [];

  return (
    <Sheet testId="player-inspect-modal" title={player.name} icon="👤" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {/* Header banner */}
        <div className="flex items-center gap-3 rounded-2xl border-2 border-line bg-white p-3 shadow-xs">
          <Avatar name={player.name} color={player.color} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-ink truncate">{player.name}</span>
              {isYou ? (
                <span className="rounded-full bg-cta/20 px-2 py-0.5 text-[10px] font-bold text-ink">You</span>
              ) : null}
              {snap.winner === player.seat ? (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-ink">👑 Winner</span>
              ) : null}
            </div>
            <div className="text-xs font-semibold text-ink-soft">
              {player.connected ? '🟢 Connected' : '⚪ Disconnected'} · {player.roadsLeft} roads left
            </div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl bg-parchment px-3 py-1">
            <span className="font-display text-xl font-bold text-ink">{vp}</span>
            <span className="text-[9px] uppercase font-bold text-ink-soft">Points</span>
          </div>
        </div>

        {/* Victory Point Breakdown */}
        <div className="rounded-2xl border-2 border-line bg-white p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-2">Victory Point Breakdown</h4>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-parchment px-2.5 py-1.5 font-bold">
              <span>🏠 Settlements ({settlements})</span>
              <span className="text-ink">+{settlements} VP</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-parchment px-2.5 py-1.5 font-bold">
              <span>🏰 Cities ({cities})</span>
              <span className="text-ink">+{cities * 2} VP</span>
            </div>
            <div className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 font-bold ${hasLongestRoad ? 'bg-[#fde7b0] text-[#7a5200]' : 'bg-parchment text-ink-soft'}`}>
              <span>🛣️ Longest Road</span>
              <span>{hasLongestRoad ? '+2 VP' : '0'}</span>
            </div>
            <div className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 font-bold ${hasLargestArmy ? 'bg-[#fcd5d5] text-[#8a1424]' : 'bg-parchment text-ink-soft'}`}>
              <span>⚔️ Largest Army</span>
              <span>{hasLargestArmy ? '+2 VP' : '0'}</span>
            </div>
            {isYou || isFinished ? (
              <div className="col-span-2 flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 font-bold text-amber-900">
                <span>🏛️ Victory Point Cards ({vpCards})</span>
                <span>+{vpCards} VP</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Holdings & Supply */}
        <div className="rounded-2xl border-2 border-line bg-white p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-2">Pieces & Cards</h4>
          <div className="grid grid-cols-4 gap-1 text-center">
            <div className="rounded-xl bg-parchment p-1.5">
              <div className="text-base font-bold text-ink">{roads}</div>
              <div className="text-[9px] font-bold text-ink-soft uppercase">Roads</div>
            </div>
            <div className="rounded-xl bg-parchment p-1.5">
              <div className="text-base font-bold text-ink">{player.resourceCount}</div>
              <div className="text-[9px] font-bold text-ink-soft uppercase">Cards</div>
            </div>
            <div className="rounded-xl bg-parchment p-1.5">
              <div className="text-base font-bold text-ink">{player.playedKnights}</div>
              <div className="text-[9px] font-bold text-ink-soft uppercase">Knights</div>
            </div>
            <div className="rounded-xl bg-parchment p-1.5">
              <div className="text-base font-bold text-ink">{player.devCardCount}</div>
              <div className="text-[9px] font-bold text-ink-soft uppercase">Dev Cards</div>
            </div>
          </div>
        </div>

        {/* Development Cards Section */}
        <div className="rounded-2xl border-2 border-line bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft">Development Cards</h4>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenGuide();
              }}
              className="text-[11px] font-bold text-cta underline"
            >
              📖 Card Guide
            </button>
          </div>

          {isYou ? (
            ownCards.length === 0 ? (
              <p className="text-xs text-ink-soft py-1">You currently have no development cards.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {ownCards.map((c) => {
                  const meta = DEV_META[c.type as DevCardType] ?? { icon: '🎴', label: c.type };
                  const isVp = c.type === 'victoryPoint';
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-line bg-parchment p-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{meta.icon}</span>
                        <div>
                          <span className="text-xs font-bold text-ink">{meta.label}</span>
                          <span className="block text-[10px] text-ink-soft">
                            {isVp ? '⭐ Secret 1 VP' : c.played ? 'Played' : 'In hand'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onInspectCard?.({
                            id: c.id,
                            type: c.type as DevCardType,
                            playable: false,
                            reason: isVp
                              ? 'Victory Point cards stay in your hand and automatically count toward your victory points!'
                              : 'Reviewing card details. You can play this on your turn!',
                          });
                        }}
                        className="rounded-lg bg-white border border-line px-2.5 py-1 text-xs font-bold text-ink shadow-xs"
                      >
                        Details
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : isFinished && revealedCards.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {revealedCards.map((c, i) => {
                const meta = DEV_META[c.type as DevCardType] ?? { icon: '🎴', label: c.type };
                return (
                  <div key={c.id ?? i} className="flex items-center gap-2 rounded-xl border border-line bg-parchment p-2">
                    <span className="text-xl">{meta.icon}</span>
                    <span className="text-xs font-bold text-ink">{meta.label}</span>
                    <span className="ml-auto text-[10px] font-bold text-ink-soft">
                      {c.played ? 'Played' : 'Unplayed'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-1 text-xs text-ink-soft">
              <div className="flex items-center gap-2 py-1">
                <span>⚔️</span>
                <span><b>{player.playedKnights}</b> Knights played publicly</span>
              </div>
              <div className="flex items-center gap-2 py-1">
                <span>🎴</span>
                <span><b>{player.devCardCount}</b> development cards in hand (hidden until played)</span>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-1 h-12 w-full rounded-2xl bg-parchment border-2 border-line font-display text-sm font-bold text-ink shadow-[0_2px_0_#d9cfb8] active:translate-y-px"
        >
          Close
        </button>
      </div>
    </Sheet>
  );
}
