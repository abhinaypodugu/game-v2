// Flying resource cards: a fixed, click-through overlay that animates small
// cards between DOM anchors whenever resources change hands — production from
// hexes to players, trades between players, bank exchanges, steals, discards
// and dev-card draws. Driven only by NEW log events (never replays history).
//
// Per batch of events, anchor rects are read once (cached) before any state
// update, so there is no read/write layout thrash. Each card runs a single
// Web Animation on transform/opacity — compositor-only, no JS frame loop.

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore, type JSX } from 'react';
import { RESOURCES, TERRAIN_RESOURCE, type Resource } from '@catan/shared';
import { useStore } from '../store';
import type { GameEvent, PersonalSnapshot } from '../types';

const CARD_W = 30;
const CARD_H = 42;
const MAX_FLIGHTS = 12;
const STAGGER_MS = 70;
/** Cards in one direction of a single event beyond this are not animated. */
const MAX_CARDS_PER_LEG = 5;
const EDGE_MARGIN = 12;

type CardFace = Resource | 'back' | 'dev';

interface Point {
  x: number;
  y: number;
}

interface Flight {
  id: number;
  face: CardFace;
  from: Point;
  to: Point;
  delay: number;
  duration: number;
}

/** A new event plus the dice sum in effect when it was logged. */
interface QueuedEvent {
  event: GameEvent;
  rollSum: number | null;
}

const FACE_STYLE: Record<CardFace, { bg: string; ink: string }> = {
  wood: { bg: '#2f7d3a', ink: '#e8f5e0' },
  brick: { bg: '#c8562f', ink: '#fde6d8' },
  sheep: { bg: '#8cc63f', ink: '#ffffff' },
  wheat: { bg: '#f0bf2c', ink: '#fff6d6' },
  ore: { bg: '#7f8a9c', ink: '#eef1f6' },
  back: { bg: '#2b4c8c', ink: '#9fb8ea' },
  dev: { bg: '#6b3fa0', ink: '#e6d6fa' },
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function lastRollSum(log: readonly GameEvent[]): number | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!;
    if (e.type === 'rolled') return e.die1 + e.die2;
  }
  return null;
}

/** Expands a resource bag into individual card faces, capped per leg. */
function bagCards(bag: Partial<Record<Resource, number>>): Resource[] {
  const out: Resource[] = [];
  for (const r of RESOURCES) {
    for (let n = bag[r] ?? 0; n > 0 && out.length < MAX_CARDS_PER_LEG; n--) out.push(r);
  }
  return out;
}

/**
 * Resolves anchor centres for one batch. Multiple elements may share an anchor
 * (e.g. the bank appears in a closed drawer and on its toggle), so the first
 * one that is laid out and on screen wins; otherwise the first laid-out match,
 * clamped into the viewport.
 */
function createAnchorResolver(): (selector: string) => Point | null {
  const cache = new Map<string, Point | null>();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return (selector) => {
    const hit = cache.get(selector);
    if (hit !== undefined) return hit;
    let fallback: DOMRect | null = null;
    let chosen: DOMRect | null = null;
    for (const el of document.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh) {
        chosen = r;
        break;
      }
      fallback ??= r;
    }
    const rect = chosen ?? fallback;
    const point =
      rect === null
        ? null
        : {
            x: Math.min(vw - EDGE_MARGIN, Math.max(EDGE_MARGIN, rect.left + rect.width / 2)),
            y: Math.min(vh - EDGE_MARGIN, Math.max(EDGE_MARGIN, rect.top + rect.height / 2)),
          };
    cache.set(selector, point);
    return point;
  };
}

/** Hexes that produced `resource` for `seat` on `rollSum`, one entry per card owed (city = 2). */
function productionHexes(game: PersonalSnapshot, seat: number, resource: Resource, rollSum: number | null): string[] {
  if (rollSum === null) return [];
  const { hexes, topology } = game.board;
  const out: string[] = [];
  for (const [vertex, building] of Object.entries(game.buildings)) {
    if (building.seat !== seat) continue;
    for (const hexId of topology.vertexHexes[Number(vertex)] ?? []) {
      const hex = hexes[hexId];
      if (hexId === game.robber || hex === undefined || hex.token !== rollSum) continue;
      if (TERRAIN_RESOURCE[hex.terrain] !== resource) continue;
      out.push(hexId);
      if (building.type === 'city') out.push(hexId);
    }
  }
  return out;
}

