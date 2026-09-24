// Shared HUD art: original vector resource glyphs, colonist-style tall
// resource cards, cost pips and dev-card metadata. Every HUD surface
// (hand, bank, trade, discard, modals) draws resources through here.

import { memo } from 'react';
import type { DevCardType, Resource } from '@catan/shared';
import { RESOURCES } from '@catan/shared';

export interface ResourceMeta {
  label: string;
  /** Card face colour. */
  bg: string;
  /** Card outline / shadow colour. */
  dark: string;
  /** Inner art-panel colour. */
  light: string;
}

export const RESOURCE_META: Record<Resource, ResourceMeta> = {
  wood: { label: 'Wood', bg: '#2f8a3a', dark: '#1d5c25', light: '#9fd98a' },
  brick: { label: 'Brick', bg: '#cf5b2e', dark: '#8f3a1a', light: '#f6b58e' },
  sheep: { label: 'Sheep', bg: '#8cc63f', dark: '#5a8a22', light: '#e3f5c4' },
  wheat: { label: 'Wheat', bg: '#e8b31c', dark: '#a87a07', light: '#fbe7a1' },
  ore: { label: 'Ore', bg: '#7b8794', dark: '#4a5360', light: '#d5dbe2' },
};

/** Small original vector glyph per resource (24×24 viewBox). */
export const ResourceGlyph = memo(function ResourceGlyph({
  resource,
  className,
}: {
  resource: Resource;
  className?: string;
}): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {resource === 'wood' ? (
        <g stroke="#123d18" strokeWidth="1" strokeLinejoin="round">
          <rect x="6.2" y="16" width="2" height="4" fill="#7a4a22" />
          <path d="M7.2 3 L12 10 H9.8 L13 14.5 H10.6 L13.2 18 H1.2 L3.8 14.5 H1.4 L4.6 10 H2.4 Z" fill="#2e7d32" />
          <rect x="16" y="16.5" width="1.8" height="3.5" fill="#7a4a22" />
          <path d="M16.9 6 L21 11.5 H19.2 L22 15.5 H19.8 L22.4 18 H11.4 L14 15.5 H11.8 L14.6 11.5 H12.8 Z" fill="#43a047" />
        </g>
      ) : null}
      {resource === 'brick' ? (
        <g stroke="#6b2a10" strokeWidth="1" strokeLinejoin="round">
          <rect x="2" y="13" width="9.5" height="5.5" rx="0.8" fill="#d8683a" />
          <rect x="12.5" y="13" width="9.5" height="5.5" rx="0.8" fill="#c65a2e" />
          <rect x="7" y="6.5" width="10" height="5.5" rx="0.8" fill="#e27a4a" />
          <path d="M8.5 8.2 h7" stroke="#f6b58e" strokeWidth="0.9" />
        </g>
      ) : null}
      {resource === 'sheep' ? (
        <g stroke="#3d4a2a" strokeWidth="1" strokeLinejoin="round">
          <path d="M8 18 v3 M15 18 v3" stroke="#2b2b2b" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M5.5 11.5 a3 3 0 0 1 4-3.5 a3.2 3.2 0 0 1 5.4 0.2 a3 3 0 0 1 3.6 3.4 a2.8 2.8 0 0 1-1 5.3 a3 3 0 0 1-4.8 1.4 a3 3 0 0 1-4.6-0.4 a2.9 2.9 0 0 1-2.6-6.4 Z"
            fill="#ffffff"
          />
          <ellipse cx="19.2" cy="10.8" rx="2.4" ry="2" fill="#3a3a3a" />
          <circle cx="19.9" cy="10.3" r="0.45" fill="#fff" stroke="none" />
        </g>
      ) : null}
      {resource === 'wheat' ? (
        <g stroke="#7a5200" strokeWidth="0.8" strokeLinejoin="round">
          <path d="M12 22 V6 M8 22 L10.5 9 M16 22 L13.5 9" stroke="#9a6b00" strokeWidth="1.2" strokeLinecap="round" />
          {[5, 8, 11, 14].map((y) => (
            <g key={y}>
              <ellipse cx="10.6" cy={y + 1} rx="1.5" ry="2.3" fill="#f7cf3d" transform={`rotate(-28 10.6 ${y + 1})`} />
              <ellipse cx="13.4" cy={y + 1} rx="1.5" ry="2.3" fill="#f2c12a" transform={`rotate(28 13.4 ${y + 1})`} />
            </g>
          ))}
          <ellipse cx="12" cy="3.6" rx="1.3" ry="2.1" fill="#f7cf3d" />
        </g>
      ) : null}
      {resource === 'ore' ? (
        <g stroke="#2e3640" strokeWidth="1" strokeLinejoin="round">
          <path d="M2 19 L6.5 9 L10 12 L14 4.5 L22 19 Z" fill="#8e9aa8" />
          <path d="M14 4.5 L16.4 9 L14.8 10.4 L13 8.4 L11.3 10.4 Z" fill="#f4f7fa" />
          <path d="M6.5 9 L8.4 12.6 L6.8 13.4 L5.2 12 Z" fill="#dfe5ea" />
          <path d="M14 4.5 L22 19 H15 Z" fill="#6f7b88" stroke="none" />
        </g>
      ) : null}
    </svg>
  );
});

