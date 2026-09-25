// Game event wiring over any HubServer (socket.io on Node, MemoryHub in a
// browser tab): room lifecycle, game actions, timers, reconnect.
// Single authoritative path: every game mutation runs through applyAction.

import { z } from 'zod';
import {
  gameActionSchema,
  generateBoard,
  legalSettlementVertices,
  stealCandidates,
  type GameAction,
  type GameEvent,
} from '@catan/shared';
import type { PlayerColor, PlayerCount } from '@catan/shared';
import { applyAction } from '@catan/shared';
import type { RoomManager} from './rooms';
import { type Room } from './rooms';
import type { HubServer, HubSocket } from './hub';
import { sanitize } from './sanitize';
import { autoActionFor, phaseTimerMs, type TimerHandle } from './timers';
import { createBalancedDiceSource } from './dice';
import { computeBotAction } from './bot';

/** Where accepted game events are recorded (JSONL file on Node, nowhere offline). */
export interface GameLogSink {
  append(roomCode: string, event: GameEvent): void;
}

export const noopLog: GameLogSink = { append: () => {} };

export interface ServerContext {
  io: HubServer;
  rooms: RoomManager;
  log: GameLogSink;
  timers: Map<string, TimerHandle>; // roomCode -> active timeout
  timerDeadlines: Map<string, { phase: string; deadlineUnixMs: number }>;
}

const joinPayloadSchema = z.object({
  code: z.string().length(4),
  name: z.string().min(1).max(24).optional(),
  token: z.string().min(10).optional(),
});

const createPayloadSchema = z.object({ name: z.string().min(1).max(24) });

const setReadySchema = z.object({ ready: z.boolean() });
const pickColorSchema = z.object({ color: z.string() });
const settingsSchema = z.object({
  maxPlayers: z.number().int().min(3).max(8).optional(),
  turnTimerSec: z.number().int().min(0).max(600).optional(),
  diceMode: z.enum(['random', 'balanced']).optional(),
  victoryPointsToWin: z.number().int().min(3).max(20).optional(),
  discardLimit: z.number().int().min(5).max(20).optional(),
  customDevDeck: z.record(z.string(), z.number().int().min(0).max(99)).optional(),
  hideBankCardsCount: z.boolean().optional(),
});

export const ADMIN_PASSWORDS = new Set(
  ['admin', 'catan-admin', 'admin123', process.env.ADMIN_PASSWORD].filter(Boolean) as string[],
);

export function verifyAdminPassword(password: string): boolean {
  return ADMIN_PASSWORDS.has(password.trim());
}

export function roomStatePayload(room: Room): unknown {
  return {
    roomCode: room.code,
    host: room.hostSeatIndex,
    players: room.seats.map((s) => ({
      seatIndex: s.seatIndex,
      name: s.name,
      color: s.color,
      ready: s.ready,
      connected: s.connected,
      isBot: s.isBot === true,
      aiTakeover: s.aiTakeover === true,
    })),
    settings: room.settings,
    seed: room.seed,
    started: room.game !== null,
  };
}

function broadcastRoom(ctx: ServerContext, room: Room): void {
  for (const seat of room.seats) {
    if (seat.socketId !== null) {
      ctx.io.to(seat.socketId).emit('room:seatSync', { seatIndex: seat.seatIndex });
    }
  }
  ctx.io.to(room.code).emit('room:state', roomStatePayload(room));
}

function broadcastGame(ctx: ServerContext, room: Room): void {
  if (room.game === null) return;
  for (const seat of room.seats) {
    if (seat.socketId === null) continue;
    ctx.io.to(seat.socketId).emit('game:state', sanitize(room.game.state, seat.seatIndex));
  }
  // Spectators / disconnected sockets still get a public board view via log.
}

function armTimer(ctx: ServerContext, room: Room): void {
  const existing = ctx.timers.get(room.code);
  if (existing !== undefined) {
    clearTimeout(existing);
    ctx.timers.delete(room.code);
  }
  if (room.game === null) return;
  const phase = room.game.state.phase;
  if (phase === 'finished') return;
  const ms = phaseTimerMs(phase, room.settings.turnTimerSec);
  if (ms === null) return;

  const deadline = Date.now() + ms;
  ctx.timerDeadlines.set(room.code, { phase, deadlineUnixMs: deadline });
  ctx.io.to(room.code).emit('game:timer', { phase, deadlineUnixMs: deadline });

  const timeout = setTimeout(() => {
    void runAutoAction(ctx, room.code);
  }, ms);
  ctx.timers.set(room.code, timeout);
}

