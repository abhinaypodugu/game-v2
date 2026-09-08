// Client-side mirror of the server's wire payloads (client keeps its own
// interfaces; sanitize.ts owns the shapes — duplicated here because the
// server package must not be a client dependency).

import type { GameEvent, GameState, PlayerColor, Resource } from '@catan/shared';

export interface PublicPlayer {
  seat: number;
  name: string;
  color: PlayerColor;
  resourceCount: number;
  devCardCount: number;
  playedKnights: number;
  connected: boolean;
  publicVp: number;
  roadsLeft: number;
  settlementsLeft: number;
  citiesLeft: number;
}

export interface OwnView {
  seat: number;
  resources: Record<Resource, number>;
  devHand: Array<{ id: string; type: string; boughtOnTurn: number; played: boolean }>;
  totalVp: number;
}

export interface PersonalSnapshot {
  version: number;
  config: string;
  playerCount: number;
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
  winner: number | null;
  players: PublicPlayer[];
  you: OwnView;
}

export interface RoomState {
  roomCode: string;
  host: number;
  players: Array<{
    seatIndex: number;
    name: string;
    color: PlayerColor | null;
    ready: boolean;
    connected: boolean;
  }>;
  settings: { maxPlayers: number; turnTimerSec: number; diceMode: 'random' | 'balanced' };
  seed: string;
  started: boolean;
}

export interface TimerInfo {
  phase: string;
  deadlineUnixMs: number;
}

export interface ErrorInfo {
  message: string;
}

export type { GameEvent };
