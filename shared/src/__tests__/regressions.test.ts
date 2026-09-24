// Regressions for reported gameplay bugs: discard after a 7, the game not
// ending at the VP target, dev cards (knight before rolling, Road Building),
// and counter-offers in player trades.

import { describe, expect, it } from 'vitest';

import { act, fixedRoll, give, newGame, runSetup } from './rules-helpers';
import { gameActionSchema } from '../protocol';
import { legalRoadEdges, stealCandidates } from '../rules/legal';
import { publicVp, totalVp, type DevCardInstance, type GameState } from '../rules/state';
import type { DevCardType, GameRules } from '../constants';

function started(seed: string, rules?: Partial<GameRules>): GameState {
  return runSetup(newGame(3, seed, rules));
}

function withCard(s: GameState, seat: number, type: DevCardType, boughtOnTurn = 0): { s: GameState; id: string } {
  const id = `dev-test-${type}-${s.players[seat]!.devHand.length}`;
  const card: DevCardInstance = { id, type, boughtOnTurn };
  const players = s.players.map((p) => (p.seat === seat ? { ...p, devHand: [...p.devHand, card] } : p));
  return { s: { ...s, players }, id };
}

function mustOk(res: ReturnType<typeof act>): GameState {
  if (!res.ok) throw new Error(`action failed: ${res.error}`);
  return res.state;
}

function roll(s: GameState, d1 = 1, d2 = 1): GameState {
  return mustOk(act(s, { type: 'rollDice' }, { rollDice: fixedRoll(d1, d2) }));
}

/** Resolve a pending robber move/steal with the first legal choices. */
function resolveRobber(s: GameState): GameState {
  let st = s;
  if (st.phase === 'robberMove') {
    st = mustOk(act(st, { type: 'moveRobber', hex: st.board.topology.hexes.find((h) => h !== st.robber)! }));
  }
  if (st.phase === 'robberSteal') {
    st = mustOk(act(st, { type: 'chooseSteal', victimSeat: stealCandidates(st, st.robber)[0]! }));
  }
  return st;
}

describe('wire schema accepts what the client sends', () => {
  it('discard with only the chosen resources is valid (zod 4 enum-keyed record demanded every key)', () => {
    expect(gameActionSchema.safeParse({ type: 'discard', resources: { wood: 4 } }).success).toBe(true);
  });

  it('trade bags may be partial', () => {
    expect(gameActionSchema.safeParse({ type: 'tradeOffer', give: { wood: 1 }, receive: { ore: 1 } }).success).toBe(true);
  });

  it('Road Building may carry a single edge', () => {
    expect(
      gameActionSchema.safeParse({ type: 'playDevCard', cardId: 'x', payload: { edges: ['1-2'] } }).success,
    ).toBe(true);
  });
});

