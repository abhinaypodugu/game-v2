// BoardSvg render tests: counts for both configs + legal-placement
// highlighting + click emit path.

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generateBoard } from '@catan/shared';
import { BoardSvg } from '../board/BoardSvg';
import type { PersonalSnapshot } from '../types';

function snapshotFor(playerCount: 3 | 4 | 5 | 6, seed = 'render-seed'): PersonalSnapshot {
  const board = generateBoard(playerCount, seed);
  return {
    version: 1,
    config: playerCount >= 5 ? 'ext56' : 'base',
    playerCount,
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
    winner: null,
    players: [],
    you: { seat: 0, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }, devHand: [], totalVp: 0 },
  };
}

describe('BoardSvg renders the base board', () => {
  const snap = snapshotFor(4);

  it('renders 19 hexes, 54 vertex hits, 72 edge hits', () => {
    const { container } = render(<BoardSvg snap={snap} />);
    const hexes = container.querySelectorAll('[data-testid^="hex-"]');
    const vertices = container.querySelectorAll('[data-testid^="vertex-hit-"]');
    const edges = container.querySelectorAll('[data-testid^="edge-hit-"]');
    expect(hexes.length).toBe(19);
    expect(vertices.length).toBe(54);
    expect(edges.length).toBe(72);
    // One robber rendered on the desert.
    expect(container.querySelectorAll('[data-testid="robber"]').length).toBe(1);
  });

  it('renders terrain fills and number tokens', () => {
    const { container } = render(<BoardSvg snap={snap} />);
    const forests = container.querySelectorAll('[data-terrain="forest"]');
    const deserts = container.querySelectorAll('[data-terrain="desert"]');
    expect(forests.length).toBe(4);
    expect(deserts.length).toBe(1);
  });
});

describe('BoardSvg renders the ext56 board', () => {
  it('renders 30 hexes, 81 vertex hits, 110 edge hits', () => {
    const snap = snapshotFor(6);
    const { container } = render(<BoardSvg snap={snap} />);
    const hexes = container.querySelectorAll('[data-testid^="hex-"]');
    const vertices = container.querySelectorAll('[data-testid^="vertex-hit-"]');
    const edges = container.querySelectorAll('[data-testid^="edge-hit-"]');
    expect(hexes.length).toBe(30);
    expect(vertices.length).toBe(81);
    expect(edges.length).toBe(110);
  });
});

describe('legal placement highlighting & clicks', () => {
  it('highlights legal vertices and emits on click', async () => {
    const snap = snapshotFor(3);
    const user = userEvent.setup();
    const onVertexClick = vi.fn();
    // First legal vertex: any vertex (empty board).
    const legal = new Set<number>([0]);
    const { container } = render(
      <BoardSvg snap={snap} legalVertices={legal} onVertexClick={onVertexClick} />,
    );
    const hit = container.querySelector('[data-testid="vertex-hit-0"]')!;
    expect(hit.getAttribute('pointer-events')).toBe('all');
    await user.click(hit);
    expect(onVertexClick).toHaveBeenCalledWith(0);
  });

  it('highlights legal edges and emits on click', async () => {
    const snap = snapshotFor(3);
    const user = userEvent.setup();
    const onEdgeClick = vi.fn();
    const firstEdge = snap.board.topology.edges[0]!;
    const eid = firstEdge[0] < firstEdge[1] ? `${firstEdge[0]}-${firstEdge[1]}` : `${firstEdge[1]}-${firstEdge[0]}`;
    const legal = new Set<string>([eid]);
    const { container } = render(
      <BoardSvg snap={snap} legalEdges={legal} onEdgeClick={onEdgeClick} />,
    );
    const hit = container.querySelector(`[data-testid="edge-hit-${eid}"]`)!;
    expect(hit.getAttribute('pointer-events')).toBe('stroke');
    await user.click(hit);
    expect(onEdgeClick).toHaveBeenCalledWith(eid);
  });
  it('illegal vertices get pointer-events none (no hit target)', () => {
    const snap = snapshotFor(3);
    const onVertexClick = vi.fn();
    const { container } = render(
      <BoardSvg snap={snap} legalVertices={new Set<number>([5])} onVertexClick={onVertexClick} />,
    );
    // Real browsers honor SVG pointer-events for hit-testing; happy-dom
    // dispatches handlers regardless. Assert the attribute (browser truth).
    const illegal = container.querySelector('[data-testid="vertex-hit-0"]')!;
    expect(illegal.getAttribute('pointer-events')).toBe('none');
    expect(illegal.getAttribute('r')).toBe('10');
  });

  it('highlights legal robber hexes and emits on click', async () => {
    const snap = snapshotFor(3);
    const user = userEvent.setup();
    const onHexClick = vi.fn();
    const target = snap.board.topology.hexes.find((h) => h !== snap.robber)!;
    const { container } = render(
      <BoardSvg snap={snap} legalHexes={new Set<string>([target])} onHexClick={onHexClick} />,
    );
    const hexGroup = container.querySelector(`[data-testid="hex-${target}"]`)!;
    const overlay = hexGroup.querySelector('polygon:nth-of-type(2)')!;
    expect(overlay.getAttribute('class')).toContain('cursor-pointer');
    await user.click(overlay);
    expect(onHexClick).toHaveBeenCalledWith(target);
  });
});
