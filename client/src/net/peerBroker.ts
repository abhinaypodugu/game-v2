// Fast WebRTC signaling broker using public PeerJS cloud.
// Allows guests to join by entering the 4-letter room code or scanning the host's
// single QR code once, with ZERO return scans required by the host.
// Pure offline 2-way QR scan remains the zero-internet fallback.

import { Peer } from 'peerjs';

export const BROKER_PREFIX = 'catan-v2-';

export interface BrokerHostHandle {
  close(): void;
}

export function startBrokerHost(
  roomCode: string,
  onGuestChannel: (channel: RTCDataChannel, pc: RTCPeerConnection) => void,
): BrokerHostHandle {
  const peerId = `${BROKER_PREFIX}${roomCode.toUpperCase()}`;
  let closed = false;
  let peer: Peer | null = null;

  function initPeer(): void {
    if (closed) return;
    try {
      peer = new Peer(peerId, { debug: 0 });

      peer.on('connection', (conn) => {
        conn.on('open', () => {
          if (closed) {
            conn.close();
            return;
          }
          const dc = conn.dataChannel;
          const pc = conn.peerConnection;
          if (dc && pc) {
            dc.onmessage = null;
            onGuestChannel(dc, pc);
          }
        });
      });

      peer.on('error', (err: unknown) => {
        const errorType = (err as { type?: string })?.type;
        if (errorType === 'unavailable-id' && !closed) {
          setTimeout(() => {
            if (closed) return;
            try {
              peer?.destroy();
            } catch {
              // ignore
            }
            initPeer();
          }, 1500);
        }
      });
    } catch {
      // Offline / broker unavailable: pure offline 2-way QR scan is still available
    }
  }

  initPeer();

  return {
    close() {
      if (closed) return;
      closed = true;
      try {
        peer?.destroy();
      } catch {
        // ignore
      }
      peer = null;
    },
  };
}

export function connectBrokerGuest(
  roomCode: string,
  timeoutMs = 7000,
): Promise<{ channel: RTCDataChannel; pc: RTCPeerConnection; close(): void }> {
  return new Promise((resolve, reject) => {
    let peer: Peer | null = null;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Could not find room with that code. Make sure the host has the room open.'));
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timer);
    };

    try {
      peer = new Peer({ debug: 0 });

      peer.on('open', () => {
        if (settled || peer === null) return;
        const targetHostId = `${BROKER_PREFIX}${roomCode.toUpperCase()}`;
        const conn = peer.connect(targetHostId, { reliable: true });

        conn.on('open', () => {
          if (settled) {
            conn.close();
            return;
          }
          settled = true;
          cleanup();
          const dc = conn.dataChannel;
          const pc = conn.peerConnection;
          if (!dc || !pc) {
            reject(new Error('Data channel failed to open.'));
            return;
          }
          dc.onmessage = null;
          resolve({
            channel: dc,
            pc,
            close: () => {
              try {
                conn.close();
                peer?.destroy();
              } catch {
                // ignore
              }
            },
          });
        });

        conn.on('error', (err) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err instanceof Error ? err : new Error('Connection to host failed.'));
        });
      });

      peer.on('error', (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err instanceof Error ? err : new Error('Signaling broker unavailable.'));
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error('WebRTC initialization failed.'));
    }
  });
}