describe('game ends at the VP target', () => {
  it('buying a VP card that reaches the target wins immediately', () => {
    let s = started('win-vp-card', { victoryPointsToWin: 3 });
    expect(totalVp(s, 0)).toBe(2);
    s = give(roll(s), 0, { sheep: 1, wheat: 1, ore: 1 });
    const deck = [...s.devDeck];
    deck[s.devDeckIndex] = { ...deck[s.devDeckIndex]!, type: 'victoryPoint' };
    s = { ...s, devDeck: deck };

    const res = act(s, { type: 'buyDevCard' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.phase).toBe('finished');
    expect(res.state.winner).toBe(0);
    expect(res.events).toContainEqual({ type: 'victory', seat: 0, vp: 3 });
    // The revealed card keeps counting for everyone once flipped.
    expect(publicVp(res.state, 0)).toBe(3);
    expect(totalVp(res.state, 0)).toBe(3);
  });

  it('a knight that takes Largest Army wins, even before the robber resolves', () => {
    let s = started('win-army', { victoryPointsToWin: 4 });
    s = { ...s, players: s.players.map((p) => (p.seat === 0 ? { ...p, playedKnights: 2 } : p)) };
    const { s: s2, id } = withCard(s, 0, 'knight');
    const res = act(s2, { type: 'playDevCard', cardId: id });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.largestArmy.holder).toBe(0);
    expect(res.state.phase).toBe('finished');
    expect(res.state.winner).toBe(0);
  });

  it('points gained off-turn win at the start of that player\'s turn', () => {
    let s = started('win-turn-start', { victoryPointsToWin: 4 });
    // Seat 1 holds Largest Army (2 settlements + 2) while seat 0 plays.
    s = { ...s, largestArmy: { holder: 1, knights: 3 } };
    s = roll(s);
    expect(s.phase).toBe('turnMain');
    const res = act(s, { type: 'endTurn' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.activeSeat).toBe(1);
    expect(res.state.phase).toBe('finished');
    expect(res.state.winner).toBe(1);
  });
});

describe('development cards', () => {
  it('a knight played before rolling returns to the roll afterwards', () => {
    const { s, id } = withCard(started('knight-preroll'), 0, 'knight');
    expect(s.phase).toBe('turnPreroll');
    const played = mustOk(act(s, { type: 'playDevCard', cardId: id }));
    expect(played.phase).toBe('robberMove');
    const after = resolveRobber(played);
    expect(after.phase).toBe('turnPreroll');
    expect(after.dice).toBeNull();
    expect(act(after, { type: 'rollDice' }, { rollDice: fixedRoll(2, 3) }).ok).toBe(true);
  });

  it('a knight played after rolling still goes to the build phase', () => {
    const base = roll(started('knight-main'));
    const { s, id } = withCard(base, 0, 'knight');
    const after = resolveRobber(mustOk(act(s, { type: 'playDevCard', cardId: id })));
    expect(after.phase).toBe('turnMain');
  });

  it('playing a card never mutates the previous state', () => {
    const { s, id } = withCard(started('no-leak'), 0, 'knight');
    mustOk(act(s, { type: 'playDevCard', cardId: id }));
    expect(s.players[0]!.devHand.find((c) => c.id === id)!.played).toBeUndefined();
  });

  it('Road Building works before rolling, without wood or brick in hand', () => {
    const base = started('rb-preroll');
    const broke = { ...base, players: base.players.map((p) => (p.seat === 0 ? { ...p, resources: { ...p.resources, wood: 0, brick: 0 } } : p)) };
    const { s, id } = withCard(broke, 0, 'roadBuilding');
    const first = legalRoadEdges(s, 0, true)[0]!;
    const withFirst = { ...s, roads: { ...s.roads, [first]: 0 } };
    const second = legalRoadEdges(withFirst, 0, true).find((e) => e !== first)!;
    const res = act(s, { type: 'playDevCard', cardId: id, payload: { edges: [first, second] } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.roads[first]).toBe(0);
    expect(res.state.roads[second]).toBe(0);
    expect(res.state.phase).toBe('turnPreroll');
  });

  it('Road Building places one road when only one road piece is left', () => {
    let s = roll(started('rb-one'));
    s = { ...s, players: s.players.map((p) => (p.seat === 0 ? { ...p, roadsLeft: 1 } : p)) };
    const { s: s2, id } = withCard(s, 0, 'roadBuilding');
    const edge = legalRoadEdges(s2, 0, true)[0]!;
    const res = act(s2, { type: 'playDevCard', cardId: id, payload: { edges: [edge] } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.players[0]!.roadsLeft).toBe(0);
  });

  it('Road Building with one edge is rejected while a second road is possible', () => {
    const s = roll(started('rb-one-reject'));
    const { s: s2, id } = withCard(s, 0, 'roadBuilding');
    const edge = legalRoadEdges(s2, 0, true)[0]!;
    const res = act(s2, { type: 'playDevCard', cardId: id, payload: { edges: [edge] } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('RB_NEEDS_2_EDGES');
  });
});

describe('counter-offers', () => {
  function withCounter(): { s: GameState; rootId: string; counterId: string } {
    let s = started('counter-flow');
    s = give(roll(s), 0, { wood: 2 });
    s = give(s, 1, { ore: 2 });
    s = mustOk(act(s, { type: 'tradeOffer', give: { wood: 1 }, receive: { brick: 1 } }));
    const rootId = s.trades.at(-1)!.id;
    s = mustOk(act(s, { type: 'tradeCounter', seat: 1, offerId: rootId, give: { ore: 1 }, receive: { wood: 1 } }));
    return { s, rootId, counterId: s.trades.at(-1)!.id };
  }

  it('the active player can accept a counter-offer, which closes the whole negotiation', () => {
    const { s, rootId, counterId } = withCounter();
    const res = act(s, { type: 'tradeRespond', seat: 0, offerId: counterId, response: 'accept' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.players[0]!.resources.ore).toBe(s.players[0]!.resources.ore + 1);
    expect(res.state.players[1]!.resources.wood).toBe(s.players[1]!.resources.wood + 1);
    expect(res.state.trades.find((t) => t.id === counterId)!.status).toBe('completed');
    expect(res.state.trades.find((t) => t.id === rootId)!.status).toBe('cancelled');
  });

  it('a third player cannot accept someone else\'s counter-offer', () => {
    const { s, counterId } = withCounter();
    const res = act(give(s, 2, { wood: 1 }), { type: 'tradeRespond', seat: 2, offerId: counterId, response: 'accept' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('NOT_TRADE_PARTY');
  });
});
