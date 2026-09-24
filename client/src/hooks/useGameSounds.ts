// Plays a sound for every NEW game-log event. The baseline is the log as it
// exists on mount, so mounting mid-game or rejoining never replays history; if
// the log is replaced or shortened (resync, leaving the room) we re-baseline
// silently instead of treating the replacement as fresh events.

import { useEffect } from 'react';
import { useStore } from '../store';
import type { GameEvent } from '../types';
import { sounds } from '../sound';

/** Sounds that repeat within this window are collapsed (one card swish per production batch). */
const DEDUPE_MS = 250;

type SoundName = Exclude<keyof typeof sounds, 'setMuted' | 'isMuted'>;

function soundFor(e: GameEvent, me: number | null): SoundName | null {
  switch (e.type) {
    case 'rolled':
      return 'dice';
    case 'produced':
      return e.seat === me ? 'card' : null;
    case 'setupPlaced':
    case 'settlementBuilt':
      return 'place';
    case 'roadBuilt':
      return 'road';
    case 'cityBuilt':
      return 'city';
    case 'devCardBought':
    case 'devCardPlayed':
      return 'devCard';
    case 'robberMoved':
      return 'robber';
    case 'stolenFrom':
      return e.seat === me || e.victim === me ? 'steal' : null;
    case 'discarded':
      return e.seat === me ? 'card' : null;
    case 'tradeOffered':
    case 'tradeCountered':
      return e.proposer === me ? null : 'trade';
    case 'tradeCompleted':
      return e.from === me || e.to === me ? 'trade' : 'card';
    case 'bankTraded':
      return e.seat === me ? 'trade' : null;
    case 'longestRoadChanged':
    case 'largestArmyChanged':
      return e.to !== null && e.to === me ? 'devCard' : null;
    case 'turnStarted':
    case 'specialBuildActivated':
      return e.seat === me ? 'turn' : null;
    case 'timedOut':
      return e.seat === me ? 'error' : null;
    case 'victory':
      return 'victory';
    default:
      return null;
  }
}

export function useGameSounds(): void {
  useEffect(() => {
    let seenLog = useStore.getState().log;
    let seenLast: GameEvent | undefined = seenLog[seenLog.length - 1];
    const lastPlayed = new Map<SoundName, number>();

    return useStore.subscribe((state) => {
      const log = state.log;
      if (log === seenLog) return;
      const prevLen = seenLog.length;
      const replaced = log.length < prevLen || (prevLen > 0 && log[prevLen - 1] !== seenLast);
      seenLog = log;
      seenLast = log[log.length - 1];
      if (replaced) return;

      const me = state.session?.seatIndex ?? state.game?.you.seat ?? null;
      const now = performance.now();
      for (let i = prevLen; i < log.length; i++) {
        const name = soundFor(log[i]!, me);
        if (name === null) continue;
        const last = lastPlayed.get(name);
        if (last !== undefined && now - last < DEDUPE_MS) continue;
        lastPlayed.set(name, now);
        sounds[name]();
      }
    });
  }, []);
}
