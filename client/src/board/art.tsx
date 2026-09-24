// Original flat vector art for the 2D board, defined ONCE in <defs> and
// instanced with <use>: tiles, terrain props, harbour ships, resource icons,
// pieces (tinted via currentColor), robber, legal markers, board CSS.

import { memo } from 'react';
import {
  BOARD_COLORS as C,
  PIECE_OUTLINE,
  TERRAIN_BORDER,
  TERRAIN_FILL,
  TERRAIN_LIGHT,
} from '../theme';

const SQRT3_2 = Math.sqrt(3) / 2;
const TERRAINS = ['forest', 'pasture', 'fields', 'hills', 'mountains', 'desert'] as const;

type Corner = [number, number];

/** Pointy-top hex corners of radius r, clockwise from upper-right (shared order). */
function corners(r: number): Corner[] {
  const x = Math.round(SQRT3_2 * r * 100) / 100;
  return [
    [x, -r / 2],
    [x, r / 2],
    [0, r],
    [-x, r / 2],
    [-x, -r / 2],
    [0, -r],
  ];
}

function pointsAttr(list: Corner[]): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ');
}

export function hexPoints(r: number): string {
  return pointsAttr(corners(r));
}

/** Upper-left rim (lit) and lower-right rim (shaded) of the inner bevel. */
function bevelPaths(r: number): { lit: string; shade: string } {
  const [ur, lr, bottom, ll, ul, top] = corners(r) as [Corner, Corner, Corner, Corner, Corner, Corner];
  return { lit: pointsAttr([ll, ul, top, ur]), shade: pointsAttr([ur, lr, bottom, ll]) };
}

/** [x, y, scale, mirrored] prop placements inside a radius-100 tile. */
type Placement = readonly [number, number, number, boolean?];

const PROPS: Record<(typeof TERRAINS)[number], { href: string; at: readonly Placement[] }> = {
  forest: {
    href: '#bs-pine',
    at: [
      [-4, -50, 0.88],
      [-42, -34, 0.92],
      [38, -36, 0.96],
      [64, -2, 0.78],
      [-64, 6, 0.8],
      [-40, 50, 0.95],
      [44, 52, 1],
      [2, 72, 0.78],
    ],
  },
  pasture: {
    href: '#bs-sheep',
    at: [
      [-42, -46, 1.05],
      [40, -42, 0.95, true],
      [58, 30, 0.8, true],
      [-8, 60, 1.1],
    ],
  },
  fields: {
    href: '#bs-wheat',
    at: [
      [-12, -56, 0.9],
      [-46, -32, 1],
      [28, -48, 1],
      [60, -12, 0.82],
      [-62, 22, 0.82],
      [-34, 64, 1],
      [48, 52, 1],
      [12, 76, 0.8],
    ],
  },
  hills: {
    href: '#bs-bricks',
    at: [
      [0, -66, 0.78],
      [-44, -36, 1],
      [48, -36, 0.9],
      [-52, 44, 0.95],
      [38, 58, 1.05],
    ],
  },
  mountains: {
    href: '#bs-peak',
    at: [
      [-2, -52, 0.8],
      [-34, -26, 1.12],
      [38, -32, 0.95],
      [70, 22, 0.55],
      [-40, 62, 0.9],
      [36, 64, 1],
    ],
  },
  desert: {
    href: '#bs-cactus',
    at: [
      [58, -40, 0.7],
      [-44, -26, 1],
      [52, 48, 0.85, true],
    ],
  },
};

