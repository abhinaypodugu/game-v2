// Transport-neutral hub: the socket.io surface the game handlers rely on, plus
// an in-memory implementation so a browser tab can host the game itself.

import { nanoid } from 'nanoid';

type Handler = (payload?: unknown) => void;

/** Server-side view of one connected client (socket.io `Socket` subset). */
export interface HubSocket {
  readonly id: string;
  /** Subscribe to a client event; `'disconnect'` fires once when the client goes away. */
  on(event: string, handler: Handler): void;
  /** Send an event to this socket's client. */
  emit(event: string, payload?: unknown): void;
  join(room: string): void;
  leave(room: string): void;
}

/** Server-side broadcaster (socket.io `Server` subset). */
export interface HubServer {
  on(event: 'connection', handler: (socket: HubSocket) => void): void;
  /** Target every socket in a room; each socket is also in a room named after its own id. */
  to(roomOrSocketId: string): { emit(event: string, payload?: unknown): void };
}

/** Client-side end of a MemoryHub connection. */
export interface HubClientEndpoint {
  readonly socketId: string;
  /** Client -> server; delivered asynchronously (microtask). */
  emit(event: string, payload?: unknown): void;
  /** Server -> client; returns an unsubscribe function. */
  onMessage(handler: (event: string, payload?: unknown) => void): () => void;
  /** Fire `'disconnect'` on the server socket; later traffic both ways is dropped. */
  close(): void;
}

/**
 * Payloads cross the hub detached, exactly as they would over the wire, so a
 * client never aliases live server objects (e.g. `room.settings`).
 */
function detach(payload: unknown): unknown {
  return payload === undefined ? undefined : JSON.parse(JSON.stringify(payload));
}

class MemorySocket implements HubSocket {
  readonly id = nanoid();
  readonly rooms = new Set<string>();
  readonly clientListeners = new Set<(event: string, payload?: unknown) => void>();
  /** Client called close(); nothing more reaches it. */
  clientClosed = false;
  /** 'disconnect' already fired server-side; client messages are dropped. */
  serverClosed = false;
  private readonly handlers = new Map<string, Handler[]>();
  private readonly hub: MemoryHub;

  constructor(hub: MemoryHub) {
    this.hub = hub;
  }

  on(event: string, handler: Handler): void {
    const list = this.handlers.get(event);
    if (list === undefined) this.handlers.set(event, [handler]);
    else list.push(handler);
  }

  emit(event: string, payload?: unknown): void {
    this.deliverToClient(event, payload);
  }

  join(room: string): void {
    if (this.serverClosed) return;
    this.rooms.add(room);
    this.hub.addMember(room, this);
  }

  leave(room: string): void {
    this.rooms.delete(room);
    this.hub.removeMember(room, this);
  }

  deliverToClient(event: string, payload: unknown): void {
    if (this.clientClosed) return;
    const data = detach(payload);
    queueMicrotask(() => {
      if (this.clientClosed) return;
      for (const listener of [...this.clientListeners]) listener(event, data);
    });
  }

  dispatch(event: string, payload: unknown): void {
    for (const handler of [...(this.handlers.get(event) ?? [])]) handler(payload);
  }
}

/** In-process HubServer: every connection is a pair of in-memory endpoints. */
export class MemoryHub implements HubServer {
  private readonly connectionHandlers: Array<(socket: HubSocket) => void> = [];
  private readonly members = new Map<string, Set<MemorySocket>>();

  on(event: 'connection', handler: (socket: HubSocket) => void): void {
    this.connectionHandlers.push(handler);
  }

  to(roomOrSocketId: string): { emit(event: string, payload?: unknown): void } {
    return {
      emit: (event, payload) => {
        const sockets = this.members.get(roomOrSocketId);
        if (sockets === undefined) return;
        for (const socket of [...sockets]) socket.deliverToClient(event, payload);
      },
    };
  }

  /** Open a server-side socket (fires 'connection' now); returns the client-side endpoint. */
  connect(): HubClientEndpoint {
    const socket = new MemorySocket(this);
    socket.join(socket.id);
    for (const handler of [...this.connectionHandlers]) handler(socket);

    return {
      socketId: socket.id,
      emit: (event, payload) => {
        if (socket.clientClosed) return;
        const data = detach(payload);
        queueMicrotask(() => {
          if (!socket.serverClosed) socket.dispatch(event, data);
        });
      },
      onMessage: (handler) => {
        socket.clientListeners.add(handler);
        return () => {
          socket.clientListeners.delete(handler);
        };
      },
      close: () => {
        if (socket.clientClosed) return;
        socket.clientClosed = true;
        socket.clientListeners.clear();
        // Queued behind any client messages already in flight, like a real transport.
        queueMicrotask(() => {
          socket.serverClosed = true;
          socket.dispatch('disconnect', undefined);
          for (const room of [...socket.rooms]) socket.leave(room);
        });
      },
    };
  }

  /** @internal */
  addMember(room: string, socket: MemorySocket): void {
    let set = this.members.get(room);
    if (set === undefined) {
      set = new Set();
      this.members.set(room, set);
    }
    set.add(socket);
  }

  /** @internal */
  removeMember(room: string, socket: MemorySocket): void {
    const set = this.members.get(room);
    if (set === undefined) return;
    set.delete(socket);
    if (set.size === 0) this.members.delete(room);
  }
}
