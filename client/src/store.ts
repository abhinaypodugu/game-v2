// Zustand store: server events are the only writers of game state. UI
// state (placement mode, modals) lives here too.

import { create } from 'zustand';
import type { GameAction } from '@catan/shared';
import {
  connectSocket,
  emitAction,
  emitCreateRoom,
  emitJoinRoom,
  emitLeaveRoom,
  emitPickColor,
  emitRegenerateBoard,
  emitRequestState,
  emitSetReady,
  emitStartGame,
  emitUpdateSettings,
} from './socket';
import type { GameEvent, PersonalSnapshot, RoomState, TimerInfo } from './types';

export type Route = 'home' | 'room' | 'game';

export interface Session {
  roomCode: string;
  seatIndex: number;
  reconnectToken: string;
}

export interface PlacementMode {
  kind: 'settlement' | 'city' | 'road' | 'robber';
}

interface UIState {
  selectedTrade: string | null;
  placement: PlacementMode | null;
  showTradeModal: boolean;
  toasts: Array<{ id: number; message: string; kind: 'error' | 'info' }>;
}

export interface Store {
  connected: boolean;
  route: Route;
  session: Session | null;
  room: RoomState | null;
  game: PersonalSnapshot | null;
  log: GameEvent[];
  timer: TimerInfo | null;
  ui: UIState;

  connect(): void;
  createRoom(name: string): void;
  joinRoom(code: string, name?: string, token?: string): void;
  leaveRoom(): void;
  setReady(ready: boolean): void;
  pickColor(color: string): void;
  updateSettings(patch: { maxPlayers?: number; turnTimerSec?: number; diceMode?: 'random' | 'balanced' }): void;
  regenerateBoard(): void;
  startGame(): void;
  sendAction(action: GameAction): void;
  resync(): void;
  clearSession(): void;
  setPlacement(mode: PlacementMode | null): void;
  setTradeModal(open: boolean): void;
  selectTrade(id: string | null): void;
  pushToast(message: string, kind?: 'error' | 'info'): void;
}

const SESSION_KEY = 'catan.session';

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw === null) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null): void {
  if (s === null) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

let toastId = 0;

export const useStore = create<Store>((set, get) => ({
  connected: false,
  route: 'home',
  session: null,
  room: null,
  game: null,
  log: [],
  timer: null,
  ui: { selectedTrade: null, placement: null, showTradeModal: false, toasts: [] },

  connect() {
    connectSocket({
      onRoomState: (room) => {
        const session = get().session;
        const sameRoom = session !== null && session.roomCode === room.roomCode;
        set({
          room,
          route: room.started && sameRoom ? 'game' : room.started && session === null ? 'home' : sameRoom ? 'room' : get().route,
        });
      },
      onRoomCreated: (payload) => {
        const session: Session = {
          roomCode: payload.roomCode,
          seatIndex: payload.seatIndex,
          reconnectToken: payload.reconnectToken,
        };
        saveSession(session);
        set({ session, route: 'room' });
      },
      onRoomJoined: (payload) => {
        const session: Session = {
          roomCode: payload.roomCode,
          seatIndex: payload.seatIndex,
          reconnectToken: payload.reconnectToken,
        };
        saveSession(session);
        const room = get().room;
        set({
          session,
          route: room?.started === true ? 'game' : 'room',
        });
      },
      onRoomStarted: () => {
        set({ route: 'game' });
      },
      onGameState: (snap) => {
        set({ game: snap });
        if (snap.phase === 'finished') {
          set((s) => ({ ui: { ...s.ui, placement: null, showTradeModal: false } }));
        }
      },
      onGameEvent: (event) => {
        set((s) => ({ log: [...s.log, event] }));
      },
      onTimer: (info) => {
        set({ timer: info });
      },
      onError: (err) => {
        get().pushToast(err.message, 'error');
      },
    });

    // Auto-rejoin from the persisted session on (re)connect.
    const { io } = { io: undefined };
    void io;
    const s = getSocketReconnectHelper();
    s.on('connect', () => {
      set({ connected: true });
      const session = loadSession();
      if (session !== null) {
        emitJoinRoom({ code: session.roomCode, token: session.reconnectToken });
        emitRequestState();
      }
    });
    s.on('disconnect', () => {
      set({ connected: false });
    });
  },

  createRoom(name) {
    emitCreateRoom(name);
  },

  joinRoom(code, name, token) {
    emitJoinRoom({ code, name, token });
  },

  leaveRoom() {
    saveSession(null);
    emitLeaveRoom();
    set({ session: null, room: null, game: null, log: [], timer: null, route: 'home' });
  },

  setReady(ready) {
    emitSetReady(ready);
  },

  pickColor(color) {
    emitPickColor(color);
  },

  updateSettings(patch) {
    emitUpdateSettings(patch);
  },

  regenerateBoard() {
    emitRegenerateBoard();
  },

  startGame() {
    emitStartGame();
  },

  sendAction(action) {
    emitAction(action);
  },

  resync() {
    emitRequestState();
  },

  clearSession() {
    saveSession(null);
    set({ session: null, route: 'home' });
  },

  setPlacement(mode) {
    set((s) => ({ ui: { ...s.ui, placement: mode } }));
  },

  setTradeModal(open) {
    set((s) => ({ ui: { ...s.ui, showTradeModal: open } }));
  },

  selectTrade(id) {
    set((s) => ({ ui: { ...s.ui, selectedTrade: id } }));
  },

  pushToast(message, kind = 'info') {
    const id = ++toastId;
    set((s) => ({ ui: { ...s.ui, toasts: [...s.ui.toasts, { id, message, kind }] } }));
    setTimeout(() => {
      set((s) => ({ ui: { ...s.ui, toasts: s.ui.toasts.filter((t) => t.id !== id) } }));
    }, 4000);
  },
}));

// Local import shim to avoid circular import in the connect handler.
import { getSocket } from './socket';
function getSocketReconnectHelper() {
  return getSocket();
}

export function bootstrapSessionRejoin(): void {
  // Called from App on mount before connect() if a session exists.
  const session = loadSession();
  if (session !== null) {
    useStore.setState({ session });
  }
}
