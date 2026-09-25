// Zustand store: server events are the only writers of game state. UI
// state (placement mode, modals) lives here too. The "server" is whatever
// transport socket.ts routes through: socket.io online, or the in-page host
// / WebRTC channel in offline mode (net/offline.ts).

import { create } from 'zustand';
import type { MemoryHub } from '@catan/host';
import type { GameAction } from '@catan/shared';
import {
  connectSocket,
  emitAction,
  emitAddBot,
  emitCreateRoom,
  emitJoinRoom,
  emitLeaveRoom,
  emitPickColor,
  emitRegenerateBoard,
  emitRemoveBot,
  emitRequestState,
  emitSetReady,
  emitStartGame,
  emitUpdateSettings,
  hasSocketHandlers,
  onceEvent,
  setSocketHandlers,
  type SocketHandlers,
} from './socket';
import { INITIAL_OFFLINE_STATE, OfflineController, type Invite, type OfflineState } from './net/offline';
import type { GameEvent, PersonalSnapshot, RoomSettingsPatch, RoomState, TimerInfo } from './types';

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
  offline: OfflineState;

  connect(): void;
  createRoom(name: string): Promise<void> | void;
  joinRoom(code: string, name?: string, token?: string): void;
  leaveRoom(): void;
  setReady(ready: boolean): void;
  pickColor(color: string): void;
  updateSettings(patch: RoomSettingsPatch): void;
  regenerateBoard(): void;
  addBot(): void;
  removeBot(seatIndex: number): void;
  startGame(): void;
  startQuickPlay(name?: string): void;
  sendAction(action: GameAction): void;
  resync(): void;
  clearSession(): void;
  setPlacement(mode: PlacementMode | null): void;
  setTradeModal(open: boolean): void;
  selectTrade(id: string | null): void;
  pushToast(message: string, kind?: 'error' | 'info'): void;

  /** Host an offline game in this page; resolves once the room exists (route → room). */
  startOfflineHost(name: string): Promise<void>;
  /** Host: open a pairing slot; resolves with the invite code once ICE gathering is done. */
  createInvite(): Promise<Invite>;
  /** Guest: answer an invite. `connected` resolves when the channel opens (the guest then joins the room). */
  joinOffline(inviteCode: string, name: string): Promise<{ replyCode: string; connected: Promise<void> }>;
  /** Guest: connect to offline host by 4-letter room code or single scan via signaling broker. */
  joinOfflineByCode(code: string, name: string): Promise<void>;
  /** A saved offline host game exists on this device. */
  canResumeOfflineHost(): boolean;
  /** Restore the saved offline host game and rejoin it as the host. */
  resumeOfflineHost(): Promise<void>;
  /** Tear down offline mode (hub, peers, wake lock, saved host game) and return online. */
  leaveOffline(): void;
}

// Session key namespaced by URL query so multiple players can share one
// browser (each tab = its own seat) — e.g. ?p=bob. Offline sessions live
// under their own key so an offline room never triggers an online rejoin.
const SESSION_KEY = `catan.session${window.location.search}`;
const OFFLINE_SESSION_KEY = `lc.offlineSession${window.location.search}`;

function readSession(key: string): Session | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function writeSession(key: string, s: Session | null): void {
  if (s === null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(s));
}

function sessionKey(): string {
  return useStore.getState().offline.role === null ? SESSION_KEY : OFFLINE_SESSION_KEY;
}

function loadSession(): Session | null {
  return readSession(sessionKey());
}

function saveSession(s: Session | null): void {
  writeSession(sessionKey(), s);
}

let toastId = 0;

// Transport handlers: installed on whichever transport is active.
export const socketHandlers: SocketHandlers = {
  onConnect: () => {
    useStore.setState({ connected: true });
    // Offline transports join explicitly (net/offline.ts); only socket.io
    // auto-rejoins from the persisted session on (re)connect.
    if (useStore.getState().offline.role !== null) return;
    const session = loadSession();
    if (session !== null) {
      emitJoinRoom({ code: session.roomCode, token: session.reconnectToken });
      emitRequestState();
    }
  },
  onDisconnect: () => {
    useStore.setState({ connected: false });
  },
  onRoomState: (room) => {
    const { session, route, room: prevRoom } = useStore.getState();
    const sameRoom = session !== null && session.roomCode === room.roomCode;
    const customDevDeck =
      room.settings.customDevDeck !== undefined
        ? room.settings.customDevDeck
        : prevRoom?.roomCode === room.roomCode
          ? prevRoom.settings.customDevDeck
          : undefined;

    const mergedRoom: RoomState = {
      ...room,
      settings: {
        ...room.settings,
        ...(customDevDeck !== undefined ? { customDevDeck } : {}),
      },
    };

    useStore.setState({
      room: mergedRoom,
      route: room.started && sameRoom ? 'game' : room.started && session === null ? 'home' : sameRoom ? 'room' : route,
    });
  },
  onRoomCreated: (payload) => {
    const session: Session = {
      roomCode: payload.roomCode,
      seatIndex: payload.seatIndex,
      reconnectToken: payload.reconnectToken,
    };
    saveSession(session);
    useStore.setState({ session, route: 'room' });
  },
  onRoomJoined: (payload) => {
    const session: Session = {
      roomCode: payload.roomCode,
      seatIndex: payload.seatIndex,
      reconnectToken: payload.reconnectToken,
    };
    saveSession(session);
    const room = useStore.getState().room;
    useStore.setState({
      session,
      route: room?.started === true ? 'game' : 'room',
    });
  },
  onRoomStarted: () => {
    useStore.setState({ route: 'game' });
  },
  onGameState: (snap) => {
    useStore.setState({ game: snap });
    const currentSession = useStore.getState().session;
    if (currentSession === null || currentSession.seatIndex !== snap.you.seat) {
      const room = useStore.getState().room;
      const roomCode = room?.roomCode ?? currentSession?.roomCode ?? '';
      const updatedSession: Session = {
        roomCode,
        seatIndex: snap.you.seat,
        reconnectToken: currentSession?.reconnectToken ?? '',
      };
      saveSession(updatedSession);
      useStore.setState({ session: updatedSession });
    }
    if (snap.phase === 'finished') {
      useStore.setState((s) => ({ ui: { ...s.ui, placement: null, showTradeModal: false } }));
    }
  },
  onGameEvent: (event) => {
    useStore.setState((s) => ({ log: [...s.log, event] }));
  },
  onTimer: (info) => {
    useStore.setState({ timer: info });
  },
  onError: (err) => {
    useStore.getState().pushToast(err.message, 'error');
  },
};