async function runAutoAction(ctx: ServerContext, code: string): Promise<void> {
  const room = ctx.rooms.getRoom(code);
  ctx.timers.delete(code);
  if (room?.game === null || room === undefined || room.game === null) return;
  const state = room.game.state;
  const rng = ctx.rooms.gameRng(room);

  // Identify who timed out and mark AI takeover if human
  const targetSeat =
    state.phase === 'discard'
      ? state.pendingDiscards.find((d) => !d.received)?.seat ?? state.activeSeat
      : state.phase === 'specialBuild' && state.specialBuild?.seat !== null && state.specialBuild?.seat !== undefined
        ? state.specialBuild.seat
        : state.activeSeat;

  const seatObj = room.seats.find((s) => s.seatIndex === targetSeat);
  if (seatObj && !seatObj.isBot && !seatObj.aiTakeover) {
    seatObj.aiTakeover = true;
    broadcastRoom(ctx, room);
  }

  // First, attempt smart bot AI to play the turn
  let action: GameAction | null = computeBotAction(state, targetSeat, rng);
  if (action !== null) {
    if (action.type === 'discard' || action.type === 'tradeRespond' || action.type === 'tradeCounter') {
      action = { ...action, seat: targetSeat };
    }
  }

  // Fallback to autoActionFor if computeBotAction was null
  if (action === null) {
    const auto = autoActionFor(state.phase, targetSeat, state, rng);
    if (auto === null) {
      armTimer(ctx, room);
      return;
    }

    if (auto.action.type === '__autoSetupPlace') {
      const vertices = legalSettlementVertices(state, targetSeat, true);
      if (vertices.length === 0) {
        action = null;
      } else {
        const vertex = rng.pick(vertices);
        const edges = state.board.topology.vertexEdges[vertex] ?? [];
        const edge = edges.find((e) => state.roads[e] === undefined) ?? edges[0];
        action =
          edge === undefined
            ? null
            : { type: 'setupPlace', settlementVertex: vertex, roadEdge: edge };
      }
    } else if (auto.action.type === '__autoChooseSteal') {
      const candidates = stealCandidates(state, state.robber);
      const withCards = candidates.filter((s) => {
        const p = state.players[s]!;
        return RESOURCES_TOTAL(p.resources) > 0;
      });
      const pool = withCards.length > 0 ? withCards : candidates;
      action = pool.length > 0 ? { type: 'chooseSteal', victimSeat: rng.pick(pool) } : null;
    } else {
      action = auto.action;
    }
  }

  if (action === null) {
    armTimer(ctx, room);
    return;
  }

  const rollDice = makeRollSource(ctx, room);
  const result = applyAction(state, action, rng, rollDice);
  if (result.ok) {
    room.game.state = result.state;
    for (const e of result.events) {
      room.game.events.push(e);
      ctx.log.append(room.code, e);
      ctx.io.to(room.code).emit('game:event', e);
    }
    if (state.activeSeat !== result.state.activeSeat || state.phase !== result.state.phase) {
      ctx.io.to(room.code).emit(
        'game:timer',
        ctx.timerDeadlines.get(room.code) ?? { phase: result.state.phase, deadlineUnixMs: 0 },
      );
    }
  } else {
    // If smart action was rejected, fallback to basic endTurn if in main turn
    if (state.phase === 'turnMain') {
      const fallbackRes = applyAction(state, { type: 'endTurn' }, rng);
      if (fallbackRes.ok) {
        room.game.state = fallbackRes.state;
        for (const e of fallbackRes.events) {
          room.game.events.push(e);
          ctx.log.append(room.code, e);
          ctx.io.to(room.code).emit('game:event', e);
        }
      }
    }
  }
  broadcastGame(ctx, room);
  armTimer(ctx, room);
  triggerBotTurnIfNeeded(ctx, room);
}

