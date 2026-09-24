// 2D dice: white rounded dice with dark pips plus a bold total pill.
// A new roll (rollKey change) remounts the dice, replaying the CSS tumble
// animation — no JS animation loop.

import { memo } from 'react';

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
};

function Die({ value, className, delayMs }: { value: number; className: string; delayMs: number }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`${className} animate-dice-tumble drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]`}
      style={{ animationDelay: `${delayMs}ms` }}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="92" height="92" rx="22" fill="#ffffff" stroke="#2b3440" strokeWidth="6" />
      <rect x="12" y="10" width="76" height="30" rx="14" fill="#f1f4f8" />
      {PIPS[value]?.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill={value === 1 ? '#d7263d' : '#1f2a37'} />
      ))}
    </svg>
  );
}

export interface DiceDisplayProps {
  die1: number | null;
  die2: number | null;
  /** Increments per roll event; remounts the dice to replay the tumble. */
  rollKey: number;
  size?: 'sm' | 'md';
}

export const DiceDisplay = memo(function DiceDisplay({
  die1,
  die2,
  rollKey,
  size = 'sm',
}: DiceDisplayProps): React.JSX.Element {
  const dieClass = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  if (die1 === null || die2 === null) {
    return (
      <div className="flex items-center gap-1 opacity-50" data-testid="dice-display" aria-label="Dice not rolled yet">
        <Die value={0} className={dieClass} delayMs={0} key="idle-1" />
        <Die value={0} className={dieClass} delayMs={0} key="idle-2" />
      </div>
    );
  }
  const total = die1 + die2;
  return (
    <div className="flex flex-none items-center gap-1" data-testid="dice-display" aria-label={`Rolled ${die1} and ${die2}, total ${total}`}>
      <Die value={die1} className={dieClass} delayMs={0} key={`a-${rollKey}`} />
      <Die value={die2} className={dieClass} delayMs={70} key={`b-${rollKey}`} />
      <span
        key={`t-${rollKey}`}
        className={`animate-pop-in ml-0.5 flex min-w-8 items-center justify-center rounded-full px-1.5 font-display font-bold leading-none tabular-nums shadow-sm ${
          size === 'sm' ? 'h-7 text-base' : 'h-10 text-xl'
        } ${total === 7 ? 'bg-[#d7263d] text-white' : 'bg-ink text-white'}`}
        data-testid="dice-sum"
      >
        {total}
      </span>
    </div>
  );
});
