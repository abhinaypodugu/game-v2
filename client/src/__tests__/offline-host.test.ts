// Offline host mode without WebRTC: the store hosts the game on an in-page
// MemoryHub and a second client joins through a raw hub endpoint, exactly
// as a paired phone's data channel would be bridged.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EndpointTransport } from '../net/endpointTransport';
import { OFFLINE_HOST_KEY } from '../net/offline';
import { getOfflineHostHub, useStore } from '../store';
import type { PersonalSnapshot } from '../types';

/**
 * Step fake time (hub delivery is microtasks; persistence, bots and turn
 * timers are setTimeout) until `predicate` holds.
 */
async function until(predicate: () => boolean, label: string, maxMs = 5000): Promise<void> {
  for (let waited = 0; !predicate(); waited += 10) {
    if (waited >= maxMs) throw new Error(`never happened: ${label}; room=${JSON.stringify(useStore.getState().room)}`);
    await vi.advanceTimersByTimeAsync(10);
  }
}

/** A second player connected straight to the host's hub. */
interface Guest {
  transport: EndpointTransport;
  inbox: { game: PersonalSnapshot | null; seat: number | null; errors: string[] };
}

function joinGuest(): Guest {
  const hub = getOfflineHostHub();
  if (hub === null) throw new Error('not hosting');
  const transport = new EndpointTransport(hub.connect());
  const inbox: Guest['inbox'] = { game: null, seat: null, errors: [] };
  transport.on('room:joined', (payload: { seatIndex: number }) => {
    inbox.seat = payload.seatIndex;
  });
  transport.on('game:state', (snap: PersonalSnapshot) => {
    inbox.game = snap;
  });
  transport.on('error', (err: { message: string }) => {
    inbox.errors.push(err.message);
  });
  transport.connect();
  return { transport, inbox };
}

beforeEach(() => {
  // Microtasks stay real: MemoryHub delivers through queueMicrotask.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  useStore.getState().leaveOffline();
  localStorage.clear();
  vi.useRealTimers();
});

/** Host (red), optional guest (orange) and bots fill 3 seats, all ready; host starts. */
async function startThreeSeatGame(guest?: Guest): Promise<void> {
  const host = useStore.getState();
  host.pickColor('red');
  host.setReady(true);
  if (guest !== undefined) {
    guest.transport.emit('room:pickColor', { color: 'orange' });
    guest.transport.emit('room:setReady', { ready: true });
  }
  host.addBot();
  if (guest === undefined) host.addBot();
  await until(() => {
    const players = useStore.getState().room?.players ?? [];
    return players.length === 3 && players.every((p) => p.ready && p.color !== null);
  }, 'lobby ready');
  host.startGame();
  await until(() => useStore.getState().route === 'game' && useStore.getState().game !== null, 'host in game');
}

/** The saved host game (throttled after broadcasts) contains a started game. */
function savedGameStarted(): boolean {
  const raw = localStorage.getItem(OFFLINE_HOST_KEY);
  if (raw === null) return false;
  const { rooms } = JSON.parse(raw) as { rooms: string };
  return (JSON.parse(rooms) as { rooms: Array<{ game: unknown }> }).rooms.some((r) => r.game !== null);
}

