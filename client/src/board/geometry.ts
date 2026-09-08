// Board geometry: pixel lookups over the shared topology. This interface
// is the 3D-swap point — all board rendering consumes BoardGeometry only.
import type { Board } from '@catan/shared';
import type { HexId, Pt, VertexId } from '@catan/shared';
import { hexToPixel } from '@catan/shared';

export interface BoardGeometry {
  vertexPos(v: VertexId): Pt;
  edgeEnds(e: string): [Pt, Pt];
  hexCenter(hex: HexId): Pt;
  hexPolygon(hex: HexId): Pt[];
}

export function makeGeometry(board: Board): BoardGeometry {
  const hexCenters = new Map<HexId, Pt>();
  for (const hex of board.topology.hexes) {
    const [q, r] = hex.split(',').map(Number) as [number, number];
    hexCenters.set(hex, hexToPixel(q, r));
  }
  const polygons = new Map<HexId, Pt[]>();
  for (const [hex, center] of hexCenters) {
    const verts = board.topology.hexVertices[hex]!;
    polygons.set(
      hex,
      verts.map((v) => board.topology.vertexPos[v]!),
    );
    void center;
  }
  return {
    vertexPos: (v) => board.topology.vertexPos[v]!,
    edgeEnds: (e) => {
      const [a, b] = board.topology.edgeEndpoints[e]!;
      return [board.topology.vertexPos[a]!, board.topology.vertexPos[b]!];
    },
    hexCenter: (hex) => hexCenters.get(hex)!,
    hexPolygon: (hex) => polygons.get(hex)!,
  };
}
