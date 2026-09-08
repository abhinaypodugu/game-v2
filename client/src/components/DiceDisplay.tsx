// Dice display: 3D cube flip animation on roll, settling on real pips.
// CSS preserve-3d pattern (MDN); framer-motion drives the rotation.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const PIP_POSITIONS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function Face({ value }: { value: number }): React.JSX.Element {
  return (
    <div className="absolute inset-0 rounded-lg bg-[#fdfaf2] shadow-inner">
      {PIP_POSITIONS[value]?.map(([x, y], i) => (
        <span
          key={i}
          className="absolute h-2 w-2 rounded-full bg-[#222]"
          style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
        />
      ))}
    </div>
  );
}

export interface DiceDisplayProps {
  die1: number | null;
  die2: number | null;
  rolling: boolean;
}

export function DiceDisplay({ die1, die2, rolling }: DiceDisplayProps): React.JSX.Element {
  const [spin, setSpin] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!rolling) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const interval = setInterval(() => {
      setSpin({
        x: Math.floor(Math.random() * 360) + 360,
        y: Math.floor(Math.random() * 360) + 360,
      });
    }, 100);
    return () => clearInterval(interval);
  }, [rolling]);

  const value1 = rolling ? 1 + (Math.floor(spin.x / 60) % 6) : die1 ?? 1;
  const value2 = rolling ? 1 + (Math.floor(spin.y / 60) % 6) : die2 ?? 1;

  return (
    <div className="flex items-center gap-3" data-testid="dice-display" style={{ perspective: 600 }}>
      {[value1, value2].map((v, i) => (
        <div
          key={i}
          className="relative h-14 w-14"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <motion.div
            className="relative h-14 w-14"
            animate={{ rotateX: rolling ? spin.x : 0, rotateY: rolling ? spin.y : 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <Face value={v} />
          </motion.div>
        </div>
      ))}
      {die1 !== null && die2 !== null && !rolling ? (
        <span className="text-2xl font-bold" data-testid="dice-sum">
          = {die1 + die2}
        </span>
      ) : null}
    </div>
  );
}
