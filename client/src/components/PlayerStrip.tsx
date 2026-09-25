// Top player strip: one compact chip per seat (avatar, name, VP, cards,
// dev cards, longest-road / largest-army badges, active highlight + turn
// timer). Scrolls horizontally when seats don't fit (7-8 players on a phone).

import { memo } from 'react';
import type { PersonalSnapshot, PublicPlayer } from '../types';
import { PIECE_COLORS } from '../theme';
import { TurnTimer } from './Overlays';

export function playerColor(color: string): { main: string; dark: string } {
  return PIECE_COLORS[color] ?? { main: '#8a94a3', dark: '#4a5360' };
}

export function Avatar({
  name,
  color,
  size = 'md',
}: {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}): React.JSX.Element {
  const c = playerColor(color);
  const light = color === 'white';
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full border-2 font-display font-bold leading-none ${
        size === 'sm' ? 'h-6 w-6 text-[11px]' : 'h-8 w-8 text-sm'
      } ${light ? 'text-ink' : 'text-white'}`}
      style={{ background: c.main, borderColor: '#1f2a37' }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export interface PlayerStripProps {
  snap: PersonalSnapshot;
  onSelectPlayer?: (player: PublicPlayer) => void;
}

export const PlayerStrip = memo(function PlayerStrip({
  snap,
  onSelectPlayer,
}: PlayerStripProps): React.JSX.Element {
  const { players, activeSeat, you, longestRoad, largestArmy, specialBuildSeat, phase } = snap;
  return (
    <div
      className="scrollbar-none flex min-w-0 flex-1 snap-x gap-1.5 overflow-x-auto px-0.5 pt-1 pb-2.5"
      data-testid="player-strip"
    >
      {players.map((p) => {
        const isYou = p.seat === you.seat;
        const isActive =
          phase !== 'finished' && (phase === 'specialBuild' ? p.seat === specialBuildSeat : p.seat === activeSeat);
        const vp = isYou ? you.totalVp : p.publicVp;
        const hasRoad = longestRoad.holder === p.seat;
        const hasArmy = largestArmy.holder === p.seat;
        return (
          <div
            key={p.seat}
            data-anchor={`player-${p.seat}`}
            data-testid={`player-card-${p.seat}`}
            aria-current={isActive ? 'true' : undefined}
            role="button"
            tabIndex={0}
            onClick={() => onSelectPlayer?.(p)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectPlayer?.(p);
            }}
            className={`relative flex min-w-[88px] flex-1 basis-0 snap-start flex-col gap-0.5 rounded-xl border-2 bg-white px-1.5 py-1 shadow-[0_2px_0_rgba(0,0,0,0.12)] transition-[opacity,filter,transform] cursor-pointer hover:border-cta active:scale-[0.98] ${
              isActive ? 'border-cta bg-[#fff8e6]' : 'border-transparent'
            } ${p.connected ? '' : 'opacity-50 grayscale'}`}
            title={`${p.name}${isYou ? ' (you)' : ''} — ${vp} VP (tap to view cards & stats)`}
          >
            <div className="flex min-w-0 items-center gap-1">
              <span className="relative flex-none">
                <Avatar name={p.name} color={p.color} size="sm" />
                <span
                  className="absolute -right-1.5 -bottom-1.5 flex h-4 min-w-4 items-center justify-center rounded-md border border-white bg-ink px-0.5 font-display text-[10px] font-bold leading-none text-white tabular-nums"
                  aria-label={`${vp} victory points`}
                >
                  {vp}
                </span>
              </span>
              <span className="min-w-0 flex-1 truncate pl-1 text-[11px] font-bold leading-tight text-ink">
                {isYou ? 'You' : p.name}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold leading-none text-ink-soft tabular-nums">
              <span className="flex items-center gap-0.5" title={`${p.resourceCount} resource cards`}>
                <span className="inline-block h-3 w-2 rounded-[2px] border border-[#8a6d3b] bg-[#f3ead3]" />
                {p.resourceCount}
              </span>
              <span className="flex items-center gap-0.5" title={`${p.devCardCount} development cards`}>
                <span className="inline-block h-3 w-2 rounded-[2px] border border-[#5b3b8c] bg-[#b89ee6]" />
                {p.devCardCount}
              </span>
              {hasRoad ? (
                <span className="rounded bg-[#fde7b0] px-0.5 text-[#7a5200]" title={`Longest Road (${longestRoad.length})`}>
                  🛣️
                </span>
              ) : null}
              {hasArmy ? (
                <span className="rounded bg-[#fcd5d5] px-0.5 text-[#8a1424]" title={`Largest Army (${largestArmy.knights})`}>
                  ⚔️
                </span>
              ) : null}
              {p.isFortified ? (
                <span className="rounded bg-sky-100 px-0.5 text-sky-800" title="Fortified! Immune to robber steals & 7-roll discard">
                  🛡️
                </span>
              ) : null}
              {snap.merchantSeat === p.seat ? (
                <span className="rounded bg-amber-100 px-0.5 text-amber-800" title="Active Merchant: 2:1 bank trades this turn">
                  ⚖️
                </span>
              ) : null}
              {!p.connected ? <span title="Disconnected">📡</span> : null}
            </div>
            {isActive ? (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <TurnTimer className="h-4 text-[9px] shadow-sm ring-1 ring-cta" />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
