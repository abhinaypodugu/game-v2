// The rules engine: applyAction — a pure function over GameState. The server
// is the only caller with authority; the client reuses the legal.ts queries.
// State is NEVER mutated: every action clones the affected slices.

import { generateBoard, type Board } from '../board';
import {
  boardConfigForPlayers,
  BUILD_COSTS,
  canAfford,
  DEFAULT_RULES,
  emptyResourceBag,
  PIECE_LIMITS,
  RESOURCES,
  subtractCost,
  TERRAIN_RESOURCE,
  type DevCardType,
  type Resource,
  type ResourceBag,
} from '../constants';
import { computeLongestRoadAward } from '../longestRoad';
import type { GameAction, GameEvent } from '../protocol';
import { createRng, type Rng } from '../rng';
import type { EdgeId, HexId, VertexId } from '../topology';
import {
  bestTradeRate,
  canPlaceCity,
  canPlaceRoad,
  canPlaceSettlement,
  canPlaceSetupRoad,
  legalRoadEdges,
  legalRobberHexes,
  stealCandidates,
} from './legal';
import {
  totalVp,
  type EngineOptions,
  type GameState,
  type InitialPlayer,
  type PlayerState,
} from './state';

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string };

export interface RollDiceFn {
  (rng: Rng): { die1: number; die2: number };
}

const defaultRollDice: RollDiceFn = (rng) => ({
  die1: 1 + rng.int(6),
  die2: 1 + rng.int(6),
});

// ---------------------------------------------------------------------------
// Game creation
// ---------------------------------------------------------------------------

export function createGame(opts: EngineOptions): GameState {
  const config = boardConfigForPlayers(opts.playerCount);
  const board: Board = generateBoard(opts.playerCount, opts.seed);
  const rng = createRng(`${opts.seed}:devdeck`);

  const devDeckCounts: Record<string, number> = {
    ...config.devDeck,
    ...(opts.rules?.customDevDeck ?? {}),
  };

  const deck: Array<{ id: string; type: DevCardType }> = [];
  for (const [type, count] of Object.entries(devDeckCounts)) {
    const n = Math.max(0, count);
    for (let i = 0; i < n; i++) deck.push({ id: `${type}-${i}`, type: type as DevCardType });
  }
  const shuffled = rng.shuffle(deck).map((c) => ({
    id: c.id,
    type: c.type,
    boughtOnTurn: -1,
  }));

  const players: PlayerState[] = opts.players.map((p: InitialPlayer) => ({
    seat: p.seat,
    name: p.name,
    color: p.color,
    resources: emptyResourceBag(),
    devHand: [],
    playedKnights: 0,
    connected: true,
    roadsLeft: PIECE_LIMITS.roads,
    settlementsLeft: PIECE_LIMITS.settlements,
    citiesLeft: PIECE_LIMITS.cities,
  }));

  return {
    config: config.key,
    playerCount: opts.playerCount,
    rules: {
      victoryPointsToWin: opts.rules?.victoryPointsToWin ?? DEFAULT_RULES.victoryPointsToWin,
      discardLimit: opts.rules?.discardLimit ?? DEFAULT_RULES.discardLimit,
      ...(opts.rules?.customDevDeck !== undefined ? { customDevDeck: opts.rules.customDevDeck } : {}),
    },
    players,
    board,
    phase: 'setupForward',
    activeSeat: 0,
    turn: 0,
    dice: null,
    buildings: {},
    roads: {},
    robber: board.robberHex,
    bank: emptyResourceBagFrom(config.resourceBank),
    devDeck: shuffled,
    devDeckIndex: 0,
    trades: [],
    pendingDiscards: [],
    specialBuild: null,
    setupCursor: 0,
    longestRoad: { holder: null, length: 0 },
    largestArmy: { holder: null, knights: 0 },
    winner: null,
    devCardPlayedThisTurn: false,
    knightBeforeRoll: false,
    version: 1,
  };
}

function emptyResourceBagFrom(per: number): ResourceBag {
  return { wood: per, brick: per, sheep: per, wheat: per, ore: per };
}

// ---------------------------------------------------------------------------
// Setup draft order
// ---------------------------------------------------------------------------

/** Snake draft: forward 0..N-1 then reverse N-1..0. */
export function draftOrder(playerCount: number): number[] {
  const forward = Array.from({ length: playerCount }, (_, i) => i);
  return [...forward, ...[...forward].reverse()];
}

function isSecondPlacement(state: GameState): boolean {
  return state.setupCursor >= state.playerCount;
}

// ---------------------------------------------------------------------------
// applyAction
// ---------------------------------------------------------------------------

export function applyAction(
  prev: GameState,
  action: GameAction,
  rng: Rng,
  rollDice: RollDiceFn = defaultRollDice,
): ActionResult {
  if (prev.phase === 'finished') {
    return fail('GAME_FINISHED');
  }
  const result = dispatch(prev, action, rng, rollDice);
  // Single victory gate: any accepted action (a build, a VP card bought, a
  // knight taking Largest Army, free roads taking Longest Road, or the start
  // of a turn where points were gained earlier) can end the game.
  if (result.ok) maybeWin(result.state, result.events);
  return result;
}

