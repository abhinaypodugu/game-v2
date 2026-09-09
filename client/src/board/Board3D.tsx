// 3D isometric board: extruded hex slabs, biome props, carved tokens, 3D pieces.
// All layers render via the geometry interface (3D-swap point) — the board is
// embedded in a pan/zoom TransformComponent by the GamePage.

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Board } from '@catan/shared';
import { PIPS as PIP_COUNTS } from '@catan/shared';
import type { PersonalSnapshot } from '../types';
import { makeGeometry, type BoardGeometry } from './geometry';
import {
  biomePropsSvg,
  citySvg,
  hexPoints,
  harborSvg,
  robberSvg,
  roadSvg,
  settlementSvg,
  slabSvg,
  tokenSvg,
} from './terrain3d';
import { PIECE_COLORS } from '../theme';

export interface Board3DProps {
  snap: PersonalSnapshot;
  legalVertices?: Set<number>;
  legalEdges?: Set<string>;
  legalHexes?: Set<string>;
  pulseHexes?: Set<string>;
  onVertexClick?: (vertex: number) => void;
  onEdgeClick?: (edge: string) => void;
  onHexClick?: (hex: string) => void;
}

interface Layers {
  geometry: BoardGeometry;
  viewBox: string;
  seaX: number;
  seaY: number;
  seaW: number;
  seaH: number;
  hexes: Array<{ hex: string; cx: number; cy: number; terrain: string; token: number | null }>;
}

const R = 82; // hex radius in px
const DEPTH = 26;

function computeLayers(board: Board): Layers {
  const geometry = makeGeometry(board);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const v of board.topology.vertices) {
    const p = board.topology.vertexPos[v]!;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 170;
  const hexes = board.topology.hexes.map((hex) => {
    const c = geometry.hexCenter(hex);
    const data = board.hexes[hex]!;
    return { hex, cx: c.x, cy: c.y, terrain: data.terrain, token: data.token };
  });
  return {
    geometry,
    viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
    seaX: minX - pad,
    seaY: minY - pad,
    seaW: maxX - minX + pad * 2,
    seaH: maxY - minY + pad * 2,
    hexes,
  };
}