export const useStore = create<Store>((set, get) => ({
  connected: false,
  route: 'home',
  session: null,
  room: null,
  game: null,
  log: [],
  timer: null,
  ui: { selectedTrade: null, placement: null, showTradeModal: false, toasts: [] },
  offline: INITIAL_OFFLINE_STATE,

  connect() {
    connectSocket(socketHandlers);
  },

  async createRoom(name) {
    const finalName = name.trim();
    if (!finalName) return;
    if (!get().connected) {
      try {
        await get().startOfflineHost(finalName);
      } catch (err) {
        get().pushToast(err instanceof Error ? err.message : 'Could not create room.', 'error');
      }
      return;
    }
    emitCreateRoom(finalName);
  },

  async joinRoom(code, name, token) {
    const finalCode = code.trim().toUpperCase();
    const finalName = name?.trim() || 'Player';
    if (!finalCode) return;

    if (!get().connected) {
      try {
        await get().joinOfflineByCode(finalCode, finalName);
      } catch (err) {
        get().pushToast(
          err instanceof Error
            ? err.message
            : 'Could not connect to room. If you are completely offline with no signal, scan QR under "Join a game".',
          'error',
        );
      }
      return;
    }
    emitJoinRoom({ code: finalCode, name: finalName, token });
  },

  leaveRoom() {
    if (get().offline.role !== null) {
      get().leaveOffline();
      return;
    }
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
    const current = get().room;
    if (current) {
      set({
        room: {
          ...current,
          settings: {
            ...current.settings,
            ...patch,
          },
        },
      });
    }
    emitUpdateSettings(patch);
  },

  regenerateBoard() {
    emitRegenerateBoard();
  },
  addBot() {
    emitAddBot();
  },

  removeBot(seatIndex) {
    emitRemoveBot(seatIndex);
  },

  startGame() {
    emitStartGame();
  },

  async startQuickPlay(name = 'Player') {
    const finalName = name.trim() || 'Player';
    try {
      await get().startOfflineHost(finalName);
      get().pickColor('red');
      get().setReady(true);
      get().addBot();
      get().addBot();
      get().addBot();
      const tryStart = (): void => {
        const room = get().room;
        if (room && room.players.length === 4 && room.players.every((p) => p.ready && p.color !== null)) {
          get().startGame();
        } else {
          setTimeout(tryStart, 50);
        }
      };
      setTimeout(tryStart, 50);
    } catch (err) {
      get().pushToast(err instanceof Error ? err.message : 'Could not start quick play.', 'error');
    }
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

  startOfflineHost(name) {
    return offline.startOfflineHost(name);
  },

  createInvite() {
    return offline.createInvite();
  },

  joinOffline(inviteCode, name) {
    return offline.joinOffline(inviteCode, name);
  },

  joinOfflineByCode(code, name) {
    return offline.joinOfflineByCode(code, name);
  },

  canResumeOfflineHost() {
    return offline.canResumeOfflineHost();
  },

  resumeOfflineHost() {
    return offline.resumeOfflineHost();
  },

  leaveOffline() {
    offline.leaveOffline();
  },
}));

// Annotated: its bridge closes over useStore, whose actions close over it.
const offline: OfflineController = new OfflineController({
  getOffline: () => useStore.getState().offline,
  patchOffline: (patch) => {
    useStore.setState((s) => ({ offline: { ...s.offline, ...patch } }));
  },
  getSession: () => useStore.getState().session,
  setSession: (session) => {
    writeSession(OFFLINE_SESSION_KEY, session);
    useStore.setState({ session });
  },
  loadOfflineSession: () => readSession(OFFLINE_SESSION_KEY),
  ensureHandlers: () => {
    if (!hasSocketHandlers()) setSocketHandlers(socketHandlers);
  },
  setConnected: (connected) => {
    useStore.setState({ connected });
  },
  resetToHome: () => {
    useStore.setState((s) => ({
      // Offline mode had already dropped socket.io; resetToOnline() is reconnecting it.
      connected: false,
      session: null,
      room: null,
      game: null,
      log: [],
      timer: null,
      route: 'home',
      ui: { ...s.ui, selectedTrade: null, placement: null, showTradeModal: false },
    }));
  },
  toast: (message, kind) => {
    useStore.getState().pushToast(message, kind);
  },
});

/** The in-page hub while hosting offline (tests/diagnostics); null otherwise. */
export function getOfflineHostHub(): MemoryHub | null {
  return offline.hostHub;
}

export function bootstrapSessionRejoin(): void {
  // Called from App on mount before connect() if a session exists.
  const session = loadSession();
  if (session !== null) {
    useStore.setState({ session });
  }
}
if (import.meta.env.DEV) {
  (window as unknown as { __catanStore?: typeof useStore }).__catanStore = useStore;
}
