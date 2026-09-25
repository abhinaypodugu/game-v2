// WebRTC pairing without internet: no STUN/TURN, non-trickle ICE (the whole
// candidate set rides inside the QR code), one pre-negotiated ordered data
// channel. The host creates offers and bridges each opened channel into its
// in-page MemoryHub; guests answer offers and talk over the channel.

import type { HubClientEndpoint, MemoryHub } from '@catan/host';
import { CodeError, decodeSignal, encodeSignal } from './codec';
import { decodeFrame, encodeFrame } from './transport';

export const CHANNEL_LABEL = 'game';
/** Upper bound on ICE gathering; whatever was gathered by then is used. */
export const ICE_GATHER_TIMEOUT_MS = 4000;
/** Timeout for WebRTC data channel to connect after signaling exchange. */
export const PAIRING_CONNECT_TIMEOUT_MS = 15000;

// Negotiated (id 0) on both sides: no 'datachannel' event to wait for.
const CHANNEL_INIT: RTCDataChannelInit = { negotiated: true, id: 0, ordered: true };

const CONNECT_FAILED =
  'Could not connect. Both phones must be on the same local network: turn on Personal Hotspot on one phone, or connect both to the same Wi-Fi (no mobile data or internet needed), then try again.';

/** Events a peer must never inject into the hub: they are lifecycle signals, not requests. */
const RESERVED_EVENTS = new Set(['connect', 'connection', 'disconnect', 'disconnecting']);

export interface HostOffer {
  /** Invite code (`LC1.…`) for the guest to scan. */
  readonly code: string;
  readonly pc: RTCPeerConnection;
  readonly channel: RTCDataChannel;
  /** Resolves when the guest's channel opens; rejects if pairing fails or is closed. */
  readonly opened: Promise<RTCDataChannel>;
  /** Apply the guest's reply code. Rejects (invite stays usable) on a bad/foreign code. */
  accept(replyCode: string): Promise<void>;
  close(): void;
}

export interface GuestAnswer {
  /** Reply code (`LC1.…`) for the host to scan. */
  readonly replyCode: string;
  /** Host room code carried by the invite. */
  readonly room: string;
  readonly pc: RTCPeerConnection;
  readonly channel: RTCDataChannel;
  /** Resolves when the channel to the host opens; rejects if pairing fails or is closed. */
  readonly opened: Promise<RTCDataChannel>;
  close(): void;
}

export interface HubBridge {
  readonly endpoint: HubClientEndpoint;
  close(): void;
}

export async function createOffer(room: string): Promise<HostOffer> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = pc.createDataChannel(CHANNEL_LABEL, CHANNEL_INIT);
  const pairing = trackPairing(pc, channel);
  const close = (): void => {
    pairing.abort();
    channel.close();
    pc.close();
  };

  let code: string;
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIceGathering(pc);
    const sdp = pc.localDescription?.sdp;
    if (sdp === undefined || sdp === '') throw new Error('Could not create an invite on this device.');
    code = await encodeSignal({ v: 1, t: 'offer', sdp, room });
  } catch (err) {
    close();
    throw err;
  }

  return {
    code,
    pc,
    channel,
    opened: pairing.opened,
    async accept(replyCode) {
      const answer = await decodeSignal(replyCode, 'answer');
      if (pc.signalingState !== 'have-local-offer') {
        throw new Error('This invite was already used. Make a new invite for the next player.');
      }
      try {
        await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
      } catch {
        throw new CodeError('corrupt', 'That reply code does not match this invite. Scan the reply shown for this invite.');
      }
    },
    close,
  };
}

export async function acceptOffer(inviteCode: string): Promise<GuestAnswer> {
  // Decode first: a bad code fails fast without touching WebRTC.
  const offer = await decodeSignal(inviteCode, 'offer');
  const room = offer.room;
  if (room === undefined) throw new CodeError('corrupt', 'The pairing code is damaged. Scan or paste it again.');

  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = pc.createDataChannel(CHANNEL_LABEL, CHANNEL_INIT);
  const pairing = trackPairing(pc, channel);
  const close = (): void => {
    pairing.abort();
    channel.close();
    pc.close();
  };

  let replyCode: string;
  try {
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
    } catch {
      throw new CodeError('corrupt', 'This invite could not be read. Ask the host to make a new invite.');
    }
    await pc.setLocalDescription(await pc.createAnswer());
    await waitForIceGathering(pc);
    const sdp = pc.localDescription?.sdp;
    if (sdp === undefined || sdp === '') throw new Error('Could not create a reply on this device.');
    replyCode = await encodeSignal({ v: 1, t: 'answer', sdp });
  } catch (err) {
    close();
    throw err;
  }

  return { replyCode, room, pc, channel, opened: pairing.opened, close };
}