describe('offline host', () => {
  it('hosts a lobby in-page, seats a hub client and starts the game', async () => {
    await useStore.getState().startOfflineHost('  Alice  ');
    const hosted = useStore.getState();
    expect(hosted.offline.role).toBe('host');
    expect(hosted.route).toBe('room');
    expect(hosted.session?.seatIndex).toBe(0);
    const code = hosted.session!.roomCode;
    await until(() => useStore.getState().connected, 'host client connected');
    await until(() => useStore.getState().room?.players[0]?.name === 'Alice', 'host seat in room state');

    const guest = joinGuest();
    guest.transport.emit('room:join', { code, name: 'Bob' });
    await until(() => guest.inbox.seat === 1, 'guest seated');
    await until(() => useStore.getState().room?.players.length === 2, 'host sees guest');
    expect(useStore.getState().room?.players[1]).toMatchObject({ name: 'Bob', connected: true });

    await startThreeSeatGame(guest);
    await until(() => guest.inbox.game !== null, 'guest snapshot');

    const hostGame = useStore.getState().game!;
    expect(hostGame.playerCount).toBe(3);
    expect(hostGame.players.map((p) => p.name).slice(0, 2)).toEqual(['Alice', 'Bob']);
    // Each client receives its own private view.
    expect(hostGame.you.seat).toBe(0);
    expect(guest.inbox.game!.you.seat).toBe(1);
    expect(guest.inbox.errors).toEqual([]);

    await until(savedGameStarted, 'host game saved');
    expect(useStore.getState().canResumeOfflineHost()).toBe(true);
  });

  it('marks a seat disconnected when its client goes away', async () => {
    await useStore.getState().startOfflineHost('Alice');
    const code = useStore.getState().session!.roomCode;
    const guest = joinGuest();
    guest.transport.emit('room:join', { code, name: 'Bob' });
    await until(() => useStore.getState().room?.players[1]?.connected === true, 'guest connected');
    await startThreeSeatGame(guest);

    guest.transport.disconnect();
    await until(() => useStore.getState().room?.players[1]?.connected === false, 'guest seat disconnected');
    expect(useStore.getState().connected).toBe(true);
  });

  it('resumes a saved host game and reclaims the host seat', async () => {
    await useStore.getState().startOfflineHost('Alice');
    const code = useStore.getState().session!.roomCode;
    await startThreeSeatGame();
    await until(savedGameStarted, 'host game saved');

    // Simulate the host tab being reloaded: the in-memory host is gone, storage survives.
    const saved = localStorage.getItem(OFFLINE_HOST_KEY)!;
    useStore.getState().leaveOffline();
    expect(useStore.getState().route).toBe('home');
    expect(useStore.getState().offline.role).toBeNull();
    localStorage.setItem(OFFLINE_HOST_KEY, saved);
    expect(useStore.getState().canResumeOfflineHost()).toBe(true);

    await useStore.getState().resumeOfflineHost();
    expect(useStore.getState().offline.role).toBe('host');
    expect(useStore.getState().session?.roomCode).toBe(code);
    await until(() => useStore.getState().route === 'game' && useStore.getState().game !== null, 'back in game');
    expect(useStore.getState().game!.you.seat).toBe(0);
    await until(() => useStore.getState().room?.players[0]?.connected === true, 'host seat reclaimed');
  });

  it('refuses to resume a corrupt save and drops it', async () => {
    localStorage.setItem(
      OFFLINE_HOST_KEY,
      JSON.stringify({
        v: 1,
        rooms: '{"v":1,"rooms":[{"code":"nope"}]}',
        session: { roomCode: 'AB2C', seatIndex: 0, reconnectToken: 'x'.repeat(21) },
      }),
    );
    expect(useStore.getState().canResumeOfflineHost()).toBe(true);
    await expect(useStore.getState().resumeOfflineHost()).rejects.toThrow(/could not be restored/);
    expect(localStorage.getItem(OFFLINE_HOST_KEY)).toBeNull();
    expect(useStore.getState().offline.role).toBeNull();
  });

  it('leaving offline mode stops hosting and forgets the saved game', async () => {
    await useStore.getState().startOfflineHost('Alice');
    await until(() => localStorage.getItem(OFFLINE_HOST_KEY) !== null, 'saved');
    useStore.getState().leaveOffline();
    expect(getOfflineHostHub()).toBeNull();
    expect(localStorage.getItem(OFFLINE_HOST_KEY)).toBeNull();
    expect(useStore.getState()).toMatchObject({ route: 'home', session: null, room: null, connected: false });
  });
});
