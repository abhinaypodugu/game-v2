// The SVG board: layered rendering with fat transparent hit targets for
// crisp pointer interaction (per MDN pointer-events semantics).

import { memo, useMemo } from 'react';
import type { Board } from '@catan/shared';
import { PIPS } from '@catan/shared';
import type { PersonalSnapshot } from '../types';
import { PIECE_COLORS, TERRAIN_BORDER, TERRAIN_FILL } from '../theme';
import { makeGeometry, type BoardGeometry } from './geometry';

export interface BoardSvgProps {
  snap: PersonalSnapshot;
  /** Legal vertices (highlight + clickable) — settlement/city placement. */
  legalVertices?: Set<number>;
  /** Legal edges (highlight + clickable) — road placement. */
  legalEdges?: Set<string>;
  /** Legal robber destination hexes. */
  legalHexes?: Set<string>;
  onVertexClick?: (vertex: number) => void;
  onEdgeClick?: (edge: string) => void;
  onHexClick?: (hex: string) => void;
  compact?: boolean;
}

interface LayerData {
  geometry: BoardGeometry;
  viewBox: { x: number; y: number; w: number; h: number };
}

function computeLayers(board: Board): LayerData {
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
  const pad = 80;
  return {
    geometry,
    viewBox: {
      x: minX - pad,
      y: minY - pad,
      w: maxX - minX + pad * 2,
      h: maxY - minY + pad * 2,
    },
  };
}


