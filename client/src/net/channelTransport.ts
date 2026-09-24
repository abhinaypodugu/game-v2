// ClientTransport over a WebRTC data channel: an offline guest talks to the
// host phone. Frames are JSON `{ e, p }`; channel close/error = 'disconnect'.

import { decodeFrame, encodeFrame, TransportEvents, type ClientTransport } from './transport';

export class ChannelTransport extends TransportEvents implements ClientTransport {
  private readonly channel: RTCDataChannel;
  private live = false;
  private wired = false;

  constructor(channel: RTCDataChannel) {
    super();
    this.channel = channel;
  }

  get connected(): boolean {
    return this.live;
  }

  connect(): this {
    if (this.wired) return this;
    this.wired = true;
    this.channel.addEventListener('message', this.onMessage);
    this.channel.addEventListener('close', this.onClose);
    this.channel.addEventListener('error', this.onClose);
    if (this.channel.readyState === 'open') {
      // Usable immediately (callers emit right after connecting); the
      // 'connect' notification stays async like socket.io.
      this.live = true;
      queueMicrotask(() => {
        if (this.live) this.dispatch('connect');
      });
    } else if (this.channel.readyState === 'connecting') {
      this.channel.addEventListener('open', this.onOpen, { once: true });
    } else {
      queueMicrotask(this.onClose);
    }
    return this;
  }

  disconnect(): this {
    this.channel.close();
    this.onClose();
    return this;
  }

  emit(event: string, payload?: unknown): this {
    if (!this.live || this.channel.readyState !== 'open') return this;
    try {
      this.channel.send(encodeFrame(event, payload));
    } catch {
      // Send only throws on a dying channel (or overflowing buffer): treat as lost.
      this.disconnect();
    }
    return this;
  }

  private readonly onOpen = (): void => {
    if (this.live || this.channel.readyState !== 'open') return;
    this.live = true;
    this.dispatch('connect');
  };

  private readonly onMessage = (ev: MessageEvent): void => {
    const frame = decodeFrame(ev.data);
    // Lifecycle events are local-only; a peer must not be able to fake them.
    if (frame === null || frame.e === 'connect' || frame.e === 'disconnect') return;
    this.dispatch(frame.e, frame.p);
  };

  private readonly onClose = (): void => {
    this.channel.removeEventListener('message', this.onMessage);
    this.channel.removeEventListener('close', this.onClose);
    this.channel.removeEventListener('error', this.onClose);
    this.channel.removeEventListener('open', this.onOpen);
    if (!this.live) return;
    this.live = false;
    this.dispatch('disconnect', 'transport close');
  };
}
