// Snapshot sanitizer: full GameState -> per-seat view. Hides other players'
// resource compositions and dev-card identities; keeps public counts.

import type { GameState } from '@catan/shared';
import { publicVp, totalVp } from '@catan/shared';
import type { Resource } from '@catan/shared';

export interface PublicPlayer {
  seat: number;
  name: string;
  color: string;
  resourceCount: number;
  devCardCount: number;
  playedKnights: number;
  connected: boolean;
  publicVp: number;
  roadsLeft: number;
  settlementsLeft: number;
  citiesLeft: number;
  isFortified?: boolean;
  spyResources?: Record<Resource, number>;
  totalVp?: number;
  resources?: Record<Resource, number>;
  devCards?: Array<{ id: string; type: string; played: boolean }>;
}

export interface OwnView {
  seat: number;
  resources: Record<Resource, number>;
  devHand: Array<{ id: string; type: string; boughtOnTurn: number; played: boolean }>;
  totalVp: number;
  oraclePreview?: Array<{ id: string; type: string }>;
}

export interface PersonalSnapshot {
  version: number;
  config: GameState['config'];
  playerCount: number;
  rules: GameState['rules'];
  phase: GameState['phase'];
  activeSeat: number;
  specialBuildSeat: number | null;
  turn: number;
  dice: { die1: number; die2: number } | null;
  board: GameState['board'];
  buildings: GameState['buildings'];
  roads: GameState['roads'];
  robber: GameState['robber'];
  bank: GameState['bank'];
  devDeckCount: number;
  trades: GameState['trades'];
  pendingDiscards: Array<{ seat: number; count: number; received: boolean }>;
  longestRoad: GameState['longestRoad'];
  largestArmy: GameState['largestArmy'];
  /** The active player already played a development card this turn. */
  devCardPlayedThisTurn: boolean;
  merchantSeat?: number | null;
  fortifiedSeats?: number[];
  winner: number | null;
  players: PublicPlayer[];
  you: OwnView;
}

function ownTotalVp(state: GameState, seat: number): number {
  return totalVp(state, seat);
}

export function sanitize(state: GameState, seat: number): PersonalSnapshot {
  const isFinished = state.winner !== null;
  const own = state.players[seat]!;
  const canSpy = seat === state.activeSeat && own.devHand.some((c) => c.type === 'spy' && !c.played);

  const fortifiedSeats = Object.keys(state.fortifiedUntilTurn ?? {})
    .map(Number)
    .filter((s) => state.turn < (state.fortifiedUntilTurn?.[s] ?? 0));

  const players: PublicPlayer[] = state.players.map((p) => {
    const resourceCount =
      p.resources.wood + p.resources.brick + p.resources.sheep + p.resources.wheat + p.resources.ore;
    const isFortified = fortifiedSeats.includes(p.seat);
    return {
      seat: p.seat,
      name: p.name,
      color: p.color,
      resourceCount,
      devCardCount: p.devHand.filter((c) => !c.played).length,
      playedKnights: p.playedKnights,
      connected: p.connected,
      publicVp: publicVp(state, p.seat),
      roadsLeft: p.roadsLeft,
      settlementsLeft: p.settlementsLeft,
      citiesLeft: p.citiesLeft,
      isFortified,
      ...(canSpy && p.seat !== seat ? { spyResources: { ...p.resources } } : {}),
      ...(isFinished
        ? {
            totalVp: totalVp(state, p.seat),
            resources: { ...p.resources },
            devCards: p.devHand.map((c) => ({ id: c.id, type: c.type, played: c.played === true })),
          }
        : {}),
    };
  });

  const canOracle = seat === state.activeSeat && own.devHand.some((c) => c.type === 'oracle' && !c.played);
  const oraclePreview = canOracle
    ? state.devDeck.slice(state.devDeckIndex, state.devDeckIndex + 3).map((c) => ({ id: c.id, type: c.type }))
    : undefined;

  return {
    version: state.version,
    config: state.config,
    playerCount: state.playerCount,
    rules: { ...state.rules },
    phase: state.phase,
    activeSeat: state.activeSeat,
    specialBuildSeat: state.specialBuild?.seat ?? null,
    turn: state.turn,
    dice: state.dice,
    board: state.board,
    buildings: state.buildings,
    roads: state.roads,
    robber: state.robber,
    bank: state.bank,
    devDeckCount: state.devDeck.length - state.devDeckIndex,
    trades: state.trades,
    pendingDiscards: state.pendingDiscards.map((d) => ({ ...d })),
    longestRoad: state.longestRoad,
    largestArmy: state.largestArmy,
    devCardPlayedThisTurn: state.devCardPlayedThisTurn,
    merchantSeat: state.merchantSeat ?? null,
    fortifiedSeats,
    winner: state.winner,
    players,
    you: {
      seat,
      resources: { ...own.resources },
      devHand: own.devHand
        .filter((c) => !c.played || c.type === 'victoryPoint')
        .map((c) => ({ id: c.id, type: c.type, boughtOnTurn: c.boughtOnTurn, played: c.played === true })),
      totalVp: ownTotalVp(state, seat),
      oraclePreview,
    },
  };
}
