// Server Bot AI engine: decision making for AI-controlled seats across all phases.
// Fully rules-compliant, server-authoritative, deterministic, and 100% offline-compatible (<1ms).
// Architecture: Goal-Oriented Action Planning (GOAP) + BFS Road Routing + Proactive & Kingmaker-safe Trading.

import type {
  EdgeId,
  GameAction,
  GameState,
  HexId,
  Resource,
  Rng,
  VertexId,
} from '@catan/shared';
import {
  bestTradeRate,
  BUILD_COSTS,
  canAfford,
  canPlaceRoad,
  canPlaceSetupRoad,
  legalCityVertices,
  legalRoadEdges,
  legalRobberHexes,
  legalSettlementVertices,
  PIPS,
  publicVp,
  RESOURCES,
  stealCandidates,
  TERRAIN_RESOURCE,
  totalVp,
  vertexRespectsDistanceRule,
} from '@catan/shared';

export const BOT_NAMES = [
  'Bot Alice',
  'Bot Bob',
  'Bot Charlie',
  'Bot Diana',
  'Bot Ethan',
  'Bot Fiona',
  'Bot George',
  'Bot Hana',
] as const;

function totalResources(bag: Record<Resource, number>): number {
  return bag.wood + bag.brick + bag.sheep + bag.wheat + bag.ore;
}

/** Score a vertex for settlement placement based on adjacent hex pips, terrain diversity, and harbors. */
function scoreVertex(state: GameState, vertex: VertexId): number {
  let score = 0;
  const hexes = state.board.topology.vertexHexes[vertex] ?? [];
  const resourcesSeen = new Set<Resource>();

  for (const h of hexes) {
    const hexData = state.board.hexes[h];
    if (hexData === undefined) continue;
    const res = TERRAIN_RESOURCE[hexData.terrain];
    if (res === null) continue;
    resourcesSeen.add(res);
    const pips = hexData.token !== null ? (PIPS[hexData.token] ?? 0) : 0;
    score += pips * 2.2;
  }

  // Bonus for resource variety (e.g. 3 different resources is great!)
  score += resourcesSeen.size * 3.5;

  // Bonus if on a harbor edge
  const edges = state.board.topology.vertexEdges[vertex] ?? [];
  for (const e of edges) {
    if (state.board.harbors[e] !== undefined) {
      score += 2.0;
      break;
    }
  }

  return score;
}

/** Score a hex for robber placement. Highly penalize own hexes; reward leaders' high-pip tiles. */
function scoreRobberHex(state: GameState, botSeat: number, hex: HexId): number {
  if (hex === state.robber) return -9999;
  const hexData = state.board.hexes[hex];
  if (hexData === undefined || hexData.terrain === 'desert') return -500;

  const pips = hexData.token !== null ? (PIPS[hexData.token] ?? 0) : 0;
  const score = pips * 2;

  const vertices = state.board.topology.hexVertices[hex] ?? [];
  let touchesBot = false;
  let opponentScore = 0;

  for (const v of vertices) {
    const b = state.buildings[v];
    if (b === undefined) continue;
    if (b.seat === botSeat) {
      touchesBot = true;
    } else {
      const oppVp = publicVp(state, b.seat);
      opponentScore += (b.type === 'city' ? 6 : 3) * (oppVp + 1);
    }
  }

  if (touchesBot) return -1000;
  return score + opponentScore;
}

// ---------------------------------------------------------------------------
// BFS Road Graph Pathfinding
// ---------------------------------------------------------------------------

/**
 * Breadth-First Search: finds the shortest sequence of unbuilt edges from the bot's
 * road/building network to `targetVertex`.
 * Returns [] if the bot already touches targetVertex.
 * Returns null if targetVertex is unreachable or blocked by opponent settlements.
 */
