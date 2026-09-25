// Bottom dock: my hand (colonist-style resource cards + dev cards) and the
// big-button action bar (Trade, Road, Settlement, City, Dev card, and the
// primary Roll / End turn slot). Lives in document flow at the bottom of the
// game layout, so it never overlaps the board region or the status line.

import { memo, useMemo } from 'react';
import type { DevCardType, GameAction } from '@catan/shared';
import { BUILD_COSTS, RESOURCES, canAfford } from '@catan/shared';
import type { PersonalSnapshot } from '../types';
import type { LegalMoves } from '../hooks/useLegalMoves';
import { useStore, type PlacementMode } from '../store';
import { CostPips, DEV_META, ResourceCard, costLabel } from './resourceArt';
import { playerColor } from './PlayerStrip';

export interface ColonistBottomDockProps {
  snap: PersonalSnapshot;
  legal: LegalMoves;
  /** My build window: my main/pre-roll turn or my special-build slot. */
  canAct: boolean;
  placement: PlacementMode | null;
  setupVertex?: number | null;
  onArm: (kind: 'settlement' | 'city' | 'road') => void;
  onPlayDevCard: (card: { id: string; type: string }) => void;
}

type PieceKind = 'road' | 'settlement' | 'city';

/** Flat player-coloured piece silhouettes with a dark outline. */
function PieceIcon({ kind, color, className = 'h-6 w-6' }: { kind: PieceKind; color: string; className?: string }): React.JSX.Element {
  const c = playerColor(color);
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g fill={c.main} stroke="#1f2a37" strokeWidth="1.6" strokeLinejoin="round">
        {kind === 'road' ? <rect x="2" y="9" width="20" height="6" rx="3" transform="rotate(-30 12 12)" /> : null}
        {kind === 'settlement' ? <path d="M4 11 L12 4 L20 11 V20 H4 Z" /> : null}
        {kind === 'city' ? (
          <>
            <path d="M2 12 L7 7.5 L12 12 V21 H2 Z" />
            <path d="M11 21 V9 L16.5 4 L22 9 V21 Z" />
          </>
        ) : null}
      </g>
    </svg>
  );
}

interface DevGroup {
  key: string;
  type: DevCardType;
  ids: string[];
  fresh: boolean;
}

const actionBase =
  'relative flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-0.5 font-bold leading-none transition-[transform,opacity] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0';
const actionIdle = 'border-line bg-white text-ink shadow-[0_3px_0_#d9cfb8]';
const actionArmed = 'border-cta bg-[#fff1d6] text-ink shadow-[0_3px_0_#c98612]';

function CountBadge({ n }: { n: number }): React.JSX.Element {
  return (
    <span className="absolute -top-1.5 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-ink px-1 text-[10px] font-bold text-white tabular-nums">
      {n}
    </span>
  );
}

