// Board layout: every pixel-space quantity the SVG renderer needs, derived
// once per board from the shared topology (pointy-top, HEX_SIZE 100).
import type { Board, HarborType, HexId, Pt, Resource, Terrain } from '@catan/shared';
import { createRng, hexToPixel, parseHexId } from '@catan/shared';

export interface HexLayout {
  id: HexId;
  center: Pt;
  terrain: Terrain;
  token: number | null;
  /** Mirror the tile art horizontally for visual variety. */
  mirror: boolean;
}

export interface VertexLayout {
  id: number;
  pos: Pt;
}

export interface EdgeLayout {
  id: string;
  a: Pt;
  b: Pt;
}

export interface HarborLayout {
  edge: string;
  a: Pt;
  b: Pt;
  /** Badge/ship centre, out in the water along the edge's outward normal. */
  ship: Pt;
  type: HarborType;
  resource: Resource | null;
  ratio: 2 | 3;
}

export interface BoardLayout {
  hexes: HexLayout[];
  hexById: Map<HexId, HexLayout>;
  vertices: VertexLayout[];
  edges: EdgeLayout[];
  /** Closed path through the island's border vertices. */
  coastPath: string;
  harbors: HarborLayout[];
  waves: Pt[];
  viewBox: { x: number; y: number; w: number; h: number };
}

/** Scale applied to the ship + badge art (drawn at ~±30 x ±32 units). */
export const HARBOR_SCALE = 1.2;
/** Distance from a harbour edge midpoint to its ship/badge centre. */
const HARBOR_OFFSET = 70;
/** Half extents of the scaled ship + badge art around its centre. */
const SHIP_HALF_W = 30 * HARBOR_SCALE;
const SHIP_HALF_H = 32 * HARBOR_SCALE;
/** Beach + outline margin around the outermost vertices. */
const COAST_MARGIN = 24;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const layoutCache = new Map<string, BoardLayout>();

/**
 * Layout for a board, cached by board identity (config + seed + size):
 * every snapshot re-creates the board object, but the board itself never
 * changes within a game, so memoised layers keep receiving the same layout.
 */
export function getBoardLayout(board: Board): BoardLayout {
  const key = `${board.config}:${board.seed}:${board.topology.hexes.length}`;
  let layout = layoutCache.get(key);
  if (layout === undefined) {
    layout = computeBoardLayout(board);
    layoutCache.set(key, layout);
    const oldest = layoutCache.keys().next().value;
    if (layoutCache.size > 4 && oldest !== undefined) layoutCache.delete(oldest);
  }
  return layout;
}

/** Walk the border edges into one closed vertex loop. */
function coastLoop(board: Board): number[] {
  const { borderEdges } = board.topology;
  const neighbors = new Map<number, number[]>();
  for (const [a, b] of borderEdges) {
    neighbors.set(a, [...(neighbors.get(a) ?? []), b]);
    neighbors.set(b, [...(neighbors.get(b) ?? []), a]);
  }
  const first = borderEdges[0];
  if (first === undefined) return [];
  const loop = [first[0]];
  let prev = first[0];
  let cur = first[1];
  while (cur !== first[0] && loop.length <= borderEdges.length) {
    loop.push(cur);
    const options = neighbors.get(cur) ?? [];
    const step = options[0] === prev ? options[1] : options[0];
    if (step === undefined) break;
    prev = cur;
    cur = step;
  }
  return loop;
}

function computeBoardLayout(board: Board): BoardLayout {
  const { topology } = board;

  const hexes: HexLayout[] = topology.hexes.map((id) => {
    const { q, r } = parseHexId(id);
    const data = board.hexes[id]!;
    return {
      id,
      center: hexToPixel(q, r),
      terrain: data.terrain,
      token: data.token,
      mirror: ((q * 7 + r * 13) & 1) === 1,
    };
  });
  const hexById = new Map(hexes.map((h) => [h.id, h]));

  const vertices: VertexLayout[] = topology.vertices.map((id) => ({ id, pos: topology.vertexPos[id]! }));

  const edges: EdgeLayout[] = topology.edges.map(([a, b]) => ({
    id: a < b ? `${a}-${b}` : `${b}-${a}`,
    a: topology.vertexPos[a]!,
    b: topology.vertexPos[b]!,
  }));

  const loop = coastLoop(board);
  const coastPath =
    loop
      .map((v, i) => {
        const p = topology.vertexPos[v]!;
        return `${i === 0 ? 'M' : 'L'}${round2(p.x)},${round2(p.y)}`;
      })
      .join('') + 'Z';

  const harbors: HarborLayout[] = Object.entries(board.harbors).map(([edge, harbor]) => {
    const [va, vb] = topology.edgeEndpoints[edge]!;
    const a = topology.vertexPos[va]!;
    const b = topology.vertexPos[vb]!;
    const hex = hexById.get(topology.edgeHexes[edge]![0]!)!;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // Midpoint minus hex centre is the edge's outward normal on a regular hex.
    const nx = mx - hex.center.x;
    const ny = my - hex.center.y;
    const len = Math.hypot(nx, ny) || 1;
    return {
      edge,
      a,
      b,
      ship: { x: round2(mx + (nx / len) * HARBOR_OFFSET), y: round2(my + (ny / len) * HARBOR_OFFSET) },
      type: harbor.type,
      resource: harbor.type === 'specialty' ? (harbor.resource ?? null) : null,
      ratio: harbor.type === 'specialty' ? 2 : 3,
    };
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { pos } of vertices) {
    minX = Math.min(minX, pos.x - COAST_MARGIN);
    maxX = Math.max(maxX, pos.x + COAST_MARGIN);
    minY = Math.min(minY, pos.y - COAST_MARGIN);
    maxY = Math.max(maxY, pos.y + COAST_MARGIN);
  }
  for (const { ship } of harbors) {
    minX = Math.min(minX, ship.x - SHIP_HALF_W);
    maxX = Math.max(maxX, ship.x + SHIP_HALF_W);
    minY = Math.min(minY, ship.y - SHIP_HALF_H);
    maxY = Math.max(maxY, ship.y + SHIP_HALF_H);
  }
  const pad = 8;
  const viewBox = {
    x: Math.floor(minX - pad),
    y: Math.floor(minY - pad),
    w: Math.ceil(maxX - minX + pad * 2),
    h: Math.ceil(maxY - minY + pad * 2),
  };

  // Wave marks: jittered grid over the view (plus letterbox slack), kept
  // clear of the island's shallows and of every harbour ship.
  const rng = createRng(`${board.seed}:waves`);
  const waves: Pt[] = [];
  const step = 120;
  const slack = 160;
  for (let y = viewBox.y - slack; y <= viewBox.y + viewBox.h + slack; y += step) {
    for (let x = viewBox.x - slack; x <= viewBox.x + viewBox.w + slack; x += step) {
      const p = { x: round2(x + (rng.next() - 0.5) * 70), y: round2(y + (rng.next() - 0.5) * 60) };
      const nearIsland = hexes.some((h) => Math.hypot(h.center.x - p.x, h.center.y - p.y) < 168);
      if (nearIsland) continue;
      const nearShip = harbors.some((h) => Math.hypot(h.ship.x - p.x, h.ship.y - p.y) < 62);
      if (nearShip) continue;
      waves.push(p);
    }
  }

  return { hexes, hexById, vertices, edges, coastPath, harbors, waves, viewBox };
}
