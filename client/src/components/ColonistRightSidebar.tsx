// Colonist.io-style Right Sidebar HUD:
// - Top: Game Event Log (light card with player avatars, dice, resources, actions)
// - Middle: Chat bar & Bank inventory bar (Wood, Brick, Sheep, Wheat, Ore, Dev Cards)
// - Bottom: Player Roster cards with avatars, VP ribbons, resource & dev card counts, knights, roads
// - Responsive: Collapsible into a slide-over drawer on mobile screens (<1024px)

import { memo, useEffect, useRef, useState } from 'react';
import type { GameEvent, Resource } from '@catan/shared';
import type { PersonalSnapshot } from '../types';
import { useStore } from '../store';
import { PIECE_COLORS } from '../theme';

export interface ColonistRightSidebarProps {
  snap: PersonalSnapshot;
}

const RESOURCE_EMOJI: Record<Resource, string> = {
  wood: '🌲',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰',
};

const RESOURCE_CARD_BG: Record<Resource, { bg: string; border: string; text: string }> = {
  wood: { bg: 'bg-[#15803d]', border: 'border-[#166534]', text: 'text-white' },
  brick: { bg: 'bg-[#dc2626]', border: 'border-[#b91c1c]', text: 'text-white' },
  sheep: { bg: 'bg-[#65a30d]', border: 'border-[#4d7c0f]', text: 'text-white' },
  wheat: { bg: 'bg-[#ca8a04]', border: 'border-[#a16207]', text: 'text-white' },
  ore: { bg: 'bg-[#475569]', border: 'border-[#334155]', text: 'text-white' },
};

function formatEvent(event: GameEvent, names: string[], colors: string[]): React.JSX.Element {
  const getBadge = (seat: number | null | undefined) => {
    if (seat === null || seat === undefined) return null;
    const col = colors[seat] ?? '#64748b';
    return (
      <span
        className="inline-block h-2.5 w-2.5 rounded-full border border-black/30 mr-1.5 align-middle shadow-xs"
        style={{ backgroundColor: col }}
      />
    );
  };

  const name = (seat: number | null | undefined): string =>
    seat === null || seat === undefined ? '?' : (names[seat] ?? `P${seat}`);

  switch (event.type) {
    case 'gameStarted':
      return <span>Game started with {event.playerCount} players</span>;
    case 'setupPlaced':
      return (
        <span>
          {getBadge(event.seat)}
          <span className="font-semibold text-slate-900">{name(event.seat)}</span> placed a{' '}
          {event.second ? '2nd Settlement 🏠' : 'Settlement 🏠'}
        </span>
      );
    case 'rolled':
      return (
        <span>
          {getBadge(event.seat)}
          <span className="font-semibold text-slate-900">{name(event.seat)}</span> rolled 🎲{' '}
          <span className="font-bold">{event.die1}+{event.die2} = {event.die1 + event.die2}</span>
        </span>
      );
    case 'produced':
      return (
        <span>
          {getBadge(event.seat)}
          <span className="font-semibold text-slate-900">{name(event.seat)}</span> received +{event.amount}{' '}
          {RESOURCE_EMOJI[event.resource] ?? ''}
        </span>
      );
    case 'roadBuilt':
      return (
        <span>
          {getBadge(event.seat)}
          <span className="font-semibold text-slate-900">{name(event.seat)}</span> placed a Road 🛣
        </span>
      );
    case 'settlementBuilt':
      return (
        <span>
          {getBadge(event.seat)}
          <span className="font-semibold text-slate-900">{name(event.seat)}</span> placed a Settlement 🏠
        </span>
      );
    case 'cityBuilt':
      return (
        <span>
          {getBadge(event.seat)}
          <span className="font-semibold text-slate-900">{name(event.seat)}</span> upgraded to City 🏰
        </span>
      );
    case 'devCardBought':
      return (
        <span>
          {getBadge(event.seat)}
          <span className="font-semibold text-slate-900">{name(event.seat)}</span> bought a Dev Card 🎴
        </span>
      );
    case 'devCardPlayed':
      return (
        <span>
          {getBadge(event.seat)}
          <span className="font-semibold text-slate-900">{name(event.seat)}</span> played {event.cardType} ⚔
        </span>
      );
    case 'robberMoved':
      return (
        <span>
          {getBadge(event.seat)}
          <span className="font-semibold text-slate-900">{name(event.seat)}</span> moved the Robber 🥷
        </span>
      );
    case 'tradeOffered':
      return (
        <span>
          {getBadge(event.proposer)}
          <span className="font-semibold text-slate-900">{name(event.proposer)}</span> offered a trade
        </span>
      );
    case 'tradeCompleted':
      return (
        <span>
          Trade accepted: {name(event.from)} ↔ {name(event.to)}
        </span>
      );
    case 'turnStarted':
      return (
        <span className="font-bold text-slate-600 block border-t border-slate-200/80 pt-1 mt-1">
          — {name(event.seat)}'s Turn {event.turn} —
        </span>
      );
    case 'victory':
      return (
        <span className="font-bold text-amber-600">
          🎉 {name(event.seat)} wins with {event.vp} VP!
        </span>
      );
    default:
      return <span>{(event as { type: string }).type}</span>;
  }
}

