// Offline play: one phone hosts the authoritative game in-page (MemoryHub +
// the @catan/host handlers), other phones pair over WebRTC data channels by
// exchanging QR/text codes. The controller owns the host runtime and guest
// link; the store owns UI-visible state and reaches in through a bridge.

import {
  MemoryHub,
  noopLog,
  registerSocketHandlers,
  RoomManager,
  stopRoomTimers,
  type ServerContext,
  type TimerHandle,
} from '@catan/host';
import { disconnectOnline, emitCreateRoom, emitJoinRoom, resetToOnline, setTransport } from '../socket';
import type { Session } from '../store';
import type { RoomState } from '../types';
import { ChannelTransport } from './channelTransport';
import { EndpointTransport } from './endpointTransport';
import { acceptOffer, bridgeChannelToHub, createOffer, watchLink, type GuestAnswer, type HostOffer, type HubBridge } from './peer';
import type { ClientTransport, TransportListener } from './transport';

export type OfflineRole = 'host' | 'guest';

export interface OfflinePeer {
  id: string;
  /** Player name once known (from their join request, then their seat). */
  name: string | null;
  /** Closed peers are dropped from the list right away. */
  state: 'pairing' | 'open' | 'closed';
}

export interface Invite {
  /** Invite code for the guest to scan. */
  code: string;
  /** Apply the guest's reply code; rejects with CodeError on a bad code (the invite stays usable). */
  accept(replyCode: string): Promise<void>;
  /** Abandon the invite while still pairing; no-op once the guest is connected. */
  cancel(): void;
}

export interface OfflineState {
  role: OfflineRole | null;
  peers: OfflinePeer[];
  /** Guest: the channel to the host closed; re-scan a new invite to rejoin. */
  hostLost: boolean;
}

export const INITIAL_OFFLINE_STATE: OfflineState = { role: null, peers: [], hostLost: false };

/** localStorage key of the host's resumable game. */
export const OFFLINE_HOST_KEY = 'lc.offlineHost';
const PERSIST_THROTTLE_MS = 500;
const HOST_REPLY_TIMEOUT_MS = 5000;
const MAX_NAME_LENGTH = 24;

/** Store surface the controller needs; implemented by store.ts. */
export interface OfflineBridge {
  getOffline(): OfflineState;
  patchOffline(patch: Partial<OfflineState>): void;
  getSession(): Session | null;
  /** Replace the store session and persist it under the (offline) session key. */
  setSession(session: Session): void;
  /** The session saved by an earlier offline join/host on this device. */
  loadOfflineSession(): Session | null;
  /** Install the store's transport handlers if the app has not connected yet. */
  ensureHandlers(): void;
  setConnected(connected: boolean): void;
  /** Back to the home screen with no room/game (after leaving offline mode). */
  resetToHome(): void;
  toast(message: string, kind: 'error' | 'info'): void;
}

interface SavedHostGame {
  v: 1;
  rooms: string;
  session: Session;
}

interface HostPeerLink {
  offer: HostOffer;
  bridge: HubBridge | null;
  /** The guest's reply was applied; a later failure is worth telling the host. */
  accepted: boolean;
  seatIndex: number | null;
}

interface HostRuntime {
  hub: MemoryHub;
  rooms: RoomManager;
  ctx: ServerContext;
  transport: EndpointTransport;
  links: Map<string, HostPeerLink>;
  persistTimer: TimerHandle | null;
}

interface GuestLink {
  answer: GuestAnswer;
  transport: ChannelTransport | null;
  stopWatching: (() => void) | null;
}

export class OfflineController {
  private readonly bridge: OfflineBridge;
  private host: HostRuntime | null = null;
  private guest: GuestLink | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private peerSeq = 0;

  constructor(bridge: OfflineBridge) {
    this.bridge = bridge;
  }

  /** The in-page hub while hosting (diagnostics/tests). */
  get hostHub(): MemoryHub | null {
    return this.host?.hub ?? null;
  }

  // ---------------------------------------------------------------- host

