// Client transport abstraction: the store talks to "a server" through this
// interface. socket.io-client's Socket satisfies it (online mode); the
// offline modes plug in an in-page hub endpoint (host) or a WebRTC data
// channel (guest). Lifecycle is reported through 'connect'/'disconnect'.

// Listener payloads are wire data typed at the store boundary; `never[]`
// accepts any concrete handler signature without resorting to `any`.
export type TransportListener = (...args: never[]) => void;

export interface ClientTransport {
  readonly connected: boolean;
  connect(): unknown;
  disconnect(): unknown;
  emit(event: string, payload?: unknown): unknown;
  on(event: string, handler: TransportListener): unknown;
  off(event: string, handler?: TransportListener): unknown;
}

/** Listener bookkeeping shared by the offline transports. */
export class TransportEvents {
  private readonly listeners = new Map<string, Set<TransportListener>>();

  on(event: string, handler: TransportListener): this {
    let set = this.listeners.get(event);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return this;
  }

  off(event: string, handler?: TransportListener): this {
    if (handler === undefined) this.listeners.delete(event);
    else this.listeners.get(event)?.delete(handler);
    return this;
  }

  protected dispatch(event: string, payload?: unknown): void {
    const set = this.listeners.get(event);
    if (set === undefined) return;
    // Snapshot: handlers may unsubscribe themselves (once-style listeners).
    for (const handler of [...set]) {
      // Handlers declare the payload type they expect for their event.
      const call = handler as (payload?: unknown) => void;
      if (payload === undefined) call();
      else call(payload);
    }
  }
}

/** One wire message on a data channel: `{ e: event, p?: payload }`. */
export interface Frame {
  e: string;
  p?: unknown;
}

export function encodeFrame(event: string, payload?: unknown): string {
  const frame: Frame = payload === undefined ? { e: event } : { e: event, p: payload };
  return JSON.stringify(frame);
}

/** Parse a data-channel message; null for anything that is not a well-formed frame. */
export function decodeFrame(data: unknown): Frame | null {
  if (typeof data !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { e, p } = parsed as { e?: unknown; p?: unknown };
  if (typeof e !== 'string' || e.length === 0) return null;
  return p === undefined ? { e } : { e, p };
}
