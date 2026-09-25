// The 2D board: colonist-style flat SVG with original vector art.
// Layers, bottom -> top: sea + beach, harbours, tiles, number tokens,
// robber-target rings, roads, legal-road marks, buildings, preview,
// legal-vertex marks, robber, hit targets. Static layers are memoised on the
// cached board layout; only legal targets receive pointer events.

import { memo } from 'react';
import { PIPS, type BoardHex, type Harbor } from '@catan/shared';
import type { PersonalSnapshot } from '../types';
import { BOARD_COLORS as C, PIECE_COLORS, PIECE_OUTLINE, RESOURCE_TERRAIN, TERRAIN_FILL } from '../theme';
import { BoardDefs, hexPoints } from './art';
import { getBoardLayout, HARBOR_SCALE, type BoardLayout, type EdgeLayout } from './geometry';

export interface BoardSvgProps {
  snap: PersonalSnapshot;
  /** Legal vertices (highlight + tappable) — settlement/city placement. */
  legalVertices?: Set<number>;
  /** Legal edges (highlight + tappable) — road placement. */
  legalEdges?: Set<string>;
  /** Legal robber destination hexes. */
  legalHexes?: Set<string>;
  onVertexClick?: (vertex: number) => void;
  onEdgeClick?: (edge: string) => void;
  onHexClick?: (hex: string) => void;
  /** Hexes that just produced (token pop + tile glow). */
  pulseHexes?: Set<string>;
  /** Hexes that were swapped (Surveyor swap animation & highlight). */
  swappedHexes?: Set<string>;
  /** Coastal harbor edges that were swapped (Port Renovation swap animation & highlight). */
  swappedHarbors?: Set<string>;
  /** Ghost piece at a vertex; `color` is a PlayerColor name (or any CSS colour). */
  previewBuilding?: { vertex: number; color: string };
  /** Static preview (lobby): no hit targets, no wave marks. */
  compact?: boolean;
}

const FONT = 'Rubik, system-ui, sans-serif';
const NO_PIECE = { main: '#9aa0a6', dark: '#5f6368', light: '#c4c7ca' };
/** Vertex hit radius / edge hit stroke (board units, HEX_SIZE 100). */
const VERTEX_HIT_R = 28;
const EDGE_HIT_W = 34;
/** Settlements/cities read small at phone scale; enlarge the shared piece art. */
const PIECE_SCALE = 1.3;

function pieceColor(color: string | undefined): { main: string; dark: string; light: string } {
  if (color === undefined) return NO_PIECE;
  return PIECE_COLORS[color] ?? { main: color, dark: color, light: color };
}

/** Sub-segment of an edge between fractions t0..t1 (keeps pieces off the corners). */
function trim(e: EdgeLayout, t0: number, t1: number): { x1: number; y1: number; x2: number; y2: number } {
  const dx = e.b.x - e.a.x;
  const dy = e.b.y - e.a.y;
  return { x1: e.a.x + dx * t0, y1: e.a.y + dy * t0, x2: e.a.x + dx * t1, y2: e.a.y + dy * t1 };
}

// ---------------------------------------------------------------------------
// Static layers (memoised on the cached layout)
// ---------------------------------------------------------------------------

const SeaLayer = memo(function SeaLayer({ layout, compact }: { layout: BoardLayout; compact: boolean }): React.JSX.Element {
  const { viewBox: vb, coastPath } = layout;
  return (
    <g pointerEvents="none">
      <rect x={vb.x - 2000} y={vb.y - 2000} width={vb.w + 4000} height={vb.h + 4000} fill={C.ocean} />
      {compact ? null : layout.waves.map((p, i) => <use key={i} href="#bs-wave" x={p.x} y={p.y} />)}
      <g strokeLinejoin="round">
        <path d={coastPath} fill={C.oceanShallow} stroke={C.oceanShallow} strokeWidth={100} strokeOpacity={0.5} />
        <path d={coastPath} fill={C.oceanShallow} stroke={C.oceanShallow} strokeWidth={66} />
        <path d={coastPath} fill={C.oceanFoam} stroke={C.oceanFoam} strokeWidth={46} />
        <path d={coastPath} fill={C.sandShade} stroke={C.sandShade} strokeWidth={40} />
        <path d={coastPath} fill={C.sand} stroke={C.sand} strokeWidth={33} />
      </g>
    </g>
  );
});