export const ColonistBottomDock = memo(function ColonistBottomDock({
  snap,
  legal,
  canAct,
  placement,
  setupVertex,
  onArm,
  onPlayDevCard,
}: ColonistBottomDockProps): React.JSX.Element {
  const sendAction = useStore((s) => s.sendAction);
  const setTradeModal = useStore((s) => s.setTradeModal);

  const { you, activeSeat, players, phase, specialBuildSeat, turn } = snap;
  const mySeat = you.seat;
  const myTurn = activeSeat === mySeat;
  const sbpWindow = specialBuildSeat === mySeat;
  const isSetupActor = (phase === 'setupForward' || phase === 'setupReverse') && myTurn;
  const player = players[mySeat]!;
  const handTotal = RESOURCES.reduce((n, r) => n + (you.resources[r] ?? 0), 0);

  const canRoad = canAct && legal.roadEdges.size > 0;
  const canSettlement = canAct && legal.settlementVertices.size > 0;
  const canCity = canAct && legal.cityVertices.size > 0;
  const canDevCard = canAct && snap.devDeckCount > 0 && canAfford(you.resources, BUILD_COSTS.devCard);
  const canTrade = phase !== 'finished';
  // One development card per turn, before or after rolling.
  const devWindow = myTurn && (phase === 'turnMain' || phase === 'turnPreroll') && !snap.devCardPlayedThisTurn;
  const noFreeRoad = legal.freeRoadEdges([]).size === 0;

  // Group unplayed dev cards by type + "bought this turn" so the row stays narrow.
  const devGroups = useMemo((): DevGroup[] => {
    const groups = new Map<string, DevGroup>();
    for (const c of you.devHand) {
      if (c.played) continue;
      const type = c.type as DevCardType;
      const fresh = type !== 'victoryPoint' && c.boughtOnTurn >= turn;
      const key = `${type}:${fresh ? 'new' : 'ok'}`;
      const g = groups.get(key);
      if (g === undefined) groups.set(key, { key, type, ids: [c.id], fresh });
      else g.ids.push(c.id);
    }
    return [...groups.values()];
  }, [you.devHand, turn]);

  const build = (kind: PieceKind, enabled: boolean, left: number): React.JSX.Element => {
    const armed = placement?.kind === kind;
    const label = kind === 'road' ? 'Road' : kind === 'settlement' ? 'Settle' : 'City';
    const isSetupHighlight = isSetupActor && ((kind === 'settlement' && setupVertex === null) || (kind === 'road' && setupVertex !== null));
    return (
      <button
        type="button"
        disabled={!enabled && !armed && !isSetupActor}
        onClick={() => {
          if (isSetupActor) {
            useStore.getState().pushToast(
              setupVertex === null
                ? 'Tap any glowing spot on the board to place your settlement!'
                : 'Now tap any glowing road edge connected to your settlement!',
              'info',
            );
            return;
          }
          onArm(kind);
        }}
        className={`${actionBase} ${armed || isSetupHighlight ? actionArmed : actionIdle}`}
        title={`${label} (${costLabel(BUILD_COSTS[kind])}) — ${left} left`}
        aria-pressed={armed || isSetupHighlight}
        data-testid={`btn-build-${kind}`}
      >
        <CountBadge n={left} />
        <PieceIcon kind={kind} color={player.color} />
        <span className="text-[10px]">{label}</span>
        <CostPips cost={BUILD_COSTS[kind]} />
      </button>
    );
  };

  let primary: React.JSX.Element;
  if (myTurn && phase === 'turnPreroll') {
    primary = (
      <button
        type="button"
        onClick={() => {
          const action: GameAction = { type: 'rollDice' };
          sendAction(action);
        }}
        className={`${actionBase} border-[#c98612] bg-cta text-ink shadow-[0_3px_0_#a86d08]`}
        data-testid="roll-button"
      >
        <span className="text-xl leading-none">🎲</span>
        <span className="font-display text-sm">Roll</span>
      </button>
    );
  } else if (myTurn && phase === 'turnMain') {
    primary = (
      <button
        type="button"
        onClick={() => {
          const action: GameAction = { type: 'endTurn' };
          sendAction(action);
        }}
        className={`${actionBase} border-[#1d7a2c] bg-go text-white shadow-[0_3px_0_#1d7a2c]`}
        data-testid="end-turn"
      >
        <span className="text-lg leading-none">➜</span>
        <span className="font-display text-sm">End turn</span>
      </button>
    );
  } else if (sbpWindow) {
    primary = (
      <button
        type="button"
        onClick={() => {
          const action: GameAction = { type: 'specialBuildDone' };
          sendAction(action);
        }}
        className={`${actionBase} border-[#1d7a2c] bg-go text-white shadow-[0_3px_0_#1d7a2c]`}
        data-testid="sbp-done"
      >
        <span className="text-lg leading-none">✓</span>
        <span className="font-display text-sm">Done</span>
      </button>
    );
  } else if (isSetupActor) {
    primary = (
      <div
        className={`${actionBase} border-[#c98612] bg-[#fff6dc] text-ink shadow-[0_3px_0_#a86d08] animate-pulse px-0.5 text-center`}
        data-testid="setup-place-prompt"
      >
        <span className="text-base leading-none">{setupVertex !== null ? '🛣️' : '🏠'}</span>
        <span className="font-display text-[10px] leading-tight">
          {setupVertex !== null ? 'Tap road' : 'Tap settlement'}
        </span>
      </div>
    );
  } else {
    const waitingFor = players[activeSeat]?.name;
    primary = (
      <button type="button" disabled className={`${actionBase} ${actionIdle}`} data-testid="waiting-turn">
        <span className="text-lg leading-none">⏳</span>
        <span className="text-[10px] truncate max-w-full px-0.5">
          {waitingFor ? `${waitingFor}…` : 'Waiting'}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5" data-testid="colonist-bottom-dock">
      {/* Hand: resource cards + dev cards */}
      <div className="flex items-end gap-1.5 rounded-2xl border-2 border-line bg-cream px-1.5 pt-2 pb-1.5 shadow-[0_2px_0_rgba(0,0,0,0.12)]">
        <div className="flex flex-none items-end gap-1" data-anchor="hand" data-testid="hand" aria-label={`Your hand: ${handTotal} cards`}>
          {RESOURCES.map((r) => {
            const count = you.resources[r] ?? 0;
            return <ResourceCard key={r} resource={r} count={count} size="lg" dim={count === 0} />;
          })}
        </div>
        <div className="scrollbar-none flex min-w-0 flex-1 items-end gap-1 overflow-x-auto border-l-2 border-line pl-1.5" data-testid="dev-hand">
          {devGroups.length === 0 ? (
            <span className="self-center px-1 text-[10px] font-bold leading-tight text-ink-soft">No dev cards</span>
          ) : null}
          {devGroups.map((g) => {
            const meta = DEV_META[g.type];
            const isVp = g.type === 'victoryPoint';
            const playable = !isVp && !g.fresh && devWindow && !(g.type === 'roadBuilding' && noFreeRoad);
            return (
              <button
                key={g.key}
                type="button"
                disabled={!playable}
                onClick={() => onPlayDevCard({ id: g.ids[0]!, type: g.type })}
                className={`relative flex h-16 w-11 flex-none flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-0.5 shadow-[0_2px_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-px sm:h-20 sm:w-14 ${
                  isVp ? 'border-[#a87a07] bg-[#fff4cc]' : 'border-[#5b3b8c] bg-[#efe7fb]'
                } ${playable ? '' : 'cursor-default'} ${g.fresh ? 'opacity-60' : ''}`}
                title={`${meta.label}: ${meta.blurb}${g.fresh ? ' (bought this turn — playable next turn)' : ''}${isVp ? ' (counts automatically)' : ''}${
                  !isVp && !g.fresh && myTurn && snap.devCardPlayedThisTurn ? ' (already played a card this turn)' : ''
                }`}
                data-testid={`dev-card-${g.type}`}
              >
                {g.ids.length > 1 ? <CountBadge n={g.ids.length} /> : null}
                <span className="text-lg leading-none sm:text-xl">{meta.icon}</span>
                <span className="w-full truncate text-center text-[8px] font-bold uppercase leading-none text-ink">
                  {isVp ? 'VP' : meta.label}
                </span>
                {g.fresh ? (
                  <span className="absolute inset-x-0 bottom-0.5 mx-auto w-fit rounded bg-ink px-0.5 text-[7px] font-bold uppercase leading-tight text-white">
                    next turn
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.35fr)] gap-1.5">
        <button
          type="button"
          disabled={!canTrade}
          onClick={() => setTradeModal(true)}
          className={`${actionBase} ${actionIdle}`}
          title="Trade with players or the bank"
          data-testid="bottom-trade-btn"
        >
          <span className="text-lg leading-none">⇄</span>
          <span className="text-[10px]">Trade</span>
        </button>
        {build('road', canRoad, player.roadsLeft)}
        {build('settlement', canSettlement, player.settlementsLeft)}
        {build('city', canCity, player.citiesLeft)}
        <button
          type="button"
          disabled={!canDevCard}
          onClick={() => {
            const action: GameAction = { type: 'buyDevCard' };
            sendAction(action);
          }}
          className={`${actionBase} ${actionIdle}`}
          title={`Buy a development card (${costLabel(BUILD_COSTS.devCard)}) — ${snap.devDeckCount} left`}
          data-anchor="dev-deck"
          data-testid="btn-buy-dev"
        >
          <CountBadge n={snap.devDeckCount} />
          <span className="flex h-6 w-5 items-center justify-center rounded-[4px] border-2 border-[#5b3b8c] bg-[#b89ee6] text-[10px] leading-none">
            ?
          </span>
          <span className="text-[10px]">Dev</span>
          <CostPips cost={BUILD_COSTS.devCard} />
        </button>
        {primary}
      </div>
    </div>
  );
});
