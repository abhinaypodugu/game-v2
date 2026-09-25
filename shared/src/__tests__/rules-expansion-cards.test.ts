import { describe, expect, it } from 'vitest';
import type { DevCardType, GameState } from '../index';
import { bestTradeRate } from '../index';
import { act, newGame, runSetup, give, fixedRoll } from './rules-helpers';

function readyTurnState(seed = 'expansion-dev-seed'): GameState {
  const g = runSetup(newGame(3, seed));
  return {
    ...g,
    phase: 'turnMain',
    activeSeat: 0,
    turn: 1,
    dice: { die1: 3, die2: 4 },
  };
}

function withCard(s: GameState, seat: number, type: DevCardType, boughtOnTurn = 0): { s: GameState; id: string } {
  const id = `test-${type}-${Math.random().toString(36).slice(2, 6)}`;
  const nextPlayers = s.players.map((pl) =>
    pl.seat === seat
      ? { ...pl, devHand: [...pl.devHand, { id, type, boughtOnTurn, played: false }] }
      : pl,
  );
  return { s: { ...s, players: nextPlayers }, id };
}

describe('Expansion Development Cards', () => {
  it('merchant: grants 2:1 bank trade on all resources and resets on turn end', () => {
    let s = readyTurnState();
    const { s: sWithCard, id } = withCard(s, 0, 'merchant');
    s = sWithCard;

    // Normal trade rate without harbor is 4:1
    expect(bestTradeRate(s, 0, 'wood')).toBe(4);

    // Play merchant
    const playRes = act(s, { type: 'playDevCard', cardId: id });
    expect(playRes.ok).toBe(true);
    s = playRes.state;
    expect(s.merchantSeat).toBe(0);

    // Now all resources are 2:1
    expect(bestTradeRate(s, 0, 'wood')).toBe(2);
    expect(bestTradeRate(s, 0, 'ore')).toBe(2);

    // Give Alice 2 wood and execute 2:1 trade for 1 wheat
    s.players[0]!.resources.wood = 2;
    const tradeRes = act(s, { type: 'bankTrade', give: 'wood', receive: 'wheat' });
    expect(tradeRes.ok).toBe(true);
    expect(tradeRes.state.players[0]!.resources.wood).toBe(0);
    expect(tradeRes.state.players[0]!.resources.wheat).toBe(1);

    // Ending turn clears merchant rate
    const endRes = act(s, { type: 'endTurn' });
    expect(endRes.ok).toBe(true);
    expect(endRes.state.merchantSeat).toBeNull();
  });

  it('alchemist: chooses exact dice outcome during turnPreroll', () => {
    let s = readyTurnState();
    s = { ...s, phase: 'turnPreroll' };
    const { s: sWithCard, id } = withCard(s, 0, 'alchemist');
    s = sWithCard;

    // Play Alchemist choosing 4 and 4 (sum 8)
    const playRes = act(s, {
      type: 'playDevCard',
      cardId: id,
      payload: { roll: { die1: 4, die2: 4 } },
    });
    expect(playRes.ok).toBe(true);
    s = playRes.state;
    expect(s.dice).toEqual({ die1: 4, die2: 4 });
    expect(s.phase).toBe('turnMain');
  });

  it('surveyor: swaps number tokens between two resource hexes', () => {
    let s = readyTurnState();
    const { s: sWithCard, id } = withCard(s, 0, 'surveyor');
    s = sWithCard;

    const nonDesertHexes = s.board.topology.hexes.filter((h) => s.board.hexes[h]!.terrain !== 'desert');
    const [h1, h2] = nonDesertHexes;
    const token1 = s.board.hexes[h1!]!.token!;
    const token2 = s.board.hexes[h2!]!.token!;

    const playRes = act(s, {
      type: 'playDevCard',
      cardId: id,
      payload: { hex1: h1, hex2: h2 },
    });
    expect(playRes.ok).toBe(true);
    s = playRes.state;

    expect(s.board.hexes[h1!]!.token).toBe(token2);
    expect(s.board.hexes[h2!]!.token).toBe(token1);
  });

  it('fortification: shields player from 7-roll discard and robber steal', () => {
    let s = readyTurnState();
    const { s: sWithCard, id } = withCard(s, 0, 'fortification');
    s = sWithCard;

    // Give Alice 10 resources (exceeds discard limit of 7)
    s.players[0]!.resources.wood = 10;
    // Play Fortification
    const playRes = act(s, { type: 'playDevCard', cardId: id });
    expect(playRes.ok).toBe(true);
    s = playRes.state;
    expect(s.fortifiedUntilTurn?.[0]).toBeGreaterThan(s.turn);

    // Trigger a 7 roll using fixedRoll(3, 4)
    const roll7Res = act({ ...s, phase: 'turnPreroll' }, { type: 'rollDice' }, { rollDice: fixedRoll(3, 4) });
    expect(roll7Res.ok).toBe(true);
    if (roll7Res.ok) {
      // Even with 10 cards, Alice is fortified so pendingDiscards should NOT include seat 0
      expect(roll7Res.state.pendingDiscards.find((d) => d.seat === 0)).toBeUndefined();
    }
  });

  it('spy: reveals opponent hand and surgically steals specified resource', () => {
    let s = readyTurnState();
    const { s: sWithCard, id } = withCard(s, 0, 'spy');
    s = sWithCard;

    // Give Bob 1 ore
    s.players[1]!.resources.ore = 1;

    const playRes = act(s, {
      type: 'playDevCard',
      cardId: id,
      payload: { victim: 1, resource: 'ore' },
    });
    expect(playRes.ok).toBe(true);
    s = playRes.state;

    expect(s.players[1]!.resources.ore).toBe(0);
    expect(s.players[0]!.resources.ore).toBe(1);
  });

  it('bountifulHarvest: harvests all settlements/cities on chosen terrain', () => {
    let s = readyTurnState();
    const { s: sWithCard, id } = withCard(s, 0, 'bountifulHarvest');
    s = sWithCard;

    // Place an Alice settlement on a forest vertex
    const forestHex = s.board.topology.hexes.find((h) => s.board.hexes[h]!.terrain === 'forest')!;
    const forestVertex = s.board.topology.hexVertices[forestHex]![0]!;
    s.buildings[forestVertex] = { seat: 0, type: 'settlement' };

    const initialWood = s.players[0]!.resources.wood;
    const playRes = act(s, {
      type: 'playDevCard',
      cardId: id,
      payload: { terrain: 'forest' },
    });
    expect(playRes.ok).toBe(true);
    expect(playRes.state.players[0]!.resources.wood).toBeGreaterThan(initialWood);
  });

  it('portRenovation: swaps two harbors on the coast', () => {
    let s = readyTurnState();
    const { s: sWithCard, id } = withCard(s, 0, 'portRenovation');
    s = sWithCard;

    const harborEdges = Object.keys(s.board.harbors);
    expect(harborEdges.length).toBeGreaterThanOrEqual(2);
    const [e1, e2] = harborEdges;
    const harbor1 = s.board.harbors[e1!]!;
    const harbor2 = s.board.harbors[e2!]!;

    const playRes = act(s, {
      type: 'playDevCard',
      cardId: id,
      payload: { edge1: e1, edge2: e2 },
    });
    expect(playRes.ok).toBe(true);
    s = playRes.state;

    expect(s.board.harbors[e1!]).toEqual(harbor2);
    expect(s.board.harbors[e2!]).toEqual(harbor1);
  });

  it('oracle: draws chosen card from top 3 dev cards and recycles remainder', () => {
    let s = readyTurnState();
    const { s: sWithCard, id } = withCard(s, 0, 'oracle');
    s = sWithCard;

    const topCard = s.devDeck[s.devDeckIndex]!;
    const playRes = act(s, {
      type: 'playDevCard',
      cardId: id,
      payload: { chosenCardId: topCard.id },
    });
    expect(playRes.ok).toBe(true);
    s = playRes.state;

    expect(s.players[0]!.devHand.some((c) => c.id === topCard.id)).toBe(true);
  });

  it('respects customDevDeck room settings override', () => {
    const s = newGame(3, 'custom-deck-seed', {
      customDevDeck: {
        knight: 0,
        victoryPoint: 0,
        roadBuilding: 0,
        monopoly: 0,
        yearOfPlenty: 0,
        taxCollector: 0,
        bountifulHarvest: 0,
        surveyor: 0,
        fortification: 0,
        spy: 0,
        oracle: 0,
        portRenovation: 0,
        merchant: 5,
        alchemist: 3,
      },
    });

    expect(s.rules.customDevDeck).toBeDefined();
    // Total deck size should be 5 + 3 = 8
    expect(s.devDeck).toHaveLength(8);
    const merchantCount = s.devDeck.filter((c) => c.type === 'merchant').length;
    const alchemistCount = s.devDeck.filter((c) => c.type === 'alchemist').length;
    const knightCount = s.devDeck.filter((c) => c.type === 'knight').length;
    expect(merchantCount).toBe(5);
    expect(alchemistCount).toBe(3);
    expect(knightCount).toBe(0);
  });
});