function RESOURCES_TOTAL(bag: Record<string, number>): number {
  return Object.values(bag).reduce((a, b) => a + b, 0);
}

/** Dice source honoring the room's diceMode. */
function makeRollSource(ctx: ServerContext, room: Room): Parameters<typeof applyAction>[3] {
  if (room.settings.diceMode !== 'balanced') return undefined;
  const balanced = createBalancedDiceSource();
  return (rng) => {
    const prev = room.game?.state.dice ?? null;
    const p = prev === null ? null : [prev.die1, prev.die2] as [number, number];
    return balanced.roll(rng, p);
  };
}

function handleGameAction(ctx: ServerContext, socket: HubSocket | null, room: Room, seat: number, action: GameAction): void {
  if (room.game === null) {
    socket?.emit('error', { message: 'GAME_NOT_STARTED' });
    return;
  }
  const state = room.game.state;
  const rng = ctx.rooms.gameRng(room);

  // If action comes from a connected human client for a seat that had aiTakeover, resume human control
  if (socket !== null) {
    const seatObj = room.seats.find((s) => s.seatIndex === seat);
    if (seatObj && seatObj.aiTakeover) {
      seatObj.aiTakeover = false;
      broadcastRoom(ctx, room);
    }
  }

  // Seat gate: only actions from the correct actor reach the engine.
  const actorOk = isActorAllowed(state, action, seat);
  if (!actorOk) {
    if (socket === null) {
      console.warn(`[Bot AI] Action ${action.type} by seat ${seat} rejected: NOT_YOUR_ACTION in phase ${state.phase}`);
      void runAutoAction(ctx, room.code);
    } else {
      socket.emit('error', { message: 'NOT_YOUR_ACTION' });
    }
    return;
  }

  // Stamp authenticated seat on non-active actions
  let stampedAction = action;
  if (action.type === 'discard' || action.type === 'tradeRespond' || action.type === 'tradeCounter') {
    stampedAction = { ...action, seat };
  }

  const result = applyAction(state, stampedAction, rng, makeRollSource(ctx, room));
  if (!result.ok) {
    if (socket === null) {
      console.warn(`[Bot AI] Action ${action.type} by seat ${seat} rejected: ${result.error} in phase ${state.phase}`);
      if (state.phase === 'turnMain' && seat === state.activeSeat) {
        handleGameAction(ctx, null, room, seat, { type: 'endTurn' });
      } else {
        void runAutoAction(ctx, room.code);
      }
    } else {
      socket.emit('error', { message: result.error });
    }
    return;
  }
  room.game.state = result.state;
  for (const e of result.events) {
    room.game.events.push(e);
    ctx.log.append(room.code, e);
    ctx.io.to(room.code).emit('game:event', e);
  }
  broadcastGame(ctx, room);
  armTimer(ctx, room);
  triggerBotTurnIfNeeded(ctx, room);
}

const botTimers = new Map<string, TimerHandle>();