/** Extra flat ground detail per terrain (one path each, drawn under props). */
const GROUND: Record<(typeof TERRAINS)[number], React.JSX.Element | null> = {
  forest: <path d="M-70,-30l4,-6l4,6M20,8l4,-6l4,6M-20,26l4,-6l4,6" stroke="#236e30" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  pasture: (
    <path
      d="M-68,-10l3,-7l3,7M-30,-74l3,-7l3,7M8,-70l3,-7l3,7M64,-60l3,-7l3,7M-70,40l3,-7l3,7M22,40l3,-7l3,7M-40,20l3,-7l3,7M44,80l3,-7l3,7"
      stroke="#6aa332"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  fields: (
    <path
      d="M-74,-4Q-56,-12 -38,-4M40,6Q58,-2 76,6M-70,46Q-52,38 -34,46M-10,-82Q8,-90 26,-82M8,40Q24,34 40,40"
      stroke={TERRAIN_BORDER.fields}
      strokeOpacity={0.45}
      strokeWidth={3}
      strokeLinecap="round"
      fill="none"
    />
  ),
  hills: (
    <path d="M-80,40Q-54,2 -24,40ZM18,-28Q48,-66 80,-28Z" fill={TERRAIN_BORDER.hills} fillOpacity={0.28} />
  ),
  mountains: (
    <path
      d="M-64,26a5,3.5 0 1,0 10,0a5,3.5 0 1,0 -10,0ZM52,-4a4,3 0 1,0 8,0a4,3 0 1,0 -8,0ZM-6,34a4,3 0 1,0 8,0a4,3 0 1,0 -8,0ZM-18,-82a4,3 0 1,0 8,0a4,3 0 1,0 -8,0Z"
      fill="#6c7783"
    />
  ),
  desert: (
    <g fill="none" stroke={TERRAIN_BORDER.desert} strokeWidth={3} strokeLinecap="round">
      <path d="M-74,6Q-44,-14 -12,4M14,-58Q38,-72 62,-60M-6,58Q26,40 64,58M-62,52Q-44,44 -26,52" />
    </g>
  ),
};

function TileDef({ terrain }: { terrain: (typeof TERRAINS)[number] }): React.JSX.Element {
  const bevel = bevelPaths(90.5);
  const { href, at } = PROPS[terrain];
  return (
    <g id={`bs-tile-${terrain}`}>
      <polygon points={hexPoints(100)} fill={TERRAIN_BORDER[terrain]} />
      <polygon points={hexPoints(95)} fill={TERRAIN_FILL[terrain]} />
      <polyline points={bevel.lit} fill="none" stroke={TERRAIN_LIGHT[terrain]} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={bevel.shade} fill="none" stroke={TERRAIN_BORDER[terrain]} strokeOpacity={0.55} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      {GROUND[terrain]}
      {at.map(([x, y, s, flip], i) => (
        <use key={i} href={href} transform={`translate(${x} ${y}) scale(${flip === true ? -s : s} ${s})`} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Board CSS (scoped by the bs- prefix; honours reduced motion)
// ---------------------------------------------------------------------------

const BOARD_CSS = `
.bs-hit{cursor:pointer;-webkit-tap-highlight-color:transparent;outline:none}
.bs-breathe{animation:bs-breathe 1.1s ease-in-out infinite alternate}
@keyframes bs-breathe{from{opacity:1}to{opacity:.62}}
.bs-dash{animation:bs-dash .9s linear infinite}
@keyframes bs-dash{to{stroke-dashoffset:-15}}
.bs-pop{transform-box:fill-box;transform-origin:center;animation:bs-pop .55s ease-out 3}
@keyframes bs-pop{0%{transform:scale(1)}40%{transform:scale(1.22)}100%{transform:scale(1)}}
.bs-glow{opacity:0;animation:bs-glow 1.9s ease-out}
@keyframes bs-glow{0%{opacity:0}18%{opacity:1}100%{opacity:0}}
.bs-robber{transition:transform .38s cubic-bezier(.3,1.35,.5,1)}
.bs-place{transform-box:fill-box;transform-origin:50% 100%;animation:bs-place .32s cubic-bezier(.3,1.5,.5,1)}
@keyframes bs-place{from{transform:scale(.4);opacity:.3}to{transform:scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){
.bs-breathe,.bs-dash,.bs-pop,.bs-place{animation:none}
.bs-glow{animation:none;opacity:.7}
.bs-robber{transition:none}
}
`;

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

/** Settlement outline: house with overhanging roof, centred on its vertex. */
const SETTLEMENT_PATH = 'M-13,-1L0,-14L13,-1H10.5V13H-10.5V-1Z';
/** City outline: tower (left) joined to a house (right). */
const CITY_PATH = 'M-17,15V-11L-10,-20L-3,-11V-2L6.5,-11L16,-2V15Z';
/** Pieces are drawn at ~26-33 units and scaled up to read well on a 100-unit hex. */
const PIECE_SCALE = 1.2;

export const BoardDefs = memo(function BoardDefs(): React.JSX.Element {
  return (
    <>
      <style>{BOARD_CSS}</style>
      <defs>
        {/* ---- Terrain props ---- */}
        <g id="bs-pine">
          <ellipse cx={0} cy={1} rx={12} ry={3.5} fill="rgba(0,0,0,0.22)" />
          <rect x={-2.5} y={-8} width={5} height={9} rx={1} fill="#5b3a1d" />
          <path d="M0,-42L14,-20H8L17,-7H-17L-8,-20H-14Z" fill="#17572a" stroke="#0e3d1b" strokeWidth={1.4} strokeLinejoin="round" />
          <path d="M0,-41L-13,-20H-7L-15.5,-8H0Z" fill="#3c9a49" />
        </g>
        <g id="bs-sheep">
          <ellipse cx={0} cy={11} rx={13} ry={3} fill="rgba(0,0,0,0.2)" />
          <path d="M-7,4v7M-2,5v7M4,5v7M8,4v7" stroke="#3a3833" strokeWidth={2.6} strokeLinecap="round" />
          <path
            d="M-12,4C-17,3 -16,-6 -10,-5C-9,-11 -1,-12 1,-7C4,-11 11,-10 11,-4C16,-3 16,5 11,5C8,9 -9,9 -12,4Z"
            fill="#fbfaf4"
            stroke="#6b675d"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <ellipse cx={12.5} cy={-2} rx={4.6} ry={5.6} fill="#3a3833" />
          <ellipse cx={10.5} cy={-7.5} rx={2.6} ry={1.4} fill="#3a3833" transform="rotate(-25 10.5 -7.5)" />
        </g>
        <g id="bs-wheat">
          <ellipse cx={0} cy={1} rx={10} ry={2.6} fill="rgba(0,0,0,0.18)" />
          <path d="M0,0V-20M-3,0L-7,-16M3,0L7,-16" stroke="#a36d0b" strokeWidth={1.8} strokeLinecap="round" fill="none" />
          <path
            d="M0,-38C4.5,-32 4.5,-24 0,-18C-4.5,-24 -4.5,-32 0,-38ZM-8,-32C-4,-27 -4.5,-20 -7.5,-15C-11.5,-19 -12,-27 -8,-32ZM8,-32C12,-27 11.5,-19 7.5,-15C4.5,-20 4,-27 8,-32Z"
            fill="#ffdc6e"
            stroke="#a36d0b"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </g>
        <g id="bs-bricks">
          <ellipse cx={0} cy={1} rx={17} ry={3.5} fill="rgba(0,0,0,0.22)" />
          <g fill="#b8452a" stroke="#6a2312" strokeWidth={1.3} strokeLinejoin="round">
            <rect x={-16} y={-8} width={15} height={8} rx={1.5} />
            <rect x={1} y={-8} width={15} height={8} rx={1.5} />
            <rect x={-7.5} y={-16.5} width={15} height={8} rx={1.5} />
          </g>
          <path d="M-14,-6.3h11M3,-6.3h11M-5.5,-14.8h11" stroke="#ec9670" strokeWidth={1.4} strokeLinecap="round" />
        </g>
        <g id="bs-peak">
          <path d="M-26,0L-4,-40L24,0Z" fill="#65717e" stroke="#434c57" strokeWidth={1.5} strokeLinejoin="round" />
          <path d="M-25,-0.8L-4,-39L-1,-0.8Z" fill="#a8b3bf" />
          <path d="M-4,-40L-12.8,-24L-8,-26.5L-4.5,-22L0,-26.5L7.2,-24Z" fill="#f5f8fb" />
        </g>
        <g id="bs-cactus">
          <ellipse cx={0} cy={1} rx={10} ry={3} fill="rgba(0,0,0,0.2)" />
          <path d="M0,-12H-7Q-10,-12 -10,-15V-22M0,-17H6Q9,-17 9,-20V-26" fill="none" stroke="#2d6329" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M0,0V-31" stroke="#2d6329" strokeWidth={10.5} strokeLinecap="round" />
          <path d="M0,-12H-7Q-10,-12 -10,-15V-22M0,-17H6Q9,-17 9,-20V-26" fill="none" stroke="#5aa84b" strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M0,-1V-30" stroke="#5aa84b" strokeWidth={7.5} strokeLinecap="round" />
        </g>

        {/* ---- Tiles ---- */}
        {TERRAINS.map((t) => (
          <TileDef key={t} terrain={t} />
        ))}

        {/* ---- Sea ---- */}
        <path id="bs-wave" d="M-14,0q7,-6 14,0t14,0" fill="none" stroke={C.wave} strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" />

        {/* ---- Harbour ship: back (wake, mast, pennant) under the badge, hull over it ---- */}
        <g id="bs-ship-back">
          <ellipse cx={0} cy={25} rx={29} ry={5} fill={C.oceanFoam} fillOpacity={0.75} />
          <path d="M0,10V-31" stroke={C.woodDark} strokeWidth={2.8} strokeLinecap="round" />
          <path d="M0,-31L13,-27L0,-23Z" fill="#e2372f" stroke={C.woodDark} strokeWidth={1} strokeLinejoin="round" />
        </g>
        <g id="bs-ship-hull">
          <path d="M-27,9H27L20,22Q0,27 -20,22Z" fill={C.wood} stroke={C.woodDark} strokeWidth={2} strokeLinejoin="round" />
          <path d="M-23,12.5H23" stroke={C.woodLight} strokeWidth={1.4} strokeOpacity={0.8} />
        </g>

        {/* ---- Resource icons (white glyphs, ~±9) ---- */}
        <g id="bs-icon-wood" fill="#fff">
          <path d="M0,-10L7,-1H3.5L8,5H-8L-3.5,-1H-7Z" />
          <rect x={-1.5} y={5} width={3} height={4.5} rx={0.8} />
        </g>
        <g id="bs-icon-brick" fill="#fff">
          <rect x={-9} y={0.5} width={8.4} height={5.5} rx={1} />
          <rect x={0.6} y={0.5} width={8.4} height={5.5} rx={1} />
          <rect x={-4.2} y={-6.5} width={8.4} height={5.5} rx={1} />
        </g>
        <g id="bs-icon-sheep" fill="#fff">
          <path d="M-7,3C-10,2.5 -9.5,-3.5 -6,-3C-5.5,-7 -0.5,-7.5 0.5,-4.5C2.5,-7 7,-6.5 7,-2.5C10,-2 10,3 7,3C5,5.5 -5,5.5 -7,3Z" />
          <path d="M-4,4v4M4,4v4" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
        </g>
        <g id="bs-icon-wheat" fill="#fff">
          <path d="M0,-10C2.8,-6.5 2.8,-2 0,1.5C-2.8,-2 -2.8,-6.5 0,-10ZM-5,-6C-2.5,-3 -2.8,1 -4.6,4C-7.2,1.6 -7.5,-3 -5,-6ZM5,-6C7.5,-3 7.2,1.6 4.6,4C2.8,1 2.5,-3 5,-6Z" />
          <path d="M0,1V9" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
        </g>
        <g id="bs-icon-ore" fill="#fff">
          <path d="M-9,6L-6,-3L0,-8L7,-3L9,6Z" />
          <path d="M0,-8L-1,6M-6,-3L-1,1L7,-3" stroke="rgba(0,0,0,0.25)" strokeWidth={1.2} fill="none" strokeLinejoin="round" />
        </g>

        {/* ---- Pieces: body = currentColor, shading via translucent overlays ---- */}
        <path id="bs-settlement-shadow" d={SETTLEMENT_PATH} transform={`scale(${PIECE_SCALE})`} fill="rgba(0,0,0,0.32)" />
        <g id="bs-settlement" transform={`scale(${PIECE_SCALE})`}>
          <path d={SETTLEMENT_PATH} fill="currentColor" />
          <path d="M-13,-1L0,-14L13,-1Z" fill="rgba(0,0,0,0.24)" />
          <rect x={-3.2} y={4} width={6.4} height={9} rx={1} fill="rgba(0,0,0,0.38)" />
          <path d="M-10,-2.5L-0.5,-11.5" stroke="rgba(255,255,255,0.55)" strokeWidth={2} strokeLinecap="round" />
          <path d={SETTLEMENT_PATH} fill="none" stroke={PIECE_OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        </g>
        <path id="bs-city-shadow" d={CITY_PATH} transform={`scale(${PIECE_SCALE})`} fill="rgba(0,0,0,0.32)" />
        <g id="bs-city" transform={`scale(${PIECE_SCALE})`}>
          <path d={CITY_PATH} fill="currentColor" />
          <path d="M-17,-11L-10,-20L-3,-11ZM-3,-2L6.5,-11L16,-2Z" fill="rgba(0,0,0,0.24)" />
          <rect x={-12.2} y={-6} width={4.4} height={6} rx={1} fill="rgba(0,0,0,0.4)" />
          <rect x={3.5} y={5} width={6} height={10} rx={1} fill="rgba(0,0,0,0.38)" />
          <path d="M-15,-12L-10.5,-17.5M-1,-3L5.5,-9" stroke="rgba(255,255,255,0.55)" strokeWidth={2} strokeLinecap="round" />
          <path d={CITY_PATH} fill="none" stroke={PIECE_OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        </g>

        {/* ---- Robber pawn ---- */}
        <g id="bs-robber" transform="scale(1.12)">
          <ellipse cx={0} cy={21} rx={17} ry={5.5} fill="rgba(0,0,0,0.3)" />
          {/* Light halo so the dark pawn reads on dark forest/mountain tiles. */}
          <g fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={6} strokeLinejoin="round">
            <path d="M-15,19Q-16,4 -7,-3H7Q16,4 15,19Q0,24 -15,19Z" />
            <circle cx={0} cy={-15} r={9.5} />
          </g>
          <path d="M-15,19Q-16,4 -7,-3H7Q16,4 15,19Q0,24 -15,19Z" fill={C.robber} stroke={C.robberDark} strokeWidth={2.2} strokeLinejoin="round" />
          <ellipse cx={0} cy={-4} rx={10} ry={3.8} fill={C.robber} stroke={C.robberDark} strokeWidth={2} />
          <circle cx={0} cy={-15} r={9.5} fill={C.robber} stroke={C.robberDark} strokeWidth={2.2} />
          <path d="M-10,15Q-11,6 -5,0M-5,-19A6,6 0 0 1 1,-21.5" stroke={C.robberLight} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        </g>

        {/* ---- Legal markers ---- */}
        <g id="bs-legal-dot">
          <circle r={16} fill="none" stroke={C.legalShade} strokeWidth={2} />
          <circle r={12.5} fill="rgba(255,255,255,0.62)" stroke={C.legal} strokeWidth={4} />
        </g>
        <g id="bs-legal-ring">
          <circle r={25.5} fill="none" stroke={C.legalShade} strokeWidth={2} />
          <circle r={22} fill="rgba(255,255,255,0.2)" stroke={C.legal} strokeWidth={4} />
        </g>
      </defs>
    </>
  );
});