function dispatch(prev: GameState, action: GameAction, rng: Rng, rollDice: RollDiceFn): ActionResult {
  switch (action.type) {
    case 'setupPlace': return setupPlace(prev, action);
    case 'rollDice': return rollDiceAction(prev, rng, rollDice);
    case 'buildRoad': return buildRoad(prev, action.edge, rng, false);
    case 'buildSettlement': return buildSettlement(prev, action.vertex, rng, false);
    case 'buildCity': return buildCity(prev, action.vertex);
    case 'buyDevCard': return buyDevCard(prev, rng);
    case 'playDevCard': return playDevCard(prev, action, rng);
    case 'moveRobber': return moveRobber(prev, action.hex);
    case 'chooseSteal': return chooseSteal(prev, action.victimSeat, rng);
    case 'discard': return discard(prev, action);
    case 'bankTrade': return bankTrade(prev, action.give, action.receive);
    case 'endTurn': return endTurn(prev);
    case 'tradeOffer': return tradeOffer(prev, action);
    case 'tradeRespond': return tradeRespond(prev, action);
    case 'tradeCounter': return tradeCounter(prev, action);
    case 'tradeCancel': return tradeCancel(prev, action);
    case 'specialBuildActivate': return specialBuildActivate(prev, action);
    case 'specialBuildDone': return specialBuildDone(prev);
    default: return fail('UNKNOWN_ACTION');
  }
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Clone helper: shallow state + copy-on-write for touched slices. */
function cloneState(s: GameState): GameState {
  return {
    ...s,
    // Cards are copied too: playing a card flips `played`, which must never leak into `prev`.
    players: s.players.map((p) => ({ ...p, resources: { ...p.resources }, devHand: p.devHand.map((c) => ({ ...c })) })),
    buildings: { ...s.buildings },
    roads: { ...s.roads },
    bank: { ...s.bank },
    trades: s.trades.map((t) => ({ ...t })),
    pendingDiscards: s.pendingDiscards.map((d) => ({ ...d })),
    dice: s.dice === null ? null : { ...s.dice },
    specialBuild: s.specialBuild === null ? null : { ...s.specialBuild, usedThisRound: { ...s.specialBuild.usedThisRound } },
    version: s.version + 1,
  };
}

// ---------------------------------------------------------------------------
// Setup phase
// ---------------------------------------------------------------------------

function setupPlace(prev: GameState, action: Extract<GameAction, { type: 'setupPlace' }>): ActionResult {
  if (prev.phase !== 'setupForward' && prev.phase !== 'setupReverse') {
    return fail('NOT_SETUP');
  }
  const seat = prev.activeSeat;
  const player = prev.players[seat]!;
  const vertex = action.settlementVertex;
  const edge = action.roadEdge;

  if (!canPlaceSettlement(prev, seat, vertex, true)) {
    return fail('ILLEGAL_SETTLEMENT');
  }
  if (!canPlaceSetupRoad(prev, seat, edge, vertex)) {
    return fail('ILLEGAL_ROAD');
  }
  if (player.settlementsLeft <= 0 || player.roadsLeft <= 0) {
    return fail('NO_PIECES');
  }

  const state = cloneState(prev);
  state.buildings[vertex] = { seat, type: 'settlement' };
  state.roads[edge] = seat;
  const p = state.players[seat]!;
  p.settlementsLeft -= 1;
  p.roadsLeft -= 1;

  const events: GameEvent[] = [
    { type: 'setupPlaced', seat, settlementVertex: vertex, roadEdge: edge, second: isSecondPlacement(prev) },
  ];

  // Second placement grants 1 resource per adjacent producing hex.
  if (isSecondPlacement(prev)) {
    for (const hex of state.board.topology.vertexHexes[vertex]!) {
      const terrain = state.board.hexes[hex]!.terrain;
      const resource = TERRAIN_RESOURCE[terrain];
      if (resource === null) continue;
      p.resources[resource] += 1;
      state.bank[resource] -= 1;
    }
  }

  // Advance draft.
  state.setupCursor += 1;
  const order = draftOrder(state.playerCount);
  if (state.setupCursor >= order.length) {
    state.phase = 'turnPreroll';
    state.activeSeat = 0;
    state.turn = 1;
    state.devCardPlayedThisTurn = false;
    events.push({ type: 'turnStarted', seat: 0, turn: 1 });
  } else {
    const nextSeat = order[state.setupCursor]!;
    const nextPhase = state.setupCursor >= state.playerCount ? 'setupReverse' : 'setupForward';
    state.phase = nextPhase;
    state.activeSeat = nextSeat;
  }
  return ok(state, events);
}

// ---------------------------------------------------------------------------
// Roll + production + robber flow
// ---------------------------------------------------------------------------

function rollDiceAction(prev: GameState, rng: Rng, rollDice: RollDiceFn): ActionResult {
  if (prev.phase !== 'turnPreroll') {
    return fail('NOT_PREROLL');
  }
  const state = cloneState(prev);
  const { die1, die2 } = rollDice(rng);
  return resolveRoll(state, die1, die2);
}

function resolveRoll(
  state: GameState,
  die1: number,
  die2: number,
  initialEvents: GameEvent[] = [],
): ActionResult {
  state.dice = { die1, die2 };
  const sum = die1 + die2;
  const events: GameEvent[] = [...initialEvents, { type: 'rolled', seat: state.activeSeat, die1, die2 }];

  if (sum === 7) {
    // Discard phase for every non-fortified player holding more than the discard limit.
    state.phase = 'discard';
    state.pendingDiscards = state.players
      .filter((p) => {
        const isFortified =
          state.fortifiedUntilTurn?.[p.seat] !== undefined && state.turn < state.fortifiedUntilTurn[p.seat]!;
        if (isFortified) return false;
        return total(p) > state.rules.discardLimit;
      })
      .map((p) => ({ seat: p.seat, count: Math.floor(total(p) / 2), received: false }));
    if (state.pendingDiscards.length === 0) {
      state.phase = 'robberMove';
      events.push({ type: 'robberMoved', seat: null, hex: state.robber });
    }
    return ok(state, events);
  }

  // Production per resource: bank shortage rule — if the bank cannot cover ALL
  // payouts of a resource, nobody gets it, unless a single player claims it.
  const payouts: Record<Resource, Array<{ seat: number; amount: number }>> = {
    wood: [], brick: [], sheep: [], wheat: [], ore: [],
  };
  for (const hex of state.board.topology.hexes) {
    if (hex === state.robber) continue;
    const token = state.board.hexes[hex]!.token;
    if (token !== sum) continue;
    const terrain = state.board.hexes[hex]!.terrain;
    const resource = TERRAIN_RESOURCE[terrain];
    if (resource === null) continue;
    for (const v of state.board.topology.hexVertices[hex]!) {
      const b = state.buildings[v];
      if (b === undefined) continue;
      payouts[resource].push({ seat: b.seat, amount: b.type === 'settlement' ? 1 : 2 });
    }
  }
  for (const resource of RESOURCES) {
    const claims = payouts[resource];
    if (claims.length === 0) continue;
    const totalDue = claims.reduce((n, c) => n + c.amount, 0);
    const available = state.bank[resource];
    if (totalDue <= available) {
      for (const c of claims) {
        state.players[c.seat]!.resources[resource] += c.amount;
        state.bank[resource] -= c.amount;
        events.push({ type: 'produced', seat: c.seat, resource, amount: c.amount });
      }
    } else if (claims.length === 1) {
      // Single claimant gets whatever remains.
      const c = claims[0]!;
      state.players[c.seat]!.resources[resource] += available;
      state.bank[resource] = 0;
      events.push({ type: 'produced', seat: c.seat, resource, amount: available });
      events.push({ type: 'bankShortage', resource });
    } else {
      events.push({ type: 'bankShortage', resource });
    }
  }

  state.phase = 'turnMain';
  return ok(state, events);
}

/** Total resource count of a player (helper local to avoid import cycle). */
function total(p: PlayerState): number {
  return RESOURCES.reduce((n, r) => n + p.resources[r], 0);
}

function discard(prev: GameState, action: Extract<GameAction, { type: 'discard' }>): ActionResult {
  if (prev.phase !== 'discard') {
    return fail('NOT_DISCARD');
  }
  const pending = prev.pendingDiscards.filter((d) => !d.received);
  if (pending.length === 0) return fail('NO_PENDING_DISCARD');
  const target = action.seat !== undefined
    ? pending.find((d) => d.seat === action.seat)
    : pending[0]!;
  if (target === undefined) return fail('NO_PENDING_DISCARD');
  const seat = target.seat;
  const player = prev.players[seat]!;

  const bag = action.resources;
  const sum = RESOURCES.reduce((n, r) => n + (bag[r] ?? 0), 0);
  if (sum !== target.count) {
    return fail('DISCARD_COUNT_MISMATCH');
  }
  for (const r of RESOURCES) {
    if ((bag[r] ?? 0) > player.resources[r]) return fail('DISCARD_OVERSpend');
  }

  const state = cloneState(prev);
  const p = state.players[seat]!;
  for (const r of RESOURCES) {
    const n = bag[r] ?? 0;
    p.resources[r] -= n;
    state.bank[r] += n;
  }
  const idx = state.pendingDiscards.findIndex((d) => d.seat === seat);
  if (idx >= 0) state.pendingDiscards[idx]!.received = true;

  const events: GameEvent[] = [
    { type: 'discarded', seat, resources: bag },
  ];

  if (state.pendingDiscards.every((d) => d.received)) {
    state.pendingDiscards = [];
    state.phase = 'robberMove';
  }
  return ok(state, events);
}

function moveRobber(prev: GameState, hex: HexId): ActionResult {
  if (prev.phase !== 'robberMove') {
    return fail('NOT_ROBBER_MOVE');
  }
  if (!legalRobberHexes(prev).includes(hex)) {
    return fail('ILLEGAL_ROBBER_HEX');
  }
  const state = cloneState(prev);
  state.robber = hex;
  const events: GameEvent[] = [{ type: 'robberMoved', seat: prev.activeSeat, hex }];

  const candidates = stealCandidates(state, hex);
  const withCards = candidates.filter((s) => total(state.players[s]!) > 0);
  if (withCards.length > 0) {
    state.phase = 'robberSteal';
  } else {
    finishRobber(state);
  }
  return ok(state, events);
}

function chooseSteal(prev: GameState, victimSeat: number, rng: Rng): ActionResult {
  if (prev.phase !== 'robberSteal') {
    return fail('NOT_ROBBER_STEAL');
  }
  const candidates = stealCandidates(prev, prev.robber);
  if (!candidates.includes(victimSeat)) {
    return fail('ILLEGAL_VICTIM');
  }
  const state = cloneState(prev);
  const victim = state.players[victimSeat]!;
  const resourcesHeld = RESOURCES.filter((r) => victim.resources[r] > 0);
  let stolenResource: Resource | null = null;
  if (resourcesHeld.length > 0) {
    const stolen = rng.pick(resourcesHeld);
    victim.resources[stolen] -= 1;
    state.players[prev.activeSeat]!.resources[stolen] += 1;
    stolenResource = stolen;
  }
  finishRobber(state);
  const events: GameEvent[] = [
    { type: 'stolenFrom', seat: prev.activeSeat, victim: victimSeat, resource: stolenResource },
  ];
  return ok(state, events);
}

/** After the robber resolves: back to rolling if a knight was played before the roll. */
function finishRobber(state: GameState): void {
  state.phase = state.knightBeforeRoll ? 'turnPreroll' : 'turnMain';
  state.knightBeforeRoll = false;
}

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

function buildRoad(prev: GameState, edge: EdgeId, rng: Rng, free: boolean): ActionResult {
  const acting = prev.specialBuild !== null && prev.specialBuild.seat !== null
    ? prev.specialBuild.seat
    : prev.activeSeat;
  // Free roads (Road Building) may be placed before rolling too.
  const phaseOk =
    prev.phase === 'turnMain' || prev.phase === 'specialBuild' || (free && prev.phase === 'turnPreroll');
  if (!phaseOk) {
    return fail('NOT_BUILD_PHASE');
  }
  if (prev.phase === 'specialBuild') {
    const sb = prev.specialBuild;
    if (sb === null || sb.seat === null) return fail('NO_SB_WINDOW');
    if (acting !== sb.seat) return fail('NOT_SB_ACTOR');
  }
  if (!canPlaceRoad(prev, acting, edge, free)) {
    return fail('ILLEGAL_ROAD');
  }
  const state = cloneState(prev);
  const p = state.players[acting]!;
  if (!free) {
    p.resources = subtractCost(p.resources, BUILD_COSTS.road);
    state.bank.wood += BUILD_COSTS.road.wood ?? 0;
    state.bank.brick += BUILD_COSTS.road.brick ?? 0;
  }
  p.roadsLeft -= 1;
  state.roads[edge] = acting;

  const events: GameEvent[] = [{ type: 'roadBuilt', seat: acting, edge, ...(free ? { free: true } : {}) }];
  recomputeLongestRoad(state, events);
  return ok(state, events);
}

function buildSettlement(prev: GameState, vertex: VertexId, _rng: Rng, free: boolean): ActionResult {
  const acting = prev.specialBuild?.seat ?? prev.activeSeat;
  if (prev.phase !== 'turnMain' && prev.phase !== 'specialBuild') {
    return fail('NOT_BUILD_PHASE');
  }
  if (prev.phase === 'specialBuild') {
    const sb = prev.specialBuild;
    if (sb === null || sb.seat === null) return fail('NO_SB_WINDOW');
    if (acting !== sb.seat) return fail('NOT_SB_ACTOR');
  }
  if (!canPlaceSettlement(prev, acting, vertex, false)) {
    return fail('ILLEGAL_SETTLEMENT');
  }
  const state = cloneState(prev);
  const p = state.players[acting]!;
  if (!free) {
    p.resources = subtractCost(p.resources, BUILD_COSTS.settlement);
    for (const r of RESOURCES) state.bank[r] += BUILD_COSTS.settlement[r as keyof typeof BUILD_COSTS.settlement] ?? 0;
  }
  p.settlementsLeft -= 1;
  state.buildings[vertex] = { seat: acting, type: 'settlement' };

  const events: GameEvent[] = [{ type: 'settlementBuilt', seat: acting, vertex }];
  recomputeLongestRoad(state, events);
  return ok(state, events);
}

function buildCity(prev: GameState, vertex: VertexId): ActionResult {
  const acting = prev.specialBuild?.seat ?? prev.activeSeat;
  if (prev.phase !== 'turnMain' && prev.phase !== 'specialBuild') {
    return fail('NOT_BUILD_PHASE');
  }
  if (prev.phase === 'specialBuild') {
    const sb = prev.specialBuild;
    if (sb === null || sb.seat === null) return fail('NO_SB_WINDOW');
    if (acting !== sb.seat) return fail('NOT_SB_ACTOR');
  }
  if (!canPlaceCity(prev, acting, vertex)) {
    return fail('ILLEGAL_CITY');
  }
  const state = cloneState(prev);
  const p = state.players[acting]!;
  p.resources = subtractCost(p.resources, BUILD_COSTS.city);
  state.bank.wheat += BUILD_COSTS.city.wheat;
  state.bank.ore += BUILD_COSTS.city.ore;
  p.settlementsLeft += 1;
  p.citiesLeft -= 1;
  state.buildings[vertex] = { seat: acting, type: 'city' };

  const events: GameEvent[] = [{ type: 'cityBuilt', seat: acting, vertex }];
  return ok(state, events);
}

// ---------------------------------------------------------------------------
// Dev cards
// ---------------------------------------------------------------------------

function buyDevCard(prev: GameState, rng: Rng): ActionResult {
  const acting = prev.specialBuild?.seat ?? prev.activeSeat;
  if (prev.phase !== 'turnMain' && prev.phase !== 'specialBuild') {
    return fail('NOT_BUILD_PHASE');
  }
  if (prev.phase === 'specialBuild') {
    const sb = prev.specialBuild;
    if (sb === null || sb.seat === null) return fail('NO_SB_WINDOW');
    if (acting !== sb.seat) return fail('NOT_SB_ACTOR');
  }
  const p = prev.players[acting]!;
  if (prev.devDeckIndex >= prev.devDeck.length) {
    return fail('DECK_EMPTY');
  }
  if (!canAfford(p.resources, BUILD_COSTS.devCard)) {
    return fail('CANNOT_AFFORD');
  }
  const state = cloneState(prev);
  const card = state.devDeck[state.devDeckIndex]!;
  state.devDeckIndex += 1;
  const player = state.players[acting]!;
  player.resources = subtractCost(player.resources, BUILD_COSTS.devCard);
  state.bank.sheep += 1;
  state.bank.wheat += 1;
  state.bank.ore += 1;
  const bought: typeof card = { ...card, boughtOnTurn: state.turn };
  player.devHand.push(bought);

  const events: GameEvent[] = [{ type: 'devCardBought', seat: acting }];
  void rng;
  return ok(state, events);
}

function playDevCard(
  prev: GameState,
  action: Extract<GameAction, { type: 'playDevCard' }>,
  rng: Rng,
): ActionResult {
  if (prev.phase !== 'turnPreroll' && prev.phase !== 'turnMain') {
    return fail('NOT_DEV_PHASE');
  }
  const seat = prev.activeSeat;
  const p = prev.players[seat]!;
  const card = p.devHand.find((c) => c.id === action.cardId);
  if (card === undefined) return fail('NO_SUCH_CARD');
  if (card.played) return fail('CARD_ALREADY_PLAYED');
  if (card.boughtOnTurn === prev.turn) return fail('BOUGHT_THIS_TURN');
  if (card.type === 'victoryPoint') return fail('VP_NOT_PLAYABLE');

  if (prev.devCardPlayedThisTurn) {
    return fail('ONE_DEV_PER_TURN');
  }

  const state = cloneState(prev);
  const player = state.players[seat]!;
  const cardIdx = player.devHand.findIndex((c) => c.id === action.cardId);
  const theCard = player.devHand[cardIdx]!;

  const events: GameEvent[] = [];

  switch (theCard.type) {
    case 'knight': {
      theCard.played = true;
      player.playedKnights += 1;
      state.devCardPlayedThisTurn = true;
      state.phase = 'robberMove';
      events.push({ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'knight' });
      // Largest army recompute after knight play.
      recomputeLargestArmy(state, events);
      // Played before rolling: after the robber resolves, the player still rolls.
      state.knightBeforeRoll = prev.phase === 'turnPreroll';
      return ok(state, events);
    }
    case 'roadBuilding': {
      const edges = action.payload?.edges;
      if (edges === undefined || edges.length === 0 || edges.length > 2) return fail('RB_NEEDS_2_EDGES');
      // Both roads placed as one action, validated in order.
      let working = state;
      for (const e of edges) {
        const res = buildRoad(working, e, rng, true);
        if (!res.ok) return res;
        working = res.state;
        events.push(...res.events);
      }
      // A single road is only allowed when no second road can legally be placed
      // (out of road pieces or no connected free edge).
      if (edges.length === 1 && legalRoadEdges(working, seat, true).length > 0) return fail('RB_NEEDS_2_EDGES');
      working.devCardPlayedThisTurn = true;
      const marked = working.players[seat]!;
      const c = marked.devHand.find((x) => x.id === action.cardId);
      if (c !== undefined) c.played = true;
      events.unshift({ type: 'devCardPlayed', seat, cardId: action.cardId, cardType: 'roadBuilding' });
      return ok(working, events);
    }
    case 'monopoly': {
      const resource = action.payload?.resource;
      if (resource === undefined) return fail('MONO_NEEDS_RESOURCE');
      theCard.played = true;
      state.devCardPlayedThisTurn = true;
      let takenTotal = 0;
      for (const other of state.players) {
        if (other.seat === seat) continue;
        const n = other.resources[resource];
        other.resources[resource] = 0;
        player.resources[resource] += n;
        takenTotal += n;
      }
      events.push({ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'monopoly' });
      events.push({ type: 'produced', seat, resource, amount: takenTotal });
      return ok(state, events);
    }
    case 'yearOfPlenty': {
      const resources = action.payload?.resources;
      if (resources === undefined || resources.length === 0 || resources.length > 2) {
        return fail('YOP_NEEDS_RESOURCES');
      }
      theCard.played = true;
      state.devCardPlayedThisTurn = true;
      for (const r of resources) {
        const avail = state.bank[r];
        const give = Math.min(avail, 1);
        state.bank[r] -= give;
        player.resources[r] += give;
        events.push({ type: 'produced', seat, resource: r, amount: give });
      }
      events.push({ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'yearOfPlenty' });
      return ok(state, events);
    }
    case 'merchant': {
      theCard.played = true;
      state.devCardPlayedThisTurn = true;
      state.merchantSeat = seat;
      events.push({ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'merchant' });
      events.push({ type: 'merchantActivated', seat });
      return ok(state, events);
    }
    case 'taxCollector': {
      theCard.played = true;
      state.devCardPlayedThisTurn = true;
      events.push({ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'taxCollector' });

      const myVp = playerPublicVp(state, seat);
      const richer = state.players.filter(
        (other) => other.seat !== seat && playerPublicVp(state, other.seat) > myVp && total(other) > 0,
      );

      let totalCollected = 0;
      if (richer.length > 0) {
        for (const target of richer) {
          const stolen = stealRandomCard(target, rng);
          if (stolen !== null) {
            player.resources[stolen] += 1;
            totalCollected += 1;
            events.push({ type: 'stolenFrom', seat, victim: target.seat, resource: stolen });
          }
        }
      } else {
        const opponents = state.players
          .filter((other) => other.seat !== seat && total(other) > 0)
          .sort((a, b) => total(b) - total(a));
        if (opponents.length > 0) {
          const target = opponents[0]!;
          const stolen = stealRandomCard(target, rng);
          if (stolen !== null) {
            player.resources[stolen] += 1;
            totalCollected += 1;
            events.push({ type: 'stolenFrom', seat, victim: target.seat, resource: stolen });
          }
        }
      }
      events.push({ type: 'taxCollected', seat, totalCards: totalCollected });
      return ok(state, events);
    }
    case 'bountifulHarvest': {
      const terrain = action.payload?.terrain;
      if (!terrain) return fail('HARVEST_NEEDS_TERRAIN');
      const resource = TERRAIN_RESOURCE[terrain];
      if (resource === null) return fail('HARVEST_NEEDS_TERRAIN');

      theCard.played = true;
      state.devCardPlayedThisTurn = true;
      events.push({ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'bountifulHarvest' });

      const payouts: Record<number, number> = {};
      for (const hex of state.board.topology.hexes) {
        if (state.board.hexes[hex]!.terrain !== terrain) continue;
        for (const v of state.board.topology.hexVertices[hex]!) {
          const b = state.buildings[v];
          if (b === undefined) continue;
          payouts[b.seat] = (payouts[b.seat] ?? 0) + (b.type === 'settlement' ? 1 : 2);
        }
      }

      const totalDue = Object.values(payouts).reduce((a, b) => a + b, 0);
      const avail = state.bank[resource];
      if (totalDue <= avail) {
        for (const [sStr, amt] of Object.entries(payouts)) {
          const s = Number(sStr);
          state.players[s]!.resources[resource] += amt;
          state.bank[resource] -= amt;
          events.push({ type: 'produced', seat: s, resource, amount: amt });
        }
      } else if (Object.keys(payouts).length === 1) {
        const s = Number(Object.keys(payouts)[0]);
        state.players[s]!.resources[resource] += avail;
        state.bank[resource] = 0;
        events.push({ type: 'produced', seat: s, resource, amount: avail });
        events.push({ type: 'bankShortage', resource });
      } else {
        events.push({ type: 'bankShortage', resource });
      }
      return ok(state, events);
    }
    case 'alchemist': {
      if (prev.phase !== 'turnPreroll') return fail('ALCHEMIST_ONLY_IN_PREROLL');
      const roll = action.payload?.roll;
      const die1 = roll?.die1 ?? 3;
      const die2 = roll?.die2 ?? 4;
      if (die1 < 1 || die1 > 6 || die2 < 1 || die2 > 6) return fail('INVALID_DICE');
      theCard.played = true;
      state.devCardPlayedThisTurn = true;
      const devEvents: GameEvent[] = [{ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'alchemist' }];
      return resolveRoll(state, die1, die2, devEvents);
    }
    case 'surveyor': {
      const hex1 = action.payload?.hex1;
      const hex2 = action.payload?.hex2;
      if (!hex1 || !hex2 || hex1 === hex2) return fail('SURVEYOR_NEEDS_2_HEXES');
      const h1 = state.board.hexes[hex1];
      const h2 = state.board.hexes[hex2];
      if (!h1 || !h2) return fail('NO_SUCH_HEX');
      if (h1.terrain === 'desert' || h2.terrain === 'desert') return fail('CANNOT_SWAP_DESERT');
      if (h1.token === undefined || h2.token === undefined || h1.token === null || h2.token === null) {
        return fail('CANNOT_SWAP_DESERT');
      }

      theCard.played = true;
      state.devCardPlayedThisTurn = true;
      const t1 = h1.token;
      const t2 = h2.token;
      h1.token = t2;
      h2.token = t1;
      events.push({ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'surveyor' });
      events.push({ type: 'tokensSwapped', seat, hex1, hex2, token1: t2, token2: t1 });
      return ok(state, events);
    }
    case 'fortification': {
      theCard.played = true;
      state.devCardPlayedThisTurn = true;
      const untilTurn = state.turn + state.playerCount;
      state.fortifiedUntilTurn = { ...(state.fortifiedUntilTurn ?? {}), [seat]: untilTurn };
      events.push({ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'fortification' });
      events.push({ type: 'fortified', seat, untilTurn });
      return ok(state, events);
    }
    case 'spy': {
      const victimSeat = action.payload?.victim;
      const resource = action.payload?.resource;
      if (victimSeat === undefined || !resource) return fail('SPY_NEEDS_TARGET');
      if (victimSeat === seat) return fail('CANNOT_STEAL_SELF');
      const victim = state.players[victimSeat];
      if (!victim) return fail('NO_SUCH_PLAYER');
      if (state.fortifiedUntilTurn?.[victimSeat] !== undefined && state.turn < state.fortifiedUntilTurn[victimSeat]!) {
        return fail('TARGET_IS_FORTIFIED');
      }
      if (victim.resources[resource] <= 0) return fail('VICTIM_LACKS_RESOURCE');

      theCard.played = true;
      state.devCardPlayedThisTurn = true;
      victim.resources[resource] -= 1;
      player.resources[resource] += 1;
      events.push({ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'spy' });
      events.push({ type: 'stolenFrom', seat, victim: victimSeat, resource });
      return ok(state, events);
    }
    case 'oracle': {
      const chosenCardId = action.payload?.chosenCardId;
      const top3 = state.devDeck.slice(state.devDeckIndex, state.devDeckIndex + 3);
      if (top3.length === 0) return fail('DEV_DECK_EMPTY');

      const chosen = top3.find((c) => c.id === chosenCardId) ?? top3[0]!;
      theCard.played = true;
      state.devCardPlayedThisTurn = true;

      const chosenIdx = state.devDeck.findIndex((c) => c.id === chosen.id);
      state.devDeck.splice(chosenIdx, 1);
      player.devHand.push({
        id: chosen.id,
        type: chosen.type,
        boughtOnTurn: state.turn,
        played: false,
      });

      const remaining = state.devDeck.slice(state.devDeckIndex);
      const shuffledRemaining = rng.shuffle(remaining);
      state.devDeck = [...state.devDeck.slice(0, state.devDeckIndex), ...shuffledRemaining];

      events.push({ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'oracle' });
      events.push({ type: 'devCardBought', seat });
      return ok(state, events);
    }
    case 'portRenovation': {
      const edge1 = action.payload?.edge1;
      const edge2 = action.payload?.edge2;
      if (!edge1 || !edge2 || edge1 === edge2) return fail('PORT_NEEDS_2_HARBORS');
      const h1 = state.board.harbors[edge1];
      const h2 = state.board.harbors[edge2];
      if (!h1 || !h2) return fail('NO_SUCH_HARBOR');

      theCard.played = true;
      state.devCardPlayedThisTurn = true;
      state.board.harbors = {
        ...state.board.harbors,
        [edge1]: h2,
        [edge2]: h1,
      };
      events.push({ type: 'devCardPlayed', seat, cardId: theCard.id, cardType: 'portRenovation' });
      events.push({ type: 'harborsSwapped', seat, edge1, edge2 });
      return ok(state, events);
    }
    default:
      return fail('UNPLAYABLE_CARD');
  }
}

function stealRandomCard(from: PlayerState, rng: Rng): Resource | null {
  const cards: Resource[] = [];
  for (const r of RESOURCES) {
    for (let i = 0; i < from.resources[r]; i++) cards.push(r);
  }
  if (cards.length === 0) return null;
  const picked = rng.pick(cards);
  from.resources[picked] -= 1;
  return picked;
}

function playerPublicVp(state: GameState, seat: number): number {
  let vp = 0;
  for (const b of Object.values(state.buildings)) {
    if (b.seat === seat) vp += b.type === 'settlement' ? 1 : 2;
  }
  if (state.longestRoad.holder === seat) vp += 2;
  if (state.largestArmy.holder === seat) vp += 2;
  return vp;
}

// ---------------------------------------------------------------------------
// Trading
// ---------------------------------------------------------------------------

function bankTrade(prev: GameState, give: Resource, receive: Resource): ActionResult {
  if (prev.phase !== 'turnMain') return fail('NOT_TRADE_PHASE');
  const seat = prev.activeSeat;
  const p = prev.players[seat]!;
  const rate = bestTradeRate(prev, seat, give);
  if (p.resources[give] < rate) return fail('INSUFFICIENT_FOR_RATE');
  if (stateBankHas(prev, receive) < 1) return fail('BANK_EMPTY');
  if (give === receive) return fail('SAME_RESOURCE');

  const state = cloneState(prev);
  const player = state.players[seat]!;
  player.resources[give] -= rate;
  player.resources[receive] += 1;
  state.bank[give] += rate;
  state.bank[receive] -= 1;
  const events: GameEvent[] = [
    { type: 'bankTraded', seat, give, giveAmount: rate, receive },
  ];
  return ok(state, events);
}

function stateBankHas(state: GameState, r: Resource): number {
  return state.bank[r];
}

function validTradeAmounts(give: Partial<ResourceBag>, receive: Partial<ResourceBag>): boolean {
  const g = RESOURCES.reduce((n, r) => n + (give[r] ?? 0), 0);
  const rv = RESOURCES.reduce((n, r) => n + (receive[r] ?? 0), 0);
  if (g === 0 || rv === 0) return false;
  // No same-resource-for-same-resource on either side.
  for (const r of RESOURCES) {
    if ((give[r] ?? 0) > 0 && (receive[r] ?? 0) > 0) return false;
  }
  for (const bag of [give, receive]) {
    for (const r of RESOURCES) {
      if ((bag[r] ?? 0) < 0) return false;
    }
  }
  return true;
}

function tradeOffer(prev: GameState, action: Extract<GameAction, { type: 'tradeOffer' }>): ActionResult {
  if (prev.phase !== 'turnMain') return fail('NOT_TRADE_PHASE');
  const seat = prev.activeSeat;
  if (!validTradeAmounts(action.give, action.receive)) return fail('INVALID_TRADE');
  const p = prev.players[seat]!;
  for (const r of RESOURCES) {
    if ((action.give[r] ?? 0) > p.resources[r]) return fail('OFFER_UNAFFORDABLE');
  }
  const state = cloneState(prev);
  const id = `t${state.version}`;
  state.trades.push({
    id,
    proposer: seat,
    give: { ...action.give },
    receive: { ...action.receive },
    status: 'open',
    counterOf: null,
    declinedBy: [],
  });
  const events: GameEvent[] = [
    { type: 'tradeOffered', offerId: id, proposer: seat, give: fillBag(action.give), receive: fillBag(action.receive) },
  ];
  return ok(state, events);
}

function tradeCounter(prev: GameState, action: Extract<GameAction, { type: 'tradeCounter' }>): ActionResult {
  if (prev.phase !== 'turnMain') return fail('NOT_TRADE_PHASE');
  const target = prev.trades.find((t) => t.id === action.offerId);
  if (target === undefined || target.status !== 'open') return fail('OFFER_NOT_OPEN');
  const seat = action.seat !== undefined ? action.seat : prev.activeSeat;
  if (target.proposer === seat) return fail('CANNOT_COUNTER_OWN_OFFER');
  if (!validTradeAmounts(action.give, action.receive)) return fail('INVALID_TRADE');
  // The countering player must afford what they offer.
  const p = prev.players[seat];
  if (p === undefined) return fail('NO_SUCH_PLAYER');
  for (const r of RESOURCES) {
    if ((action.give[r] ?? 0) > p.resources[r]) return fail('OFFER_UNAFFORDABLE');
  }
  const state = cloneState(prev);
  const id = `t${state.version}`;
  state.trades.push({
    id,
    proposer: seat,
    give: { ...action.give },
    receive: { ...action.receive },
    status: 'open',
    counterOf: action.offerId,
    declinedBy: [],
  });
  const events: GameEvent[] = [
    { type: 'tradeCountered', offerId: id, counterOf: action.offerId, proposer: seat, give: fillBag(action.give), receive: fillBag(action.receive) },
  ];
  return ok(state, events);
}

function tradeRespond(prev: GameState, action: Extract<GameAction, { type: 'tradeRespond' }>): ActionResult {
  if (prev.phase !== 'turnMain') return fail('NOT_TRADE_PHASE');
  const offer = prev.trades.find((t) => t.id === action.offerId);
  if (offer === undefined || offer.status !== 'open') return fail('OFFER_NOT_OPEN');
  const seat = action.seat !== undefined ? action.seat : prev.activeSeat;
  if (offer.proposer === seat) return fail('CANNOT_SELF_TRADE');
  // Trades are always between the active player and someone else: the active
  // player's offers are answered by others, counter-offers by the active player.
  if (offer.proposer !== prev.activeSeat && seat !== prev.activeSeat) return fail('NOT_TRADE_PARTY');

  if (action.response === 'decline') {
    const state = cloneState(prev);
    const t = state.trades.find((x) => x.id === action.offerId)!;
    if (!t.declinedBy.includes(seat)) t.declinedBy.push(seat);
    return ok(state, [{ type: 'tradeDeclined', offerId: action.offerId, responder: seat }]);
  }

  // Accept: execute between offer.proposer (gives offer.give) and seat.
  const proposer = prev.players[offer.proposer]!;
  const accepter = prev.players[seat];
  if (accepter === undefined) return fail('NO_SUCH_PLAYER');
  for (const r of RESOURCES) {
    if ((offer.give[r] ?? 0) > proposer.resources[r]) return fail('OFFER_STALE');
    if ((offer.receive[r] ?? 0) > accepter.resources[r]) return fail('CANNOT_PAY_ACCEPT');
  }
  const state = cloneState(prev);
  const pr = state.players[offer.proposer]!;
  const ac = state.players[seat]!;
  for (const r of RESOURCES) {
    pr.resources[r] -= offer.give[r] ?? 0;
    pr.resources[r] += offer.receive[r] ?? 0;
    ac.resources[r] -= offer.receive[r] ?? 0;
    ac.resources[r] += offer.give[r] ?? 0;
  }
  // Close the whole negotiation thread: the root offer and every counter to it.
  const root = offer.counterOf ?? offer.id;
  for (const t of state.trades) {
    if (t.id === action.offerId) t.status = 'completed';
    else if (t.status === 'open' && (t.id === root || t.counterOf === root)) t.status = 'cancelled';
  }
  const events: GameEvent[] = [
    { type: 'tradeCompleted', offerId: action.offerId, from: offer.proposer, to: seat, give: fillBag(offer.give), receive: fillBag(offer.receive) },
  ];
  return ok(state, events);
}

function tradeCancel(prev: GameState, action: Extract<GameAction, { type: 'tradeCancel' }>): ActionResult {
  const offer = prev.trades.find((t) => t.id === action.offerId);
  if (offer === undefined || offer.status !== 'open') return fail('OFFER_NOT_OPEN');
  if (offer.proposer !== prev.activeSeat) return fail('NOT_YOUR_OFFER');
  const state = cloneState(prev);
  const t = state.trades.find((x) => x.id === action.offerId)!;
  t.status = 'cancelled';
  return ok(state, [{ type: 'tradeCancelled', offerId: action.offerId, by: prev.activeSeat }]);
}

function fillBag(partial: Partial<ResourceBag>): Record<Resource, number> {
  return {
    wood: partial.wood ?? 0,
    brick: partial.brick ?? 0,
    sheep: partial.sheep ?? 0,
    wheat: partial.wheat ?? 0,
    ore: partial.ore ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Turn lifecycle
// ---------------------------------------------------------------------------

function endTurn(prev: GameState): ActionResult {
  if (prev.phase !== 'turnMain' && prev.phase !== 'turnPreroll') {
    return fail('NOT_YOUR_TURN_END');
  }
  const seat = prev.activeSeat;
  const state = cloneState(prev);

  const events: GameEvent[] = [{ type: 'turnEnded', seat }];
  state.trades = state.trades.map((t) =>
    t.status === 'open' ? { ...t, status: 'cancelled' as const } : t,
  );
  state.dice = null;
  state.devCardPlayedThisTurn = false;
  state.merchantSeat = null;

  // 5-6p: enter the special build sequence before the next turn. Windows
  // auto-advance clockwise; each non-active seat may build once per round.
  if (state.playerCount >= 5) {
    state.specialBuild = { seat: null, usedThisRound: {} };
    state.phase = 'specialBuild';
    return sbNext(state, events);
  }

  advanceTurn(state, events);
  return ok(state, events);
}

function specialBuildActivate(
  prev: GameState,
  action: Extract<GameAction, { type: 'specialBuildActivate' }>,
): ActionResult {
  // Windows open automatically (sbNext); activation re-asserts the current
  // window owner — the server validates socket seat == action.seat first.
  if (prev.phase !== 'specialBuild') return fail('NOT_SB_TIME');
  const sb = prev.specialBuild;
  if (sb === null) return fail('NO_SB_STATE');
  if (action.seat !== sb.seat) return fail('NOT_YOUR_WINDOW');
  return ok(cloneState(prev), []);
}

function specialBuildDone(prev: GameState): ActionResult {
  if (prev.phase !== 'specialBuild') return fail('NOT_SB');
  const sb = prev.specialBuild;
  if (sb === null) return fail('NO_SB_STATE');
  if (sb.seat === null) {
    // Queue idle: auto-pass to the next eligible seat or finish the phase.
    return sbNext(prev, []);
  }
  const state = cloneState(prev);
  state.specialBuild = {
    ...sb,
    seat: null,
    usedThisRound: { ...sb.usedThisRound, [sb.seat]: true },
  };
  const events: GameEvent[] = [{ type: 'specialBuildDone', seat: sb.seat }];
  return sbNext(state, events);
}

/** Advance the specialBuild window to the next eligible seat or end phase. */
function sbNext(state: GameState, events: GameEvent[]): ActionResult {
  const order = seatQueueForSb(state);
  const nextSeat = order.find((s) => state.specialBuild!.usedThisRound[s] !== true);
  if (nextSeat !== undefined) {
    state.specialBuild = { ...state.specialBuild!, seat: nextSeat };
    events.push({ type: 'specialBuildActivated', seat: nextSeat });
    return ok(state, events);
  }
  // All windows used or passed — start the next turn.
  state.specialBuild = null;
  advanceTurn(state, events);
  return ok(state, events);
}

/** Clockwise seats eligible for a special-build window after the turn ends. */
function seatQueueForSb(state: GameState): number[] {
  const out: number[] = [];
  for (let i = 1; i < state.playerCount; i++) {
    out.push((state.activeSeat + i) % state.playerCount);
  }
  return out;
}

function advanceTurn(state: GameState, events: GameEvent[]): void {
  const nextSeat = (state.activeSeat + 1) % state.playerCount;
  // Reset SB usage when the round wraps back to seat 0's turn start.
  if (nextSeat === 0 && state.specialBuild === null) {
    // usedThisRound resets when each player's OWN turn ends — handled by
    // clearing on endTurn of the last seat; simple full reset on wrap:
    state.specialBuild = null;
  }
  state.activeSeat = nextSeat;
  state.turn += 1;
  state.phase = 'turnPreroll';
  state.devCardPlayedThisTurn = false;
  state.merchantSeat = null;

  if (state.fortifiedUntilTurn) {
    for (const [stStr, expTurn] of Object.entries(state.fortifiedUntilTurn)) {
      if (state.turn >= expTurn) {
        delete state.fortifiedUntilTurn[Number(stStr)];
      }
    }
  }

  events.push({ type: 'turnStarted', seat: nextSeat, turn: state.turn });
}

// ---------------------------------------------------------------------------
// Awards & victory
// ---------------------------------------------------------------------------

function recomputeLongestRoad(state: GameState, events: GameEvent[]): void {
  const players = state.players.map((p) => ({ seat: p.seat, roads: Object.keys(state.roads).filter((e) => state.roads[e] === p.seat) }));
  const buildings = new Map<VertexId, number>();
  for (const [v, b] of Object.entries(state.buildings)) {
    buildings.set(Number(v), b.seat);
  }
  const prevHolder = state.longestRoad.holder;
  const award = computeLongestRoadAward(
    state.longestRoad,
    players,
    buildings,
    state.board.topology,
  );
  const changed = award.holder !== prevHolder;
  state.longestRoad = award;
  if (changed) {
    events.push({ type: 'longestRoadChanged', from: prevHolder, to: award.holder, length: award.length });
  }
}

function recomputeLargestArmy(state: GameState, events: GameEvent[]): void {
  const prevHolder = state.largestArmy.holder;
  const prevKnights = state.largestArmy.knights;
  let bestSeat: number | null = null;
  let bestKnights = 3; // minimum to claim
  for (const p of state.players) {
    if (p.playedKnights >= bestKnights) {
      if (p.playedKnights > bestKnights || bestSeat === null) {
        // Strictly greater steals; ties keep the current holder.
        if (p.playedKnights > bestKnights || prevHolder === null) {
          bestSeat = p.seat;
          bestKnights = p.playedKnights;
        }
      }
    }
  }
  // Holder keeps award on ties.
  if (prevHolder !== null) {
    const holderKnights = state.players[prevHolder]?.playedKnights ?? 0;
    let beaten = false;
    for (const p of state.players) {
      if (p.seat !== prevHolder && p.playedKnights > holderKnights) {
        beaten = true;
        bestSeat = p.seat;
        bestKnights = p.playedKnights;
      }
    }
    if (!beaten) {
      bestSeat = prevHolder;
      bestKnights = holderKnights;
    }
  }
  if (bestSeat !== null && (bestSeat !== prevHolder || bestKnights !== prevKnights)) {
    state.largestArmy = { holder: bestSeat, knights: bestKnights };
    if (bestSeat !== prevHolder) {
      events.push({ type: 'largestArmyChanged', from: prevHolder, to: bestSeat, knights: bestKnights });
    }
  }
}

function maybeWin(state: GameState, events: GameEvent[]): void {
  // A player wins on their own turn (never during setup or someone's special build).
  if (state.phase === 'specialBuild' || state.phase === 'finished') return;
  if (state.phase === 'setupForward' || state.phase === 'setupReverse') return;
  const seat = state.activeSeat;
  const vp = totalVp(state, seat);
  if (vp >= state.rules.victoryPointsToWin) {
    state.phase = 'finished';
    state.winner = seat;
    // Reveal all VP cards of the winner (revealed cards keep counting via publicVp).
    for (const c of state.players[seat]!.devHand) {
      if (c.type === 'victoryPoint') c.played = true;
    }
    events.push({ type: 'victory', seat, vp });
  }
}

function ok(state: GameState, events: GameEvent[]): ActionResult {
  return { ok: true, state, events };
}