  async startOfflineHost(name: string): Promise<void> {
    this.teardown();
    const host = this.bootHost(new RoomManager());
    this.bridge.patchOffline({ ...INITIAL_OFFLINE_STATE, role: 'host' });
    const created = waitForReply(host.transport, 'room:created');
    setTransport(host.transport);
    // After the switch so handlers land on the hub transport, not a fresh socket.io.
    this.bridge.ensureHandlers();
    emitCreateRoom(cleanName(name));
    try {
      await created;
    } catch (err) {
      this.exit();
      throw err;
    }
    this.persistHost();
    this.startHostingServices();
  }

  canResumeOfflineHost(): boolean {
    return readSavedHost() !== null;
  }

  async resumeOfflineHost(): Promise<void> {
    const saved = readSavedHost();
    if (saved === null) throw new Error('There is no saved offline game on this phone.');
    const rooms = new RoomManager();
    try {
      rooms.importState(saved.rooms);
    } catch {
      localStorage.removeItem(OFFLINE_HOST_KEY);
      throw new Error('The saved offline game could not be restored.');
    }
    if (rooms.getRoom(saved.session.roomCode) === undefined) {
      localStorage.removeItem(OFFLINE_HOST_KEY);
      throw new Error('The saved offline game could not be restored.');
    }

    this.teardown();
    const host = this.bootHost(rooms);
    this.bridge.patchOffline({ ...INITIAL_OFFLINE_STATE, role: 'host' });
    this.bridge.setSession(saved.session);
    const joined = waitForReply(host.transport, 'room:joined');
    setTransport(host.transport);
    this.bridge.ensureHandlers();
    emitJoinRoom({ code: saved.session.roomCode, token: saved.session.reconnectToken });
    try {
      await joined;
    } catch (err) {
      this.exit();
      throw err;
    }
    this.startHostingServices();
  }

  async createInvite(): Promise<Invite> {
    const host = this.host;
    const session = this.bridge.getSession();
    if (host === null || session === null) throw new Error('Start hosting an offline game first.');

    const id = `peer-${++this.peerSeq}`;
    this.setPeers([...this.bridge.getOffline().peers, { id, name: null, state: 'pairing' }]);
    let offer: HostOffer;
    try {
      offer = await createOffer(session.roomCode);
    } catch (err) {
      this.dropPeer(id);
      throw err;
    }
    if (this.host !== host) {
      offer.close();
      throw new Error('Hosting stopped.');
    }

    const link: HostPeerLink = { offer, bridge: null, accepted: false, seatIndex: null };
    host.links.set(id, link);
    offer.opened.then(
      (channel) => {
        if (this.host !== host || host.links.get(id) !== link) {
          offer.close();
          return;
        }
        link.bridge = bridgeChannelToHub(offer.pc, channel, host.hub, {
          onClientMessage: (event, payload) => {
            if (event === 'room:join') this.notePeerName(id, joinName(payload));
          },
          onServerMessage: (event, payload) => this.observePeerTraffic(id, link, event, payload),
          onClose: () => {
            if (host.links.get(id) === link) host.links.delete(id);
            this.dropPeer(id);
          },
        });
        this.patchPeer(id, { state: 'open' });
      },
      (err: unknown) => {
        // Cancelled or torn down: already cleaned up by whoever closed it.
        if (host.links.get(id) !== link) return;
        host.links.delete(id);
        this.dropPeer(id);
        if (link.accepted) this.bridge.toast(errorMessage(err), 'error');
      },
    );

    return {
      code: offer.code,
      accept: async (replyCode) => {
        await offer.accept(replyCode);
        link.accepted = true;
      },
      cancel: () => {
        if (link.bridge !== null || host.links.get(id) !== link) return;
        host.links.delete(id);
        offer.close();
        this.dropPeer(id);
      },
    };
  }

  // --------------------------------------------------------------- guest