function bfsShortestRoadPath(
  state: GameState,
  botSeat: number,
  targetVertex: VertexId,
): EdgeId[] | null {
  const topology = state.board.topology;

  // Collect all vertices connected to bot's road/building network
  const startVertices = new Set<VertexId>();
  for (const [vStr, b] of Object.entries(state.buildings)) {
    if (b.seat === botSeat) {
      startVertices.add(Number(vStr));
    }
  }
  for (const [eStr, roadSeat] of Object.entries(state.roads)) {
    if (roadSeat === botSeat) {
      const endpoints = topology.edgeEndpoints[eStr];
      if (endpoints !== undefined) {
        const [v1, v2] = endpoints;
        const b1 = state.buildings[v1];
        if (b1 === undefined || b1.seat === botSeat) startVertices.add(v1);
        const b2 = state.buildings[v2];
        if (b2 === undefined || b2.seat === botSeat) startVertices.add(v2);
      }
    }
  }

  if (startVertices.has(targetVertex)) {
    return []; // Already reached!
  }

  const queue: Array<{ vertex: VertexId; path: EdgeId[] }> = [];
  const visited = new Set<VertexId>();

  for (const sv of startVertices) {
    visited.add(sv);
    queue.push({ vertex: sv, path: [] });
  }

  while (queue.length > 0) {
    const { vertex, path } = queue.shift()!;
    if (path.length >= 6) continue; // Cap search depth

    const edges = topology.vertexEdges[vertex] ?? [];
    for (const eid of edges) {
      const existingRoad = state.roads[eid];
      const endpoints = topology.edgeEndpoints[eid];
      if (endpoints === undefined) continue;
      const [v1, v2] = endpoints;
      const nextV = v1 === vertex ? v2 : v1;

      if (existingRoad !== undefined) {
        // Traverse existing own road for free if endpoint not visited
        if (existingRoad === botSeat && !visited.has(nextV)) {
          const b = state.buildings[nextV];
          if (b === undefined || b.seat === botSeat) {
            visited.add(nextV);
            if (nextV === targetVertex) return path;
            queue.push({ vertex: nextV, path });
          }
        }
        continue;
      }

      // Edge is unbuilt
      if (nextV === targetVertex) {
        return [...path, eid];
      }

      if (visited.has(nextV)) continue;

      // Opponent settlement/city blocks passing through
      const b = state.buildings[nextV];
      if (b !== undefined && b.seat !== botSeat) continue;

      visited.add(nextV);
      queue.push({ vertex: nextV, path: [...path, eid] });
    }
  }

  return null;
}

export interface SettlementCandidate {
  vertex: VertexId;
  score: number;
  path: EdgeId[];
}

