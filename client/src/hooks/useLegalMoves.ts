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
import type { GameAction } from '@catan/shared';

export interface LegalMoves {
  settlementVertices: Set<number>;
  cityVertices: Set<number>;
  roadEdges: Set<string>;
  canBuyDev: boolean;
  setupVertices: Set<number>;
  setupRoadsForVertex: (vertex: number) => string[];
}

export function useLegalMoves(snap: PersonalSnapshot, mySeat: number): LegalMoves {
  return useMemo(() => {
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
      };
    }

    const engineState = toEngineSnapshot(snap);
    return {
      settlementVertices: new Set(legalSettlementVertices(engineState, mySeat, false)),
      cityVertices: new Set(legalCityVertices(engineState, mySeat)),
      roadEdges: new Set(legalRoadEdges(engineState, mySeat)),
      canBuyDev: playerCanBuyDev(engineState, mySeat),
      setupVertices: new Set(),
      setupRoadsForVertex: () => [],
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
    devDeck: [],
    devDeckIndex: snap.devDeckCount,
    trades: snap.trades,
    pendingDiscards: snap.pendingDiscards,
    specialBuild: snap.specialBuildSeat === null ? null : { seat: snap.specialBuildSeat, usedThisRound: {} },
    setupCursor: 0,
    longestRoad: snap.longestRoad,
    largestArmy: snap.largestArmy,
    winner: snap.winner,
    devCardPlayedThisTurn: false,
    version: snap.version,
  } as never;
}

export type { GameAction };
