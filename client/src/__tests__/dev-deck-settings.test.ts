import { describe, expect, it } from 'vitest';
import { useStore, socketHandlers } from '../store';
import type { RoomState } from '../types';

describe('Development Card Deck Customization Store', () => {
  it('optimistically updates customDevDeck in room settings and preserves it when server echoes without it', () => {
    const initialRoom: RoomState = {
      roomCode: 'TEST',
      host: 0,
      players: [
        { seatIndex: 0, name: 'Host', color: 'red', ready: true, connected: true },
        { seatIndex: 1, name: 'Guest', color: 'blue', ready: true, connected: true },
        { seatIndex: 2, name: 'Bot', color: 'orange', ready: true, connected: true, isBot: true },
      ],
      settings: {
        maxPlayers: 4,
        turnTimerSec: 120,
        diceMode: 'random',
        victoryPointsToWin: 10,
        discardLimit: 7,
      },
      seed: 'seed123',
      started: false,
    };

    useStore.setState({
      room: initialRoom,
      session: { roomCode: 'TEST', seatIndex: 0, reconnectToken: 'token0' },
      route: 'room',
    });

    // Host updates development deck
    useStore.getState().updateSettings({
      customDevDeck: { knight: 5, victoryPoint: 2, monopoly: 0 },
    });

    // Check that store has updated optimistically
    expect(useStore.getState().room?.settings.customDevDeck).toEqual({
      knight: 5,
      victoryPoint: 2,
      monopoly: 0,
    });

    // Simulate an older server sending room:state without customDevDeck
    const serverEcho: RoomState = {
      ...initialRoom,
      settings: {
        maxPlayers: 4,
        turnTimerSec: 120,
        diceMode: 'random',
        victoryPointsToWin: 10,
        discardLimit: 7,
        // customDevDeck omitted by older server
      },
    };

    socketHandlers.onRoomState?.(serverEcho);

    // Verify client did NOT wipe out customDevDeck
    expect(useStore.getState().room?.settings.customDevDeck).toEqual({
      knight: 5,
      victoryPoint: 2,
      monopoly: 0,
    });
  });
});
