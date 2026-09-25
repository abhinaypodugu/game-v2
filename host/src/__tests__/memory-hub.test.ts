// MemoryHub integration: the same handlers the Node server runs, driven
// through in-memory endpoints (how an offline host phone runs the game).

import { afterEach, describe, expect, it } from 'vitest';
import { legalSettlementVertices, type GameAction } from '@catan/shared';
import {
  MemoryHub,
  noopLog,
  registerSocketHandlers,
  RoomManager,
  stopRoomTimers,
  type HubClientEndpoint,
  type PersonalSnapshot,
  type ServerContext,
} from '../index';

interface RoomStatePayload {
  roomCode: string;
  players: Array<{
    seatIndex: number;
    name: string;
    color: string | null;
    ready: boolean;
    connected: boolean;
    isBot?: boolean;
    aiTakeover?: boolean;
  }>;
  settings: { turnTimerSec: number };
  started: boolean;
}

interface JoinedPayload {
  roomCode: string;
  seatIndex: number;
  reconnectToken: string;
}

interface Waiter {
  event: string;
  where: (payload: unknown) => boolean;
  resolve: (payload: unknown) => void;
}

interface TestClient {
  endpoint: HubClientEndpoint;
  errors: unknown[];
  /** Resolve on the next `event` matching `where` (register before triggering it). */
  next<T>(event: string, where?: (payload: T) => boolean): Promise<T>;
  send(event: string, payload?: unknown): void;
}

function connectClient(hub: MemoryHub): TestClient {
  const endpoint = hub.connect();
  const waiters: Waiter[] = [];
  const errors: unknown[] = [];
  endpoint.onMessage((event, payload) => {
    if (event === 'error') errors.push(payload);
    for (const w of [...waiters]) {
      if (w.event !== event || !w.where(payload)) continue;
      waiters.splice(waiters.indexOf(w), 1);
      w.resolve(payload);
    }
  });
  return {
    endpoint,
    errors,
    next<T>(event: string, where: (payload: T) => boolean = () => true): Promise<T> {
      const { promise, resolve } = Promise.withResolvers<T>();
      waiters.push({ event, where: (p) => where(p as T), resolve: (p) => resolve(p as T) });
      return promise;
    },
    send: (event, payload) => endpoint.emit(event, payload),
  };
}

const contexts: ServerContext[] = [];

function startHost(rooms = new RoomManager()): { hub: MemoryHub; ctx: ServerContext } {
  const hub = new MemoryHub();
  const ctx: ServerContext = { io: hub, rooms, log: noopLog, timers: new Map(), timerDeadlines: new Map() };
  registerSocketHandlers(ctx);
  contexts.push(ctx);
  return { hub, ctx };
}

afterEach(() => {
  for (const ctx of contexts.splice(0)) stopRoomTimers(ctx);
});

async function createRoom(hub: MemoryHub, name: string): Promise<{ client: TestClient; joined: JoinedPayload }> {
  const client = connectClient(hub);
  const created = client.next<JoinedPayload>('room:created');
  client.send('room:create', { name });
  return { client, joined: await created };
}

async function joinRoom(
  hub: MemoryHub,
  code: string,
  name?: string,
  token?: string,
): Promise<{ client: TestClient; joined: JoinedPayload }> {
  const client = connectClient(hub);
  const joined = client.next<JoinedPayload>('room:joined');
  client.send('room:join', { code, name, token });
  return { client, joined: await joined };
}

/** Deterministic legal opening placement for the active seat. */
function setupPlaceFor(ctx: ServerContext, code: string): Extract<GameAction, { type: 'setupPlace' }> {
  const state = ctx.rooms.getRoom(code)!.game!.state;
  const vertex = legalSettlementVertices(state, state.activeSeat, true)[0]!;
  const edge = state.board.topology.vertexEdges[vertex]![0]!;
  return { type: 'setupPlace', settlementVertex: vertex, roadEdge: edge };
}

