// Turn/status line under the player strip: whose turn, the current
// instruction prompt, an optional cancel for armed placements, and the dice.
// Lives in normal document flow, so it can never overlap other HUD panels.

import { memo } from 'react';
import type { PersonalSnapshot } from '../types';
import { DiceDisplay } from './DiceDisplay';
import { Avatar } from './PlayerStrip';

export interface StatusPrompt {
  text: string;
  /** 'action' = the local player must act now (highlighted). */
  tone: 'action' | 'wait';
}

export interface TurnStatusBarProps {
  snap: PersonalSnapshot;
  prompt: StatusPrompt;
  rollKey: number;
  onCancel?: () => void;
}

export const TurnStatusBar = memo(function TurnStatusBar({
  snap,
  prompt,
  rollKey,
  onCancel,
}: TurnStatusBarProps): React.JSX.Element {
  const actorSeat = snap.phase === 'specialBuild' && snap.specialBuildSeat !== null ? snap.specialBuildSeat : snap.activeSeat;
  const actor = snap.players[actorSeat];
  const mine = actorSeat === snap.you.seat;
  return (
    <div
      className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-line bg-cream px-2 py-1 shadow-[0_2px_0_rgba(0,0,0,0.12)]"
      data-testid="colonist-turn-banner"
      role="status"
      aria-live="polite"
    >
      {actor !== undefined ? <Avatar name={actor.name} color={actor.color} size="sm" /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-ink-soft">
          <span className="truncate">{mine ? 'Your turn' : `${actor?.name ?? '—'}'s turn`}</span>
          <span className="flex-none">· T{snap.turn}</span>
          <span className="flex-none text-[#a15c00]" data-testid="vp-target">
            · First to {snap.rules.victoryPointsToWin} VP
          </span>
        </span>
        <span
          className={`line-clamp-2 font-display text-sm font-bold leading-tight ${
            prompt.tone === 'action' ? 'text-[#b25e00]' : 'text-ink'
          }`}
          data-testid="status-prompt"
        >
          {prompt.text}
        </span>
      </div>
      {onCancel !== undefined ? (
        <button
          type="button"
          onClick={onCancel}
          data-testid="cancel-placement"
          className="h-11 flex-none rounded-xl border-2 border-line bg-white px-2.5 text-xs font-bold text-ink active:scale-95"
        >
          Cancel
        </button>
      ) : null}
      <DiceDisplay die1={snap.dice?.die1 ?? null} die2={snap.dice?.die2 ?? null} rollKey={rollKey} />
    </div>
  );
});
