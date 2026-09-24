// Game info panel: bank stock, full player details and the event log.
// Phone: a slide-up bottom sheet toggled from the toolbar.
// ≥1024px: a permanent right sidebar column beside the board.

import { memo } from 'react';
import { RESOURCES } from '@catan/shared';
import { useStore } from '../store';
import type { PersonalSnapshot } from '../types';
import { EventLog } from './EventLog';
import { Avatar } from './PlayerStrip';
import { ResourceCard } from './resourceArt';

export interface ColonistRightSidebarProps {
  snap: PersonalSnapshot;
  /** Mobile sheet open state (ignored on ≥1024px, where it is always shown). */
  open: boolean;
  onClose: () => void;
}

function Stat({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }): React.JSX.Element {
  return (
    <span
      className={`flex flex-col items-center rounded-lg px-1 py-0.5 leading-none ${highlight ? 'bg-[#fde7b0] text-[#7a5200]' : 'bg-parchment text-ink'}`}
    >
      <span className="text-xs font-bold tabular-nums">{value}</span>
      <span className="text-[8px] font-bold uppercase tracking-wide opacity-70">{label}</span>
    </span>
  );
}

export const ColonistRightSidebar = memo(function ColonistRightSidebar({
  snap,
  open,
  onClose,
}: ColonistRightSidebarProps): React.JSX.Element {
  const { players, activeSeat, longestRoad, largestArmy, you, bank, devDeckCount, rules } = snap;

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
          data-testid="sidebar-scrim"
        />
      ) : null}
      <aside
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[78dvh] flex-col gap-2 overflow-y-auto rounded-t-3xl border-t-2 border-line bg-cream px-2 pt-2 pb-[max(0.5rem,var(--safe-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-out lg:static lg:z-auto lg:max-h-none lg:w-[320px] lg:flex-none lg:translate-y-0 lg:rounded-2xl lg:border-2 lg:pb-2 lg:shadow-[0_2px_0_rgba(0,0,0,0.12)] ${
          open ? 'translate-y-0' : 'pointer-events-none translate-y-full lg:pointer-events-auto'
        }`}
        aria-label="Game details"
        data-testid="colonist-right-sidebar"
      >
        {/* Sheet header (phone only) */}
        <div className="flex items-center justify-between lg:hidden">
          <span className="mx-auto h-1.5 w-12 rounded-full bg-line" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-ink">Game</h2>
          <span className="text-xs font-bold text-ink-soft">
            Turn {snap.turn} · First to {rules.victoryPointsToWin} VP
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white text-base font-bold text-ink lg:hidden"
            aria-label="Close game details"
          >
            ✕
          </button>
        </div>

        {/* Bank */}
        <div
          className="flex items-center gap-1 rounded-2xl border-2 border-line bg-white px-2 py-1.5"
          data-anchor="bank"
          data-testid="bank"
        >
          <span className="mr-auto flex flex-col text-[10px] font-bold uppercase leading-tight text-ink-soft">
            <span className="text-base leading-none">🏦</span>Bank
          </span>
          {RESOURCES.map((r) => (
            <ResourceCard key={r} resource={r} count={bank[r]} size="md" dim={bank[r] === 0} title={`${bank[r]} ${r} in the bank`} />
          ))}
          <div
            className="relative flex h-14 w-10 flex-none items-center justify-center rounded-lg border-2 border-[#5b3b8c] bg-[#b89ee6] font-bold text-white shadow-[0_2px_0_rgba(0,0,0,0.25)]"
            title={`${devDeckCount} development cards left`}
          >
            ?
            <span className="absolute bottom-0.5 left-1/2 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-ink">
              {devDeckCount}
            </span>
          </div>
        </div>

        {/* Player details */}
        <ul className="flex flex-col gap-1" data-testid="player-details">
          {players.map((p) => {
            const isYou = p.seat === you.seat;
            const vp = isYou ? you.totalVp : p.publicVp;
            const roadsBuilt = 15 - p.roadsLeft;
            return (
              <li
                key={p.seat}
                className={`flex items-center gap-1.5 rounded-xl border-2 bg-white px-1.5 py-1 ${
                  p.seat === activeSeat ? 'border-cta' : 'border-transparent'
                } ${p.connected ? '' : 'opacity-50 grayscale'}`}
              >
                <Avatar name={p.name} color={p.color} />
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-bold text-ink">
                    {p.name}
                    {isYou ? ' (you)' : ''}
                  </span>
                  <span className="truncate text-[10px] font-bold text-ink-soft">
                    {p.connected ? `${p.settlementsLeft} houses · ${p.citiesLeft} cities · ${p.roadsLeft} roads left` : 'Disconnected'}
                  </span>
                </div>
                <div className="flex flex-none gap-0.5">
                  <Stat label="VP" value={vp} />
                  <Stat label="Cards" value={p.resourceCount} />
                  <Stat label="Dev" value={p.devCardCount} />
                  <Stat label="Knights" value={p.playedKnights} highlight={largestArmy.holder === p.seat} />
                  <Stat label="Roads" value={roadsBuilt} highlight={longestRoad.holder === p.seat} />
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex min-h-40 flex-1 flex-col">
          <EventLog />
        </div>

        <div className="pt-2 lg:hidden">
          <button
            type="button"
            onClick={() => {
              onClose();
              useStore.getState().leaveRoom();
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#d7263d] px-4 font-display text-sm font-bold text-white shadow-[0_3px_0_#8a1424] active:translate-y-px"
          >
            🚪 Leave game
          </button>
        </div>
      </aside>
    </>
  );
});
