// Socket singleton: typed client wrapper over the ACTIVE transport. Online
// (default) that is socket.io-client — same-origin via the vite dev proxy,
// auto-reconnect built in, resyncs on reconnect. Offline modes swap in an
// in-page hub endpoint (host) or a WebRTC data channel (guest) via
// setTransport(); resetToOnline() swaps socket.io back.

import { io, type Socket } from 'socket.io-client';
import type { GameAction } from '@catan/shared';
import type { ClientTransport, TransportListener } from './net/transport';
import type { ErrorInfo, GameEvent, PersonalSnapshot, RoomSettingsPatch, RoomState, TimerInfo } from './types';

export interface SocketHandlers {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onRoomState?: (state: RoomState) => void;
  onRoomCreated?: (payload: { roomCode: string; seatIndex: number; reconnectToken: string }) => void;
  onRoomJoined?: (payload: { roomCode: string; seatIndex: number; reconnectToken: string }) => void;
  onRoomStarted?: (payload: { roomCode: string }) => void;
  onRoomKicked?: (payload?: { reason?: string }) => void;
  onRoomSeatSync?: (payload: { seatIndex: number }) => void;
  onGameState?: (snap: PersonalSnapshot) => void;
  onGameEvent?: (event: GameEvent) => void;
  onTimer?: (info: TimerInfo) => void;
  onError?: (err: ErrorInfo) => void;
}

const HANDLER_EVENTS: ReadonlyArray<readonly [keyof SocketHandlers, string]> = [
  ['onConnect', 'connect'],
  ['onDisconnect', 'disconnect'],
  ['onRoomState', 'room:state'],
  ['onRoomCreated', 'room:created'],
  ['onRoomJoined', 'room:joined'],
  ['onRoomStarted', 'room:started'],
  ['onRoomKicked', 'room:kicked'],
  ['onRoomSeatSync', 'room:seatSync'],
  ['onGameState', 'game:state'],
  ['onGameEvent', 'game:event'],
  ['onTimer', 'game:timer'],
  ['onError', 'error'],
];

let socket: Socket | null = null;
/** Offline transport overriding socket.io; null = online. */
let override: ClientTransport | null = null;
let handlers: SocketHandlers | null = null;
/** Transport currently carrying `handlers`. */
let bound: ClientTransport | null = null;
/** The app connected online (App mount); resetToOnline() then reconnects socket.io. */
let onlineWanted = false;

const SERVER_URL_KEY = 'catan.serverUrl';

export function getCustomServerUrl(): string | null {
  try {
    return localStorage.getItem(SERVER_URL_KEY);
  } catch {
    return null;
  }
}

export function setCustomServerUrl(url: string | null): void {
  try {
    if (url === null) localStorage.removeItem(SERVER_URL_KEY);
    else localStorage.setItem(SERVER_URL_KEY, url);
  } catch {
    // ignore
  }
}

export function switchServerUrl(newUrl: string | null): void {
  setCustomServerUrl(newUrl);
  if (socket !== null) {
    detachHandlers();
    socket.disconnect();
    socket = null;
  }
  resetToOnline();
}

export const DEFAULT_PRODUCTION_SERVER_URL = 'https://catan-fh8w.onrender.com';

/** The socket.io socket (online transport), created lazily without connecting. */
export function getSocket(): Socket {
  if (socket === null) {
    // Same-origin by default in dev (Vite proxy), but default to production Render server in deployed builds.
    const customUrl = getCustomServerUrl();
    const envUrl = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
    const defaultUrl = import.meta.env.DEV ? '' : DEFAULT_PRODUCTION_SERVER_URL;
    const serverUrl = customUrl || envUrl || defaultUrl;
    socket = serverUrl
      ? io(serverUrl, { autoConnect: false, transports: ['websocket', 'polling'] })
      : io({ autoConnect: false });
  }
  return socket;
}

/** The transport every emitter talks through right now. */
export function getTransport(): ClientTransport {
  return override ?? getSocket();
}

