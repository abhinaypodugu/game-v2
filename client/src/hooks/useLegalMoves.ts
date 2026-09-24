// useLegalMoves: memoized legal-move queries against the current snapshot.
// Mirrors the engine's rules for client-side highlighting; the server
// revalidates everything anyway.

import { useMemo } from 'react';
import {
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  playerCanBuyDev,
} from '@catan/shared';
import type { PersonalSnapshot } from '../types';
import type { DevCardType, GameAction } from '@catan/shared';

export interface LegalMoves {
  settlementVertices: Set<number>;
  cityVertices: Set<number>;
  roadEdges: Set<string>;
  canBuyDev: boolean;
  setupVertices: Set<number>;
  setupRoadsForVertex: (vertex: number) => string[];
  /**
   * Road Building dev card: edges legal for a FREE road, treating `pending`
   * (picked but not yet sent) edges as already built.
   */
  freeRoadEdges: (pending: readonly string[]) => Set<string>;
}

const noFreeRoads = (): Set<string> => new Set<string>();

export function useLegalMoves(
  snap: PersonalSnapshot | null,
  mySeat: number,
): LegalMoves {
  return useMemo(() => {
    if (snap === null || mySeat < 0) {
      return {
        settlementVertices: new Set<number>(),
        cityVertices: new Set<number>(),
        roadEdges: new Set<string>(),
        canBuyDev: false,
        setupVertices: new Set<number>(),
        setupRoadsForVertex: () => [],
        freeRoadEdges: noFreeRoads,
      };
    }
    const setupPhase = snap.phase === 'setupForward' || snap.phase === 'setupReverse';
    const myTurn = snap.activeSeat === mySeat;
    const sbpTurn = snap.specialBuildSeat === mySeat;

    if (setupPhase && myTurn) {
      const vertices = legalSettlementVertices(
        toEngineSnapshot(snap),
        mySeat,
        true,
      );
      const setupRoadsForVertex = (vertex: number): string[] => {
        const engineState = toEngineSnapshot(snap);
        return (engineState.board.topology.vertexEdges[vertex] ?? []).filter(
          (e) => engineState.roads[e] === undefined,
        );
      };
      return {
        settlementVertices: new Set(vertices),
        cityVertices: new Set(),
        roadEdges: new Set(),
        canBuyDev: false,
        setupVertices: new Set(vertices),
        setupRoadsForVertex,
        freeRoadEdges: noFreeRoads,
      };
    }

    if (!myTurn && !sbpTurn) {
      return {
        settlementVertices: new Set(),
        cityVertices: new Set(),
        roadEdges: new Set(),
        canBuyDev: false,
        setupVertices: new Set(),
        setupRoadsForVertex: () => [],
        freeRoadEdges: noFreeRoads,
      };
    }

    const engineState = toEngineSnapshot(snap);
    const freeRoadEdges = (pending: readonly string[]): Set<string> => {
      const roads = { ...engineState.roads };
      for (const e of pending) roads[e] = mySeat;
      const players = engineState.players.map((p) =>
        p.seat === mySeat ? { ...p, roadsLeft: p.roadsLeft - pending.length } : p,
      );
      return new Set(legalRoadEdges({ ...engineState, roads, players }, mySeat, true));
    };
    return {
      settlementVertices: new Set(legalSettlementVertices(engineState, mySeat, false)),
      cityVertices: new Set(legalCityVertices(engineState, mySeat)),
      roadEdges: new Set(legalRoadEdges(engineState, mySeat)),
      canBuyDev: playerCanBuyDev(engineState, mySeat),
      setupVertices: new Set(),
      setupRoadsForVertex: () => [],
      freeRoadEdges,
    };
  }, [snap, mySeat]);
}

/**
 * The legal.ts queries read a full GameState; the sanitized snapshot lacks
 * hand details of other players, but legality only needs OUR hand + board
 * + public state — we reconstruct the minimal engine-shaped object.
 */
function toEngineSnapshot(snap: PersonalSnapshot): Parameters<typeof legalSettlementVertices>[0] {
  return {
    config: snap.config,
    playerCount: snap.playerCount,
    rules: snap.rules,
    players: snap.players.map((p, i) => ({
      seat: p.seat,
      name: p.name,
      color: p.color,
      resources:
        i === snap.you.seat
          ? snap.you.resources
          : { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }, // counts only
      devHand:
        i === snap.you.seat ? snap.you.devHand.map((c) => ({ id: c.id, type: c.type as never, boughtOnTurn: c.boughtOnTurn })) : [],
      playedKnights: p.playedKnights,
      connected: p.connected,
      roadsLeft: p.roadsLeft,
      settlementsLeft: p.settlementsLeft,
      citiesLeft: p.citiesLeft,
    })),
    board: snap.board,
    phase: snap.phase,
    activeSeat: snap.activeSeat,
    turn: snap.turn,
    dice: snap.dice,
    buildings: snap.buildings,
    roads: snap.roads,
    robber: snap.robber,
    bank: snap.bank,
    // Only the remaining count is public; a same-length placeholder deck keeps
    // `playerCanBuyDev`'s "cards left" check truthful.
    devDeck: new Array<DevCardType>(snap.devDeckCount).fill('knight'),
    devDeckIndex: 0,
    trades: snap.trades,
    pendingDiscards: snap.pendingDiscards,
    specialBuild: snap.specialBuildSeat === null ? null : { seat: snap.specialBuildSeat, usedThisRound: {} },
    setupCursor: 0,
    longestRoad: snap.longestRoad,
    largestArmy: snap.largestArmy,
    winner: snap.winner,
    devCardPlayedThisTurn: snap.devCardPlayedThisTurn,
    knightBeforeRoll: false,
    version: snap.version,
  } as never;
}

export type { GameAction };