function triggerBotTurnIfNeeded(ctx: ServerContext, room: Room): void {
  if (room.game === null || room.game.state.phase === 'finished') return;

  const existing = botTimers.get(room.code);
  if (existing !== undefined) {
    clearTimeout(existing);
    botTimers.delete(room.code);
  }

  const botSeats = new Set(
    room.seats
      .filter((s) => s.isBot || s.aiTakeover || !s.connected)
      .map((s) => s.seatIndex),
  );
  if (botSeats.size === 0) return;

  const state = room.game.state;
  let targetBotSeat: number | null = null;

  if (state.phase === 'discard') {
    const pendingBot = state.pendingDiscards.find((d) => !d.received && botSeats.has(d.seat));
    if (pendingBot !== undefined) targetBotSeat = pendingBot.seat;
  } else if (state.phase === 'specialBuild' && state.specialBuild !== null && state.specialBuild.seat !== null && botSeats.has(state.specialBuild.seat)) {
    targetBotSeat = state.specialBuild.seat;
  } else if (state.phase === 'turnMain') {
    // Check if there is an open trade that a bot needs to respond to
    const openTrade = state.trades.find((t) => t.status === 'open');
    if (openTrade !== undefined) {
      const botToRespond = room.seats.find((s) => {
        if (!botSeats.has(s.seatIndex)) return false;
        if (openTrade.counterOf !== null) {
          // Counter-offer: responded to by the active player
          return s.seatIndex === state.activeSeat && !openTrade.declinedBy.includes(s.seatIndex);
        }
        // Root offer: responded to by non-proposer
        return s.seatIndex !== openTrade.proposer && !openTrade.declinedBy.includes(s.seatIndex);
      });
      if (botToRespond !== undefined) {
        targetBotSeat = botToRespond.seatIndex;
      }
    }

    if (targetBotSeat === null && botSeats.has(state.activeSeat)) {
      targetBotSeat = state.activeSeat;
    }
  } else if (botSeats.has(state.activeSeat)) {
    targetBotSeat = state.activeSeat;
  }

  if (targetBotSeat === null) return;

  const botSeat = targetBotSeat;
  const isTakeoverSeat = room.seats.find((s) => s.seatIndex === botSeat)?.aiTakeover === true;
  let delay = room.botDelayMs ?? (isTakeoverSeat ? 800 : 500);
  if (state.phase === 'turnMain' && botSeat === state.activeSeat) {
    const myTrade = state.trades.find((t) => t.status === 'open' && t.proposer === botSeat);
    if (myTrade !== undefined) {
      const pendingHumans = room.seats.some(
        (s) => !botSeats.has(s.seatIndex) && s.seatIndex !== botSeat && !myTrade.declinedBy.includes(s.seatIndex),
      );
      if (pendingHumans) {
        const humanTradeWait = (room.botDelayMs !== undefined && room.botDelayMs <= 400)
          ? Math.max(room.botDelayMs * 2, 800)
          : 5000;
        delay = Math.max(delay, humanTradeWait);
      }
    }
  }

  const timer = setTimeout(() => {
    botTimers.delete(room.code);
    const currentRoom = ctx.rooms.getRoom(room.code);
    if (currentRoom?.game === null || currentRoom === undefined || currentRoom.game === null) return;
    if (currentRoom.game.state.phase === 'finished') return;

    const act = computeBotAction(currentRoom.game.state, botSeat, ctx.rooms.gameRng(currentRoom));
    if (act !== null) {
      handleGameAction(ctx, null, currentRoom, botSeat, act);
    } else {
      console.warn(`[Bot AI] computeBotAction returned null for botSeat ${botSeat} in phase ${currentRoom.game.state.phase}`);
      if (botSeat === currentRoom.game.state.activeSeat) {
        void runAutoAction(ctx, currentRoom.code);
      }
    }
  }, delay);

  botTimers.set(room.code, timer);
}

/**
 * Cancel every pending turn timer and bot move for this context's rooms.
 * Call before discarding a context (e.g. an offline host leaving) so no
 * auto-action keeps playing in the background.
 */
export function stopRoomTimers(ctx: ServerContext): void {
  for (const timer of ctx.timers.values()) clearTimeout(timer);
  ctx.timers.clear();
  ctx.timerDeadlines.clear();
  for (const room of ctx.rooms.allRooms()) {
    const timer = botTimers.get(room.code);
    if (timer === undefined) continue;
    clearTimeout(timer);
    botTimers.delete(room.code);
  }
}

