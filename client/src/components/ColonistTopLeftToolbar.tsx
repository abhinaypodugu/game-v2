// Colonist.io-style Top-Left Utility Toolbar:
// - Vertical column of 4 circular action buttons:
//   1. ⚙ Settings (sound, camera controls, reset)
//   2. 📖 Rules / Build Costs reference cheat sheet
//   3. ⛶ Fullscreen toggle
//   4. ⓘ Game Information (seed, room code, ruleset)

import { memo, useState } from 'react';
import type { PersonalSnapshot } from '../types';

export interface ColonistTopLeftToolbarProps {
  snap: PersonalSnapshot;
}

export const ColonistTopLeftToolbar = memo(function ColonistTopLeftToolbar({
  snap,
}: ColonistTopLeftToolbarProps): React.JSX.Element {
  const [modal, setModal] = useState<'settings' | 'rules' | 'info' | null>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <>
      {/* Top-Left Icon Toolbar (compact row on mobile, column on desktop) */}
      <div
        className="pointer-events-auto fixed top-2 left-2 z-30 flex flex-row lg:flex-col gap-1 sm:gap-1.5"
        data-testid="colonist-top-left-toolbar"
      >
        <button
          type="button"
          onClick={() => setModal('settings')}
          className="flex h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9 items-center justify-center rounded-full border border-slate-300/80 bg-white/95 text-xs sm:text-sm text-slate-700 shadow-md transition hover:scale-105 hover:bg-slate-100 active:scale-95"
          title="Settings"
          data-testid="btn-settings"
        >
          ⚙️
        </button>

        <button
          type="button"
          onClick={() => setModal('rules')}
          className="flex h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9 items-center justify-center rounded-full border border-slate-300/80 bg-white/95 text-xs sm:text-sm text-slate-700 shadow-md transition hover:scale-105 hover:bg-slate-100 active:scale-95"
          title="Build Costs & Rules"
          data-testid="btn-rules"
        >
          📖
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9 items-center justify-center rounded-full border border-slate-300/80 bg-white/95 text-xs sm:text-sm text-slate-700 shadow-md transition hover:scale-105 hover:bg-slate-100 active:scale-95"
          title="Toggle Fullscreen"
          data-testid="btn-fullscreen"
        >
          ⛶
        </button>

        <button
          type="button"
          onClick={() => setModal('info')}
          className="flex h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9 items-center justify-center rounded-full border border-slate-300/80 bg-white/95 text-xs sm:text-sm font-black text-slate-700 shadow-md transition hover:scale-105 hover:bg-slate-100 active:scale-95"
          title="Game Info"
          data-testid="btn-info"
        >
          ⓘ
        </button>
      </div>

      {/* Modal Dialogs */}
      {modal !== null ? (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-300 bg-white p-5 shadow-2xl text-slate-800">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 hover:bg-slate-200"
            >
              ✕
            </button>

            {modal === 'settings' ? (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>⚙️</span> Game Settings
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-semibold">Perspective:</span>
                    <span className="text-slate-600">3D WebGL Orbit Camera</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-semibold">Dice Mode:</span>
                    <span className="text-slate-600">Server-Authoritative Fair 2d6</span>
                  </div>
                  <div className="flex items-center justify-between pb-2">
                    <span className="font-semibold">Graphics:</span>
                    <span className="text-emerald-700 font-bold">High Performance (60 FPS)</span>
                  </div>
                </div>
              </div>
            ) : null}

            {modal === 'rules' ? (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>📖</span> Catan Build Costs Cheat Sheet
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <div className="font-bold text-slate-900">🛣 Road</div>
                    <div className="text-slate-600 mt-1">🌲 1 Wood + 🧱 1 Brick</div>
                    <div className="text-[10px] text-amber-700 font-semibold mt-1">Longest Road: 5+ (2 VP)</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <div className="font-bold text-slate-900">🏠 Settlement</div>
                    <div className="text-slate-600 mt-1">🌲 1 Wood + 🧱 1 Brick + 🐑 1 Sheep + 🌾 1 Wheat</div>
                    <div className="text-[10px] text-emerald-700 font-semibold mt-1">Worth 1 VP</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <div className="font-bold text-slate-900">🏰 City</div>
                    <div className="text-slate-600 mt-1">🌾 2 Wheat + ⛰ 3 Ore</div>
                    <div className="text-[10px] text-emerald-700 font-semibold mt-1">Worth 2 VP (2x resources)</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <div className="font-bold text-slate-900">🎴 Dev Card</div>
                    <div className="text-slate-600 mt-1">🐑 1 Sheep + 🌾 1 Wheat + ⛰ 1 Ore</div>
                    <div className="text-[10px] text-purple-700 font-semibold mt-1">Knight, VP, Progress</div>
                  </div>
                </div>
              </div>
            ) : null}

            {modal === 'info' ? (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>ⓘ</span> Game Information
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-semibold">Game Mode:</span>
                    <span className="text-slate-600">{snap.config === 'base' ? 'Classic 3-4 Player' : '5-6 Expansion'}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-semibold">Turn Number:</span>
                    <span className="text-slate-600">{snap.turn}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-semibold">Victory Condition:</span>
                    <span className="text-amber-700 font-bold">10 Victory Points on turn</span>
                  </div>
                  <div className="flex items-center justify-between pb-2">
                    <span className="font-semibold">Active Players:</span>
                    <span className="text-slate-600">{snap.players.length} seats filled</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
});
