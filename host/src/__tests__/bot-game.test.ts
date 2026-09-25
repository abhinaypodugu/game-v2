// End-to-end bot game simulation test: exercises complete game loop
// from setup draft through multiple rounds of rolls, builds, robber events, and turns.

import { describe, expect, it } from 'vitest';
import { applyAction, createGame, createRng, PLAYER_COLORS, RESOURCES, totalVp } from '@catan/shared';
import { BOT_NAMES, computeBotAction } from '../bot';

describe('end-to-end bot gameplay simulation', () => {
  it('runs an entire match through setup, production, trades, and building without deadlock', () => {
    const seed = 'simulation-seed-2026';
    const rng = createRng(seed);
    const playerCount = 4;
    const players = [
      { seat: 0, name: 'Bot Alice', color: 'red' as const },
      { seat: 1, name: 'Bot Bob', color: 'blue' as const },
      { seat: 2, name: 'Bot Charlie', color: 'orange' as const },
      { seat: 3, name: 'Bot Diana', color: 'white' as const },
    ];

    let state = createGame({ playerCount, players, seed });
    expect(state.phase).toBe('setupForward');
    expect(state.playerCount).toBe(4);

    let actionsCount = 0;
    const maxActions = 250;
    let turnCount = 0;

    while (actionsCount < maxActions && state.phase !== 'finished' && turnCount < 40) {
      actionsCount++;
      const botSeat =
        state.phase === 'discard'
          ? (state.pendingDiscards.find((d) => !d.received)?.seat ?? state.activeSeat)
          : state.activeSeat;

      const action = computeBotAction(state, botSeat, rng);
      expect(action).not.toBeNull();
      if (action === null) break;

      const stamped =
        action.type === 'discard' || action.type === 'tradeRespond' || action.type === 'tradeCounter'
          ? { ...action, seat: botSeat }
          : action;

      const result = applyAction(state, stamped, rng);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`Bot action failed: ${result.error} (type: ${action.type})`);
      }

      state = result.state;
      turnCount = state.turn;
    }

    // Verify setup placed 2 settlements and 2 roads per player = 8 each
    const buildingsCount = Object.keys(state.buildings).length;
    expect(buildingsCount).toBeGreaterThanOrEqual(8);

    const roadsCount = Object.keys(state.roads).length;
    expect(roadsCount).toBeGreaterThanOrEqual(8);

    // Verify game advanced well into the main turns
    expect(turnCount).toBeGreaterThan(5);

    // Verify players produced resources and built pieces
    const totalVp = state.players.reduce((sum, p) => sum + p.playedKnights + (5 - p.settlementsLeft), 0);
    expect(totalVp).toBeGreaterThanOrEqual(8);
  });

  it('8 bots on ext78 with custom rules: discard the right count, run SBP, reach the VP target', () => {
    const seed = 'eight-bots-2026';
    const rng = createRng(seed);
    const players = PLAYER_COLORS.map((color, seat) => ({ seat, name: BOT_NAMES[seat]!, color }));
    let state = createGame({
      playerCount: 8,
      players,
      seed,
      rules: { victoryPointsToWin: 5, discardLimit: 9 },
    });
    expect(state.config).toBe('ext78');

    let sawSbp = false;
    for (let i = 0; i < 6000 && state.phase !== 'finished'; i++) {
      if (state.phase === 'discard') {
        for (const d of state.pendingDiscards.filter((x) => !x.received)) {
          const held = RESOURCES.reduce((n, r) => n + state.players[d.seat]!.resources[r], 0);
          expect(held).toBeGreaterThan(9);
          expect(d.count).toBe(Math.floor(held / 2));
        }
      }
      if (state.phase === 'specialBuild') sawSbp = true;
      const botSeat =
        state.phase === 'discard'
          ? (state.pendingDiscards.find((d) => !d.received)?.seat ?? state.activeSeat)
          : state.phase === 'specialBuild'
            ? (state.specialBuild?.seat ?? state.activeSeat)
            : state.activeSeat;
      const action = computeBotAction(state, botSeat, rng);
      if (action === null) throw new Error(`bot ${botSeat} stuck in ${state.phase}`);
      if (action.type === 'discard') {
        const pending = state.pendingDiscards.find((d) => d.seat === botSeat)!;
        const sum = RESOURCES.reduce((n, r) => n + (action.resources[r] ?? 0), 0);
        expect(sum).toBe(pending.count);
      }
      const stamped =
        action.type === 'discard' || action.type === 'tradeRespond' || action.type === 'tradeCounter'
          ? { ...action, seat: botSeat }
          : action;
      const result = applyAction(state, stamped, rng);
      if (!result.ok) throw new Error(`Bot action failed: ${result.error} (type: ${action.type})`);
      state = result.state;
    }

    expect(sawSbp).toBe(true);
    expect(state.phase).toBe('finished');
    expect(totalVp(state, state.winner!)).toBeGreaterThanOrEqual(5);
  });
});

