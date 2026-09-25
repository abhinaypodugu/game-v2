import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DevCardType, GameAction, Resource, Terrain } from '@catan/shared';
import { RESOURCES, TERRAIN_RESOURCE } from '@catan/shared';
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
  merchant: {
    title: 'The Merchant',
    desc: 'Grants you 2:1 bank trade on ALL resources for the remainder of this turn! Exchange any 2 matching resources for 1 of your choice.',
    confirmLabel: 'Activate 2:1 Merchant',
  },
  taxCollector: {
    title: 'Tax Collector',
    desc: 'Collects taxes from wealthy opponents! Steals 1 random resource card from every player who has strictly more Victory Points than you (or from the player with the most cards if tied or leading).',
    confirmLabel: 'Collect Taxes',
  },
  bountifulHarvest: {
    title: 'Bountiful Harvest',
    desc: 'Choose 1 terrain type (Forest, Hills, Pasture, Fields, or Mountains). Every player receives 1 resource per settlement and 2 resources per city adjacent to hexes of that terrain!',
    confirmLabel: 'Choose Terrain',
  },
  alchemist: {
    title: 'The Alchemist',
    desc: 'Transmute fate itself! Choose the exact outcome of your dice roll (2 to 12) before rolling. Must be played during pre-roll before the dice are cast.',
    confirmLabel: 'Choose Dice Roll',
  },
  surveyor: {
    title: 'The Surveyor',
    desc: 'Remap the realm! Select any two non-desert resource hexes on the island to swap their number tokens with each other.',
    confirmLabel: 'Swap Hex Tokens',
  },
  fortification: {
    title: 'Fortification',
    desc: 'Erect an impenetrable fortress around your realm! You become completely immune to the robber stealing cards from you and immune to 7-roll card discarding until your next turn begins.',
    confirmLabel: 'Fortify Realm',
  },
  spy: {
    title: 'The Spy',
    desc: 'Infiltrate an opponent territory! Choose an opponent to view their card holdings and surgically steal 1 specific resource card of your choice.',
    confirmLabel: 'Infiltrate & Steal',
  },
  oracle: {
    title: 'The Oracle',
    desc: 'Gaze into the future! Look at the top 3 development cards in the deck, select the 1 card you desire to keep in your hand, and shuffle the rest back.',
    confirmLabel: 'Consult Oracle',
  },
  portRenovation: {
    title: 'Port Renovation',
    desc: 'Re-engineer maritime trade! Swap any two coastal harbors on the board with each other to bring favorable trade rates to your ports.',
    confirmLabel: 'Swap Harbors',
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
  const types: DevCardType[] = [
    'knight',
    'victoryPoint',
    'roadBuilding',
    'yearOfPlenty',
    'monopoly',
    'merchant',
    'taxCollector',
    'bountifulHarvest',
    'alchemist',
    'surveyor',
    'fortification',
    'spy',
    'oracle',
    'portRenovation',
  ];
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

// ---------------------------------------------------------------------------
// Expansion Action Modals
// ---------------------------------------------------------------------------

export interface AlchemistModalProps {
  cardId: string;
  onClose: () => void;
}

export function AlchemistModal({ cardId, onClose }: AlchemistModalProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const snap = useStore((s) => s.game);
  const [selectedTotal, setSelectedTotal] = useState<number>(7);

  const diceMap: Record<number, { die1: number; die2: number; pips: number }> = {
    2: { die1: 1, die2: 1, pips: 1 },
    3: { die1: 1, die2: 2, pips: 2 },
    4: { die1: 1, die2: 3, pips: 3 },
    5: { die1: 2, die2: 3, pips: 4 },
    6: { die1: 3, die2: 3, pips: 5 },
    7: { die1: 3, die2: 4, pips: 6 },
    8: { die1: 4, die2: 4, pips: 5 },
    9: { die1: 4, die2: 5, pips: 4 },
    10: { die1: 5, die2: 5, pips: 3 },
    11: { die1: 5, die2: 6, pips: 2 },
    12: { die1: 6, die2: 6, pips: 1 },
  };

  const rollYields = useMemo(() => {
    if (!snap) return {};
    const yields: Record<number, Partial<Record<Resource, number>>> = {};
    for (let r = 2; r <= 12; r++) {
      if (r === 7) continue;
      const resCount: Partial<Record<Resource, number>> = {};
      for (const hexId of snap.board.topology.hexes) {
        const hex = snap.board.hexes[hexId];
        if (!hex || hex.token !== r || snap.board.robberHex === hexId) continue;
        const res = TERRAIN_RESOURCE[hex.terrain];
        if (!res) continue;
        for (const v of snap.board.topology.hexVertices[hexId] ?? []) {
          const b = snap.buildings[v];
          if (b && b.seat === snap.you.seat) {
            const count = b.type === 'settlement' ? 1 : 2;
            resCount[res] = (resCount[res] ?? 0) + count;
          }
        }
      }
      yields[r] = resCount;
    }
    return yields;
  }, [snap]);

  const handleRoll = (total: number): void => {
    const pair = diceMap[total]!;
    const action: GameAction = {
      type: 'playDevCard',
      cardId,
      payload: { roll: { die1: pair.die1, die2: pair.die2 } },
    };
    sendAction(action);
    onClose();
  };

  const rolls = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <Sheet testId="alchemist-modal" title={DEV_META.alchemist.label} icon={DEV_META.alchemist.icon} onClose={onClose}>
      <p className="mb-3 text-xs text-ink-soft">
        Transmute the dice! Choose any roll outcome from 2 to 12. The dice will immediately resolve to this exact roll.
      </p>
      <div className="grid grid-cols-1 gap-1.5 max-h-[50dvh] overflow-y-auto pr-1">
        {rolls.map((r) => {
          const pair = diceMap[r]!;
          const isSelected = selectedTotal === r;
          const isHot = r === 6 || r === 8;
          const isSeven = r === 7;
          const myYield = rollYields[r] ?? {};
          const yieldKeys = Object.keys(myYield) as Resource[];
          const totalYieldCards = yieldKeys.reduce((acc, k) => acc + (myYield[k] ?? 0), 0);

          return (
            <div
              key={r}
              onClick={() => setSelectedTotal(r)}
              className={`flex items-center justify-between rounded-xl border-2 p-2 cursor-pointer transition-all ${
                isSelected
                  ? 'border-cta bg-[#fff8e6] shadow-sm'
                  : 'border-line bg-white hover:border-cta/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl font-display text-lg font-bold border-2 ${
                    isSeven
                      ? 'border-gray-800 bg-gray-900 text-white'
                      : isHot
                        ? 'border-red-600 bg-red-50 text-red-600'
                        : 'border-line bg-parchment text-ink'
                  }`}
                >
                  {r}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-ink">
                      {isSeven ? 'Robber & Discard' : `Roll ${r}`}
                    </span>
                    <span className="text-[10px] text-ink-soft font-mono">
                      {'•'.repeat(pair.pips)}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-soft">
                    {isSeven ? (
                      'Moves robber, steals card, players >7 discard'
                    ) : totalYieldCards > 0 ? (
                      <span className="text-emerald-700 font-semibold">
                        You harvest +{totalYieldCards} ({yieldKeys.map((k) => `${myYield[k]} ${k}`).join(', ')})
                      </span>
                    ) : (
                      'No harvest for you'
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRoll(r);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold font-display shadow-xs transition-transform active:translate-y-px ${
                  isSelected
                    ? 'bg-cta text-ink shadow-[0_2px_0_#a86d08]'
                    : 'bg-parchment border border-line text-ink'
                }`}
              >
                Roll {r}
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => handleRoll(selectedTotal)}
        className="mt-3.5 h-12 w-full rounded-2xl bg-cta font-display text-sm font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px"
      >
        Cast Dice for {selectedTotal}
      </button>
    </Sheet>
  );
}

export interface BountifulHarvestModalProps {
  cardId: string;
  onClose: () => void;
}

type HarvestTerrain = Exclude<Terrain, 'desert'>;

export function BountifulHarvestModal({ cardId, onClose }: BountifulHarvestModalProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const snap = useStore((s) => s.game);
  const [selectedTerrain, setSelectedTerrain] = useState<HarvestTerrain>('fields');

  const harvestableTerrains: HarvestTerrain[] = ['fields', 'forest', 'hills', 'pasture', 'mountains'];

  const terrainStats = useMemo(() => {
    if (!snap) return {};
    const stats: Record<string, { you: number; opponents: number; resource: Resource }> = {};
    for (const t of harvestableTerrains) {
      const res = TERRAIN_RESOURCE[t]!;
      let youAmt = 0;
      let oppAmt = 0;
      for (const hexId of snap.board.topology.hexes) {
        const hex = snap.board.hexes[hexId];
        if (!hex || hex.terrain !== t) continue;
        for (const v of snap.board.topology.hexVertices[hexId] ?? []) {
          const b = snap.buildings[v];
          if (!b) continue;
          const count = b.type === 'settlement' ? 1 : 2;
          if (b.seat === snap.you.seat) youAmt += count;
          else oppAmt += count;
        }
      }
      stats[t] = { you: youAmt, opponents: oppAmt, resource: res };
    }
    return stats;
  }, [snap]);

  const handleHarvest = (t: HarvestTerrain): void => {
    const action: GameAction = {
      type: 'playDevCard',
      cardId,
      payload: { terrain: t },
    };
    sendAction(action);
    onClose();
  };

  return (
    <Sheet testId="bountiful-harvest-modal" title={DEV_META.bountifulHarvest.label} icon={DEV_META.bountifulHarvest.icon} onClose={onClose}>
      <p className="mb-3 text-xs text-ink-soft">
        Select 1 terrain type. Every settlement and city adjacent to that terrain produces resources immediately for all players!
      </p>
      <div className="flex flex-col gap-2">
        {harvestableTerrains.map((t) => {
          const info = terrainStats[t] ?? { you: 0, opponents: 0, resource: 'wheat' as Resource };
          const resMeta = RESOURCE_META[info.resource];
          const isSelected = selectedTerrain === t;
          return (
            <div
              key={t}
              onClick={() => setSelectedTerrain(t)}
              className={`flex items-center justify-between rounded-2xl border-2 p-2.5 cursor-pointer transition-all ${
                isSelected
                  ? 'border-cta bg-[#fff8e6] shadow-sm'
                  : 'border-line bg-white hover:border-cta/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ResourceCard resource={info.resource} size="sm" />
                <div>
                  <div className="font-bold text-sm text-ink capitalize">{t} ({resMeta.label})</div>
                  <div className="text-xs text-ink-soft font-semibold">
                    <span className="text-emerald-700">You gain +{info.you} cards</span> · Opponents gain +{info.opponents}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleHarvest(t);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold font-display shadow-xs transition-transform active:translate-y-px ${
                  isSelected ? 'bg-cta text-ink shadow-[0_2px_0_#a86d08]' : 'bg-parchment border border-line text-ink'
                }`}
              >
                Harvest
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => handleHarvest(selectedTerrain)}
        className="mt-3.5 h-12 w-full rounded-2xl bg-cta font-display text-sm font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px"
      >
        Harvest {RESOURCE_META[TERRAIN_RESOURCE[selectedTerrain]!].label} Now (+{terrainStats[selectedTerrain]?.you ?? 0})
      </button>
    </Sheet>
  );
}

export interface SurveyorModalProps {
  cardId: string;
  onClose: () => void;
}

export function SurveyorModal({ cardId, onClose }: SurveyorModalProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const snap = useStore((s) => s.game);
  const [hex1, setHex1] = useState<string | null>(null);
  const [hex2, setHex2] = useState<string | null>(null);

  const eligibleHexes = useMemo(() => {
    if (!snap) return [];
    return snap.board.topology.hexes
      .filter((h) => {
        const hex = snap.board.hexes[h];
        return hex && hex.terrain !== 'desert' && hex.token !== undefined && hex.token !== null;
      })
      .map((h) => {
        const hex = snap.board.hexes[h]!;
        const playersOnHex = new Set<number>();
        for (const v of snap.board.topology.hexVertices[h] ?? []) {
          const b = snap.buildings[v];
          if (b) playersOnHex.add(b.seat);
        }
        return {
          id: h,
          terrain: hex.terrain,
          resource: TERRAIN_RESOURCE[hex.terrain],
          token: hex.token!,
          hasYou: playersOnHex.has(snap.you.seat),
          playersCount: playersOnHex.size,
        };
      })
      .sort((a, b) => (b.hasYou ? 1 : 0) - (a.hasYou ? 1 : 0) || a.token - b.token);
  }, [snap]);

  const toggleSelect = (id: string): void => {
    if (hex1 === id) {
      setHex1(null);
    } else if (hex2 === id) {
      setHex2(null);
    } else if (hex1 === null) {
      setHex1(id);
    } else if (hex2 === null) {
      setHex2(id);
    } else {
      setHex2(id);
    }
  };

  const handleSwap = (): void => {
    if (!hex1 || !hex2 || hex1 === hex2) return;
    const action: GameAction = {
      type: 'playDevCard',
      cardId,
      payload: { hex1, hex2 },
    };
    sendAction(action);
    onClose();
  };

  const h1Obj = eligibleHexes.find((x) => x.id === hex1);
  const h2Obj = eligibleHexes.find((x) => x.id === hex2);

  return (
    <Sheet testId="surveyor-modal" title={DEV_META.surveyor.label} icon={DEV_META.surveyor.icon} onClose={onClose}>
      <p className="mb-2.5 text-xs text-ink-soft">
        Select 2 resource hexes on the island to swap their number tokens. Boost your high-priority hexes!
      </p>

      {/* Selected Pair Preview */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-line bg-parchment p-2.5 text-xs font-bold text-ink">
        <div className="flex-1 text-center">
          {h1Obj ? (
            <span className="text-emerald-700">
              Hex {h1Obj.id} ({h1Obj.resource}) [#{h1Obj.token}]
            </span>
          ) : (
            <span className="text-ink-soft">Select Hex 1</span>
          )}
        </div>
        <span className="text-base px-2">⇄</span>
        <div className="flex-1 text-center">
          {h2Obj ? (
            <span className="text-emerald-700">
              Hex {h2Obj.id} ({h2Obj.resource}) [#{h2Obj.token}]
            </span>
          ) : (
            <span className="text-ink-soft">Select Hex 2</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 max-h-[46dvh] overflow-y-auto pr-1">
        {eligibleHexes.map((hex) => {
          const isH1 = hex1 === hex.id;
          const isH2 = hex2 === hex.id;
          const isSelected = isH1 || isH2;
          const isHot = hex.token === 6 || hex.token === 8;

          return (
            <button
              key={hex.id}
              type="button"
              onClick={() => toggleSelect(hex.id)}
              className={`flex items-center gap-2 rounded-xl border-2 p-2 text-left transition-all active:translate-y-px ${
                isSelected
                  ? 'border-cta bg-[#fff8e6] ring-2 ring-cta/50'
                  : 'border-line bg-white hover:border-cta/40'
              }`}
            >
              <div
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg font-display text-sm font-bold border ${
                  isHot ? 'border-red-600 bg-red-50 text-red-600' : 'border-line bg-parchment text-ink'
                }`}
              >
                {hex.token}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 font-bold text-xs text-ink truncate capitalize">
                  <span>{hex.resource ?? hex.terrain}</span>
                  {hex.hasYou ? <span className="rounded bg-emerald-100 text-emerald-800 px-1 text-[9px]">Yours</span> : null}
                </div>
                <div className="text-[10px] text-ink-soft">Tile {hex.id}</div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!hex1 || !hex2 || hex1 === hex2}
        onClick={handleSwap}
        className="mt-3.5 h-12 w-full rounded-2xl bg-cta font-display text-sm font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px disabled:opacity-40"
      >
        {hex1 && hex2 ? `Swap Token ${h1Obj?.token} ⇄ ${h2Obj?.token}` : 'Select 2 Hexes'}
      </button>
    </Sheet>
  );
}

export interface PortRenovationModalProps {
  cardId: string;
  onClose: () => void;
}

export function PortRenovationModal({ cardId, onClose }: PortRenovationModalProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const snap = useStore((s) => s.game);
  const [edge1, setEdge1] = useState<string | null>(null);
  const [edge2, setEdge2] = useState<string | null>(null);

  const harborList = useMemo(() => {
    if (!snap) return [];
    return Object.entries(snap.board.harbors).map(([edgeId, harbor]) => {
      const [v1, v2] = edgeId.split('-').map(Number);
      const seats = new Set<number>();
      if (v1 !== undefined && snap.buildings[v1]) seats.add(snap.buildings[v1]!.seat);
      if (v2 !== undefined && snap.buildings[v2]) seats.add(snap.buildings[v2]!.seat);

      const label =
        harbor.type === 'specialty' && harbor.resource
          ? `2:1 ${RESOURCE_META[harbor.resource].label}`
          : '3:1 Any';

      return {
        edgeId,
        harbor,
        label,
        hasYou: seats.has(snap.you.seat),
        owners: [...seats].map((s) => snap.players[s]?.name ?? `Player ${s}`),
      };
    });
  }, [snap]);

  const toggleSelect = (edgeId: string): void => {
    if (edge1 === edgeId) setEdge1(null);
    else if (edge2 === edgeId) setEdge2(null);
    else if (edge1 === null) setEdge1(edgeId);
    else if (edge2 === null) setEdge2(edgeId);
    else setEdge2(edgeId);
  };

  const handleSwap = (): void => {
    if (!edge1 || !edge2 || edge1 === edge2) return;
    const action: GameAction = {
      type: 'playDevCard',
      cardId,
      payload: { edge1, edge2 },
    };
    sendAction(action);
    onClose();
  };

  const h1 = harborList.find((h) => h.edgeId === edge1);
  const h2 = harborList.find((h) => h.edgeId === edge2);

  return (
    <Sheet testId="port-renovation-modal" title={DEV_META.portRenovation.label} icon={DEV_META.portRenovation.icon} onClose={onClose}>
      <p className="mb-2.5 text-xs text-ink-soft">
        Select any 2 coastal harbors on the island to swap their locations. Move favorable trade rates to your own settlements!
      </p>

      {/* Selected Harbors Preview */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-line bg-parchment p-2.5 text-xs font-bold text-ink">
        <div className="flex-1 text-center">
          {h1 ? <span className="text-emerald-700">{h1.label}</span> : <span className="text-ink-soft">Select Harbor 1</span>}
        </div>
        <span className="text-base px-2">⇄</span>
        <div className="flex-1 text-center">
          {h2 ? <span className="text-emerald-700">{h2.label}</span> : <span className="text-ink-soft">Select Harbor 2</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 max-h-[46dvh] overflow-y-auto pr-1">
        {harborList.map((h) => {
          const isH1 = edge1 === h.edgeId;
          const isH2 = edge2 === h.edgeId;
          const isSelected = isH1 || isH2;

          return (
            <button
              key={h.edgeId}
              type="button"
              onClick={() => toggleSelect(h.edgeId)}
              className={`flex items-center justify-between rounded-xl border-2 p-2.5 text-left transition-all active:translate-y-px ${
                isSelected
                  ? 'border-cta bg-[#fff8e6] ring-2 ring-cta/50'
                  : 'border-line bg-white hover:border-cta/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">⚓</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-ink">{h.label}</span>
                    {h.hasYou ? (
                      <span className="rounded bg-emerald-100 text-emerald-800 px-1 py-0.2 text-[9px] font-bold">
                        Your Port
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-ink-soft">
                    {h.owners.length > 0 ? `Occupied by: ${h.owners.join(', ')}` : 'Unsettled coast'}
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-ink-soft">Edge {h.edgeId}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!edge1 || !edge2 || edge1 === edge2}
        onClick={handleSwap}
        className="mt-3.5 h-12 w-full rounded-2xl bg-cta font-display text-sm font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px disabled:opacity-40"
      >
        {edge1 && edge2 ? `Swap ${h1?.label} ⇄ ${h2?.label}` : 'Select 2 Harbors'}
      </button>
    </Sheet>
  );
}

export interface SpyModalProps {
  cardId: string;
  onClose: () => void;
}

export function SpyModal({ cardId, onClose }: SpyModalProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const snap = useStore((s) => s.game);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const opponents = useMemo(() => {
    if (!snap) return [];
    return snap.players.filter(
      (p) => p.seat !== snap.you.seat && p.resourceCount > 0 && !p.isFortified,
    );
  }, [snap]);

  const targetPlayer = opponents.find((p) => p.seat === selectedSeat);

  const handleSteal = (): void => {
    if (selectedSeat === null || !selectedResource) return;
    const action: GameAction = {
      type: 'playDevCard',
      cardId,
      payload: { victim: selectedSeat, resource: selectedResource },
    };
    sendAction(action);
    onClose();
  };

  return (
    <Sheet testId="spy-modal" title={DEV_META.spy.label} icon={DEV_META.spy.icon} onClose={onClose}>
      <p className="mb-3 text-xs text-ink-soft">
        Select an opponent to inspect their resource hand and steal 1 specific resource card of your choice!
      </p>

      {/* Step 1: Select Opponent */}
      <div className="mb-3">
        <label className="block text-[11px] font-bold uppercase text-ink-soft mb-1.5">
          1. Choose Opponent to Infiltrate
        </label>
        {opponents.length === 0 ? (
          <p className="text-xs text-ink-soft py-2">No unfortified opponents currently have resource cards.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {opponents.map((p) => {
              const isSelected = selectedSeat === p.seat;
              return (
                <button
                  key={p.seat}
                  type="button"
                  onClick={() => {
                    setSelectedSeat(p.seat);
                    setSelectedResource(null);
                  }}
                  className={`flex items-center gap-2 rounded-xl border-2 p-2 text-left transition-all active:translate-y-px ${
                    isSelected ? 'border-cta bg-[#fff8e6] ring-2 ring-cta/50' : 'border-line bg-white hover:border-cta/40'
                  }`}
                >
                  <Avatar name={p.name} color={p.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-ink truncate">{p.name}</div>
                    <div className="text-[10px] text-ink-soft font-semibold">{p.resourceCount} cards</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: Pick Resource */}
      {targetPlayer ? (
        <div className="mb-2">
          <label className="block text-[11px] font-bold uppercase text-ink-soft mb-1.5">
            2. Choose Resource to Steal from {targetPlayer.name}
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {RESOURCES.map((r) => {
              const count = targetPlayer.spyResources?.[r];
              const isSelected = selectedResource === r;
              const hasCards = count === undefined || count > 0;
              return (
                <button
                  key={r}
                  type="button"
                  disabled={count !== undefined && count === 0}
                  onClick={() => setSelectedResource(r)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-all active:translate-y-px ${
                    isSelected ? 'border-cta bg-[#fff8e6] ring-2 ring-cta/50' : 'border-line bg-white'
                  } ${count !== undefined && count === 0 ? 'opacity-30' : ''}`}
                >
                  <ResourceCard resource={r} size="sm" />
                  <span className="text-[9px] font-bold uppercase">{RESOURCE_META[r].label}</span>
                  {count !== undefined ? (
                    <span className="text-[10px] font-bold tabular-nums text-ink-soft">({count})</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        disabled={selectedSeat === null || selectedResource === null}
        onClick={handleSteal}
        className="mt-3.5 h-12 w-full rounded-2xl bg-cta font-display text-sm font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px disabled:opacity-40"
      >
        {selectedResource && targetPlayer ? `Steal 1 ${RESOURCE_META[selectedResource].label}` : 'Select Opponent & Card'}
      </button>
    </Sheet>
  );
}

export interface OracleModalProps {
  cardId: string;
  onClose: () => void;
}

export function OracleModal({ cardId, onClose }: OracleModalProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const snap = useStore((s) => s.game);
  const previewCards = snap?.you.oraclePreview ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(previewCards[0]?.id ?? null);

  const handleChoose = (id: string): void => {
    const action: GameAction = {
      type: 'playDevCard',
      cardId,
      payload: { chosenCardId: id },
    };
    sendAction(action);
    onClose();
  };

  const effectiveSelectedId = selectedId ?? previewCards[0]?.id ?? null;

  return (
    <Sheet testId="oracle-modal" title={DEV_META.oracle.label} icon={DEV_META.oracle.icon} onClose={onClose}>
      <p className="mb-3 text-xs text-ink-soft">
        The mists of prophecy part! Choose 1 card to take into your hand. The unchosen cards will be shuffled back into the deck.
      </p>

      {previewCards.length === 0 ? (
        <div className="rounded-xl border border-line bg-parchment p-3 text-center text-xs text-ink-soft">
          No development cards remaining in the deck to foretell.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {previewCards.map((c) => {
            const type = c.type as DevCardType;
            const meta = DEV_META[type] ?? { icon: '🎴', label: type, blurb: '' };
            const desc = DEV_DESCRIPTIONS[type]?.desc ?? meta.blurb;
            const isSelected = effectiveSelectedId === c.id;

            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex items-start gap-3 rounded-2xl border-2 p-3 cursor-pointer transition-all ${
                  isSelected ? 'border-cta bg-[#fff8e6] shadow-sm ring-2 ring-cta/50' : 'border-line bg-white hover:border-cta/40'
                }`}
              >
                <span className="text-3xl flex-none">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-sm text-ink">{meta.label}</span>
                    <span className="text-[10px] font-bold text-ink-soft uppercase">Vision</span>
                  </div>
                  <p className="text-xs text-ink-soft leading-relaxed">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        disabled={previewCards.length === 0 || !effectiveSelectedId}
        onClick={() => {
          if (effectiveSelectedId) handleChoose(effectiveSelectedId);
        }}
        className="mt-3.5 h-12 w-full rounded-2xl bg-cta font-display text-sm font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px disabled:opacity-40"
      >
        Take Chosen Card
      </button>
    </Sheet>
  );
}