  async joinOffline(inviteCode: string, name: string): Promise<{ replyCode: string; connected: Promise<void> }> {
    if (this.host !== null) throw new Error('This phone is hosting a game. Stop hosting before joining another one.');
    const playerName = cleanName(name);
    // Decodes (and rejects bad codes) before the previous link is touched.
    const answer = await acceptOffer(inviteCode);
    this.closeGuestLink();
    const link: GuestLink = { answer, transport: null, stopWatching: null };
    this.guest = link;
    this.bridge.patchOffline({ role: 'guest', peers: [] });
    // No internet from here on: stop socket.io retrying while we pair.
    disconnectOnline();

    const connected = answer.opened.then((channel) => {
      if (this.guest !== link) throw new Error('Pairing cancelled.');
      const transport = new ChannelTransport(channel);
      link.transport = transport;
      link.stopWatching = watchLink(answer.pc, channel, () => this.onHostLost(link));
      setTransport(transport);
      this.bridge.ensureHandlers();
      this.bridge.patchOffline({ hostLost: false });
      // Reclaim our seat if we were in this room before (host restart / re-scan).
      const saved = this.bridge.loadOfflineSession();
      const token = saved?.roomCode === answer.room ? saved.reconnectToken : undefined;
      emitJoinRoom(
        token === undefined
          ? { code: answer.room, name: playerName }
          : { code: answer.room, name: playerName, token },
      );
    });
    // The pairing sheet may be dismissed without awaiting this.
    connected.catch(() => undefined);
    return { replyCode: answer.replyCode, connected };
  }

  // --------------------------------------------------------------- common

  leaveOffline(): void {
    const hosting = this.host !== null;
    this.exit();
    // An explicit leave ends the hosted game for good; guests keep their seat token.
    if (hosting) localStorage.removeItem(OFFLINE_HOST_KEY);
  }

  /** Leave offline mode, keeping any saved host game (failed start/resume). */
  private exit(): void {
    const active = this.host !== null || this.guest !== null || this.bridge.getOffline().role !== null;
    if (!active) return;
    this.teardown();
    resetToOnline();
    this.bridge.patchOffline(INITIAL_OFFLINE_STATE);
    this.bridge.resetToHome();
  }

  /** Stop hosting/guest links without touching the store or saved game. */
  private teardown(): void {
    const host = this.host;
    if (host !== null) {
      this.host = null;
      if (host.persistTimer !== null) clearTimeout(host.persistTimer);
      for (const link of host.links.values()) {
        if (link.bridge !== null) link.bridge.close();
        else link.offer.close();
      }
      host.links.clear();
      stopRoomTimers(host.ctx);
      host.transport.off('room:state', this.schedulePersist);
      host.transport.off('game:state', this.schedulePersist);
      host.transport.off('game:event', this.schedulePersist);
      this.stopHostingServices();
    }
    this.closeGuestLink();
  }

  private bootHost(rooms: RoomManager): HostRuntime {
    const hub = new MemoryHub();
    const ctx: ServerContext = { io: hub, rooms, log: noopLog, timers: new Map(), timerDeadlines: new Map() };
    registerSocketHandlers(ctx);
    const transport = new EndpointTransport(hub.connect());
    // Every state change reaches the host's own client (room broadcasts and
    // its personal game:state), so its inbox is the persistence trigger.
    transport.on('room:state', this.schedulePersist);
    transport.on('game:state', this.schedulePersist);
    transport.on('game:event', this.schedulePersist);
    const host: HostRuntime = { hub, rooms, ctx, transport, links: new Map(), persistTimer: null };
    this.host = host;
    return host;
  }

  private readonly schedulePersist = (): void => {
    const host = this.host;
    if (host === null || host.persistTimer !== null) return;
    host.persistTimer = setTimeout(() => {
      host.persistTimer = null;
      if (this.host === host) this.persistHost();
    }, PERSIST_THROTTLE_MS);
  };

  private persistHost(): void {
    const host = this.host;
    const session = this.bridge.getSession();
    if (host === null || session === null) return;
    const saved: SavedHostGame = { v: 1, rooms: host.rooms.exportState(), session };
    try {
      localStorage.setItem(OFFLINE_HOST_KEY, JSON.stringify(saved));
    } catch {
      // Storage full or unavailable: the live game continues, only resume is lost.
    }
  }

  private startHostingServices(): void {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    void this.acquireWakeLock();
  }

  private stopHostingServices(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    const lock = this.wakeLock;
    this.wakeLock = null;
    void lock?.release().catch(() => undefined);
  }