export const BoardSvg = memo(function BoardSvg({
  snap,
  legalVertices,
  legalEdges,
  legalHexes,
  onVertexClick,
  onEdgeClick,
  onHexClick,
  compact = false,
}: BoardSvgProps): React.JSX.Element {
  const board = snap.board;
  const { geometry, viewBox } = useMemo(() => computeLayers(board), [board]);
  const hexagons = useMemo(
    () =>
      board.topology.hexes.map((hex) => ({
        hex,
        points: geometry.hexPolygon(hex)
          .map((p) => `${p.x},${p.y}`)
          .join(' '),
      })),
    [board, geometry],
  );

  const edgeStroke = compact ? 10 : 14;
  const vertexRadius = compact ? 12 : 16;

  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      className="block h-full w-full select-none"
      data-testid="board-svg"
    >
      {/* Sea backdrop */}
      <rect
        x={viewBox.x}
        y={viewBox.y}
        width={viewBox.w}
        height={viewBox.h}
        fill="#0a2e52"
        rx={24}
      />

      {/* Terrain hexes */}
      <g>
        {hexagons.map(({ hex, points }) => {
          const hexData = board.hexes[hex]!;
          const isRobber = snap.robber === hex;
          const robberTargetable = legalHexes?.has(hex) ?? false;
          return (
            <g key={hex} data-testid={`hex-${hex}`} data-terrain={hexData.terrain}>
              <polygon
                points={points}
                fill={TERRAIN_FILL[hexData.terrain] ?? '#555'}
                stroke={TERRAIN_BORDER[hexData.terrain] ?? '#333'}
                strokeWidth={2}
              />
              {robberTargetable && onHexClick !== undefined ? (
                <polygon
                  points={points}
                  fill="rgba(240,104,0,0.28)"
                  stroke="#f06800"
                  strokeWidth={4}
                  className="cursor-pointer"
                  onClick={() => onHexClick(hex)}
                />
              ) : null}
              {isRobber ? (
                <circle
                  cx={geometry.hexCenter(hex).x}
                  cy={geometry.hexCenter(hex).y}
                  r={22}
                  fill="#111"
                  stroke="#000"
                  strokeWidth={3}
                  pointerEvents="none"
                  data-testid="robber"
                />
              ) : null}
            </g>
          );
        })}
      </g>

      {/* Number tokens */}
      <g pointerEvents="none">
        {hexagons.map(({ hex }) => {
          const hexData = board.hexes[hex]!;
          if (hexData.token === null) return null;
          const c = geometry.hexCenter(hex);
          const hot = hexData.token === 6 || hexData.token === 8;
          const pips = PIPS[hexData.token] ?? 0;
          return (
            <g key={`token-${hex}`} transform={`translate(${c.x} ${c.y})`}>
              <circle r={26} fill="#fdfaf2" stroke="#c9bfa5" strokeWidth={1.5} />
              <text
                textAnchor="middle"
                y={6}
                fontSize={22}
                fontWeight={700}
                fill={hot ? '#cc2222' : '#222'}
                fontFamily="Rubik, sans-serif"
              >
                {hexData.token}
              </text>
              <g>
                {Array.from({ length: pips }, (_, i) => (
                  <circle key={i} cx={-((pips - 1) * 6) / 2 + i * 6} cy={18} r={1.8} fill={hot ? '#cc2222' : '#444'} />
                ))}
              </g>
            </g>
          );
        })}
      </g>

      {/* Edge hit layer (fat transparent strokes UNDER visible roads) */}
      <g>
        {board.topology.edges.map((e) => {
          const eid = e[0] < e[1] ? `${e[0]}-${e[1]}` : `${e[1]}-${e[0]}`;
          const [p1, p2] = geometry.edgeEnds(eid);
          const legal = legalEdges?.has(eid) ?? false;
          const roadOwner = snap.roads[eid];
          return (
            <g key={`edge-${eid}`}>
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={legal && onEdgeClick !== undefined ? 'rgba(240,104,0,0.45)' : 'transparent'}
                strokeWidth={edgeStroke}
                strokeLinecap="round"
                pointerEvents={legal && onEdgeClick !== undefined ? 'stroke' : 'none'}
                className={legal && onEdgeClick !== undefined ? 'cursor-pointer' : undefined}
                data-testid={`edge-hit-${eid}`}
                onClick={() => onEdgeClick?.(eid)}
              />
              {roadOwner !== undefined ? (
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={PIECE_COLORS[snap.players[roadOwner]!.color]?.main ?? '#888'}
                  strokeWidth={9}
                  strokeLinecap="round"
                  pointerEvents="none"
                  data-testid={`road-${eid}`}
                />
              ) : null}
            </g>
          );
        })}
      </g>

      {/* Vertex hit layer */}
      <g>
        {board.topology.vertices.map((v) => {
          const p = geometry.vertexPos(v);
          const building = snap.buildings[v];
          const legal = legalVertices?.has(v) ?? false;
          const clickable = legal && onVertexClick !== undefined;
          if (building !== undefined) {
            const color = PIECE_COLORS[snap.players[building.seat]!.color]?.main ?? '#888';
            const isCity = building.type === 'city';
            return (
              <g key={`vertex-${v}`} pointerEvents="none" data-testid={`building-${v}`}>
                {isCity ? (
                  <rect
                    x={p.x - 13}
                    y={p.y - 13}
                    width={26}
                    height={26}
                    rx={3}
                    fill={color}
                    stroke="#000"
                    strokeWidth={2}
                  />
                ) : (
                  <polygon
                    points={`${p.x},${p.y - 12} ${p.x + 11},${p.y - 2} ${p.x + 11},${p.y + 11} ${p.x - 11},${p.y + 11} ${p.x - 11},${p.y - 2}`}
                    fill={color}
                    stroke="#000"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          }
          return (
            <circle
              key={`vertex-${v}`}
              cx={p.x}
              cy={p.y}
              r={clickable ? vertexRadius : 10}
              fill={clickable ? 'rgba(240,104,0,0.45)' : 'transparent'}
              stroke={clickable ? '#f06800' : 'transparent'}
              strokeWidth={clickable ? 3 : 0}
              pointerEvents={clickable ? 'all' : 'none'}
              className={clickable ? 'cursor-pointer' : undefined}
              data-testid={`vertex-hit-${v}`}
              onClick={() => onVertexClick?.(v)}
            />
          );
        })}
      </g>
    </svg>
  );
});