/** Rank all valid unbuilt settlement locations on the board by production potential and BFS distance. */
function findBestSettlementCandidates(
  state: GameState,
  botSeat: number,
): SettlementCandidate[] {
  const candidates: SettlementCandidate[] = [];
  const topology = state.board.topology;
  const p = state.players[botSeat]!;

  // Measure bot's current resource production
  const currentProduction: Record<Resource, number> = {
    wood: 0,
    brick: 0,
    sheep: 0,
    wheat: 0,
    ore: 0,
  };

  for (const [vStr, b] of Object.entries(state.buildings)) {
    if (b.seat === botSeat) {
      const v = Number(vStr);
      const mult = b.type === 'city' ? 2 : 1;
      for (const h of topology.vertexHexes[v] ?? []) {
        const hex = state.board.hexes[h];
        if (hex && hex.token !== null && hex.terrain !== 'desert') {
          const res = TERRAIN_RESOURCE[hex.terrain];
          if (res) currentProduction[res] += (PIPS[hex.token] ?? 0) * mult;
        }
      }
    }
  }

  for (const v of topology.vertices) {
    if (!vertexRespectsDistanceRule(state, v)) continue;

    const path = bfsShortestRoadPath(state, botSeat, v);
    if (path === null) continue;
    if (path.length > p.roadsLeft) continue;

    let score = 0;
    const resourcesSeen = new Set<Resource>();

    for (const h of topology.vertexHexes[v] ?? []) {
      const hex = state.board.hexes[h];
      if (hex && hex.token !== null && hex.terrain !== 'desert') {
        const res = TERRAIN_RESOURCE[hex.terrain];
        if (res) {
          resourcesSeen.add(res);
          const pips = PIPS[hex.token] ?? 0;
          score += pips * 2.5;

          // Diversity bonus: extra weight for resource types bot currently lacks
          if (currentProduction[res] === 0) {
            score += 7.0;
          } else if (currentProduction[res] < 4) {
            score += 3.0;
          }
        }
      }
    }

    score += resourcesSeen.size * 3.0;

    // Harbor bonus
    for (const eid of topology.vertexEdges[v] ?? []) {
      const harbor = state.board.harbors[eid];
      if (harbor) {
        if (harbor.type === 'generic') {
          score += 3.5;
        } else if (harbor.resource) {
          if (currentProduction[harbor.resource] >= 4) {
            score += 8.0;
          } else {
            score += 3.0;
          }
        }
      }
    }

    // Road distance penalty / ready bonus
    if (path.length === 0) {
      score += 7.0; // Ready to build immediately!
    } else {
      score -= path.length * 3.5;
    }

    candidates.push({ vertex: v, score, path });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/** Rank existing settlements for city upgrades based on production value (especially ore & wheat). */
function findBestCityVertex(state: GameState, botSeat: number): VertexId | null {
  const p = state.players[botSeat]!;
  if (p.citiesLeft <= 0) return null;

  const candidateVertices: VertexId[] = [];
  for (const [vStr, b] of Object.entries(state.buildings)) {
    if (b.seat === botSeat && b.type === 'settlement') {
      candidateVertices.push(Number(vStr));
    }
  }
  if (candidateVertices.length === 0) return null;

  const topology = state.board.topology;
  let bestVertex = candidateVertices[0]!;
  let bestScore = -Infinity;

  for (const v of candidateVertices) {
    let score = 0;
    for (const h of topology.vertexHexes[v] ?? []) {
      const hex = state.board.hexes[h];
      if (hex && hex.token !== null && hex.terrain !== 'desert') {
        const pips = PIPS[hex.token] ?? 0;
        const res = TERRAIN_RESOURCE[hex.terrain];
        if (res === 'ore' || res === 'wheat') {
          score += pips * 3.5;
        } else {
          score += pips * 2.0;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestVertex = v;
    }
  }

  return bestVertex;
}

// ---------------------------------------------------------------------------
// Goal-Oriented Action Planning (GOAP)
// ---------------------------------------------------------------------------

interface BotGoal {
  type: 'win' | 'city' | 'settlement' | 'road' | 'devCard';
  cost: Partial<Record<Resource, number>>;
  targetVertex?: VertexId;
  targetEdge?: EdgeId;
}

function determineBotGoal(state: GameState, botSeat: number): BotGoal {
  const p = state.players[botSeat]!;
  const myTotalVp = totalVp(state, botSeat);
  const targetVp = state.rules.victoryPointsToWin;

  // 1. WIN NOW: Prioritize whatever action secures the final victory point
  if (myTotalVp + 1 >= targetVp) {
    if (p.citiesLeft > 0) {
      const bestCity = findBestCityVertex(state, botSeat);
      if (bestCity !== null) {
        return { type: 'win', cost: BUILD_COSTS.city, targetVertex: bestCity };
      }
    }
    if (p.settlementsLeft > 0) {
      const candidates = findBestSettlementCandidates(state, botSeat);
      const ready = candidates.find((c) => c.path.length === 0);
      if (ready !== undefined) {
        return { type: 'win', cost: BUILD_COSTS.settlement, targetVertex: ready.vertex };
      }
    }
    if (state.devDeckIndex < state.devDeck.length) {
      return { type: 'win', cost: BUILD_COSTS.devCard };
    }
  }

  const bestCity = findBestCityVertex(state, botSeat);
  const candidates = findBestSettlementCandidates(state, botSeat);
  const readySettlement = candidates.find((c) => c.path.length === 0);

  // 2. BUILD SETTLEMENT if road already reaches an open spot
  if (readySettlement !== undefined && p.settlementsLeft > 0) {
    const oreWheatCount = p.resources.ore + p.resources.wheat;
    const woodBrickCount = p.resources.wood + p.resources.brick;
    // If bot has ore & wheat abundance, city may take precedence
    if (bestCity !== null && p.citiesLeft > 0 && oreWheatCount >= 3 && woodBrickCount < 2) {
      return { type: 'city', cost: BUILD_COSTS.city, targetVertex: bestCity };
    }
    return { type: 'settlement', cost: BUILD_COSTS.settlement, targetVertex: readySettlement.vertex };
  }

  // 3. UPGRADE TO CITY if settlements exist and cities available
  if (bestCity !== null && p.citiesLeft > 0) {
    return { type: 'city', cost: BUILD_COSTS.city, targetVertex: bestCity };
  }

  // 4. EXPAND ROAD TOWARDS BEST SETTLEMENT
  if (candidates.length > 0 && p.settlementsLeft > 0 && p.roadsLeft > 0) {
    const bestTarget = candidates[0]!;
    if (bestTarget.path.length > 0) {
      return {
        type: 'road',
        cost: BUILD_COSTS.road,
        targetVertex: bestTarget.vertex,
        targetEdge: bestTarget.path[0],
      };
    }
  }

  // 5. BUY DEV CARD
  if (state.devDeckIndex < state.devDeck.length) {
    return { type: 'devCard', cost: BUILD_COSTS.devCard };
  }

  return { type: 'road', cost: BUILD_COSTS.road };
}

function getMissingAndSurplus(
  hand: Record<Resource, number>,
  cost: Partial<Record<Resource, number>>,
): {
  missing: Resource[];
  missingCount: number;
  surplus: Partial<Record<Resource, number>>;
  surplusResList: Resource[];
} {
  const missing: Resource[] = [];
  let missingCount = 0;
  const surplus: Partial<Record<Resource, number>> = {};
  const surplusResList: Resource[] = [];

  for (const r of RESOURCES) {
    const needed = (cost[r] ?? 0) - (hand[r] ?? 0);
    if (needed > 0) {
      for (let i = 0; i < needed; i++) missing.push(r);
      missingCount += needed;
    } else {
      const extra = (hand[r] ?? 0) - (cost[r] ?? 0);
      if (extra > 0) {
        surplus[r] = extra;
        surplusResList.push(r);
      }
    }
  }

  surplusResList.sort((a, b) => (surplus[b] ?? 0) - (surplus[a] ?? 0));
  return { missing, missingCount, surplus, surplusResList };
}

// ---------------------------------------------------------------------------
// Main Bot Action Computation
// ---------------------------------------------------------------------------

/** Determine the next action for a bot in the given game state. */
export function computeBotAction(
  state: GameState,
  botSeat: number,
  rng: Rng,
): GameAction | null {
  // 1. DISCARD PHASE: Discard surplus resources furthest from current goal
  if (state.phase === 'discard') {
    const pending = state.pendingDiscards.find((d) => d.seat === botSeat && !d.received);
    if (pending === undefined) return null;

    const p = state.players[botSeat]!;
    const toDiscard: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    let needed = pending.count;

    const goal = determineBotGoal(state, botSeat);
    const { surplusResList } = getMissingAndSurplus(p.resources, goal.cost);

    // Discard surplus first, then resources with highest quantities
    const discardOrder = [
      ...surplusResList,
      ...[...RESOURCES].sort((a, b) => p.resources[b] - p.resources[a]),
    ];
    const uniqueOrder = [...new Set(discardOrder)];

    for (const r of uniqueOrder) {
      const take = Math.min(p.resources[r] - toDiscard[r], needed);
      if (take > 0) {
        toDiscard[r] += take;
        needed -= take;
      }
      if (needed === 0) break;
    }

    return { type: 'discard', seat: botSeat, resources: toDiscard };
  }

  // 2. OPEN TRADES: Evaluate and respond (or cancel own unaccepted offer)
  if (state.phase === 'turnMain' && state.trades.some((t) => t.status === 'open')) {
    const openTrade = state.trades.find((t) => {
      if (t.status !== 'open') return false;
      if (t.counterOf !== null) {
        return state.activeSeat === botSeat && !t.declinedBy.includes(botSeat);
      }
      return t.proposer !== botSeat && !t.declinedBy.includes(botSeat);
    });

    if (openTrade !== undefined) {
      const p = state.players[botSeat]!;
      const canAffordGive = RESOURCES.every(
        (r) => (openTrade.receive[r] ?? 0) <= p.resources[r],
      );

      if (!canAffordGive) {
        return { type: 'tradeRespond', offerId: openTrade.id, response: 'decline', seat: botSeat };
      }

      // Proposer VP check - Kingmaker Prevention!
      const proposerVp = publicVp(state, openTrade.proposer);
      const targetVp = state.rules.victoryPointsToWin;

      // Never trade with a player who is 1 VP away from winning unless this trade immediately wins the game for the bot
      if (proposerVp >= targetVp - 1) {
        return { type: 'tradeRespond', offerId: openTrade.id, response: 'decline', seat: botSeat };
      }

      const receivesCount = RESOURCES.reduce((s, r) => s + (openTrade.give[r] ?? 0), 0);
      const givesCount = RESOURCES.reduce((s, r) => s + (openTrade.receive[r] ?? 0), 0);

      const goal = determineBotGoal(state, botSeat);
      const { missing, surplus } = getMissingAndSurplus(p.resources, goal.cost);

      const givesNeeded = RESOURCES.some((r) => (openTrade.give[r] ?? 0) > 0 && missing.includes(r));
      const depletesGoal = RESOURCES.some((r) => {
        const ask = openTrade.receive[r] ?? 0;
        if (ask === 0) return false;
        const extra = surplus[r] ?? 0;
        return ask > extra;
      });

      // 1. Accept if it supplies a missing goal resource without hurting our goal
      if (givesNeeded && !depletesGoal) {
        return { type: 'tradeRespond', offerId: openTrade.id, response: 'accept', seat: botSeat };
      }

      // 2. Accept if fair surplus exchange (receives >= gives) with a non-leader
      if (!depletesGoal && receivesCount >= givesCount && receivesCount > 0 && proposerVp <= targetVp - 3) {
        return { type: 'tradeRespond', offerId: openTrade.id, response: 'accept', seat: botSeat };
      }

      return { type: 'tradeRespond', offerId: openTrade.id, response: 'decline', seat: botSeat };
    }
  }

  // 3. SPECIAL BUILD PHASE (5+ players)
  if (state.phase === 'specialBuild') {
    if (state.specialBuild?.seat !== botSeat) return null;
    const p = state.players[botSeat]!;

    if (canAfford(p.resources, BUILD_COSTS.city) && p.citiesLeft > 0) {
      const bestCity = findBestCityVertex(state, botSeat);
      if (bestCity !== null) return { type: 'buildCity', vertex: bestCity };
    }

    if (canAfford(p.resources, BUILD_COSTS.settlement) && p.settlementsLeft > 0) {
      const settlements = legalSettlementVertices(state, botSeat, false);
      if (settlements.length > 0) {
        const candidates = findBestSettlementCandidates(state, botSeat);
        const bestLegal = candidates.find((c) => settlements.includes(c.vertex))?.vertex ?? settlements[0]!;
        return { type: 'buildSettlement', vertex: bestLegal };
      }
    }

    if (canAfford(p.resources, BUILD_COSTS.road) && p.roadsLeft > 0) {
      const roads = legalRoadEdges(state, botSeat);
      if (roads.length > 0 && p.settlementsLeft > 0) {
        const candidates = findBestSettlementCandidates(state, botSeat);
        if (candidates.length > 0 && candidates[0]!.path.length > 0) {
          const nextRoad = candidates[0]!.path[0]!;
          if (roads.includes(nextRoad)) return { type: 'buildRoad', edge: nextRoad };
        }
        return { type: 'buildRoad', edge: rng.pick(roads) };
      }
    }

    if (canAfford(p.resources, BUILD_COSTS.devCard) && state.devDeckIndex < state.devDeck.length) {
      return { type: 'buyDevCard' };
    }

    return { type: 'specialBuildDone' };
  }

  // If it's not the bot's active turn, no further actions
  if (state.activeSeat !== botSeat) return null;

  // 4. SETUP PHASES
  if (state.phase === 'setupForward' || state.phase === 'setupReverse') {
    const legalVertices = legalSettlementVertices(state, botSeat, true);
    if (legalVertices.length === 0) return null;

    let bestVertex = legalVertices[0]!;
    let bestScore = -Infinity;
    for (const v of legalVertices) {
      const s = scoreVertex(state, v);
      if (s > bestScore) {
        bestScore = s;
        bestVertex = v;
      }
    }

    // Pick road extending toward the center of the board or another viable vertex
    const edges = state.board.topology.vertexEdges[bestVertex] ?? [];
    const validEdges = edges.filter((e) => canPlaceSetupRoad(state, botSeat, e, bestVertex));
    const chosenEdge = validEdges.length > 0 ? rng.pick(validEdges) : edges[0];
    if (chosenEdge === undefined) return null;

    return { type: 'setupPlace', settlementVertex: bestVertex, roadEdge: chosenEdge };
  }

  // 5. TURN PREROLL
  if (state.phase === 'turnPreroll') {
    const p = state.players[botSeat]!;

    // Alchemist: pick roll maximizing bot's resource production
    const alchemist = p.devHand.find((c) => c.type === 'alchemist' && !c.played && c.boughtOnTurn < state.turn);
    if (alchemist !== undefined && !state.devCardPlayedThisTurn) {
      let bestRoll = { die1: 3, die2: 4 };
      let maxYield = -1;
      for (let d1 = 1; d1 <= 6; d1++) {
        for (let d2 = 1; d2 <= 6; d2++) {
          const sum = d1 + d2;
          if (sum === 7) continue;
          let sumYield = 0;
          for (const hex of state.board.topology.hexes) {
            if (hex === state.robber || state.board.hexes[hex]!.token !== sum) continue;
            for (const v of state.board.topology.hexVertices[hex] ?? []) {
              const b = state.buildings[v];
              if (b?.seat === botSeat) sumYield += b.type === 'settlement' ? 1 : 2;
            }
          }
          if (sumYield > maxYield) {
            maxYield = sumYield;
            bestRoll = { die1: d1, die2: d2 };
          }
        }
      }
      return { type: 'playDevCard', cardId: alchemist.id, payload: { roll: bestRoll } };
    }

    // Knight: play before rolling if robber blocks bot's tile
    const knight = p.devHand.find((c) => c.type === 'knight' && !c.played && c.boughtOnTurn < state.turn);
    if (knight !== undefined && !state.devCardPlayedThisTurn) {
      const robberVertices = state.board.topology.hexVertices[state.robber] ?? [];
      const touchesBot = robberVertices.some((v) => state.buildings[v]?.seat === botSeat);
      if (touchesBot) {
        return { type: 'playDevCard', cardId: knight.id };
      }
    }

    return { type: 'rollDice' };
  }

  // 6. ROBBER MOVE
  if (state.phase === 'robberMove') {
    const hexes = legalRobberHexes(state);
    if (hexes.length === 0) return null;

    let bestHex = hexes[0]!;
    let bestScore = -Infinity;
    for (const h of hexes) {
      const s = scoreRobberHex(state, botSeat, h);
      if (s > bestScore) {
        bestScore = s;
        bestHex = h;
      }
    }

    return { type: 'moveRobber', hex: bestHex };
  }

  // 7. ROBBER STEAL
  if (state.phase === 'robberSteal') {
    const candidates = stealCandidates(state, state.robber);
    const withCards = candidates.filter((s) => totalResources(state.players[s]!.resources) > 0);
    const pool = withCards.length > 0 ? withCards : candidates;
    if (pool.length === 0) return null;

    // Target the opponent with highest public VP, breaking ties by card count
    let bestVictim = pool[0]!;
    let bestScore = -1;
    for (const s of pool) {
      const vp = publicVp(state, s);
      const cards = totalResources(state.players[s]!.resources);
      const score = vp * 10 + cards;
      if (score > bestScore) {
        bestScore = score;
        bestVictim = s;
      }
    }

    return { type: 'chooseSteal', victimSeat: bestVictim };
  }

  // 8. TURN MAIN: Dev cards, trading, building, bank trades, end turn
  if (state.phase === 'turnMain') {
    const p = state.players[botSeat]!;
    const goal = determineBotGoal(state, botSeat);
    const { missing, missingCount, surplus, surplusResList } = getMissingAndSurplus(p.resources, goal.cost);

    // Cancel own unaccepted open trade if computeBotAction was called again for this bot
    const myOpenTrade = state.trades.find((t) => t.status === 'open' && t.proposer === botSeat);
    if (myOpenTrade !== undefined) {
      return { type: 'tradeCancel', offerId: myOpenTrade.id };
    }

    // A. Tactical Dev Card Plays
    if (!state.devCardPlayedThisTurn) {
      // 1. Year of Plenty: fulfill exact missing goal resources
      const yop = p.devHand.find((c) => c.type === 'yearOfPlenty' && !c.played && c.boughtOnTurn < state.turn);
      if (yop !== undefined) {
        const needed: Resource[] = [];
        if (missing.length >= 2) {
          needed.push(missing[0]!, missing[1]!);
        } else if (missing.length === 1) {
          needed.push(missing[0]!);
          // Add a high-value resource (ore or wheat)
          needed.push(p.resources.ore < p.resources.wheat ? 'ore' : 'wheat');
        } else {
          // Lowest two resources
          const sorted = [...RESOURCES].sort((a, b) => p.resources[a] - p.resources[b]);
          needed.push(sorted[0]!, sorted[1]!);
        }
        return { type: 'playDevCard', cardId: yop.id, payload: { resources: needed } };
      }

      // 2. Monopoly: steal the resource held in greatest abundance by opponents
      const mono = p.devHand.find((c) => c.type === 'monopoly' && !c.played && c.boughtOnTurn < state.turn);
      if (mono !== undefined) {
        const oppTotals: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
        for (const other of state.players) {
          if (other.seat === botSeat) continue;
          for (const r of RESOURCES) oppTotals[r] += other.resources[r] ?? 0;
        }
        const bestMonoRes = [...RESOURCES].sort((a, b) => oppTotals[b] - oppTotals[a])[0]!;
        if (oppTotals[bestMonoRes] >= 2) {
          return { type: 'playDevCard', cardId: mono.id, payload: { resource: bestMonoRes } };
        }
      }

      // 3. Road Building: place along BFS path toward best settlement spot
      const rb = p.devHand.find((c) => c.type === 'roadBuilding' && !c.played && c.boughtOnTurn < state.turn);
      if (rb !== undefined && p.roadsLeft >= 2) {
        const candidates = findBestSettlementCandidates(state, botSeat);
        if (candidates.length > 0 && candidates[0]!.path.length >= 2) {
          const e1 = candidates[0]!.path[0]!;
          const e2 = candidates[0]!.path[1]!;
          return { type: 'playDevCard', cardId: rb.id, payload: { edges: [e1, e2] } };
        }
        const legalRoads = legalRoadEdges(state, botSeat, true);
        if (legalRoads.length >= 2) {
          return { type: 'playDevCard', cardId: rb.id, payload: { edges: [legalRoads[0]!, legalRoads[1]!] } };
        }
      }

      // 4. Knight: defensive unblock or offensive Largest Army takeover
      const knight = p.devHand.find((c) => c.type === 'knight' && !c.played && c.boughtOnTurn < state.turn);
      if (knight !== undefined) {
        const robberVertices = state.board.topology.hexVertices[state.robber] ?? [];
        const touchesBot = robberVertices.some((v) => state.buildings[v]?.seat === botSeat);
        const claimsArmy =
          state.largestArmy.holder !== botSeat &&
          p.playedKnights + 1 >= 3 &&
          p.playedKnights + 1 > (state.largestArmy.knights || 0);

        if (touchesBot || claimsArmy) {
          return { type: 'playDevCard', cardId: knight.id };
        }
      }

      // 5. Merchant
      const merchant = p.devHand.find((c) => c.type === 'merchant' && !c.played && c.boughtOnTurn < state.turn);
      if (merchant !== undefined) {
        return { type: 'playDevCard', cardId: merchant.id };
      }

      // 6. Tax Collector
      const tax = p.devHand.find((c) => c.type === 'taxCollector' && !c.played && c.boughtOnTurn < state.turn);
      if (tax !== undefined) {
        return { type: 'playDevCard', cardId: tax.id };
      }

      // 7. Bountiful Harvest
      const harvest = p.devHand.find((c) => c.type === 'bountifulHarvest' && !c.played && c.boughtOnTurn < state.turn);
      if (harvest !== undefined) {
        const counts: Record<string, number> = { forest: 0, hills: 0, pasture: 0, fields: 0, mountains: 0 };
        for (const hex of state.board.topology.hexes) {
          const t = state.board.hexes[hex]!.terrain;
          if (t === 'desert') continue;
          for (const v of state.board.topology.hexVertices[hex] ?? []) {
            if (state.buildings[v]?.seat === botSeat) counts[t] = (counts[t] ?? 0) + 1;
          }
        }
        const bestTerrain = (Object.keys(counts) as Array<keyof typeof counts>).reduce((best, t) =>
          (counts[t] ?? 0) > (counts[best] ?? 0) ? t : best, 'forest');
        return { type: 'playDevCard', cardId: harvest.id, payload: { terrain: bestTerrain as never } };
      }

      // 8. Fortification
      const fort = p.devHand.find((c) => c.type === 'fortification' && !c.played && c.boughtOnTurn < state.turn);
      if (fort !== undefined && totalResources(p.resources) >= 6) {
        return { type: 'playDevCard', cardId: fort.id };
      }

      // 9. Spy
      const spy = p.devHand.find((c) => c.type === 'spy' && !c.played && c.boughtOnTurn < state.turn);
      if (spy !== undefined) {
        const others = state.players.filter((o) => o.seat !== botSeat && totalResources(o.resources) > 0);
        if (others.length > 0) {
          const victim = others.sort((a, b) => totalResources(b.resources) - totalResources(a.resources))[0]!;
          const res = RESOURCES.find((r) => victim.resources[r] > 0) ?? 'wood';
          return { type: 'playDevCard', cardId: spy.id, payload: { victim: victim.seat, resource: res } };
        }
      }

      // 10. Oracle
      const oracle = p.devHand.find((c) => c.type === 'oracle' && !c.played && c.boughtOnTurn < state.turn);
      if (oracle !== undefined) {
        return { type: 'playDevCard', cardId: oracle.id };
      }
    }

    // B. Build City (High priority)
    if (canAfford(p.resources, BUILD_COSTS.city) && p.citiesLeft > 0) {
      const bestCity = findBestCityVertex(state, botSeat);
      if (bestCity !== null) {
        return { type: 'buildCity', vertex: bestCity };
      }
    }

    // C. Build Settlement
    if (canAfford(p.resources, BUILD_COSTS.settlement) && p.settlementsLeft > 0) {
      const settlements = legalSettlementVertices(state, botSeat, false);
      if (settlements.length > 0) {
        const candidates = findBestSettlementCandidates(state, botSeat);
        const bestLegal = candidates.find((c) => settlements.includes(c.vertex))?.vertex ?? settlements[0]!;
        return { type: 'buildSettlement', vertex: bestLegal };
      }
    }

    // D. Proactive Trading: Propose trade if 1 card away from completing goal
    const proposedThisTurn = state.trades.some(
      (t) => t.proposer === botSeat && (t.turn === state.turn || t.status === 'open'),
    );

    if (!proposedThisTurn && missingCount === 1 && surplusResList.length > 0) {
      const giveRes = surplusResList[0]!;
      const neededRes = missing[0]!;
      const giveAmount = (surplus[giveRes] ?? 0) >= 3 ? 2 : 1;
      return {
        type: 'tradeOffer',
        give: { [giveRes]: giveAmount },
        receive: { [neededRes]: 1 },
      };
    }

    // E. Bank Trading: Trade surplus to afford current goal
    if (missingCount > 0) {
      for (const neededRes of missing) {
        if (state.bank[neededRes] <= 0) continue;
        for (const giveRes of surplusResList) {
          if (giveRes === neededRes) continue;
          const rate = bestTradeRate(state, botSeat, giveRes);
          const extra = surplus[giveRes] ?? 0;
          if (p.resources[giveRes] >= rate && (extra >= rate || (goal.cost[giveRes] ?? 0) === 0)) {
            return { type: 'bankTrade', give: giveRes, receive: neededRes };
          }
        }
      }
    }

    // F. Build Road along BFS path to target settlement spot
    if (canAfford(p.resources, BUILD_COSTS.road) && p.roadsLeft > 0) {
      const legalRoads = legalRoadEdges(state, botSeat);
      if (legalRoads.length > 0 && p.settlementsLeft > 0) {
        const candidates = findBestSettlementCandidates(state, botSeat);
        if (candidates.length > 0 && candidates[0]!.path.length > 0) {
          const nextRoad = candidates[0]!.path[0]!;
          if (legalRoads.includes(nextRoad)) {
            return { type: 'buildRoad', edge: nextRoad };
          }
        }
        return { type: 'buildRoad', edge: rng.pick(legalRoads) };
      }
    }

    // G. Buy Dev Card
    if (canAfford(p.resources, BUILD_COSTS.devCard) && state.devDeckIndex < state.devDeck.length) {
      return { type: 'buyDevCard' };
    }

    // H. End Turn
    return { type: 'endTurn' };
  }

  return null;
}
