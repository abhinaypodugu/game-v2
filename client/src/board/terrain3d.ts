// 3D Terrain Art Kit: extruded hex slabs, biome props, carved number tokens,
// harbor docks, and 3D playing pieces — all pure SVG generators used by BoardSvg.
// Catan Universe-style isometric look: top-lit surfaces, side shading, contact shadows.

export type Pt = { x: number; y: number };

// ---------------------------------------------------------------------------
// Extruded hex slab: top face + two shaded side walls (pseudo-3D depth).
// ---------------------------------------------------------------------------

export interface SlabColors {
  top: string;
  topStroke: string;
  bevel: string;
  sideLeft: string;
  sideRight: string;
}

export const TERRAIN_SLAB: Record<string, SlabColors> = {
  forest: { top: '#3f8a4a', topStroke: '#2c6135', bevel: 'rgba(255,255,255,0.22)', sideLeft: '#1b4d24', sideRight: '#123418' },
  hills: { top: '#d3703a', topStroke: '#a04e1c', bevel: 'rgba(255,255,255,0.22)', sideLeft: '#8f3e15', sideRight: '#5f2a0c' },
  pasture: { top: '#a4d94f', topStroke: '#7aa832', bevel: 'rgba(255,255,255,0.28)', sideLeft: '#5c9420', sideRight: '#3e6815' },
  fields: { top: '#f7cf4b', topStroke: '#c9a014', bevel: 'rgba(255,255,255,0.3)', sideLeft: '#c99812', sideRight: '#8a690c' },
  mountains: { top: '#a7b3bf', topStroke: '#7c8894', bevel: 'rgba(255,255,255,0.25)', sideLeft: '#5a6773', sideRight: '#3c464e' },
  desert: { top: '#eed69a', topStroke: '#c2a866', bevel: 'rgba(255,255,255,0.3)', sideLeft: '#b89e60', sideRight: '#8a7442' },
};

const DEPTH = 26; // extrusion depth (px)

