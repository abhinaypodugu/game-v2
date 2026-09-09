// Production floaters: "+2 🪵" chips that drift up from producing hexes on roll.
// Purely decorative — driven from the last roll's produced events.

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameEvent, Resource } from '@catan/shared';
import { useStore } from '../store';
import type { PersonalSnapshot } from '../types';

const RESOURCE_EMOJI: Record<Resource, string> = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰',
};

interface Floater {
  id: number;
  seat: number;
  resource: Resource;
  amount: number;
}

let floaterId = 0;

export function ProductionFloaters({ snap }: { snap: PersonalSnapshot }): React.JSX.Element | null {
  const log = useStore((s) => s.log);
  const [floaters, setFloaters] = useState<Floater[]>([]);

  // Detect each new produced event after a roll and emit floaters.
  const lastRollIdx = useMemo(() => log.map((e: GameEvent) => e.type === 'rolled').lastIndexOf(true), [log]);

  useEffect(() => {
    if (lastRollIdx === -1) return;
    const produced = log
      .slice(lastRollIdx)
      .filter((e: GameEvent): e is Extract<GameEvent, { type: 'produced' }> => e.type === 'produced');
    if (produced.length === 0) return;
    const next: Floater[] = produced.map((e) => ({
      id: ++floaterId,
      seat: e.seat,
      resource: e.resource,
      amount: e.amount,
    }));
    const show = setTimeout(() => setFloaters(next), 0);
    const clear = setTimeout(() => setFloaters([]), 2600);
    return () => {
      clearTimeout(show);
      clearTimeout(clear);
    };
  }, [lastRollIdx, log]);

  if (floaters.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30" data-testid="production-floaters">
      <AnimatePresence>
        {floaters
          .filter((f) => f.seat === snap.you.seat)
          .map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], y: -120, scale: 1 }}
              transition={{ duration: 2.2, ease: 'easeOut', delay: i * 0.15 }}
              className="absolute bottom-32 left-1/2 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1.5 text-lg font-bold text-amber-300 shadow-xl"
            >
              +{f.amount} {RESOURCE_EMOJI[f.resource]}
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