export interface BridgeHooks {
  /** Guest -> hub traffic (already filtered). */
  onClientMessage?: (event: string, payload?: unknown) => void;
  /** Hub -> guest traffic. */
  onServerMessage?: (event: string, payload?: unknown) => void;
  /** Link lost or closed; the hub socket has already disconnected. */
  onClose?: () => void;
}

/**
 * Host side: once a guest channel is open, give it its own hub socket.
 * Channel frames -> hub; hub messages -> channel; link loss -> hub 'disconnect'.
 */
export function bridgeChannelToHub(
  pc: RTCPeerConnection,
  channel: RTCDataChannel,
  hub: Pick<MemoryHub, 'connect'>,
  hooks: BridgeHooks = {},
): HubBridge {
  const endpoint = hub.connect();
  let closed = false;

  const unsubscribe = endpoint.onMessage((event, payload) => {
    hooks.onServerMessage?.(event, payload);
    if (channel.readyState !== 'open') return;
    try {
      channel.send(encodeFrame(event, payload));
    } catch {
      close();
    }
  });

  const onMessage = (ev: MessageEvent): void => {
    const frame = decodeFrame(ev.data);
    if (frame === null || RESERVED_EVENTS.has(frame.e)) return;
    hooks.onClientMessage?.(frame.e, frame.p);
    endpoint.emit(frame.e, frame.p);
  };
  channel.addEventListener('message', onMessage);

  const stopWatching = watchLink(pc, channel, () => close());

  function close(): void {
    if (closed) return;
    closed = true;
    stopWatching();
    channel.removeEventListener('message', onMessage);
    unsubscribe();
    endpoint.close();
    channel.close();
    pc.close();
    hooks.onClose?.();
  }

  return { endpoint, close };
}

/**
 * Invoke `onLost` once when an established link dies: the channel closes or
 * errors, or ICE fails. Returns a function that stops watching.
 */
export function watchLink(pc: RTCPeerConnection, channel: RTCDataChannel, onLost: () => void): () => void {
  let active = true;
  const stop = (): void => {
    active = false;
    channel.removeEventListener('close', lost);
    channel.removeEventListener('error', lost);
    pc.removeEventListener('connectionstatechange', onState);
  };
  function lost(): void {
    if (!active) return;
    stop();
    onLost();
  }
  function onState(): void {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') lost();
  }
  channel.addEventListener('close', lost);
  channel.addEventListener('error', lost);
  pc.addEventListener('connectionstatechange', onState);
  return stop;
}

/** Resolve when the channel opens; reject on failure or `abort()`. */
function trackPairing(
  pc: RTCPeerConnection,
  channel: RTCDataChannel,
): { opened: Promise<RTCDataChannel>; abort(): void } {
  let abort = (): void => undefined;
  const opened = new Promise<RTCDataChannel>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = (err: Error | null): void => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      stopWatching();
      channel.removeEventListener('open', onOpen);
      if (err === null) resolve(channel);
      else reject(err);
    };
    const onOpen = (): void => settle(null);
    const stopWatching = watchLink(pc, channel, () => settle(new Error(CONNECT_FAILED)));
    channel.addEventListener('open', onOpen);
    timer = setTimeout(() => {
      settle(new Error(CONNECT_FAILED));
    }, PAIRING_CONNECT_TIMEOUT_MS);
    abort = () => settle(new Error('Pairing cancelled.'));
  });
  // Callers may drop `opened` (e.g. a cancelled pairing sheet): never an unhandled rejection.
  opened.catch(() => undefined);
  return { opened, abort: () => abort() };
}

/** Wait for ICE gathering to finish, capped at ICE_GATHER_TIMEOUT_MS. */
function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onStateChange);
      pc.removeEventListener('icecandidate', onCandidate);
      resolve();
    };
    const onStateChange = (): void => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const onCandidate = (ev: RTCPeerConnectionIceEvent): void => {
      if (ev.candidate === null) done();
    };
    const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS);
    pc.addEventListener('icegatheringstatechange', onStateChange);
    pc.addEventListener('icecandidate', onCandidate);
  });
}