function isActorAllowed(
  state: Parameters<typeof applyAction>[0],
  action: GameAction,
  seat: number,
): boolean {
  switch (action.type) {
    case 'setupPlace':
      return state.phase === 'setupForward' || state.phase === 'setupReverse'
        ? seat === state.activeSeat
        : false;
    case 'rollDice':
    case 'endTurn':
    case 'tradeOffer':
    case 'tradeCancel':
    case 'buildSettlement':
    case 'buildCity':
    case 'bankTrade':
      return seat === state.activeSeat;
    case 'buildRoad':
    case 'buyDevCard':
      // Special build: the SBP window owner; otherwise active seat.
      if (state.phase === 'specialBuild') {
        return seat === state.specialBuild?.seat;
      }
      return seat === state.activeSeat;
    case 'playDevCard':
      return seat === state.activeSeat;
    case 'moveRobber':
    case 'chooseSteal':
      return seat === state.activeSeat;
    case 'discard': {
      // Any pending discarder may submit their discard.
      return state.pendingDiscards.some((d) => d.seat === seat && !d.received);
    }
    case 'tradeRespond': {
      // Others answer the active player's offers; the active player answers
      // counter-offers made to them. The reducer enforces the same pairing.
      const offer = state.trades.find((t) => t.id === action.offerId);
      if (offer === undefined || offer.proposer === seat) return false;
      return offer.proposer === state.activeSeat || seat === state.activeSeat;
    }
    case 'tradeCounter':
      // Only non-active players counter the active player's offer.
      return seat !== state.activeSeat;
    case 'specialBuildActivate':
      return action.seat === seat && seat !== state.activeSeat;
    case 'specialBuildDone':
      return seat === state.specialBuild?.seat;
    default:
      return false;
  }
}