export const ColonistRightSidebar = memo(function ColonistRightSidebar({
  snap,
}: ColonistRightSidebarProps): React.JSX.Element {
  const log = useStore((s) => s.log);
  const [mobileOpen, setMobileOpen] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { players, activeSeat, longestRoad, largestArmy, you, bank, devDeckCount } = snap;
  const names = players.map((p) => p.name);
  const colors = players.map((p) => PIECE_COLORS[p.color]?.main ?? '#64748b');

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <>
      {/* Backdrop scrim on mobile when drawer is open */}
      {mobileOpen ? (
        <div
          className="pointer-events-auto fixed inset-0 z-25 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Mobile Drawer Toggle Button (Visible only on <1024px) */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="pointer-events-auto fixed top-2 right-2 z-30 flex lg:hidden items-center gap-1 rounded-xl border border-slate-300 bg-white/95 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-md"
      >
        <span>{mobileOpen ? '✕ Close' : '📋 Roster'}</span>
      </button>

      {/* Main Sidebar Container */}
      <aside
        className={`pointer-events-auto fixed top-2 right-2 bottom-2 z-30 flex w-[85vw] max-w-[320px] sm:w-80 flex-col justify-between gap-2 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0 bg-[#071828]/95 backdrop-blur-md lg:bg-transparent shadow-2xl p-2 rounded-2xl' : 'translate-x-[115%] lg:translate-x-0'
        }`}
        data-testid="colonist-right-sidebar"
      >
        {/* ============================================================ */}
        {/* 1. TOP: GAME EVENT LOG (Colonist-style light card)          */}
        {/* ============================================================ */}
        <div className="flex h-44 lg:h-52 w-full flex-col rounded-xl border border-slate-300 bg-[#f8f9fa]/95 shadow-md overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/90 px-3 py-1.5 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <span>📜</span>
              <span>Game Log</span>
            </span>
            <span className="text-[10px] text-slate-500 font-normal">
              Turn {snap.turn}
            </span>
          </div>

          {/* Scrollable event feed */}
          <div className="flex-1 overflow-y-auto p-2.5 text-[11px] leading-relaxed text-slate-700 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-300">
            {log.length === 0 ? (
              <div className="text-slate-400 italic">Game events will appear here…</div>
            ) : (
              log.map((e, idx) => (
                <div key={`${e.type}-${idx}`} className="break-words">
                  {formatEvent(e, names, colors)}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. MIDDLE: BANK RESOURCES BAR (Colonist-style card row)     */}
        {/* ============================================================ */}
        <div className="flex w-full items-center justify-between gap-1 rounded-xl border border-slate-300/80 bg-white/95 px-2 py-1.5 shadow-sm">
          {/* Bank building emblem */}
          <div className="flex flex-col items-center justify-center px-1 text-slate-700" title="Bank Stock">
            <span className="text-sm">🏛️</span>
            <span className="text-[8px] font-bold text-slate-500">BANK</span>
          </div>

          {/* 5 Bank Resource Cards */}
          {(['wood', 'brick', 'sheep', 'wheat', 'ore'] as const).map((res) => {
            const spec = RESOURCE_CARD_BG[res];
            return (
              <div
                key={res}
                className={`flex h-11 w-9 flex-col items-center justify-between rounded border ${spec.bg} ${spec.border} p-0.5 shadow-xs`}
                title={`${res}: ${bank[res]} left in bank`}
              >
                <span className="text-[10px] font-bold text-white leading-none">
                  {bank[res]}
                </span>
                <span className="text-xs leading-none">{RESOURCE_EMOJI[res]}</span>
              </div>
            );
          })}

          {/* Dev Card Deck */}
          <div
            className="flex h-11 w-9 flex-col items-center justify-between rounded border border-purple-800 bg-purple-700 p-0.5 shadow-xs"
            title={`Development Cards: ${devDeckCount} remaining in deck`}
          >
            <span className="text-[10px] font-bold text-white leading-none">
              {devDeckCount}
            </span>
            <span className="text-xs leading-none">🎴</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. BOTTOM: PLAYER ROSTER CARDS (Colonist.io player cards)   */}
        {/* ============================================================ */}
        <div className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden">
          {players.map((p) => {
            const isActive = p.seat === activeSeat;
            const isYou = p.seat === you.seat;
            const colorMain = PIECE_COLORS[p.color]?.main ?? '#64748b';
            const hasRoad = longestRoad.holder === p.seat;
            const hasArmy = largestArmy.holder === p.seat;
            const vpScore = isYou ? you.totalVp : p.publicVp;
            const roadsBuilt = Math.max(0, 15 - p.roadsLeft);

            return (
              <div
                key={p.seat}
                data-testid={`player-card-${p.seat}`}
                className={`flex items-center justify-between rounded-xl border px-2.5 py-1.5 shadow-md transition ${
                  isActive
                    ? 'border-amber-400/90 bg-white ring-2 ring-amber-400/50'
                    : 'border-slate-300/80 bg-[#f8f9fa]'
                } ${p.connected ? '' : 'opacity-60'}`}
              >
                {/* Active Indicator & Name */}
                <div className="flex items-center gap-1.5 min-w-[72px] max-w-[84px]">
                  {isActive ? (
                    <span className="text-amber-500 font-black text-xs animate-pulse">…</span>
                  ) : null}
                  <span className="truncate text-xs font-bold text-slate-800" title={p.name}>
                    {p.name}
                  </span>
                </div>

                {/* Avatar Icon with VP Shield Ribbon below */}
                <div className="relative flex flex-col items-center justify-center">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm font-bold text-xs text-white"
                    style={{ backgroundColor: colorMain }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  {/* VP Ribbon Shield */}
                  <div
                    className="absolute -bottom-1.5 flex h-4 min-w-[18px] items-center justify-center rounded bg-amber-400 px-1 text-[10px] font-black text-slate-900 shadow-xs border border-amber-500"
                    title={`${vpScore} Victory Points`}
                  >
                    {vpScore}
                  </div>
                </div>

                {/* Stat Cards Row */}
                <div className="flex items-center gap-1">
                  {/* Resource Cards Count (Blue '?' Card) */}
                  <div
                    className="flex h-8 w-6 flex-col items-center justify-between rounded border border-blue-700 bg-blue-600 p-0.5 shadow-2xs text-white"
                    title={`${p.resourceCount} resource cards`}
                  >
                    <span className="text-[9px] font-bold leading-none">{p.resourceCount}</span>
                    <span className="text-[10px] font-bold leading-none">?</span>
                  </div>

                  {/* Dev Cards Count (Purple Card) */}
                  <div
                    className="flex h-8 w-6 flex-col items-center justify-between rounded border border-purple-700 bg-purple-600 p-0.5 shadow-2xs text-white"
                    title={`${p.devCardCount} development cards`}
                  >
                    <span className="text-[9px] font-bold leading-none">{p.devCardCount}</span>
                    <span className="text-[9px] leading-none">🎴</span>
                  </div>

                  {/* Knights Played */}
                  <div
                    className={`flex h-8 w-6 flex-col items-center justify-between rounded border p-0.5 shadow-2xs ${
                      hasArmy ? 'border-red-500 bg-red-100 text-red-700 font-black' : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                    title={`${p.playedKnights} knights played ${hasArmy ? '(Largest Army! ⚔)' : ''}`}
                  >
                    <span className="text-[9px] font-bold leading-none">{p.playedKnights}</span>
                    <span className="text-[9px] leading-none">⚔</span>
                  </div>

                  {/* Roads Built */}
                  <div
                    className={`flex h-8 w-6 flex-col items-center justify-between rounded border p-0.5 shadow-2xs ${
                      hasRoad ? 'border-amber-500 bg-amber-100 text-amber-800 font-black' : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                    title={`${roadsBuilt} roads built ${hasRoad ? '(Longest Road! 🛣)' : ''}`}
                  >
                    <span className="text-[9px] font-bold leading-none">{roadsBuilt}</span>
                    <span className="text-[9px] leading-none">🛣</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
});