  private readonly onVisibilityChange = (): void => {
    if (this.host === null) return;
    if (document.visibilityState === 'hidden') {
      // The OS may kill a backgrounded tab: save now rather than after the throttle.
      this.persistHost();
    } else {
      // Wake locks are released whenever the page is hidden.
      void this.acquireWakeLock();
    }
  };

  private async acquireWakeLock(): Promise<void> {
    if (this.host === null || this.wakeLock !== null || document.visibilityState !== 'visible') return;
    if (!('wakeLock' in navigator)) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (this.host === null || this.wakeLock !== null) {
        void lock.release().catch(() => undefined);
        return;
      }
      this.wakeLock = lock;
      lock.addEventListener('release', () => {
        if (this.wakeLock === lock) this.wakeLock = null;
      });
    } catch {
      // Denied (battery saver, no user gesture) or unsupported: hosting still works.
    }
  }

  private observePeerTraffic(id: string, link: HostPeerLink, event: string, payload: unknown): void {
    if (event === 'room:joined') {
      const seatIndex = (payload as { seatIndex?: unknown } | undefined)?.seatIndex;
      if (typeof seatIndex === 'number') link.seatIndex = seatIndex;
    } else if (event === 'room:state' && link.seatIndex !== null) {
      const seat = (payload as RoomState).players.find((p) => p.seatIndex === link.seatIndex);
      if (seat !== undefined) this.notePeerName(id, seat.name);
    }
  }

  private notePeerName(id: string, name: string | null): void {
    if (name === null) return;
    const peer = this.bridge.getOffline().peers.find((p) => p.id === id);
    if (peer !== undefined && peer.name !== name) this.patchPeer(id, { name });
  }

  private patchPeer(id: string, patch: Partial<OfflinePeer>): void {
    this.setPeers(this.bridge.getOffline().peers.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  private dropPeer(id: string): void {
    const peers = this.bridge.getOffline().peers;
    if (peers.some((p) => p.id === id)) this.setPeers(peers.filter((p) => p.id !== id));
  }

  private setPeers(peers: OfflinePeer[]): void {
    this.bridge.patchOffline({ peers });
  }

  private onHostLost(link: GuestLink): void {
    if (this.guest !== link) return;
    // Our own transport reports 'disconnect' to the store (connected=false);
    // session/room/game stay so the player can re-scan and reclaim the seat.
    link.transport?.disconnect();
    link.answer.close();
    this.bridge.setConnected(false);
    this.bridge.patchOffline({ hostLost: true });
  }

  private closeGuestLink(): void {
    const link = this.guest;
    if (link === null) return;
    this.guest = null;
    link.stopWatching?.();
    link.transport?.disconnect();
    link.answer.close();
  }
}

function cleanName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH) || 'Player';
}

function joinName(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const name = (payload as { name?: unknown }).name;
  return typeof name === 'string' && name.length > 0 ? name : null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Connection failed.';
}

/** Resolve on the host's reply `event`; reject on an 'error' reply or timeout. */
function waitForReply(transport: ClientTransport, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timer);
      transport.off(event, onReply);
      transport.off('error', onError);
    };
    const onReply: TransportListener = () => {
      cleanup();
      resolve();
    };
    const onError: TransportListener = (err?: { message?: string }) => {
      cleanup();
      reject(new Error(err?.message ?? 'The offline game could not start.'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('The offline game did not respond.'));
    }, HOST_REPLY_TIMEOUT_MS);
    transport.on(event, onReply);
    transport.on('error', onError);
  });
}

function readSavedHost(): SavedHostGame | null {
  let parsed: unknown;
  try {
    const raw = localStorage.getItem(OFFLINE_HOST_KEY);
    if (raw === null) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { v, rooms, session } = parsed as { v?: unknown; rooms?: unknown; session?: unknown };
  if (v !== 1 || typeof rooms !== 'string' || typeof session !== 'object' || session === null) return null;
  const { roomCode, seatIndex, reconnectToken } = session as Record<string, unknown>;
  if (typeof roomCode !== 'string' || typeof seatIndex !== 'number' || typeof reconnectToken !== 'string') return null;
  return { v: 1, rooms, session: { roomCode, seatIndex, reconnectToken } };
}