type CardSize = 'sm' | 'md' | 'lg';

const CARD_SIZE: Record<CardSize, { card: string; glyph: string; count: string }> = {
  sm: { card: 'h-10 w-7 rounded-md', glyph: 'h-5 w-5', count: 'text-[10px] min-w-4 h-4' },
  md: { card: 'h-14 w-10 rounded-lg', glyph: 'h-7 w-7', count: 'text-xs min-w-5 h-5' },
  lg: { card: 'h-16 w-11 sm:h-20 sm:w-14 rounded-xl', glyph: 'h-8 w-8 sm:h-10 sm:w-10', count: 'text-xs sm:text-sm min-w-5 h-5 sm:min-w-6 sm:h-6' },
};

/** Colonist-style tall rounded resource card: art panel + count badge. */
export const ResourceCard = memo(function ResourceCard({
  resource,
  count,
  size = 'md',
  dim = false,
  title,
}: {
  resource: Resource;
  count?: number;
  size?: CardSize;
  dim?: boolean;
  title?: string;
}): React.JSX.Element {
  const meta = RESOURCE_META[resource];
  const s = CARD_SIZE[size];
  return (
    <div
      className={`relative flex flex-none flex-col items-center justify-center border-2 shadow-[0_2px_0_rgba(0,0,0,0.25)] transition-opacity ${s.card} ${
        dim ? 'opacity-40 saturate-50' : ''
      }`}
      style={{ background: meta.bg, borderColor: meta.dark }}
      title={title ?? `${meta.label}${count !== undefined ? `: ${count}` : ''}`}
      data-resource={resource}
    >
      <div
        className="absolute inset-[3px] bottom-[30%] rounded-[inherit] opacity-90"
        style={{ background: meta.light }}
      />
      <ResourceGlyph resource={resource} className={`relative -mt-2 ${s.glyph}`} />
      {count !== undefined ? (
        <span
          className={`absolute bottom-0.5 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-white px-1 font-bold leading-none text-ink tabular-nums shadow-sm ${s.count}`}
        >
          {count}
        </span>
      ) : null}
    </div>
  );
});

/** Tiny coloured squares describing a build cost (e.g. road = wood+brick). */
export function CostPips({
  cost,
  className = '',
}: {
  cost: Partial<Record<Resource, number>>;
  className?: string;
}): React.JSX.Element {
  const pips: Resource[] = [];
  for (const r of RESOURCES) for (let i = 0; i < (cost[r] ?? 0); i++) pips.push(r);
  return (
    <span className={`flex items-center gap-px ${className}`} aria-hidden="true">
      {pips.map((r, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-[2px] border"
          style={{ background: RESOURCE_META[r].bg, borderColor: RESOURCE_META[r].dark }}
        />
      ))}
    </span>
  );
}

/** Human-readable cost string for titles / aria labels. */
export function costLabel(cost: Partial<Record<Resource, number>>): string {
  return RESOURCES.filter((r) => (cost[r] ?? 0) > 0)
    .map((r) => `${cost[r]} ${RESOURCE_META[r].label}`)
    .join(' + ');
}

export const DEV_META: Record<DevCardType, { label: string; icon: string; blurb: string }> = {
  knight: { label: 'Knight', icon: '⚔️', blurb: 'Move the robber and steal a card.' },
  victoryPoint: { label: 'Victory Point', icon: '🏆', blurb: 'Worth 1 VP. Hidden from other players.' },
  roadBuilding: { label: 'Road Building', icon: '🛣️', blurb: 'Place 2 roads for free.' },
  monopoly: { label: 'Monopoly', icon: '👑', blurb: 'Take every card of one resource.' },
  yearOfPlenty: { label: 'Year of Plenty', icon: '🎁', blurb: 'Take any 2 resources from the bank.' },
};
