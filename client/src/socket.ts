// Socket singleton: typed client wrapper over socket.io-client. Same-origin
// via the vite dev proxy; auto-reconnect built in; resyncs on reconnect.

import { io, type Socket } from 'socket.io-client';
import type { GameAction } from '@catan/shared';
import type { ErrorInfo, GameEvent, PersonalSnapshot, RoomState, TimerInfo } from './types';

export interface SocketHandlers {
  onRoomState?: (state: RoomState) => void;
  onRoomCreated?: (payload: { roomCode: string; seatIndex: number; reconnectToken: string }) => void;
  onRoomJoined?: (payload: { roomCode: string; seatIndex: number; reconnectToken: string }) => void;
  onRoomStarted?: (payload: { roomCode: string }) => void;
  onGameState?: (snap: PersonalSnapshot) => void;
  onGameEvent?: (event: GameEvent) => void;
  onTimer?: (info: TimerInfo) => void;
  onError?: (err: ErrorInfo) => void;
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket === null) {
    socket = io({ autoConnect: false });
  }
  return socket;
}

export function connectSocket(handlers: SocketHandlers): Socket {
  const s = getSocket();
  s.off('room:state');
  s.off('room:created');
  s.off('room:joined');
  s.off('room:started');
  s.off('game:state');
  s.off('game:event');
  s.off('game:timer');
  s.off('error');

  if (handlers.onRoomState !== undefined) s.on('room:state', handlers.onRoomState);
  if (handlers.onRoomCreated !== undefined) s.on('room:created', handlers.onRoomCreated);
  if (handlers.onRoomJoined !== undefined) s.on('room:joined', handlers.onRoomJoined);
  if (handlers.onRoomStarted !== undefined) s.on('room:started', handlers.onRoomStarted);
  if (handlers.onGameState !== undefined) s.on('game:state', handlers.onGameState);
  if (handlers.onGameEvent !== undefined) s.on('game:event', handlers.onGameEvent);
  if (handlers.onTimer !== undefined) s.on('game:timer', handlers.onTimer);
  if (handlers.onError !== undefined) s.on('error', handlers.onError);
  s.connect();
  return s;
}

// Client -> server emitters
export function emitCreateRoom(name: string): void {
  getSocket().emit('room:create', { name });
}

export function emitJoinRoom(payload: { code: string; name?: string; token?: string }): void {
  getSocket().emit('room:join', payload);
}

export function emitLeaveRoom(): void {
  getSocket().emit('room:leave');
}

export function emitSetReady(ready: boolean): void {
  getSocket().emit('room:setReady', { ready });
}

export function emitPickColor(color: string): void {
  getSocket().emit('room:pickColor', { color });
}

export function emitUpdateSettings(patch: {
  maxPlayers?: number;
  turnTimerSec?: number;
  diceMode?: 'random' | 'balanced';
}): void {
  getSocket().emit('room:updateSettings', patch);
}

export function emitRegenerateBoard(): void {
  getSocket().emit('room:regenerateBoard');
}

export function emitStartGame(): void {
  getSocket().emit('room:start');
}

export function emitAction(action: GameAction): void {
  getSocket().emit('game:action', action);
}

export function emitRequestState(): void {
  getSocket().emit('game:requestState');
}