describe('bot tactical decision making', () => {
  const seed = 'tactical-seed-2026';
  const rng = createRng(seed);
  const players = [
    { seat: 0, name: 'Bot Alice', color: 'red' as const },
    { seat: 1, name: 'Bot Bob', color: 'blue' as const },
    { seat: 2, name: 'Bot Charlie', color: 'orange' as const },
    { seat: 3, name: 'Bot Diana', color: 'white' as const },
  ];

  it('proactively proposes trade when 1 card away from city and has surplus', () => {
    let state = createGame({ playerCount: 4, players, seed });
    // Advance state to turnMain
    state = {
      ...state,
      phase: 'turnMain',
      activeSeat: 0,
      turn: 3,
      buildings: {
        0: { seat: 0, type: 'settlement' },
      },
      players: state.players.map((p, idx) =>
        idx === 0
          ? {
              ...p,
              resources: { wood: 1, brick: 0, sheep: 0, wheat: 2, ore: 2 },
              citiesLeft: 4,
            }
          : p,
      ),
    };

    const action = computeBotAction(state, 0, rng);
    expect(action).toEqual({
      type: 'tradeOffer',
      give: { wood: 1 },
      receive: { ore: 1 },
    });
  });

  it('cancels own open trade offer if called again without accept', () => {
    let state = createGame({ playerCount: 4, players, seed });
    state = {
      ...state,
      phase: 'turnMain',
      activeSeat: 0,
      turn: 3,
      trades: [
        {
          id: 't1',
          proposer: 0,
          give: { wood: 1 },
          receive: { ore: 1 },
          status: 'open',
          counterOf: null,
          declinedBy: [],
        },
      ],
    };

    const action = computeBotAction(state, 0, rng);
    expect(action).toEqual({
      type: 'tradeCancel',
      offerId: 't1',
    });
  });

  it('kingmaker protection: declines trade from leader near winning VP', () => {
    let state = createGame({ playerCount: 4, players, seed });
    state = {
      ...state,
      phase: 'turnMain',
      activeSeat: 1,
      turn: 10,
      buildings: {
        // Player 1 has 9 VP (4 cities + 1 settlement)
        0: { seat: 1, type: 'city' },
        1: { seat: 1, type: 'city' },
        2: { seat: 1, type: 'city' },
        3: { seat: 1, type: 'city' },
        4: { seat: 1, type: 'settlement' },
        10: { seat: 0, type: 'settlement' },
      },
      players: state.players.map((p, idx) =>
        idx === 0
          ? { ...p, resources: { wood: 3, brick: 0, sheep: 0, wheat: 0, ore: 0 } }
          : idx === 1
            ? { ...p, resources: { wood: 0, brick: 0, sheep: 2, wheat: 0, ore: 0 } }
            : p,
      ),
      trades: [
        {
          id: 't_lead',
          proposer: 1,
          give: { sheep: 1 },
          receive: { wood: 1 },
          status: 'open',
          counterOf: null,
          declinedBy: [],
        },
      ],
    };

    const action = computeBotAction(state, 0, rng);
    expect(action).toEqual({
      type: 'tradeRespond',
      offerId: 't_lead',
      response: 'decline',
      seat: 0,
    });
  });

  it('accepts trade supplying missing goal resource in exchange for surplus', () => {
    let state = createGame({ playerCount: 4, players, seed });
    state = {
      ...state,
      phase: 'turnMain',
      activeSeat: 1,
      turn: 5,
      buildings: {
        0: { seat: 1, type: 'settlement' },
        10: { seat: 0, type: 'settlement' },
      },
      players: state.players.map((p, idx) =>
        idx === 0
          ? {
              ...p,
              // Bot 0 needs 1 ore for city, has surplus wood
              resources: { wood: 2, brick: 0, sheep: 0, wheat: 2, ore: 2 },
              citiesLeft: 4,
            }
          : idx === 1
            ? {
                ...p,
                resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 2 },
              }
            : p,
      ),
      trades: [
        {
          id: 't_good',
          proposer: 1,
          give: { ore: 1 },
          receive: { wood: 1 },
          status: 'open',
          counterOf: null,
          declinedBy: [],
        },
      ],
    };

    const action = computeBotAction(state, 0, rng);
    expect(action).toEqual({
      type: 'tradeRespond',
      offerId: 't_good',
      response: 'accept',
      seat: 0,
    });
  });

  it('executes bank trade with exact bundle rate to complete goal', () => {
    let state = createGame({ playerCount: 4, players, seed });
    state = {
      ...state,
      phase: 'turnMain',
      activeSeat: 0,
      turn: 4,
      buildings: {
        0: { seat: 0, type: 'settlement' },
      },
      trades: [
        // Already proposed a trade this turn
        {
          id: 't_done',
          proposer: 0,
          give: { wood: 1 },
          receive: { ore: 1 },
          status: 'cancelled',
          counterOf: null,
          declinedBy: [1, 2, 3],
          turn: 4,
        },
      ],
      players: state.players.map((p, idx) =>
        idx === 0
          ? {
              ...p,
              // Needs 1 ore for city, has 4 wood (4:1 rate)
              resources: { wood: 4, brick: 0, sheep: 0, wheat: 2, ore: 2 },
              citiesLeft: 4,
            }
          : p,
      ),
    };

    const action = computeBotAction(state, 0, rng);
    expect(action).toEqual({
      type: 'bankTrade',
      give: 'wood',
      receive: 'ore',
    });
  });

  it('plays Year of Plenty dev card to fulfill exact missing goal resources', () => {
    let state = createGame({ playerCount: 4, players, seed });
    state = {
      ...state,
      phase: 'turnMain',
      activeSeat: 0,
      turn: 3,
      buildings: {
        0: { seat: 0, type: 'settlement' },
      },
      players: state.players.map((p, idx) =>
        idx === 0
          ? {
              ...p,
              // Goal is settlement or city; if settlement, needs sheep + wheat
              resources: { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 },
              settlementsLeft: 4,
              citiesLeft: 0, // ensure goal is settlement
              devHand: [
                {
                  id: 'yop_card',
                  type: 'yearOfPlenty' as const,
                  boughtOnTurn: 1,
                  played: false,
                },
              ],
            }
          : p,
      ),
    };

    const action = computeBotAction(state, 0, rng);
    expect(action).toEqual({
      type: 'playDevCard',
      cardId: 'yop_card',
      payload: { resources: ['sheep', 'wheat'] },
    });
  });

  it('builds road along BFS path towards candidate settlement', () => {
    let state = createGame({ playerCount: 4, players, seed });
    // In standard board: vertex 10 has adjacent edges
    const v = 10;
    const edges = state.board.topology.vertexEdges[v] ?? [];
    const firstEdge = edges[0]!;

    state = {
      ...state,
      phase: 'turnMain',
      activeSeat: 0,
      turn: 3,
      buildings: {
        [v]: { seat: 0, type: 'settlement' },
      },
      roads: {},
      players: state.players.map((p, idx) =>
        idx === 0
          ? {
              ...p,
              // Enough for road, but not city or settlement
              resources: { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 },
              roadsLeft: 14,
              settlementsLeft: 4,
              citiesLeft: 0,
            }
          : p,
      ),
    };

    const action = computeBotAction(state, 0, rng);
    expect(action?.type).toBe('buildRoad');
    if (action?.type === 'buildRoad') {
      // Must be a valid legal road connected to the settlement
      expect(edges).toContain(action.edge);
    }
  });

  it('tactically plays Surveyor dev card to swap a high-pip token onto its own building', () => {
    let state = createGame({ playerCount: 4, players, seed });
    // Find a non-desert hex with token 2 or 12
    const hexes = state.board.topology.hexes;
    const hLow = hexes.find((h) => state.board.hexes[h]?.token === 2 || state.board.hexes[h]?.token === 12)!;
    const hHigh = hexes.find((h) => state.board.hexes[h]?.token === 6 || state.board.hexes[h]?.token === 8)!;

    const vLow = state.board.topology.hexVertices[hLow]![0]!;

    state = {
      ...state,
      phase: 'turnMain',
      activeSeat: 0,
      turn: 3,
      buildings: {
        [vLow]: { seat: 0, type: 'settlement' },
      },
      players: state.players.map((p, idx) =>
        idx === 0
          ? {
              ...p,
              devHand: [
                {
                  id: 'surveyor_1',
                  type: 'surveyor' as const,
                  boughtOnTurn: 1,
                  played: false,
                },
              ],
            }
          : p,
      ),
    };

    const action = computeBotAction(state, 0, rng);
    expect(action).not.toBeNull();
    expect(action?.type).toBe('playDevCard');
    if (action?.type === 'playDevCard') {
      expect(action.cardId).toBe('surveyor_1');
      const payload = action.payload as { hex1: string; hex2: string };
      expect(payload).toBeDefined();
      expect([payload.hex1, payload.hex2]).toContain(hLow);
      // The other hex swapped should have high pips (6 or 8)
      const otherHex = payload.hex1 === hLow ? payload.hex2 : payload.hex1;
      expect([6, 8, 5, 9]).toContain(state.board.hexes[otherHex]?.token);

      const initialLowToken = state.board.hexes[hLow]!.token;
      const initialHighToken = state.board.hexes[otherHex]!.token;

      // Verify applying the action succeeds in the rules engine
      const res = applyAction(state, action, rng);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.state.board.hexes[hLow]?.token).toBe(initialHighToken);
        expect(res.state.board.hexes[otherHex]?.token).toBe(initialLowToken);
      }
    }
  });

  it('tactically plays Port Renovation dev card to acquire a 2:1 port matching heavy resource production', () => {
    let state = createGame({ playerCount: 4, players, seed });
    const harborEdges = Object.keys(state.board.harbors);
    expect(harborEdges.length).toBeGreaterThanOrEqual(2);

    // Find a specialty harbor (e.g. ore or wheat) and a generic or different harbor
    const specialtyEdge = harborEdges.find((e) => state.board.harbors[e]?.type === 'specialty')!;
    const specialtyRes = state.board.harbors[specialtyEdge]!.resource!;
    const otherEdge = harborEdges.find((e) => e !== specialtyEdge)!;

    // Place a bot settlement at otherEdge
    const vBot = state.board.topology.edgeEndpoints[otherEdge]![0]!;

    // Find a hex producing specialtyRes with high pips and give bot a city there
    const hexMatch = state.board.topology.hexes.find((h) => {
      const hex = state.board.hexes[h];
      return hex && hex.terrain !== 'desert' && (hex.token === 6 || hex.token === 8);
    })!;
    const vProd = state.board.topology.hexVertices[hexMatch]![0]!;

    // Ensure the terrain produces specialtyRes
    state.board.hexes[hexMatch]!.terrain =
      specialtyRes === 'ore'
        ? 'mountains'
        : specialtyRes === 'wheat'
          ? 'fields'
          : specialtyRes === 'wood'
            ? 'forest'
            : specialtyRes === 'brick'
              ? 'hills'
              : 'pasture';

    state = {
      ...state,
      phase: 'turnMain',
      activeSeat: 0,
      turn: 3,
      buildings: {
        [vBot]: { seat: 0, type: 'settlement' },
        [vProd]: { seat: 0, type: 'city' },
      },
      players: state.players.map((p, idx) =>
        idx === 0
          ? {
              ...p,
              devHand: [
                {
                  id: 'port_1',
                  type: 'portRenovation' as const,
                  boughtOnTurn: 1,
                  played: false,
                },
              ],
            }
          : p,
      ),
    };

    const action = computeBotAction(state, 0, rng);
    expect(action).not.toBeNull();
    expect(action?.type).toBe('playDevCard');
    if (action?.type === 'playDevCard') {
      expect(action.cardId).toBe('port_1');
      const payload = action.payload as { edge1: string; edge2: string };
      expect(payload).toBeDefined();
      expect([payload.edge1, payload.edge2]).toContain(otherEdge);
      expect([payload.edge1, payload.edge2]).toContain(specialtyEdge);

      // Verify applying the action succeeds in the rules engine
      const res = applyAction(state, action, rng);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.state.board.harbors[otherEdge]?.resource).toBe(specialtyRes);
      }
    }
  });
});

