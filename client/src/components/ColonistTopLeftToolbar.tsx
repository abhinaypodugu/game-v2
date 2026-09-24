// Compact corner toolbar (top-left of the board area): game details sheet
// (phone only), sound mute, rules & costs, fullscreen, settings.

import { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BUILD_COSTS, type Resource } from '@catan/shared';
import type { PersonalSnapshot } from '../types';
import { sounds } from '../sound';
import { useStore } from '../store';
import { CostPips, costLabel } from './resourceArt';

export interface ColonistTopLeftToolbarProps {
  snap: PersonalSnapshot;
  detailsOpen: boolean;
  onToggleDetails: () => void;
}

const MODE_LABEL: Record<PersonalSnapshot['config'], string> = {
  base: 'Classic 3-4 Player',
  ext56: '5-6 Expansion',
  ext78: '7-8 Expansion',
};

const toolBtn =
  'flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white text-lg leading-none text-ink shadow-[0_2px_0_rgba(0,0,0,0.15)] transition-transform active:translate-y-px';

function CostRow({ label, cost, note }: { label: string; cost: Partial<Record<Resource, number>>; note: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-line bg-white px-3 py-2">
      <div className="flex flex-col">
        <span className="text-sm font-bold text-ink">{label}</span>
        <span className="text-[11px] text-ink-soft">{note}</span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <CostPips cost={cost} className="[&>span]:h-3 [&>span]:w-3" />
        <span className="text-[10px] text-ink-soft">{costLabel(cost)}</span>
      </div>
    </div>
  );
}

export const ColonistTopLeftToolbar = memo(function ColonistTopLeftToolbar({
  snap,
  detailsOpen,
  onToggleDetails,
}: ColonistTopLeftToolbarProps): React.JSX.Element {
  const [modal, setModal] = useState<'settings' | 'rules' | null>(null);
  const [muted, setMutedState] = useState(() => sounds.isMuted());
  const leaveRoom = useStore((s) => s.leaveRoom);

  const toggleMute = (): void => {
    const next = !muted;
    sounds.setMuted(next);
    setMutedState(next);
    if (!next) sounds.click();
  };

  const toggleFullscreen = (): void => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <>
      <div className="pointer-events-auto flex flex-row gap-1.5 lg:flex-col" data-testid="colonist-top-left-toolbar">
        <button
          type="button"
          onClick={onToggleDetails}
          className={`${toolBtn} lg:hidden ${detailsOpen ? 'border-cta bg-[#fff1d6]' : ''}`}
          title="Log, bank & players"
          aria-label="Log, bank and players"
          aria-expanded={detailsOpen}
          data-anchor="bank"
          data-testid="btn-details"
        >
          📜
        </button>
        <button
          type="button"
          onClick={toggleMute}
          className={toolBtn}
          title={muted ? 'Unmute sounds' : 'Mute sounds'}
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          aria-pressed={muted}
          data-testid="btn-mute"
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          onClick={() => setModal('rules')}
          className={toolBtn}
          title="Rules & build costs"
          aria-label="Rules and build costs"
          data-testid="btn-rules"
        >
          📖
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className={`${toolBtn} text-base`}
          title="Toggle fullscreen"
          aria-label="Toggle fullscreen"
          data-testid="btn-fullscreen"
        >
          ⛶
        </button>
        <button
          type="button"
          onClick={() => setModal('settings')}
          className={toolBtn}
          title="Settings"
          aria-label="Settings"
          data-testid="btn-settings"
        >
          ⚙️
        </button>
      </div>

      {modal !== null && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4 pt-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] backdrop-blur-xs"
              onClick={() => setModal(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="animate-pop-in relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-line bg-cream p-5 text-ink shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white text-base font-bold active:translate-y-px"
                  aria-label="Close"
                >
                  ✕
                </button>

                {modal === 'rules' ? (
                  <div className="flex flex-col gap-2">
                    <h3 className="pr-12 text-xl font-bold">Rules & costs</h3>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div className="rounded-xl bg-parchment px-3 py-2">
                        <div className="text-ink-soft">Victory</div>
                        <div className="text-base font-bold" data-testid="rules-vp">First to {snap.rules.victoryPointsToWin} VP</div>
                      </div>
                      <div className="rounded-xl bg-parchment px-3 py-2">
                        <div className="text-ink-soft">Robber on 7</div>
                        <div className="text-base font-bold">Discard if &gt; {snap.rules.discardLimit}</div>
                      </div>
                      <div className="rounded-xl bg-parchment px-3 py-2">
                        <div className="text-ink-soft">Mode</div>
                        <div className="text-sm font-bold" data-testid="game-mode">{MODE_LABEL[snap.config]}</div>
                      </div>
                      <div className="rounded-xl bg-parchment px-3 py-2">
                        <div className="text-ink-soft">Players</div>
                        <div className="text-sm font-bold">{snap.players.length} · Turn {snap.turn}</div>
                      </div>
                    </div>
                    <CostRow label="Road" cost={BUILD_COSTS.road} note="Longest Road (5+) = 2 VP" />
                    <CostRow label="Settlement" cost={BUILD_COSTS.settlement} note="1 VP" />
                    <CostRow label="City" cost={BUILD_COSTS.city} note="2 VP, double production" />
                    <CostRow label="Development card" cost={BUILD_COSTS.devCard} note="Largest Army (3+ knights) = 2 VP" />
                    {snap.config !== 'base' ? (
                      <p className="text-xs text-ink-soft">
                        Special build phase: after each turn, other players may build in order.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {modal === 'settings' ? (
                  <div className="flex flex-col gap-4">
                    <h3 className="pr-12 text-xl font-bold">Settings</h3>
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="flex h-12 items-center justify-between rounded-xl border-2 border-line bg-white px-4 text-sm font-bold active:translate-y-px"
                    >
                      <span>Sound effects</span>
                      <span className={muted ? 'text-ink-soft' : 'text-go'}>{muted ? 'Off' : 'On'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModal(null);
                        leaveRoom();
                      }}
                      className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#d7263d] px-4 font-display text-base font-bold text-white shadow-[0_4px_0_#8a1424] active:translate-y-px"
                      data-testid="leave-game"
                    >
                      🚪 Leave game
                    </button>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
});
