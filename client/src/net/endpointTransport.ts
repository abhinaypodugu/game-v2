// ClientTransport over an in-page MemoryHub endpoint: the offline host's own
// client talks to the hub running in the same page.

import type { HubClientEndpoint } from '@catan/host';
import { TransportEvents, type ClientTransport } from './transport';

export class EndpointTransport extends TransportEvents implements ClientTransport {
  private readonly endpoint: HubClientEndpoint;
  private unsubscribe: (() => void) | null = null;
  private closed = false;

  constructor(endpoint: HubClientEndpoint) {
    super();
    this.endpoint = endpoint;
  }

  get connected(): boolean {
    return this.unsubscribe !== null;
  }

  connect(): this {
    // An endpoint cannot reopen once closed; the host makes a new one instead.
    if (this.closed || this.unsubscribe !== null) return this;
    this.unsubscribe = this.endpoint.onMessage((event, payload) => {
      this.dispatch(event, payload);
    });
    // Async like socket.io, so callers can finish wiring before 'connect'.
    queueMicrotask(() => {
      if (this.unsubscribe !== null) this.dispatch('connect');
    });
    return this;
  }

  disconnect(): this {
    if (this.closed) return this;
    this.closed = true;
    const wasConnected = this.unsubscribe !== null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.endpoint.close();
    if (wasConnected) this.dispatch('disconnect', 'io client disconnect');
    return this;
  }

  emit(event: string, payload?: unknown): this {
    if (this.unsubscribe !== null) this.endpoint.emit(event, payload);
    return this;
  }
}
