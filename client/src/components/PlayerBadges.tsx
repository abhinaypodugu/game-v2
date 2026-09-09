// Floating player badges on the top-left showing avatars, public VP,
// resource and dev card counts, longest road, and largest army.

import { memo } from 'react';
import type { PersonalSnapshot } from '../types';
import { PIECE_COLORS } from '../theme';

export interface PlayerBadgesProps {
  snap: PersonalSnapshot;
}

export const PlayerBadges = memo(function PlayerBadges({ snap }: PlayerBadgesProps): React.JSX.Element {
  const { players, activeSeat, longestRoad, largestArmy, you } = snap;

  return (
    <div className="pointer-events-auto flex flex-col gap-2" data-testid="player-badges">
      {players.map((p) => {
        const isActive = p.seat === activeSeat;
        const isYou = p.seat === you.seat;
        const colorMain = PIECE_COLORS[p.color]?.main ?? '#94a3b8';
        const hasRoad = longestRoad.holder === p.seat;
        const hasArmy = largestArmy.holder === p.seat;

        return (
          <div
            key={p.seat}
            data-testid={`player-badge-${p.seat}`}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 shadow-xl backdrop-blur-md transition ${
              isActive
                ? 'border-amber-400/80 bg-gradient-to-r from-[#0d2a45]/95 to-[#13375c]/95 ring-2 ring-amber-400/40'
                : 'border-sky-500/20 bg-[#041626]/80'
            } ${p.connected ? '' : 'opacity-50'}`}
          >
            {/* Color Avatar Ring */}
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/80 shadow-md font-bold text-xs text-white" style={{ background: colorMain }}>
              {p.name.charAt(0).toUpperCase()}
              {isActive ? (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-slate-950 shadow">
                  ★
                </span>
              ) : null}
            </div>

            {/* Name and Achievements */}
            <div className="flex flex-col min-w-[90px]">
              <span className="truncate text-xs font-bold text-white leading-tight">
                {p.name} {isYou ? <span className="text-[10px] text-sky-300 font-normal">(You)</span> : null}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-sky-200/80">
                <span title="Resource cards">🃏 {p.resourceCount}</span>
                <span title="Dev cards">🎴 {p.devCardCount}</span>
                {hasRoad ? <span title={`Longest Road (${longestRoad.length})`}>🛣</span> : null}
                {hasArmy ? <span title={`Largest Army (${largestArmy.knights}⚔)`}>⚔</span> : null}
              </div>
            </div>

            {/* Large VP Badge */}
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 font-[Bricolage_Grotesque,system-ui] text-sm font-black text-amber-300 shadow-inner">
              {isYou ? you.totalVp : p.publicVp}
            </div>
          </div>
        );
      })}
    </div>
  );
});