interface HarborLayerProps {
  layout: BoardLayout;
  harbors: Record<string, Harbor>;
  swappedHarbors?: Set<string>;
  swapKey?: string;
}

const HarborLayer = memo(function HarborLayer({
  layout,
  harbors,
  swappedHarbors,
  swapKey,
}: HarborLayerProps): React.JSX.Element {
  return (
    <g pointerEvents="none">
      {layout.harbors.map((h) => {
        const harbor = harbors[h.edge] ?? h;
        const resource = harbor.type === 'specialty' ? (harbor.resource ?? null) : null;
        const ratio = harbor.type === 'specialty' ? 2 : 3;
        const { ship } = h;
        const piers = [h.a, h.b].map((p) => `M${p.x},${p.y}L${ship.x},${ship.y}`).join('');
        const badgeFill = resource === null ? C.tokenCream : TERRAIN_FILL[RESOURCE_TERRAIN[resource] ?? ''];
        const isSwapped = swappedHarbors?.has(h.edge) ?? false;

        return (
          <g key={h.edge} data-harbor={h.edge} data-harbor-type={resource ?? 'generic'}>
            <path d={piers} stroke={C.woodDark} strokeWidth={10} fill="none" />
            <path d={piers} stroke={C.woodLight} strokeWidth={7} strokeDasharray="5 2.4" fill="none" />
            {isSwapped ? (
              <circle
                cx={ship.x}
                cy={ship.y}
                r={28 * HARBOR_SCALE}
                fill="rgba(245,158,11,0.25)"
                stroke="#f59e0b"
                strokeWidth={3}
                className="bs-swap-glow"
              />
            ) : null}
            <g
              key={isSwapped ? `harbor-swap-${swapKey}-${resource ?? 'generic'}` : 'still'}
              transform={`translate(${ship.x} ${ship.y}) scale(${HARBOR_SCALE})`}
              className={isSwapped ? 'bs-swap' : undefined}
            >
              <use href="#bs-ship-back" />
              <circle r={18} fill={C.tokenCream} stroke={isSwapped ? '#d97706' : C.woodDark} strokeWidth={2.5} />
              {resource === null ? (
                <text y={6} textAnchor="middle" fontSize={21} fontWeight={700} fontFamily={FONT} fill={C.tokenText}>
                  ?
                </text>
              ) : (
                <>
                  <circle cy={-1} r={13.5} fill={badgeFill} />
                  <use href={`#bs-icon-${resource}`} y={-1.5} />
                </>
              )}
              <use href="#bs-ship-hull" />
              <text y={21.5} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily={FONT} fill="#fff">
                {ratio}:1
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
});

interface TileLayerProps {
  layout: BoardLayout;
  hexes: Record<string, BoardHex>;
}

const TileLayer = memo(function TileLayer({ layout, hexes }: TileLayerProps): React.JSX.Element {
  return (
    <g pointerEvents="none">
      {layout.hexes.map((h) => {
        const token = hexes[h.id]?.token ?? h.token;
        return (
          <g
            key={h.id}
            data-hex-id={h.id}
            data-testid={`hex-${h.id}`}
            data-terrain={h.terrain}
            data-token={token ?? undefined}
            transform={`translate(${h.center.x} ${h.center.y})${h.mirror ? ' scale(-1 1)' : ''}`}
          >
            <use href={`#bs-tile-${h.terrain}`} />
          </g>
        );
      })}
    </g>
  );
});

interface TokenLayerProps {
  layout: BoardLayout;
  hexes: Record<string, BoardHex>;
  robber: string;
  /** Pulsing hex ids joined by '|' (string for cheap memo equality). */
  pulse: string;
  /** Changes per roll so the pop animation restarts. */
  pulseKey: string;
  /** Hexes that were swapped (Surveyor swap animation & highlight). */
  swappedHexes?: Set<string>;
  swapKey?: string;
}

const TokenLayer = memo(function TokenLayer({
  layout,
  hexes,
  robber,
  pulse,
  pulseKey,
  swappedHexes,
  swapKey,
}: TokenLayerProps): React.JSX.Element {
  const pulsing = new Set(pulse === '' ? [] : pulse.split('|'));
  return (
    <g pointerEvents="none">
      {layout.hexes.map((h) =>
        pulsing.has(h.id) ? (
          <polygon
            key={`glow-${h.id}-${pulseKey}`}
            className="bs-glow"
            points={hexPoints(88)}
            transform={`translate(${h.center.x} ${h.center.y})`}
            fill="rgba(255,243,168,0.25)"
            stroke={C.pulse}
            strokeWidth={8}
            strokeLinejoin="round"
          />
        ) : null,
      )}
      {layout.hexes.map((h) => {
        const token = hexes[h.id]?.token ?? h.token;
        if (token === null) return null;
        const hot = token === 6 || token === 8;
        const ink = hot ? C.tokenRed : C.tokenText;
        const pips = PIPS[token] ?? 0;
        const isPulsing = pulsing.has(h.id);
        const isSwapped = swappedHexes?.has(h.id) ?? false;
        return (
          <g
            key={h.id}
            transform={`translate(${h.center.x} ${h.center.y})`}
            opacity={robber === h.id ? 0.55 : undefined}
          >
            {isSwapped ? (
              <circle
                r={36}
                fill="rgba(245,158,11,0.25)"
                stroke="#f59e0b"
                strokeWidth={3}
                className="bs-swap-glow"
              />
            ) : null}
            <g
              key={isPulsing ? pulseKey : isSwapped ? `token-swap-${swapKey}-${token}` : 'still'}
              className={isPulsing ? 'bs-pop' : isSwapped ? 'bs-swap' : undefined}
            >
              <circle cy={2.5} r={30} fill="rgba(0,0,0,0.25)" />
              <circle r={30} fill={C.tokenCream} stroke={isSwapped ? '#d97706' : C.tokenEdge} strokeWidth={isSwapped ? 3 : 2} />
              <text y={hot ? 7.5 : 7} textAnchor="middle" fontSize={hot ? 29 : 27} fontWeight={700} fontFamily={FONT} fill={ink}>
                {token}
              </text>
              {Array.from({ length: pips }, (_, i) => (
                <circle key={i} cx={(i - (pips - 1) / 2) * 6.6} cy={17} r={2.7} fill={ink} />
              ))}
            </g>
          </g>
        );
      })}
    </g>
  );
});

// ---------------------------------------------------------------------------
// Dynamic layers
// ---------------------------------------------------------------------------

interface PiecesProps {
  layout: BoardLayout;
  snap: PersonalSnapshot;
}

function Roads({ layout, snap }: PiecesProps): React.JSX.Element {
  return (
    <g pointerEvents="none">
      {layout.edges.map((e) => {
        const seat = snap.roads[e.id];
        if (seat === undefined) return null;
        const color = pieceColor(snap.players[seat]?.color);
        const seg = trim(e, 0.17, 0.83);
        const shine = trim(e, 0.24, 0.76);
        return (
          <g key={e.id} data-testid={`road-${e.id}`} className="bs-place" strokeLinecap="round">
            <line {...seg} transform="translate(2 3)" stroke="rgba(0,0,0,0.3)" strokeWidth={16} />
            <line {...seg} stroke={PIECE_OUTLINE} strokeWidth={16} />
            <line {...seg} stroke={color.main} strokeWidth={11} />
            <line {...shine} stroke={color.light} strokeWidth={3} strokeOpacity={0.85} />
          </g>
        );
      })}
    </g>
  );
}

function Buildings({ snap }: { snap: PersonalSnapshot }): React.JSX.Element {
  const { vertexPos } = snap.board.topology;
  return (
    <g pointerEvents="none">
      {Object.entries(snap.buildings).map(([vertex, b]) => {
        const p = vertexPos[Number(vertex)];
        if (p === undefined) return null;
        const color = pieceColor(snap.players[b.seat]?.color);
        const dy = b.type === 'city' ? 2 : 0;
        return (
          <g key={vertex} data-testid={`building-${vertex}`} data-building={b.type} transform={`translate(${p.x} ${p.y}) scale(${PIECE_SCALE})`}>
            <g key={b.type} className="bs-place">
              <use href={`#bs-${b.type}-shadow`} x={2.5} y={3.5 + dy} />
              <use href={`#bs-${b.type}`} y={dy} color={color.main} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

function PreviewBuilding({ snap, preview }: { snap: PersonalSnapshot; preview: { vertex: number; color: string } }): React.JSX.Element | null {
  const p = snap.board.topology.vertexPos[preview.vertex];
  if (p === undefined) return null;
  const type = snap.buildings[preview.vertex]?.type === 'settlement' ? 'city' : 'settlement';
  return (
    <g data-testid="preview-building" transform={`translate(${p.x} ${p.y}) scale(${PIECE_SCALE})`} opacity={0.75} pointerEvents="none">
      <g className="bs-breathe">
        <use href="#bs-legal-ring" />
        <use href={`#bs-${type}`} y={type === 'city' ? 2 : 0} color={pieceColor(preview.color).main} />
      </g>
    </g>
  );
}

function Robber({ layout, hex }: { layout: BoardLayout; hex: string }): React.JSX.Element | null {
  const h = layout.hexById.get(hex);
  if (h === undefined) return null;
  // Stand beside the number token so it stays readable; centre on the desert.
  const x = h.token === null ? h.center.x : h.center.x - 50;
  const y = h.token === null ? h.center.y : h.center.y + 4;
  return (
    <g data-testid="robber" className="bs-robber" style={{ transform: `translate(${x}px, ${y}px)` }} pointerEvents="none">
      <use href="#bs-robber" />
    </g>
  );
}

/** Legal target sets, already gated on their click handler being present. */
interface LegalSets {
  vertices: Set<number> | undefined;
  edges: Set<string> | undefined;
  hexes: Set<string> | undefined;
}

function RobberTargets({ layout, hexes }: { layout: BoardLayout; hexes: LegalSets['hexes'] }): React.JSX.Element | null {
  if (hexes === undefined || hexes.size === 0) return null;
  return (
    <g className="bs-breathe" pointerEvents="none">
      {layout.hexes.map((h) =>
        hexes.has(h.id) ? (
          <polygon
            key={h.id}
            points={hexPoints(84)}
            transform={`translate(${h.center.x} ${h.center.y})`}
            fill="rgba(255,255,255,0.18)"
            stroke={C.legal}
            strokeWidth={6}
            strokeLinejoin="round"
          />
        ) : null,
      )}
    </g>
  );
}

function EdgeMarks({ layout, edges }: { layout: BoardLayout; edges: LegalSets['edges'] }): React.JSX.Element | null {
  if (edges === undefined || edges.size === 0) return null;
  const d = layout.edges
    .filter((e) => edges.has(e.id))
    .map((e) => {
      const s = trim(e, 0.2, 0.8);
      return `M${s.x1},${s.y1}L${s.x2},${s.y2}`;
    })
    .join('');
  return (
    <g className="bs-breathe" pointerEvents="none" strokeLinecap="round" fill="none">
      <path d={d} stroke={C.legalShade} strokeWidth={14} />
      <path d={d} stroke="rgba(255,255,255,0.6)" strokeWidth={10} />
      <path d={d} className="bs-dash" stroke={C.legal} strokeWidth={5} strokeDasharray="8 7" />
    </g>
  );
}

function VertexMarks({
  layout,
  snap,
  vertices,
}: {
  layout: BoardLayout;
  snap: PersonalSnapshot;
  vertices: LegalSets['vertices'];
}): React.JSX.Element | null {
  if (vertices === undefined || vertices.size === 0) return null;
  return (
    <g className="bs-breathe" pointerEvents="none">
      {layout.vertices.map((v) =>
        vertices.has(v.id) ? (
          <use
            key={v.id}
            href={snap.buildings[v.id] === undefined ? '#bs-legal-dot' : '#bs-legal-ring'}
            x={v.pos.x}
            y={v.pos.y}
          />
        ) : null,
      )}
    </g>
  );
}

interface HitLayerProps extends LegalSets {
  layout: BoardLayout;
  onVertexClick: ((vertex: number) => void) | undefined;
  onEdgeClick: ((edge: string) => void) | undefined;
  onHexClick: ((hex: string) => void) | undefined;
}

/**
 * Every vertex and edge has a hit shape, but only legal ones take pointer
 * events (and a pointer cursor). One delegated click handler reads the
 * data attributes and ignores anything not marked data-legal.
 */
function HitLayer({ layout, vertices, edges, hexes, onVertexClick, onEdgeClick, onHexClick }: HitLayerProps): React.JSX.Element {
  const onClick = (event: React.MouseEvent<SVGGElement>): void => {
    const origin = event.target;
    const target = origin instanceof Element ? origin.closest('[data-legal="true"]') : null;
    const vertex = target?.getAttribute('data-vertex') ?? null;
    const edge = target?.getAttribute('data-edge') ?? null;
    const hex = target?.getAttribute('data-hex-hit') ?? null;
    if (vertex !== null) onVertexClick?.(Number(vertex));
    else if (edge !== null) onEdgeClick?.(edge);
    else if (hex !== null) onHexClick?.(hex);
  };

  return (
    <g onClick={onClick}>
      {hexes === undefined
        ? null
        : layout.hexes.map((h) =>
            hexes.has(h.id) ? (
              <polygon
                key={h.id}
                points={hexPoints(96)}
                transform={`translate(${h.center.x} ${h.center.y})`}
                fill="transparent"
                pointerEvents="all"
                className="bs-hit"
                data-hex-hit={h.id}
                data-legal="true"
                data-testid={`robber-hit-${h.id}`}
              />
            ) : null,
          )}
      {layout.edges.map((e) => {
        const live = edges?.has(e.id) === true;
        return (
          <line
            key={e.id}
            {...trim(e, 0.14, 0.86)}
            stroke="transparent"
            strokeWidth={EDGE_HIT_W}
            pointerEvents={live ? 'stroke' : 'none'}
            className={live ? 'bs-hit' : undefined}
            data-edge={e.id}
            data-legal={live ? 'true' : undefined}
            data-testid={`edge-hit-${e.id}`}
          />
        );
      })}
      {layout.vertices.map((v) => {
        const live = vertices?.has(v.id) === true;
        return (
          <circle
            key={v.id}
            cx={v.pos.x}
            cy={v.pos.y}
            r={VERTEX_HIT_R}
            fill="transparent"
            pointerEvents={live ? 'all' : 'none'}
            className={live ? 'bs-hit' : undefined}
            data-vertex={v.id}
            data-legal={live ? 'true' : undefined}
            data-testid={`vertex-hit-${v.id}`}
          />
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------

export const BoardSvg = memo(function BoardSvg({
  snap,
  legalVertices,
  legalEdges,
  legalHexes,
  pulseHexes,
  swappedHexes,
  swappedHarbors,
  previewBuilding,
  onVertexClick,
  onEdgeClick,
  onHexClick,
  compact = false,
}: BoardSvgProps): React.JSX.Element {
  const layout = getBoardLayout(snap.board);
  const { viewBox: vb } = layout;
  const pulse = pulseHexes === undefined ? '' : [...pulseHexes].sort().join('|');
  const pulseKey = `${snap.turn}:${snap.dice?.die1 ?? 0}${snap.dice?.die2 ?? 0}`;
  const swapKey = `${snap.turn}:${snap.version}`;
  const legal: LegalSets = compact
    ? { vertices: undefined, edges: undefined, hexes: undefined }
    : {
        vertices: onVertexClick !== undefined ? legalVertices : undefined,
        edges: onEdgeClick !== undefined ? legalEdges : undefined,
        hexes: onHexClick !== undefined ? legalHexes : undefined,
      };

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full select-none"
      data-testid="board-svg"
      data-board={snap.board.config}
    >
      <BoardDefs />
      <SeaLayer layout={layout} compact={compact} />
      <HarborLayer
        layout={layout}
        harbors={snap.board.harbors}
        swappedHarbors={swappedHarbors}
        swapKey={swapKey}
      />
      <TileLayer layout={layout} hexes={snap.board.hexes} />
      <TokenLayer
        layout={layout}
        hexes={snap.board.hexes}
        robber={snap.robber}
        pulse={pulse}
        pulseKey={pulseKey}
        swappedHexes={swappedHexes}
        swapKey={swapKey}
      />
      <RobberTargets layout={layout} hexes={legal.hexes} />
      <Roads layout={layout} snap={snap} />
      <EdgeMarks layout={layout} edges={legal.edges} />
      <Buildings snap={snap} />
      {previewBuilding === undefined ? null : <PreviewBuilding snap={snap} preview={previewBuilding} />}
      <VertexMarks layout={layout} snap={snap} vertices={legal.vertices} />
      <Robber layout={layout} hex={snap.robber} />
      {compact ? null : (
        <HitLayer
          layout={layout}
          {...legal}
          onVertexClick={onVertexClick}
          onEdgeClick={onEdgeClick}
          onHexClick={onHexClick}
        />
      )}
    </svg>
  );
});