/** Hex slab polygon points, pointy-top, radius r. */
export function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (60 * i - 30) * (Math.PI / 180);
    pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)},${(cy + r * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** The full extruded 3D hex slab: side walls + top face + inner bevel ring. */
export function slabSvg(
  cx: number,
  cy: number,
  r: number,
  terrain: string,
  key: string,
): string {
  const c = TERRAIN_SLAB[terrain] ?? TERRAIN_SLAB.desert!;
  const top = hexPoints(cx, cy, r);
  const bottom = hexPoints(cx, cy + DEPTH, r);
  const d = DEPTH;
  return `<g id="${key}" data-slab="${terrain}">
  <polygon points="${bottom}" fill="${c.sideRight}" opacity="0.95"/>
  <polygon points="${cx - r},${cy} ${cx - r * 0.5},${cy + r * 0.866} ${cx - r * 0.5},${cy + r * 0.866 + d} ${cx - r},${cy + d}" fill="${c.sideLeft}"/>
  <polygon points="${cx + r},${cy} ${cx + r * 0.5},${cy + r * 0.866} ${cx + r * 0.5},${cy + r * 0.866 + d} ${cx + r},${cy + d}" fill="${c.sideRight}"/>
  <polygon points="${cx - r * 0.5},${cy + r * 0.866} ${cx + r * 0.5},${cy + r * 0.866} ${cx + r * 0.5},${cy + r * 0.866 + d} ${cx - r * 0.5},${cy + r * 0.866 + d}" fill="${c.sideLeft}"/>
  <polygon points="${top}" fill="${c.top}" stroke="${c.topStroke}" stroke-width="2.5"/>
  <polygon points="${hexPoints(cx, cy, r - 7)}" fill="none" stroke="${c.bevel}" stroke-width="2"/>
</g>`;
}

// ---------------------------------------------------------------------------
// Biome props drawn on the top face (offset up by DEPTH/2 for visual centering).
// ---------------------------------------------------------------------------

export function biomePropsSvg(terrain: string, cx: number, cy: number): string {
  const y = cy + DEPTH / 2 - 8; // optical center on the top face
  switch (terrain) {
    case 'forest':
      return `
  <g transform="translate(${cx - 34},${y})">
    <polygon points="0,26 -16,26 0,-26 16,26" fill="#6b4a2b"/><polygon points="0,26 -6,26 0,-26 6,26" fill="#4d3520"/>
    <polygon points="-4,-38 4,-38 4,-30 -4,-30" fill="#6b4a2b"/>
    <polygon points="-20,-6 -26,26 -14,26" fill="#1b5e2c"/><polygon points="-20,-6 -14,26 -20,26" fill="#144a22"/>
    <polygon points="0,-10 -22,26 22,26" fill="#277a36"/><polygon points="0,-10 22,26 0,26" fill="#1c5f2a"/>
    <polygon points="0,-26 -14,26 14,26" fill="#33914a"/><polygon points="0,-26 14,26 0,26" fill="#247038"/>
  </g>
  <g transform="translate(${cx + 30},${y + 6}) scale(0.7)">
    <polygon points="0,26 -22,26 0,-30 22,26" fill="#277a36"/><polygon points="0,26 22,26 0,-30" fill="#1c5f2a"/>
    <polygon points="0,-4 -14,26 14,26" fill="#33914a"/>
  </g>
  <circle cx="${cx - 12}" cy="${y + 34}" r="12" fill="#2c6135"/>
  <circle cx="${cx + 26}" cy="${y + 36}" r="14" fill="#245630"/>`;
    case 'hills':
      return `
  <g transform="translate(${cx},${y})">
    <path d="M-52,18 C-30,-14 30,-24 52,0 C54,26 30,40 -20,38 Z" fill="#9e4316" stroke="#4a1c06" stroke-width="2"/>
    <path d="M-38,10 C-15,-14 25,-10 38,8 C38,24 15,32 -20,26 Z" fill="#c25721"/>
    <g transform="translate(-8,4)">
      <polygon points="-14,2 0,-6 14,2 0,10" fill="#f07c3f" stroke="#6e2808" stroke-width="1.5"/>
      <polygon points="-14,2 0,10 0,16 -14,8" fill="#c25721"/>
      <polygon points="0,10 14,2 14,8 0,16" fill="#8a340b"/>
      <g transform="translate(0,-12)">
        <polygon points="-9,2 0,-4 9,2 0,8" fill="#ff9966" stroke="#6e2808" stroke-width="1.2"/>
        <polygon points="-9,2 0,8 0,13 -9,6" fill="#e0692d"/>
        <polygon points="0,8 9,2 9,6 0,13" fill="#a84313"/>
      </g>
    </g>
  </g>`;
    case 'pasture':
      return `
  <path d="M-55,5 Q-20,-25 30,0 Q55,-15 70,10 L70,40 Q5,45 -55,30 Z" fill="#78b52c" opacity="0.9" transform="translate(${cx},${y})"/>
  <g transform="translate(${cx - 12},${y - 2}) scale(0.95)">
    <ellipse cx="0" cy="14" rx="16" ry="5" fill="rgba(0,0,0,0.25)"/>
    <ellipse cx="0" cy="0" rx="17" ry="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
    <circle cx="-14" cy="-4" r="6.5" fill="#1e293b"/>
    <ellipse cx="-13" cy="-10" rx="1.8" ry="4" fill="#1e293b" transform="rotate(-30 -13 -10)"/>
    <rect x="-8" y="10" width="2.6" height="7" fill="#1e293b" rx="1"/>
    <rect x="6" y="10" width="2.6" height="7" fill="#1e293b" rx="1"/>
  </g>
  <g transform="translate(${cx + 30},${y + 14}) scale(0.62)">
    <ellipse cx="0" cy="0" rx="17" ry="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
    <circle cx="-14" cy="-4" r="6.5" fill="#1e293b"/>
    <rect x="-8" y="10" width="2.6" height="7" fill="#1e293b" rx="1"/>
  </g>`;
    case 'fields':
      return `
  <g transform="translate(${cx},${y})">
    <path d="M-58,-28 C-28,-10 28,-46 58,-28" stroke="#b08307" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="7,5"/>
    <path d="M-64,-4 C-28,14 28,-22 64,-4" stroke="#997003" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="7,5"/>
    <path d="M-58,20 C-28,38 28,2 58,20" stroke="#b08307" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="7,5"/>
    <g transform="translate(0,-2)">
      <path d="M-19,14 C-8,-6 -15,-30 0,-40 C15,-30 8,-6 19,14 C8,21 -8,21 -19,14 Z" fill="#ffe082" stroke="#8d6e12" stroke-width="2"/>
      <rect x="-15" y="-4" width="30" height="6" rx="2.5" fill="#ef4444" stroke="#991b1b" stroke-width="1"/>
    </g>
  </g>`;
    case 'mountains':
      return `
  <g transform="translate(${cx},${y})">
    <polygon points="-38,12 -14,-48 26,12" fill="#4b5563"/>
    <polygon points="-14,-48 -2,-28 -20,-26" fill="#f1f5f9"/>
    <polygon points="-52,42 6,-56 62,42" fill="#64748b" stroke="#1e293b" stroke-width="2"/>
    <polygon points="6,-56 62,42 6,42" fill="#475569"/>
    <polygon points="6,-56 -8,-32 7,-29 22,-24" fill="#ffffff"/>
    <path d="M-20,14 L-11,-2 L-3,12 L9,-10 L17,4" stroke="#38bdf8" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
  </g>`;
    case 'desert':
      return `
  <g transform="translate(${cx},${y})">
    <path d="M-62,-22 Q-15,-58 45,-16 Q62,4 66,-8 L66,28 Q5,20 -62,8 Z" fill="#d4bb79"/>
    <path d="M-62,8 Q-28,44 35,14 Q55,36 66,24 L66,52 L-62,52 Z" fill="#bfa35a"/>
    <g transform="translate(0,-16)">
      <ellipse cx="0" cy="30" rx="15" ry="4.5" fill="rgba(0,0,0,0.25)"/>
      <rect x="-5.5" y="-28" width="11" height="58" rx="5.5" fill="#4d7c0f" stroke="#1a2e05" stroke-width="1.8"/>
      <path d="M-5.5,-6 L-17,-6 L-17,-26" fill="none" stroke="#4d7c0f" stroke-width="7" stroke-linecap="round"/>
      <path d="M5.5,4 L17,4 L17,-16" fill="none" stroke="#4d7c0f" stroke-width="7" stroke-linecap="round"/>
    </g>
  </g>`;
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Carved number token (ivory face + wood rim + pips; red for 6/8).
// ---------------------------------------------------------------------------

export function tokenSvg(cx: number, cy: number, token: number, pips: number): string {
  const hot = token === 6 || token === 8;
  const color = hot ? '#dc2626' : '#2d3748';
  const pipDots = Array.from({ length: pips }, (_, i) => {
    const x = -((pips - 1) * 4) / 2 + i * 4;
    return `<circle cx="${cx + x}" cy="${cy + 24}" r="2" fill="${color}"/>`;
  }).join('');
  return `<g data-token="${token}">
  <circle cx="${cx}" cy="${cy + 5}" r="34" fill="#5c3818"/>
  <circle cx="${cx}" cy="${cy}" r="34" fill="#b07038" stroke="#3e220a" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="27" fill="${hot ? '#fff5f5' : '#fcf8ed'}" stroke="${hot ? '#fca5a5' : '#d5c39e'}" stroke-width="2"/>
  <text x="${cx}" y="${cy + 8}" font-family="Rubik, sans-serif" font-size="24" font-weight="700" fill="${color}" text-anchor="middle">${token}</text>
  ${pipDots}
</g>`;
}

// ---------------------------------------------------------------------------
// Harbor dock buoys: wood pier planks + rate badge.
// ---------------------------------------------------------------------------

export function harborSvg(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  isSpecialty: boolean,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Pull the buoy outward from the board center (0,0) so it floats on the sea.
  const len = Math.hypot(mx, my) || 1;
  const bx = mx + (mx / len) * 30;
  const by = my + (my / len) * 30 + 8;
  const badge = isSpecialty ? '#b45309' : '#0f3d69';
  const ring = isSpecialty ? '#f5c938' : '#38bdf8';
  return `<g data-harbor="${label}">
  <rect x="${bx - 18}" y="${by + 8}" width="36" height="13" rx="3" fill="#8b5a2b" stroke="#4a2808" stroke-width="1.5"/>
  <line x1="${bx - 6}" y1="${by + 8}" x2="${bx - 6}" y2="${by + 21}" stroke="#4a2808" stroke-width="1.2"/>
  <line x1="${bx + 6}" y1="${by + 8}" x2="${bx + 6}" y2="${by + 21}" stroke="#4a2808" stroke-width="1.2"/>
  <circle cx="${bx}" cy="${by - 8}" r="17" fill="${badge}" stroke="${ring}" stroke-width="2.5"/>
  <text x="${bx}" y="${by - 10}" font-family="Rubik, sans-serif" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">${label}</text>
</g>`;
}

// ---------------------------------------------------------------------------
// 3D playing pieces.
// ---------------------------------------------------------------------------

export const PIECE_GRADIENTS: Record<string, { top: string; face: string; side: string; stroke: string }> = {
  red: { top: '#ff8a80', face: '#e02020', side: '#8f0000', stroke: '#6b0000' },
  blue: { top: '#8ad4ff', face: '#0e90e8', side: '#0059a8', stroke: '#003d75' },
  orange: { top: '#ffcf9e', face: '#f08c1e', side: '#9c4d00', stroke: '#7a3b00' },
  white: { top: '#ffffff', face: '#e8e8e8', side: '#a8a8a8', stroke: '#7a7a7a' },
  green: { top: '#a7f3b0', face: '#22b352', side: '#0a6e2e', stroke: '#075223' },
  brown: { top: '#d4b48c', face: '#8a5a2b', side: '#4d2f12', stroke: '#3a220d' },
};

/** Road: beveled timber log along (x1,y1)->(x2,y2). */
export function roadSvg(x1: number, y1: number, x2: number, y2: number, color: string, key: string): string {
  const g = PIECE_GRADIENTS[color] ?? PIECE_GRADIENTS.white!;
  return `<g id="road-${key}" data-piece="road">
  <line x1="${x1}" y1="${y1 + 4}" x2="${x2}" y2="${y2 + 4}" stroke="${g.side}" stroke-width="11" stroke-linecap="round"/>
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${g.face}" stroke-width="11" stroke-linecap="round"/>
  <line x1="${x1}" y1="${y1 - 2}" x2="${x2}" y2="${y2 - 2}" stroke="${g.top}" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>
</g>`;
}

/** Settlement: gabled cottage with chimney, 3D shading. */
export function settlementSvg(x: number, y: number, color: string, key: string): string {
  const g = PIECE_GRADIENTS[color] ?? PIECE_GRADIENTS.white!;
  return `<g id="settlement-${key}" data-piece="settlement">
  <ellipse cx="${x}" cy="${y + 32}" rx="24" ry="7" fill="rgba(0,0,0,0.35)"/>
  <polygon points="${x + 12},${y + 12} ${x + 30},${y + 26} ${x + 30},${y + 30} ${x + 12},${y + 16}" fill="${g.side}"/>
  <polygon points="${x - 12},${y + 12} ${x - 30},${y + 26} ${x - 30},${y + 30} ${x - 12},${y + 16}" fill="${g.side}" opacity="0.8"/>
  <polygon points="${x},${y - 14} ${x + 24},${y + 6} ${x},${y + 26} ${x - 24},${y + 6}" fill="${g.face}" stroke="${g.stroke}" stroke-width="2.5"/>
  <polygon points="${x},${y - 10} ${x + 19},${y + 6} ${x},${y + 21} ${x - 19},${y + 6}" fill="${g.top}" opacity="0.85"/>
  <rect x="${x + 12}" y="${y - 8}" width="7" height="10" rx="1.5" fill="${g.stroke}"/>
  <rect x="${x - 8}" y="${y + 14}" width="16" height="18" rx="2.5" fill="${g.stroke}" opacity="0.9"/>
</g>`;
}

/** City: two-tier keep with battlements, tower, and gate. */
export function citySvg(x: number, y: number, color: string, key: string): string {
  const g = PIECE_GRADIENTS[color] ?? PIECE_GRADIENTS.white!;
  const merlons = [0, 10, 20].map((dx) => `<rect x="${x - 26 + dx}" y="${y - 16}" width="6" height="7" fill="${g.stroke}"/>`).join('');
  return `<g id="city-${key}" data-piece="city">
  <ellipse cx="${x}" cy="${y + 34}" rx="34" ry="8" fill="rgba(0,0,0,0.4)"/>
  <polygon points="${x + 16},${y - 6} ${x + 34},${y + 8} ${x + 34},${y + 30} ${x + 16},${y + 16}" fill="${g.side}"/>
  <rect x="${x - 34}" y="${y - 6}" width="68" height="40" rx="3" fill="${g.face}" stroke="${g.stroke}" stroke-width="2.5"/>
  <rect x="${x - 30}" y="${y - 22}" width="22" height="18" rx="2" fill="${g.face}" stroke="${g.stroke}" stroke-width="2"/>
  ${merlons}
  <path d="M${x - 10},${y + 34} L${x - 10},${y + 18} A10,10 0 0,1 ${x + 10},${y + 18} L${x + 10},${y + 34} Z" fill="${g.stroke}"/>
  <rect x="${x - 30}" y="${y - 2}" width="60" height="3.5" fill="${g.top}" opacity="0.6"/>
</g>`;
}

/** Robber: faceted obsidian pawn with hover elevation shadow. */
export function robberSvg(x: number, y: number): string {
  return `<g data-piece="robber">
  <ellipse cx="${x}" cy="${y + 20}" rx="20" ry="6.5" fill="rgba(0,0,0,0.55)"/>
  <polygon points="${x - 13},${y - 24} ${x + 13},${y - 24} ${x + 17},${y + 12} ${x - 17},${y + 12}" fill="#181818"/>
  <polygon points="${x - 4},${y - 24} ${x + 13},${y - 24} ${x + 17},${y + 12} ${x - 4},${y + 12}" fill="#2c2c2c"/>
  <circle cx="${x}" cy="${y - 32}" r="13" fill="#242424" stroke="#000" stroke-width="2"/>
  <ellipse cx="${x - 5}" cy="${y - 37}" rx="4.5" ry="2.6" fill="rgba(255,255,255,0.35)" transform="rotate(-30 ${x - 5} ${y - 37})"/>
</g>`;
}