export const Board3D = memo(function Board3D({
  snap,
  legalVertices,
  legalEdges,
  legalHexes,
  pulseHexes,
  onVertexClick,
  onEdgeClick,
  onHexClick,
}: Board3DProps): React.JSX.Element {
  const board = snap.board;
  const { geometry, viewBox, seaX, seaY, seaW, seaH, hexes } = useMemo(() => computeLayers(board), [board]);
  const pulsing = pulseHexes ?? new Set<string>();

  // Static sea + terrain layer (dangerouslySetInnerHTML keeps the SVG light).
  const seaAndTerrain = useMemo(() => {
    let svg = `<g>
      <defs>
        <radialGradient id="seaGrad" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stop-color="#0d4d7d"/>
          <stop offset="55%" stop-color="#072b4a"/>
          <stop offset="100%" stop-color="#031b30"/>
        </radialGradient>
        <pattern id="waves" width="46" height="24" patternUnits="userSpaceOnUse">
          <path d="M0,12 Q11,6 23,12 T46,12" fill="none" stroke="rgba(120,180,230,0.10)" stroke-width="1.5"/>
        </pattern>
      </defs>
      <rect x="${seaX}" y="${seaY}" width="${seaW}" height="${seaH}" rx="30" fill="url(#seaGrad)"/>
      <rect x="${seaX}" y="${seaY}" width="${seaW}" height="${seaH}" rx="30" fill="url(#waves)"/>`;

    for (const { hex, cx, cy, terrain } of hexes) {
      svg += slabSvg(cx, cy, R, terrain, `slab-${hex}`);
      svg += biomePropsSvg(terrain, cx, cy);
    }
    for (const { cx, cy, token } of hexes) {
      if (token === null) continue;
      svg += tokenSvg(cx, cy + DEPTH / 2 - 14, token, PIP_COUNTS[token] ?? 0);
    }
    for (const [eid, harbor] of Object.entries(board.harbors)) {
      const [a, b] = board.topology.edgeEndpoints[eid] as [number, number];
      const pa = board.topology.vertexPos[a]!;
      const pb = board.topology.vertexPos[b]!;
      const label = harbor.type === 'generic' ? '3:1' : '2:1';
      svg += harborSvg(pa.x, pa.y, pb.x, pb.y, label, harbor.type === 'specialty');
    }
    svg += '</g>';
    return svg;
  }, [hexes, board, seaX, seaY, seaW, seaH]);

  // Robber position.
  const robberHex = useMemo(() => hexes.find((h) => h.hex === snap.robber) ?? null, [hexes, snap.robber]);

  return (
    <svg
      viewBox={viewBox}
      className="block h-full w-full select-none"
      data-testid="board-svg"
      style={{ touchAction: 'none' }}
    >
      {/* Layer 0: sea + extruded terrain slabs + tokens + harbors */}
      <g dangerouslySetInnerHTML={{ __html: seaAndTerrain }} />

      {/* Production pulse rings on hot hexes */}
      {hexes
        .filter((h) => pulsing.has(h.hex))
        .map((h) => (
          <motion.polygon
            key={`pulse-${h.hex}`}
            points={hexPoints(h.cx, h.cy, R - 4)}
            fill="none"
            stroke="#ffd54f"
            strokeWidth={5}
            initial={{ opacity: 0.9, scale: 1 }}
            animate={{ opacity: [0.9, 0.2, 0.9], scale: [1, 1.07, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: `${h.cx}px ${h.cy}px` }}
            pointerEvents="none"
          />
        ))}

      {/* Robber hex target overlays */}
      {legalHexes !== undefined && onHexClick !== undefined
        ? hexes
            .filter((h) => legalHexes.has(h.hex))
            .map((h) => (
              <polygon
                key={`hexhit-${h.hex}`}
                points={hexPoints(h.cx, h.cy, R - 6)}
                fill="rgba(239,63,42,0.30)"
                stroke="#ef3f2a"
                strokeWidth={4}
                className="cursor-pointer"
                data-testid={`hex-hit-${h.hex}`}
                onClick={() => onHexClick(h.hex)}
              />
            ))
        : null}

      {/* Edge hit + road layer */}
      {board.topology.edges.map((e) => {
        const eid = e[0] < e[1] ? `${e[0]}-${e[1]}` : `${e[1]}-${e[0]}`;
        const [pa, pb] = geometry.edgeEnds(eid);
        const owner = snap.roads[eid];
        const legal = legalEdges?.has(eid) ?? false;
        return (
          <g key={`edge-${eid}`}>
            {owner !== undefined ? (
              <g
                dangerouslySetInnerHTML={{
                  __html: roadSvg(pa.x, pa.y, pb.x, pb.y, PIECE_COLORS[snap.players[owner]!.color]?.main ? snap.players[owner]!.color : 'white', eid),
                }}
              />
            ) : null}
            {legal && onEdgeClick !== undefined ? (
              <line
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="rgba(255,213,79,0.75)"
                strokeWidth={16}
                strokeLinecap="round"
                strokeDasharray="10,8"
                className="cursor-pointer"
                pointerEvents="stroke"
                data-testid={`edge-hit-${eid}`}
                onClick={() => onEdgeClick(eid)}
              />
            ) : null}
          </g>
        );
      })}

      {/* Vertex hit + buildings layer */}
      {board.topology.vertices.map((v) => {
        const p = geometry.vertexPos(v);
        const building = snap.buildings[v];
        const legal = legalVertices?.has(v) ?? false;
        if (building !== undefined) {
          const color = snap.players[building.seat]!.color;
          return (
            <g
              key={`v-${v}`}
              dangerouslySetInnerHTML={{
                __html:
                  building.type === 'city'
                    ? citySvg(p.x, p.y, color, String(v))
                    : settlementSvg(p.x, p.y, color, String(v)),
              }}
            />
          );
        }
        if (!legal || onVertexClick === undefined) return null;
        return (
          <circle
            key={`v-${v}`}
            cx={p.x}
            cy={p.y}
            r={18}
            fill="rgba(255,213,79,0.5)"
            stroke="#ffd54f"
            strokeWidth={3}
            className="cursor-pointer"
            data-testid={`vertex-hit-${v}`}
            onClick={() => onVertexClick(v)}
          >
            <animate attributeName="opacity" values="1;0.55;1" dur="1.2s" repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Robber pawn (slides between hexes) */}
      {robberHex !== null ? (
        <motion.g
          key={robberHex.hex}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          dangerouslySetInnerHTML={{ __html: robberSvg(robberHex.cx, robberHex.cy) }}
          style={{ transformOrigin: `${robberHex.cx}px ${robberHex.cy}px` }}
        />
      ) : null}
    </svg>
  );
});