function planFlights(batch: readonly QueuedEvent[], game: PersonalSnapshot | null, me: number | null, nextId: () => number): Flight[] {
  const anchor = createAnchorResolver();
  const centre: Point = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const player = (seat: number): Point | null =>
    (seat === me ? anchor('[data-anchor="hand"]') : null) ?? anchor(`[data-anchor="player-${seat}"]`);
  const hex = (id: string | undefined): Point => (id === undefined ? null : anchor(`[data-hex-id="${id}"]`)) ?? centre;

  const flights: Flight[] = [];
  let cursor = 0;
  const fly = (face: CardFace, from: Point | null, to: Point | null, gapAfter = STAGGER_MS): void => {
    if (from === null || to === null) return;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    flights.push({
      id: nextId(),
      face,
      from,
      to,
      delay: cursor,
      duration: Math.round(Math.min(750, Math.max(550, 450 + distance * 0.4))),
    });
    cursor += gapAfter;
  };

  for (const { event: e, rollSum } of batch) {
    switch (e.type) {
      case 'produced': {
        if (game === null) break;
        const sources = productionHexes(game, e.seat, e.resource, rollSum);
        const to = player(e.seat);
        for (let i = 0; i < Math.min(e.amount, MAX_CARDS_PER_LEG); i++) fly(e.resource, hex(sources[i] ?? sources[0]), to);
        break;
      }
      case 'setupPlaced': {
        if (!e.second || game === null) break;
        const to = player(e.seat);
        for (const hexId of game.board.topology.vertexHexes[e.settlementVertex] ?? []) {
          const tile = game.board.hexes[hexId];
          const resource = tile === undefined ? null : TERRAIN_RESOURCE[tile.terrain];
          if (resource !== null) fly(resource, hex(hexId), to);
        }
        break;
      }
      case 'tradeCompleted': {
        const proposer = player(e.from);
        const responder = player(e.to);
        for (const r of bagCards(e.give)) fly(r, proposer, responder);
        for (const r of bagCards(e.receive)) fly(r, responder, proposer);
        break;
      }
      case 'bankTraded': {
        const seatPoint = player(e.seat);
        const bank = anchor('[data-anchor="bank"]');
        for (let i = 0; i < Math.min(e.giveAmount, MAX_CARDS_PER_LEG); i++) fly(e.give, seatPoint, bank);
        cursor += 150;
        fly(e.receive, bank, seatPoint);
        break;
      }
      case 'stolenFrom': {
        // Only thief and victim see which resource moved; everyone else sees a card back.
        const face = e.resource !== null && (e.seat === me || e.victim === me) ? e.resource : 'back';
        fly(face, player(e.victim), player(e.seat));
        break;
      }
      case 'discarded': {
        const bank = anchor('[data-anchor="bank"]');
        const from = player(e.seat);
        for (const r of bagCards(e.resources)) fly(e.seat === me ? r : 'back', from, bank);
        break;
      }
      case 'devCardBought':
        fly('dev', anchor('[data-anchor="dev-deck"]'), player(e.seat));
        break;
      default:
        break;
    }
  }
  return flights;
}

function CardIcon({ face, ink }: { face: CardFace; ink: string }): JSX.Element {
  switch (face) {
    case 'wood':
      return (
        <g fill={ink}>
          <path d="M12 3 L18 11 H15 L19 16 H5 L9 11 H6 Z" />
          <rect x="11" y="16" width="2" height="4" />
        </g>
      );
    case 'brick':
      return (
        <g fill={ink}>
          <rect x="4" y="6" width="7" height="4" rx="0.8" />
          <rect x="13" y="6" width="7" height="4" rx="0.8" />
          <rect x="8" y="11" width="8" height="4" rx="0.8" />
          <rect x="4" y="16" width="7" height="4" rx="0.8" />
          <rect x="13" y="16" width="7" height="4" rx="0.8" />
        </g>
      );
    case 'sheep':
      return (
        <g fill={ink}>
          <circle cx="9" cy="12" r="3.5" />
          <circle cx="13" cy="10.5" r="3.5" />
          <circle cx="15" cy="13.5" r="3.2" />
          <circle cx="11" cy="14.5" r="3" />
          <ellipse cx="19" cy="10.5" rx="2" ry="2.4" fill="#3d3d3d" />
          <rect x="9" y="16" width="1.6" height="4" fill="#3d3d3d" />
          <rect x="14" y="16" width="1.6" height="4" fill="#3d3d3d" />
        </g>
      );
    case 'wheat':
      return (
        <g fill={ink}>
          <rect x="11.3" y="8" width="1.4" height="13" />
          <ellipse cx="12" cy="5" rx="1.6" ry="2.4" />
          <ellipse cx="9.6" cy="9" rx="1.5" ry="2.3" transform="rotate(-30 9.6 9)" />
          <ellipse cx="14.4" cy="9" rx="1.5" ry="2.3" transform="rotate(30 14.4 9)" />
          <ellipse cx="9.6" cy="13" rx="1.5" ry="2.3" transform="rotate(-30 9.6 13)" />
          <ellipse cx="14.4" cy="13" rx="1.5" ry="2.3" transform="rotate(30 14.4 13)" />
        </g>
      );
    case 'ore':
      return (
        <g fill={ink}>
          <path d="M3 19 L10 7 L14 13 L16 10 L21 19 Z" />
          <path d="M10 7 L12 10.5 L10.8 10 L9.4 11 L8.4 9.9 Z" fill="#ffffff" />
        </g>
      );
    case 'dev':
      return <path fill={ink} d="M12 4 L14.2 9.6 L20 10 L15.5 13.7 L17 19.5 L12 16.3 L7 19.5 L8.5 13.7 L4 10 L9.8 9.6 Z" />;
    case 'back':
      return (
        <g fill="none" stroke={ink} strokeWidth="1.6">
          <path d="M12 4 L19 8 V16 L12 20 L5 16 V8 Z" />
          <circle cx="12" cy="12" r="2.6" fill={ink} stroke="none" />
        </g>
      );
  }
}

