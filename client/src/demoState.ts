// Demo game state for interactive showcase and visual verification.
import { generateBoard } from '@catan/shared';
import type { PersonalSnapshot } from './types';

export function createDemoSnapshot(): PersonalSnapshot {
  const board = generateBoard(4, 'demo-universe-2026');
  const vKeys = Object.keys(board.topology.vertexPos).map(Number);
  const eKeys = Object.keys(board.topology.edgeEndpoints);

  // Distribute realistic settlements, cities, and roads for 4 players.
  return {
    version: 1,
    config: 'base',
    playerCount: 4,
    phase: 'turnMain',
    activeSeat: 0,
    specialBuildSeat: null,
    turn: 5,
    dice: { die1: 4, die2: 2 },
    board,
    buildings: {
      [vKeys[0]!]: { type: 'settlement', seat: 0 },
      [vKeys[2]!]: { type: 'city', seat: 0 },
      [vKeys[7]!]: { type: 'settlement', seat: 1 },
      [vKeys[11]!]: { type: 'city', seat: 1 },
      [vKeys[16]!]: { type: 'settlement', seat: 2 },
      [vKeys[20]!]: { type: 'settlement', seat: 2 },
      [vKeys[25]!]: { type: 'settlement', seat: 3 },
      [vKeys[29]!]: { type: 'settlement', seat: 3 },
    },
    roads: {
      [eKeys[0]!]: 0,
      [eKeys[1]!]: 0,
      [eKeys[3]!]: 0,
      [eKeys[8]!]: 1,
      [eKeys[9]!]: 1,
      [eKeys[15]!]: 2,
      [eKeys[16]!]: 2,
      [eKeys[24]!]: 3,
      [eKeys[25]!]: 3,
    },
    robber: board.robberHex,
    bank: { wood: 15, brick: 16, sheep: 14, wheat: 12, ore: 15 },
    devDeckCount: 20,
    trades: [],
    pendingDiscards: [],
    longestRoad: { holder: 0, length: 5 },
    largestArmy: { holder: 1, knights: 3 },
    winner: null,
    players: [
      {
        seat: 0,
        name: 'Abhinay',
        color: 'red',
        resourceCount: 7,
        devCardCount: 2,
        playedKnights: 1,
        connected: true,
        publicVp: 5,
        roadsLeft: 12,
        settlementsLeft: 3,
        citiesLeft: 3,
      },
      {
        seat: 1,
        name: 'Bob',
        color: 'blue',
        resourceCount: 4,
        devCardCount: 3,
        playedKnights: 3,
        connected: true,
        publicVp: 6,
        roadsLeft: 13,
        settlementsLeft: 3,
        citiesLeft: 3,
      },
      {
        seat: 2,
        name: 'Carol',
        color: 'orange',
        resourceCount: 5,
        devCardCount: 1,
        playedKnights: 1,
        connected: true,
        publicVp: 3,
        roadsLeft: 13,
        settlementsLeft: 3,
        citiesLeft: 4,
      },
      {
        seat: 3,
        name: 'Dave',
        color: 'white',
        resourceCount: 3,
        devCardCount: 0,
        playedKnights: 0,
        connected: true,
        publicVp: 2,
        roadsLeft: 13,
        settlementsLeft: 3,
        citiesLeft: 4,
      },
    ],
    you: {
      seat: 0,
      resources: { wood: 3, brick: 2, sheep: 1, wheat: 2, ore: 1 },
      devHand: [
        { id: 'k1', type: 'knight', boughtOnTurn: 4, played: false },
        { id: 'vp1', type: 'victoryPoint', boughtOnTurn: 3, played: false },
      ],
      totalVp: 5,
    },
  };
}