function detachHandlers(): void {
  if (bound !== null && handlers !== null) {
    for (const [key, event] of HANDLER_EVENTS) {
      const handler = handlers[key];
      if (handler !== undefined) bound.off(event, handler);
    }
  }
  bound = null;
}

function attachHandlers(): ClientTransport {
  const t = getTransport();
  if (bound === t) return t;
  detachHandlers();
  if (handlers !== null) {
    for (const [key, event] of HANDLER_EVENTS) {
      const handler = handlers[key];
      if (handler !== undefined) t.on(event, handler);
    }
  }
  bound = t;
  return t;
}

/** Install the store's handlers on the active transport without connecting it. */
export function setSocketHandlers(next: SocketHandlers): void {
  detachHandlers();
  handlers = next;
  attachHandlers();
}

export function hasSocketHandlers(): boolean {
  return handlers !== null;
}

/** Install handlers and connect the active transport. */
export function connectSocket(next: SocketHandlers): ClientTransport {
  setSocketHandlers(next);
  onlineWanted = true;
  const t = getTransport();
  t.connect();
  return t;
}

/**
 * Route all traffic through `t` (offline modes). The previous transport is
 * disconnected with the handlers already detached, so the store only sees
 * lifecycle events of the new one. Stops socket.io reconnect attempts.
 */
export function setTransport(t: ClientTransport): void {
  const previous = override ?? socket;
  if (previous === t) return;
  detachHandlers();
  override = t;
  previous?.disconnect();
  attachHandlers();
  t.connect();
}

/** Stop socket.io and its reconnect attempts ahead of an offline transport. */
export function disconnectOnline(): void {
  if (override === null) socket?.disconnect();
}

/** Drop any offline transport and go back to socket.io, reconnecting it if the app went online. */
export function resetToOnline(): void {
  const previous = override;
  if (previous !== null) {
    detachHandlers();
    override = null;
    previous.disconnect();
  }
  // Never used online yet: handlers attach when connectSocket() first runs.
  if (socket === null) return;
  const t = attachHandlers();
  if (onlineWanted && !t.connected) t.connect();
}

/** One-shot listener on the active transport. */
export function onceEvent(event: string, handler: (payload?: unknown) => void): void {
  const t = getTransport();
  const wrapped: TransportListener = (payload?: unknown) => {
    t.off(event, wrapped);
    handler(payload);
  };
  t.on(event, wrapped);
}

// Client -> server emitters
export function emitCreateRoom(name: string): void {
  getTransport().emit('room:create', { name });
}

export function emitJoinRoom(payload: { code: string; name?: string; token?: string }): void {
  getTransport().emit('room:join', payload);
}

export function emitLeaveRoom(): void {
  getTransport().emit('room:leave');
}

export function emitSetReady(ready: boolean): void {
  getTransport().emit('room:setReady', { ready });
}

export function emitPickColor(color: string): void {
  getTransport().emit('room:pickColor', { color });
}

export function emitUpdateSettings(patch: RoomSettingsPatch): void {
  getTransport().emit('room:updateSettings', patch);
}

export function emitRegenerateBoard(): void {
  getTransport().emit('room:regenerateBoard');
}

export function emitStartGame(): void {
  getTransport().emit('room:start');
}

export function emitAddBot(): void {
  getTransport().emit('room:addBot');
}

export function emitToggleBot(seatIndex: number): void {
  getTransport().emit('room:toggleBot', { seatIndex });
}

export function emitFillBots(includeHost = true): void {
  getTransport().emit('room:fillBots', { includeHost });
}

export function emitSetBotDelay(delayMs: number): void {
  getTransport().emit('room:setBotDelay', { delayMs });
}

export function emitRemoveBot(seatIndex: number): void {
  getTransport().emit('room:removeBot', { seatIndex });
}

export function emitKickPlayer(seatIndex: number): void {
  getTransport().emit('room:kickPlayer', { seatIndex });
}

export function emitAction(action: GameAction): void {
  getTransport().emit('game:action', action);
}

export function emitRequestState(): void {
  getTransport().emit('game:requestState');
}

export function emitResumeControl(): void {
  getTransport().emit('room:resumeControl');
}