/** Quadratic-bezier arc sampled into transform keyframes; the global easing shapes the pace. */
function arcKeyframes(flight: Flight, spin: number): Keyframe[] {
  const { from, to } = flight;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const lift = Math.min(120, distance * 0.3);
  // Control point: above the midpoint, nudged sideways so arcs don't overlap exactly.
  const cx = (from.x + to.x) / 2 - (dy / distance) * lift * 0.3;
  const cy = (from.y + to.y) / 2 - lift;
  const steps = 8;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * from.x + 2 * u * t * cx + t * t * to.x - CARD_W / 2;
    const y = u * u * from.y + 2 * u * t * cy + t * t * to.y - CARD_H / 2;
    const scale = t < 0.5 ? 0.55 + t * 1.1 : 1.1 - (t - 0.5) * 0.5;
    frames.push({
      offset: t,
      transform: `translate3d(${x}px, ${y}px, 0) rotate(${spin * u}deg) scale(${scale})`,
      // Fade in on the first segment, out on the last.
      opacity: i === 0 || i === steps ? 0 : 1,
    });
  }
  return frames;
}

const FlyingCard = memo(function FlyingCard({ flight, onDone }: { flight: Flight; onDone: (id: number) => void }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null || typeof el.animate !== 'function') {
      onDone(flight.id);
      return;
    }
    const spin = (flight.id % 2 === 0 ? -1 : 1) * 18;
    const animation = el.animate(arcKeyframes(flight, spin), {
      duration: flight.duration,
      delay: flight.delay,
      easing: 'cubic-bezier(0.45, 0.05, 0.35, 1)',
      fill: 'both',
    });
    animation.onfinish = () => onDone(flight.id);
    return () => {
      animation.onfinish = null;
      animation.cancel();
    };
  }, [flight, onDone]);

  const { bg, ink } = FACE_STYLE[flight.face];
  return (
    <div
      ref={ref}
      className="absolute left-0 top-0 flex items-center justify-center rounded-[5px] border-2 border-white shadow-[0_3px_8px_rgba(0,0,0,0.35)] will-change-transform"
      style={{ width: CARD_W, height: CARD_H, background: bg, opacity: 0 }}
    >
      <svg viewBox="0 0 24 24" width={CARD_W - 8} height={CARD_W - 8} aria-hidden="true">
        <CardIcon face={flight.face} ink={ink} />
      </svg>
    </div>
  );
});

export function FlyingCards(): JSX.Element {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    if (reducedMotion) return;
    let seenLog = useStore.getState().log;
    let seenLast: GameEvent | undefined = seenLog[seenLog.length - 1];
    let rollSum = lastRollSum(seenLog);
    let queue: QueuedEvent[] = [];
    let frame = 0;
    let idSeq = 0;
    const nextId = (): number => ++idSeq;

    const flush = (): void => {
      frame = 0;
      const batch = queue;
      queue = [];
      if (batch.length === 0 || document.hidden) return;
      const { game, session } = useStore.getState();
      const me = session?.seatIndex ?? game?.you.seat ?? null;
      const planned = planFlights(batch, game, me, nextId);
      if (planned.length === 0) return;
      setFlights((current) => {
        const room = MAX_FLIGHTS - current.length;
        return room <= 0 ? current : [...current, ...planned.slice(0, room)];
      });
    };

    const unsubscribe = useStore.subscribe((state) => {
      const log = state.log;
      if (log === seenLog) return;
      const prevLen = seenLog.length;
      const replaced = log.length < prevLen || (prevLen > 0 && log[prevLen - 1] !== seenLast);
      seenLog = log;
      seenLast = log[log.length - 1];
      if (replaced) {
        queue = [];
        rollSum = lastRollSum(log);
        return;
      }
      for (let i = prevLen; i < log.length; i++) {
        const event = log[i]!;
        if (event.type === 'rolled') rollSum = event.die1 + event.die2;
        queue.push({ event, rollSum });
      }
      if (frame === 0) frame = requestAnimationFrame(flush);
    });

    return () => {
      unsubscribe();
      if (frame !== 0) cancelAnimationFrame(frame);
      setFlights([]);
    };
  }, [reducedMotion]);

  const handleDone = useCallback((id: number) => {
    setFlights((current) => current.filter((f) => f.id !== id));
  }, []);

  if (reducedMotion) return <></>;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true" data-testid="flying-cards">
      {flights.map((flight) => (
        <FlyingCard key={flight.id} flight={flight} onDone={handleDone} />
      ))}
    </div>
  );
}
