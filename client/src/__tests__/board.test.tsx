// BoardSvg render tests: hex/vertex/edge counts for all three board sizes,
// legal-only interactivity (data-legal + pointer-events), click emit paths,
// pieces and the placement preview.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { boardConfigForPlayers, DEFAULT_RULES, generateBoard, type PlayerCount } from '@catan/shared';
import { BoardSvg } from '../board/BoardSvg';
import type { PersonalSnapshot, PublicPlayer } from '../types';

function snapshotFor(playerCount: PlayerCount, seed = 'render-seed'): PersonalSnapshot {
  const board = generateBoard(playerCount, seed);
  return {
    version: 1,
    config: boardConfigForPlayers(playerCount).key,
    playerCount,
    rules: { ...DEFAULT_RULES },
    phase: 'setupForward',
    activeSeat: 0,
    specialBuildSeat: null,
    turn: 0,
    dice: null,
    board,
    buildings: {},
    roads: {},
    robber: board.robberHex,
    bank: { wood: 19, brick: 19, sheep: 19, wheat: 19, ore: 19 },
    devDeckCount: 25,
    trades: [],
    pendingDiscards: [],
    longestRoad: { holder: null, length: 0 },
    largestArmy: { holder: null, knights: 0 },
    devCardPlayedThisTurn: false,
    winner: null,
    players: [],
    you: { seat: 0, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }, devHand: [], totalVp: 0 },
  };
}

function player(seat: number, color: PublicPlayer['color']): PublicPlayer {
  return {
    seat,
    name: `P${seat}`,
    color,
    resourceCount: 0,
    devCardCount: 0,
    playedKnights: 0,
    connected: true,
    publicVp: 0,
    roadsLeft: 15,
    settlementsLeft: 5,
    citiesLeft: 4,
  };
}