describe('MemoryHub lobby → game', () => {
  it('runs create, join, colors, ready, start, setup placement and disconnect', async () => {
    const { hub, ctx } = startHost();
    const host = await createRoom(hub, 'Ann');
    const code = host.joined.roomCode;

    const timerOff = host.client.next<RoomStatePayload>('room:state', (s) => s.settings.turnTimerSec === 0);
    host.client.send('room:updateSettings', { turnTimerSec: 0 });
    const offState = await timerOff;
    // Payloads arrive detached from live server objects, as over a real wire.
    expect(offState.settings).not.toBe(ctx.rooms.getRoom(code)!.settings);

    const ben = await joinRoom(hub, code, 'Ben');
    const cy = await joinRoom(hub, code, 'Cy');
    expect([host.joined.seatIndex, ben.joined.seatIndex, cy.joined.seatIndex]).toEqual([0, 1, 2]);
    const clients = [host.client, ben.client, cy.client];

    const colored = host.client.next<RoomStatePayload>('room:state', (s) =>
      s.players.length === 3 && s.players.every((p) => p.color !== null),
    );
    clients.forEach((c, i) => c.send('room:pickColor', { color: ['red', 'blue', 'orange'][i] }));
    await colored;

    const ready = host.client.next<RoomStatePayload>('room:state', (s) => s.players.every((p) => p.ready));
    for (const c of clients) c.send('room:setReady', { ready: true });
    await ready;

    const started = host.client.next<{ roomCode: string }>('room:started');
    const snapshots = clients.map((c) => c.next<PersonalSnapshot>('game:state'));
    host.client.send('room:start');
    expect(await started).toEqual({ roomCode: code });
    const initial = await Promise.all(snapshots);
    expect(initial.map((s) => s.you.seat)).toEqual([0, 1, 2]);
    expect(initial[0]!.phase).toBe('setupForward');

    const place = setupPlaceFor(ctx, code);
    const active = clients[initial[0]!.activeSeat]!;
    const placed = ben.client.next<PersonalSnapshot>('game:state', (s) => s.buildings[place.settlementVertex] !== undefined);
    active.send('game:action', place);
    const afterPlace = await placed;
    expect(afterPlace.buildings[place.settlementVertex]).toEqual({ seat: 0, type: 'settlement' });
    expect(afterPlace.roads[place.roadEdge]).toBe(0);
    expect(afterPlace.activeSeat).toBe(1);

    const dropped = host.client.next<RoomStatePayload>('room:state', (s) => s.players[2]?.connected === false);
    cy.client.endpoint.close();
    await dropped;
    const seat = ctx.rooms.getRoom(code)!.seats[2]!;
    expect(seat.socketId).toBeNull();
    expect(seat.disconnectedAt).not.toBeNull();

    expect(clients.flatMap((c) => c.errors)).toEqual([]);
  });
});

describe('RoomManager export/import', () => {
  it('restores rooms with game state intact and every human seat disconnected', async () => {
    const { hub, ctx } = startHost();
    const host = await createRoom(hub, 'Ann');
    const code = host.joined.roomCode;
    const ben = await joinRoom(hub, code, 'Ben');
    const cy = await joinRoom(hub, code, 'Cy');
    const clients = [host.client, ben.client, cy.client];
    const colored = host.client.next<RoomStatePayload>('room:state', (s) => s.players.every((p) => p.color !== null && p.ready));
    clients.forEach((c, i) => {
      c.send('room:pickColor', { color: ['red', 'blue', 'orange'][i] });
      c.send('room:setReady', { ready: true });
    });
    await colored;
    const started = host.client.next<PersonalSnapshot>('game:state');
    host.client.send('room:start');
    await started;
    const placed = host.client.next<PersonalSnapshot>('game:state', (s) => s.activeSeat === 1);
    host.client.send('game:action', setupPlaceFor(ctx, code));
    await placed;

    const original = ctx.rooms.getRoom(code)!;
    const restored = new RoomManager();
    restored.importState(ctx.rooms.exportState());
    const room = restored.getRoom(code)!;

    expect(room.game!.state).toEqual(original.game!.state);
    expect(room.game!.events).toEqual(original.game!.events);
    expect(room.seed).toBe(original.seed);
    expect(room.settings).toEqual(original.settings);
    expect(room.seats.map((s) => [s.name, s.color, s.reconnectToken, s.ready])).toEqual(
      original.seats.map((s) => [s.name, s.color, s.reconnectToken, s.ready]),
    );
    expect(room.seats.every((s) => !s.connected && s.socketId === null && s.disconnectedAt !== null)).toBe(true);
    // Same RNG stream: a resumed game draws exactly what the original would.
    expect(restored.gameRng(room).next()).toBe(ctx.rooms.gameRng(original).next());
  });

  it('rejects a malformed snapshot without dropping current rooms', () => {
    const rooms = new RoomManager();
    const room = rooms.createRoom('Ann');
    expect(() => rooms.importState(JSON.stringify({ v: 1, rooms: [{ code: 'NOPE' }] }))).toThrow();
    expect(rooms.getRoom(room.code)).toBe(room);
  });

  it('resumes on a fresh hub: host reclaims its seat by token and a pending bot turn plays', async () => {
    const { hub, ctx } = startHost();
    const host = await createRoom(hub, 'Ann');
    const code = host.joined.roomCode;
    const settled = host.client.next<RoomStatePayload>('room:state', (s) => s.players.length === 3 && s.players[0]!.color !== null && s.players[0]!.ready && s.settings.turnTimerSec === 0);
    host.client.send('room:updateSettings', { turnTimerSec: 0 });
    // Pick before adding bots: each bot takes the first free color.
    host.client.send('room:pickColor', { color: 'red' });
    host.client.send('room:setReady', { ready: true });
    host.client.send('room:addBot');
    host.client.send('room:addBot');
    await settled;
    const started = host.client.next<PersonalSnapshot>('game:state');
    host.client.send('room:start');
    await started;
    const handedToBot = host.client.next<PersonalSnapshot>('game:state', (s) => s.activeSeat === 1);
    host.client.send('game:action', setupPlaceFor(ctx, code));
    const saved = await handedToBot;

    // The page "reloads" before the bot moves: old context dies, snapshot survives.
    const json = ctx.rooms.exportState();
    stopRoomTimers(ctx);
    host.client.endpoint.close();

    const rooms = new RoomManager();
    rooms.importState(json);
    const resumed = startHost(rooms);
    const client = connectClient(resumed.hub);
    const rejoined = client.next<JoinedPayload>('room:joined');
    const botMoved = client.next<PersonalSnapshot>('game:state', (s) => s.version > saved.version);
    client.send('room:join', { code, token: host.joined.reconnectToken });
    expect((await rejoined).seatIndex).toBe(0);
    const next = await botMoved;
    expect(Object.values(next.buildings).filter((b) => b.seat === 1)).toHaveLength(1);
    expect(rooms.getRoom(code)!.seats[0]!.connected).toBe(true);
    expect(client.errors).toEqual([]);
  });
});