export function registerSocketHandlers(ctx: ServerContext): void {
  const { io } = ctx;

  io.on('connection', (socket) => {
    let joinedRoom: string | null = null;
    let joinedSeat: number | null = null;

    socket.on('room:create', (raw: unknown) => {
      const parsed = createPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit('error', { message: 'BAD_PAYLOAD' });
        return;
      }
      const room = ctx.rooms.createRoom(parsed.data.name);
      room.seats[0]!.connected = true;
      room.seats[0]!.socketId = socket.id;
      socket.join(room.code);
      joinedRoom = room.code;
      joinedSeat = 0;
      socket.emit('room:created', {
        roomCode: room.code,
        seatIndex: 0,
        reconnectToken: room.seats[0]!.reconnectToken,
      });
      socket.emit('room:state', roomStatePayload(room));
    });

    socket.on('room:join', (raw: unknown) => {
      const parsed = joinPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit('error', { message: 'BAD_PAYLOAD' });
        return;
      }
      const { code, name, token } = parsed.data;
      let room: Room | undefined;
      let seatIndex: number | undefined;
      let reconnectToken: string | undefined;

      if (token !== undefined || (room === undefined && name !== undefined && ctx.rooms.getRoom(code)?.game !== null)) {
        const res = ctx.rooms.reattachSeat(code, token, name);
        if ('error' in res) {
          socket.emit('error', { message: res.error });
          return;
        }
        room = res.room;
        seatIndex = res.seat.seatIndex;
        reconnectToken = res.seat.reconnectToken;
        res.seat.connected = true;
        res.seat.socketId = socket.id;
        res.seat.disconnectedAt = null;
        if (res.seat.isBot && res.seat.name.endsWith(' (Bot)')) {
          res.seat.isBot = false;
          res.seat.name = res.seat.name.slice(0, -6);
        }
      } else {
        const res = ctx.rooms.joinRoom(code, name!);
        if ('error' in res) {
          socket.emit('error', { message: res.error });
          return;
        }
        room = res.room;
        seatIndex = res.seat.seatIndex;
        reconnectToken = res.seat.reconnectToken;
        res.seat.connected = true;
        res.seat.socketId = socket.id;
      }

      joinedRoom = room.code;
      joinedSeat = seatIndex;
      socket.join(room.code);
      socket.emit('room:joined', { roomCode: room.code, seatIndex, reconnectToken });
      broadcastRoom(ctx, room);
      if (room.game !== null) {
        socket.emit('game:state', sanitize(room.game.state, seatIndex));
        armTimer(ctx, room);
        // A resumed room (RoomManager.importState) has no pending bot move yet.
        triggerBotTurnIfNeeded(ctx, room);
      }
    });

    socket.on('room:leave', () => {
      if (joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const mySeat = room.seats.find((s) => s.socketId === socket.id);
      const actingSeat = mySeat?.seatIndex ?? joinedSeat;
      ctx.rooms.leaveRoom(joinedRoom, actingSeat);
      socket.leave(room.code);
      joinedRoom = null;
      joinedSeat = null;
      broadcastRoom(ctx, room);
    });

    socket.on('room:setReady', (raw: unknown) => {
      const parsed = setReadySchema.safeParse(raw);
      if (!parsed.success || joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const seat = room.seats.find((s) => s.socketId === socket.id) ?? room.seats[joinedSeat];
      if (seat === undefined) return;
      seat.ready = parsed.data.ready;
      broadcastRoom(ctx, room);
    });

    socket.on('room:pickColor', (raw: unknown) => {
      const parsed = pickColorSchema.safeParse(raw);
      if (!parsed.success || joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const seat = room.seats.find((s) => s.socketId === socket.id) ?? room.seats[joinedSeat];
      if (seat === undefined) return;
      const res = ctx.rooms.pickColor(joinedRoom, seat.seatIndex, parsed.data.color as PlayerColor);
      if ('error' in res) {
        socket.emit('error', { message: res.error });
        return;
      }
      broadcastRoom(ctx, room);
    });

    socket.on('room:updateSettings', (raw: unknown) => {
      const parsed = settingsSchema.safeParse(raw);
      if (!parsed.success || joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const res = ctx.rooms.updateSettings(joinedRoom, joinedSeat, parsed.data);
      if ('error' in res) {
        socket.emit('error', { message: res.error });
        return;
      }
      broadcastRoom(ctx, room);
    });

    socket.on('room:regenerateBoard', () => {
      if (joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const res = ctx.rooms.regenerateBoard(joinedRoom, joinedSeat);
      if ('error' in res) {
        socket.emit('error', { message: res.error });
        return;
      }
      broadcastRoom(ctx, room);
    });

    socket.on('room:boardPreview', () => {
      if (joinedRoom === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      socket.emit('room:boardPreview', generateBoard(room.settings.maxPlayers as PlayerCount, room.seed));
    });

    socket.on('room:start', () => {
      if (joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const res = ctx.rooms.startGame(joinedRoom, joinedSeat);
      if ('error' in res) {
        socket.emit('error', { message: res.error });
        return;
      }
      const { room: started } = res;
      const startedEvent = started.game!.events[0]!;
      ctx.log.append(started.code, startedEvent);
      ctx.io.to(started.code).emit('game:event', startedEvent);
      ctx.io.to(started.code).emit('room:started', { roomCode: started.code });
      broadcastGame(ctx, started);
      armTimer(ctx, started);
      triggerBotTurnIfNeeded(ctx, started);
    });

    socket.on('room:addBot', () => {
      if (joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const res = ctx.rooms.addBot(joinedRoom, joinedSeat);
      if ('error' in res) {
        socket.emit('error', { message: res.error });
        return;
      }
      broadcastRoom(ctx, room);
    });

    socket.on('room:removeBot', (raw: unknown) => {
      const parsed = z.object({ seatIndex: z.number().int().nonnegative() }).safeParse(raw);
      if (!parsed.success || joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const mySeat = room.seats.find((s) => s.socketId === socket.id);
      const actingSeat = mySeat?.seatIndex ?? joinedSeat;
      const res = ctx.rooms.removeBot(joinedRoom, actingSeat, parsed.data.seatIndex);
      if ('error' in res) {
        socket.emit('error', { message: res.error });
        return;
      }
      broadcastRoom(ctx, room);
    });

    socket.on('room:toggleBot', (raw: unknown) => {
      const parsed = z.object({ seatIndex: z.number().int().nonnegative() }).safeParse(raw);
      if (!parsed.success || joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const mySeat = room.seats.find((s) => s.socketId === socket.id);
      const actingSeat = mySeat?.seatIndex ?? joinedSeat;
      const res = ctx.rooms.toggleBot(joinedRoom, actingSeat, parsed.data.seatIndex);
      if ('error' in res) {
        socket.emit('error', { message: res.error });
        return;
      }
      broadcastRoom(ctx, room);
      if (room.game !== null) {
        broadcastGame(ctx, room);
        triggerBotTurnIfNeeded(ctx, room);
      }
    });

    socket.on('room:fillBots', (raw: unknown) => {
      const parsed = z.object({ includeHost: z.boolean().optional() }).safeParse(raw ?? {});
      if (joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const mySeat = room.seats.find((s) => s.socketId === socket.id);
      const actingSeat = mySeat?.seatIndex ?? joinedSeat;
      const res = ctx.rooms.fillBots(joinedRoom, actingSeat, parsed.success ? (parsed.data.includeHost ?? true) : true);
      if ('error' in res) {
        socket.emit('error', { message: res.error });
        return;
      }
      broadcastRoom(ctx, room);
    });

    socket.on('room:setBotDelay', (raw: unknown) => {
      const parsed = z.object({ delayMs: z.number().int().min(20).max(5000) }).safeParse(raw);
      if (!parsed.success || joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const mySeat = room.seats.find((s) => s.socketId === socket.id);
      const actingSeat = mySeat?.seatIndex ?? joinedSeat;
      ctx.rooms.setBotDelay(joinedRoom, actingSeat, parsed.data.delayMs);
      if (room.game !== null) {
        triggerBotTurnIfNeeded(ctx, room);
      }
      ctx.io.to(room.code).emit('room:botDelay', { delayMs: room.botDelayMs ?? 500 });
    });

    socket.on('room:kickPlayer', (raw: unknown) => {
      const parsed = z.object({ seatIndex: z.number().int().nonnegative() }).safeParse(raw);
      if (!parsed.success || joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;

      const mySeat = room.seats.find((s) => s.socketId === socket.id);
      const actingSeat = mySeat?.seatIndex ?? joinedSeat;

      const targetSeatIndex = parsed.data.seatIndex;
      const targetSeat = room.seats[targetSeatIndex];
      const targetSocketId = targetSeat?.socketId;

      const res = ctx.rooms.kickPlayer(joinedRoom, actingSeat, targetSeatIndex);
      if ('error' in res) {
        socket.emit('error', { message: res.error });
        return;
      }

      if (targetSocketId) {
        ctx.io.to(targetSocketId).emit('room:kicked', { reason: 'You were removed from the room by the host.' });
      }

      broadcastRoom(ctx, room);
      if (room.game !== null) {
        broadcastGame(ctx, room);
        triggerBotTurnIfNeeded(ctx, room);
      }
    });

    socket.on('game:action', (raw: unknown) => {
      const parsed = gameActionSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit('error', { message: 'BAD_ACTION' });
        return;
      }
      if (joinedRoom === null || joinedSeat === null) {
        socket.emit('error', { message: 'NOT_IN_ROOM' });
        return;
      }
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) {
        socket.emit('error', { message: 'ROOM_NOT_FOUND' });
        return;
      }
      handleGameAction(ctx, socket, room, joinedSeat, parsed.data);
    });

    socket.on('game:requestState', () => {
      if (joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room?.game === null || room === undefined || room.game === null) return;
      socket.emit('game:state', sanitize(room.game.state, joinedSeat));
    });

    socket.on('room:resumeControl', () => {
      if (joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const mySeat = room.seats.find((s) => s.socketId === socket.id);
      const actingSeat = mySeat?.seatIndex ?? joinedSeat;
      ctx.rooms.resumeControl(joinedRoom, actingSeat);
      broadcastRoom(ctx, room);
      if (room.game !== null) {
        broadcastGame(ctx, room);
      }
    });

    socket.on('admin:verify', (raw: unknown) => {
      const parsed = z.object({ password: z.string() }).safeParse(raw);
      if (!parsed.success) {
        socket.emit('admin:verifyResult', { ok: false });
        return;
      }
      const ok = verifyAdminPassword(parsed.data.password);
      socket.emit('admin:verifyResult', { ok });
    });

    socket.on('disconnect', () => {
      if (joinedRoom === null || joinedSeat === null) return;
      const room = ctx.rooms.getRoom(joinedRoom);
      if (room === undefined) return;
      const seat = room.seats.find((s) => s.seatIndex === joinedSeat);
      if (seat !== undefined && seat.socketId === socket.id) {
        seat.connected = false;
        seat.socketId = null;
        seat.disconnectedAt = Date.now();
        if (room.game !== null && !seat.isBot) {
          seat.aiTakeover = true;
        }
        broadcastRoom(ctx, room);
        if (room.game !== null) {
          broadcastGame(ctx, room);
          triggerBotTurnIfNeeded(ctx, room);
        }
      }
    });
  });
}