function firstEdgeId(snap: PersonalSnapshot): string {
  const [a, b] = snap.board.topology.edges[0]!;
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

describe.each([
  [4, 19, 54, 72],
  [6, 30, 80, 109],
  [8, 37, 96, 132],
] as const)('BoardSvg renders the %i-player board', (players, hexCount, vertexCount, edgeCount) => {
  it(`renders ${hexCount} hexes, ${vertexCount} vertex hits, ${edgeCount} edge hits — none interactive`, () => {
    const snap = snapshotFor(players);
    const { container } = render(<BoardSvg snap={snap} />);
    expect(container.querySelectorAll('[data-hex-id]').length).toBe(hexCount);
    expect(container.querySelectorAll('[data-testid^="hex-"]').length).toBe(hexCount);
    const vertices = container.querySelectorAll('[data-vertex]');
    const edges = container.querySelectorAll('[data-edge]');
    expect(vertices.length).toBe(vertexCount);
    expect(edges.length).toBe(edgeCount);
    // No legal sets passed: nothing is tappable.
    expect(container.querySelectorAll('[data-legal="true"]').length).toBe(0);
    for (const hit of [...vertices, ...edges]) expect(hit.getAttribute('pointer-events')).toBe('none');
    expect(container.querySelectorAll('[data-testid="robber"]').length).toBe(1);
    expect(container.querySelectorAll('[data-harbor]').length).toBe(Object.keys(snap.board.harbors).length);
  });
});

describe('BoardSvg terrain and tokens', () => {
  it('renders terrain groups and one token per non-desert hex', () => {
    const snap = snapshotFor(4);
    const { container } = render(<BoardSvg snap={snap} />);
    expect(container.querySelectorAll('[data-terrain="forest"]').length).toBe(4);
    expect(container.querySelectorAll('[data-terrain="desert"]').length).toBe(1);
    expect(container.querySelectorAll('[data-token]').length).toBe(18);
  });

  it('compact preview renders the board without hit targets', () => {
    const snap = snapshotFor(4);
    const { container } = render(<BoardSvg snap={snap} compact />);
    expect(container.querySelectorAll('[data-hex-id]').length).toBe(19);
    expect(container.querySelectorAll('[data-vertex], [data-edge]').length).toBe(0);
  });
});

describe('legal placement highlighting & clicks', () => {
  it('marks exactly the legal vertices and emits on click', async () => {
    const snap = snapshotFor(3);
    const user = userEvent.setup();
    const onVertexClick = vi.fn();
    const { container } = render(
      <BoardSvg snap={snap} legalVertices={new Set([0, 7])} onVertexClick={onVertexClick} />,
    );
    const legal = [...container.querySelectorAll('[data-vertex][data-legal="true"]')].map((el) =>
      el.getAttribute('data-vertex'),
    );
    expect(legal.sort()).toEqual(['0', '7']);
    const hit = container.querySelector('[data-testid="vertex-hit-0"]')!;
    expect(hit.getAttribute('pointer-events')).toBe('all');
    await user.click(hit);
    expect(onVertexClick).toHaveBeenCalledWith(0);
  });

  it('illegal vertices are inert: no pointer events and clicks are ignored', () => {
    const snap = snapshotFor(3);
    const onVertexClick = vi.fn();
    const { container } = render(
      <BoardSvg snap={snap} legalVertices={new Set([5])} onVertexClick={onVertexClick} />,
    );
    const illegal = container.querySelector('[data-testid="vertex-hit-0"]')!;
    expect(illegal.getAttribute('pointer-events')).toBe('none');
    expect(illegal.hasAttribute('data-legal')).toBe(false);
    // happy-dom ignores SVG pointer-events: dispatch directly; the delegated handler must still refuse.
    fireEvent.click(illegal);
    expect(onVertexClick).not.toHaveBeenCalled();
  });

  it('legal sets without a click handler are not interactive', () => {
    const snap = snapshotFor(3);
    const { container } = render(<BoardSvg snap={snap} legalVertices={new Set([0])} legalEdges={new Set([firstEdgeId(snap)])} />);
    expect(container.querySelectorAll('[data-legal="true"]').length).toBe(0);
  });

  it('marks legal edges and emits on click', async () => {
    const snap = snapshotFor(3);
    const user = userEvent.setup();
    const onEdgeClick = vi.fn();
    const eid = firstEdgeId(snap);
    const { container } = render(<BoardSvg snap={snap} legalEdges={new Set([eid])} onEdgeClick={onEdgeClick} />);
    const legal = container.querySelectorAll('[data-edge][data-legal="true"]');
    expect(legal.length).toBe(1);
    const hit = container.querySelector(`[data-testid="edge-hit-${eid}"]`)!;
    expect(hit.getAttribute('data-legal')).toBe('true');
    expect(hit.getAttribute('pointer-events')).toBe('stroke');
    await user.click(hit);
    expect(onEdgeClick).toHaveBeenCalledWith(eid);
  });

  it('makes only legal robber hexes tappable and emits on click', async () => {
    const snap = snapshotFor(3);
    const user = userEvent.setup();
    const onHexClick = vi.fn();
    const target = snap.board.topology.hexes.find((h) => h !== snap.robber)!;
    const { container } = render(
      <BoardSvg snap={snap} legalHexes={new Set([target])} onHexClick={onHexClick} />,
    );
    const hits = container.querySelectorAll('[data-hex-hit]');
    expect(hits.length).toBe(1);
    const hit = container.querySelector(`[data-testid="robber-hit-${target}"]`)!;
    expect(hit.getAttribute('data-legal')).toBe('true');
    await user.click(hit);
    expect(onHexClick).toHaveBeenCalledWith(target);
  });
});

describe('pieces and preview', () => {
  it('renders roads, settlements, cities and the placement preview', () => {
    const base = snapshotFor(3);
    const eid = firstEdgeId(base);
    const snap: PersonalSnapshot = {
      ...base,
      players: [player(0, 'red'), player(1, 'purple')],
      roads: { [eid]: 0 },
      buildings: { 3: { seat: 0, type: 'settlement' }, 20: { seat: 1, type: 'city' } },
    };
    const { container } = render(<BoardSvg snap={snap} previewBuilding={{ vertex: 40, color: 'pink' }} />);
    expect(container.querySelector(`[data-testid="road-${eid}"]`)).not.toBeNull();
    expect(container.querySelector('[data-testid="building-3"]')?.getAttribute('data-building')).toBe('settlement');
    expect(container.querySelector('[data-testid="building-20"]')?.getAttribute('data-building')).toBe('city');
    expect(container.querySelector('[data-testid="preview-building"]')).not.toBeNull();
  });
});