describe('RoomManager kickPlayer', () => {
  it('kicks a connected player in lobby, emits room:kicked, and frees the slot', async () => {
    const { hub } = startHost();
    const host = await createRoom(hub, 'Ann');
    const code = host.joined.roomCode;
    const ben = await joinRoom(hub, code, 'Ben');

    const kickedEvent = ben.client.next<{ reason?: string }>('room:kicked');
    const roomStateAfterKick = host.client.next<RoomStatePayload>('room:state', (s) => s.players.length === 1);

    host.client.send('room:kickPlayer', { seatIndex: 1 });

    const kicked = await kickedEvent;
    expect(kicked.reason).toContain('removed');

    const state = await roomStateAfterKick;
    expect(state.players).toHaveLength(1);
    expect(state.players[0]!.name).toBe('Ann');

    // Slot is freed up: a new player can join
    const cy = await joinRoom(hub, code, 'Cy');
    expect(cy.joined.seatIndex).toBe(1);
  });

  it('kicks a disconnected player in lobby to free up a reconnecting slot in a full room', async () => {
    const { hub } = startHost();
    const host = await createRoom(hub, 'Ann');
    const code = host.joined.roomCode;

    // Set max players to 3
    const settingsUpdated = host.client.next<RoomStatePayload>('room:state', (s) => s.settings.maxPlayers === 3);
    host.client.send('room:updateSettings', { maxPlayers: 3 });
    await settingsUpdated;

    const ben = await joinRoom(hub, code, 'Ben');
    await joinRoom(hub, code, 'Cy');

    // Room is full (3/3). Another player cannot join.
    const dave = connectClient(hub);
    const daveFullError = dave.next<{ message: string }>('error');
    dave.send('room:join', { code, name: 'Dave' });
    expect((await daveFullError).message).toBe('ROOM_FULL');

    // Ben disconnects
    const benDropped = host.client.next<RoomStatePayload>('room:state', (s) => s.players[1]?.connected === false);
    ben.client.endpoint.close();
    await benDropped;

    // Host kicks disconnected Ben to free the reconnecting slot
    const slotFreed = host.client.next<RoomStatePayload>('room:state', (s) => s.players.length === 2);
    host.client.send('room:kickPlayer', { seatIndex: 1 });
    await slotFreed;

    // Dave can now join into the freed slot!
    const daveJoined = dave.next<JoinedPayload>('room:joined');
    dave.send('room:join', { code, name: 'Dave' });
    expect((await daveJoined).seatIndex).toBe(2);
  });

  it('kicks an in-game player, replacing them with a bot so the game proceeds without stalling', async () => {
    const { hub, ctx } = startHost();
    const host = await createRoom(hub, 'Ann');
    const code = host.joined.roomCode;
    const ben = await joinRoom(hub, code, 'Ben');
    const cy = await joinRoom(hub, code, 'Cy');

    const clients = [host.client, ben.client, cy.client];
    const colored = host.client.next<RoomStatePayload>('room:state', (s) => s.players.every((p) => p.color !== null && p.ready));
    clients.forEach((c, i) => {
      c.send('room:pickColor', { color: ['red', 'blue', 'orange'][i] });
      c.send('room:setReady', { ready: true });
    });
    await colored;

    const started = host.client.next<PersonalSnapshot>('game:state');
    host.client.send('room:start');
    await started;

    // Ann plays first turn
    const handedToBen = host.client.next<PersonalSnapshot>('game:state', (s) => s.activeSeat === 1);
    host.client.send('game:action', setupPlaceFor(ctx, code));
    await handedToBen;

    // Ben disconnects during his turn
    const benDropped = host.client.next<RoomStatePayload>('room:state', (s) => s.players[1]?.connected === false);
    ben.client.endpoint.close();
    await benDropped;

    // Host kicks Ben mid-game -> Ben converted to bot -> bot takes Ben's turn automatically!
    const botPlayed = host.client.next<PersonalSnapshot>('game:state', (s) => s.activeSeat === 2);
    host.client.send('room:kickPlayer', { seatIndex: 1 });

    const afterBot = await botPlayed;
    expect(afterBot.activeSeat).toBe(2);
    const room = ctx.rooms.getRoom(code)!;
    expect(room.seats[1]!.isBot).toBe(true);
  });

  it('rejects kickPlayer if caller is not host or tries to kick self', async () => {
    const { hub } = startHost();
    const host = await createRoom(hub, 'Ann');
    const code = host.joined.roomCode;
    const ben = await joinRoom(hub, code, 'Ben');

    // Ben tries to kick Ann
    const benError = ben.client.next<{ message: string }>('error');
    ben.client.send('room:kickPlayer', { seatIndex: 0 });
    expect((await benError).message).toBe('NOT_HOST');

    // Ann tries to kick self
    const hostError = host.client.next<{ message: string }>('error');
    host.client.send('room:kickPlayer', { seatIndex: 0 });
    expect((await hostError).message).toBe('CANNOT_KICK_HOST');
  });

  it('updates hideBankCardsCount, applies it to game rules, and sanitizes bank counts to players', async () => {
    const { ctx, hub } = startHost();
    const host = await createRoom(hub, 'Ann');
    const code = host.joined.roomCode;
    const ben = await joinRoom(hub, code, 'Ben');
    const cal = await joinRoom(hub, code, 'Cal');

    // Host updates settings to hide bank cards count
    const settingsUpdated = host.client.next<any>('room:state', (s) => s.settings.hideBankCardsCount === true);
    host.client.send('room:updateSettings', { hideBankCardsCount: true });
    await settingsUpdated;

    const colored = host.client.next<RoomStatePayload>('room:state', (s) =>
      s.players.length === 3 && s.players.every((p) => p.color !== null),
    );
    [host.client, ben.client, cal.client].forEach((c, i) => c.send('room:pickColor', { color: ['red', 'blue', 'orange'][i] }));
    await colored;

    const ready = host.client.next<RoomStatePayload>('room:state', (s) => s.players.every((p) => p.ready));
    for (const c of [host.client, ben.client, cal.client]) c.send('room:setReady', { ready: true });
    await ready;

    // Start game
    const started = host.client.next<PersonalSnapshot>('game:state');
    host.client.send('room:start');
    const snap = await started;

    expect(snap.rules.hideBankCardsCount).toBe(true);
    // Bank counts should be masked to -1
    expect(snap.bank).toEqual({ wood: -1, brick: -1, sheep: -1, wheat: -1, ore: -1 });

    // Internal game state still retains full accurate bank
    const room = ctx.rooms.getRoom(code)!;
    expect(room.game!.state.bank.wood).toBeGreaterThan(0);
  });

  it('runs an all-bot simulation: fills room with bots, starts, and bots play autonomously', async () => {
    const { ctx, hub } = startHost();
    const host = await createRoom(hub, 'Host');
    const code = host.joined.roomCode;

    // Fill room with bots including converting host seat to bot
    const allBots = host.client.next<RoomStatePayload>('room:state', (s) =>
      s.players.length === 4 && s.players.every((p) => p.isBot && p.ready && p.color !== null),
    );
    host.client.send('room:fillBots', { includeHost: true });
    const roomState = await allBots;
    expect(roomState.players).toHaveLength(4);
    expect(roomState.players.every((p) => p.isBot)).toBe(true);

    // Set fast bot delay for fast test
    host.client.send('room:setBotDelay', { delayMs: 20 });

    // Start game
    const started = host.client.next<PersonalSnapshot>('game:state');
    host.client.send('room:start');
    await started;

    // Wait for bots to complete setup phase (all 8 settlements placed)
    const setupDone = host.client.next<PersonalSnapshot>(
      'game:state',
      (s) => Object.keys(s.buildings).length >= 8,
    );
    const snap = await setupDone;
    expect(Object.keys(snap.buildings).length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(snap.roads).length).toBeGreaterThanOrEqual(8);

    stopRoomTimers(ctx);
  });

  it('verifies admin password via admin:verify', async () => {
    const { ctx, hub } = startHost();
    const host = await createRoom(hub, 'AdminUser');

    // Test valid passwords
    const p1 = host.client.next<{ ok: boolean }>('admin:verifyResult');
    host.client.send('admin:verify', { password: 'admin' });
    expect((await p1).ok).toBe(true);

    const p2 = host.client.next<{ ok: boolean }>('admin:verifyResult');
    host.client.send('admin:verify', { password: 'catan-admin' });
    expect((await p2).ok).toBe(true);

    const p3 = host.client.next<{ ok: boolean }>('admin:verifyResult');
    host.client.send('admin:verify', { password: 'admin123' });
    expect((await p3).ok).toBe(true);

    // Test invalid password
    const pInvalid = host.client.next<{ ok: boolean }>('admin:verifyResult');
    host.client.send('admin:verify', { password: 'wrong-password' });
    expect((await pInvalid).ok).toBe(false);

    stopRoomTimers(ctx);
  });

  it('triggers AI takeover when a player disconnects during an active game, and allows resuming control', async () => {
    const { ctx, hub } = startHost();
    const host = await createRoom(hub, 'Alice');
    const bob = await joinRoom(hub, host.joined.roomCode, 'Bob');
    const charlie = await joinRoom(hub, host.joined.roomCode, 'Charlie');
    const code = host.joined.roomCode;

    // Pick colors and ready up
    host.client.send('room:pickColor', { color: 'red' });
    host.client.send('room:setReady', { ready: true });
    bob.client.send('room:pickColor', { color: 'blue' });
    bob.client.send('room:setReady', { ready: true });
    charlie.client.send('room:pickColor', { color: 'orange' });
    charlie.client.send('room:setReady', { ready: true });

    // Set maxPlayers to 3
    host.client.send('room:updateSettings', { maxPlayers: 3 });

    // Start game
    const started = host.client.next<PersonalSnapshot>('game:state');
    host.client.send('room:start');
    await started;

    const roomBefore = ctx.rooms.getRoom(code)!;
    expect(roomBefore.seats[1]!.aiTakeover).toBeFalsy();

    // Bob disconnects during game
    const roomStateAfterDisconnect = host.client.next<RoomStatePayload>(
      'room:state',
      (s) => s.players.find((p) => p.seatIndex === 1)?.aiTakeover === true,
    );
    bob.client.endpoint.close();
    const updatedRoom = await roomStateAfterDisconnect;
    const bobPlayer = updatedRoom.players.find((p) => p.seatIndex === 1);
    expect(bobPlayer?.connected).toBe(false);
    expect(bobPlayer?.aiTakeover).toBe(true);

    // Bob reconnects with his reconnect token
    const bobReconnected = await joinRoom(hub, code, 'Bob', bob.joined.reconnectToken);
    const roomAfterReconnect = ctx.rooms.getRoom(code)!;
    expect(roomAfterReconnect.seats[1]!.connected).toBe(true);

    // Bob sends resumeControl to take back control from the AI
    const roomStateAfterResume = host.client.next<RoomStatePayload>(
      'room:state',
      (s) => s.players.find((p) => p.seatIndex === 1)?.aiTakeover === false,
    );
    bobReconnected.client.send('room:resumeControl');
    const resumedRoom = await roomStateAfterResume;
    const bobAfterResume = resumedRoom.players.find((p) => p.seatIndex === 1);
    expect(bobAfterResume?.aiTakeover).toBe(false);

    stopRoomTimers(ctx);
  });
});


