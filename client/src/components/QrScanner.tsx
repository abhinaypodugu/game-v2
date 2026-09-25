// Rear-camera QR scanner for offline pairing codes.
//
// `useCamera` owns the MediaStream (the page must hold camera permission
// while WebRTC offers/answers are created, otherwise browsers hide LAN IPs
// behind mDNS names) and `QrViewfinder` decodes frames with jsQR.

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/** Only codes produced by this app are accepted by the viewfinder. */
export const PAIRING_CODE_PREFIX = 'LC1.';

/** Extracts a 4-letter room code from raw text, room URLs, or broker prefixes. */
export function extractRoomCode(raw: string): string | null {
  const trimmed = raw.trim();
  // Pure 4 letters: ABCD
  if (/^[A-Za-z]{4}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  // Broker peer ID: catan-v2-ABCD
  if (trimmed.startsWith('catan-v2-') && trimmed.length === 13) {
    return trimmed.slice(9).toUpperCase();
  }
  // URL containing hash: e.g. /#/ABCD or #/ABCD or #ABCD
  if (trimmed.includes('#')) {
    const hash = trimmed.slice(trimmed.indexOf('#') + 1);
    const m = hash.match(/(?:^|\/)([A-Za-z]{4})(?:[/?#]|$)/);
    if (m && m[1]) return m[1].toUpperCase();
  }
  // Query parameter: ?room=ABCD
  const queryMatch = trimmed.match(/[?&]room=([A-Za-z]{4})/i);
  if (queryMatch && queryMatch[1]) return queryMatch[1].toUpperCase();
  // Trailing path segment: /ABCD or /ABCD/
  const pathMatch = trimmed.match(/\/([A-Za-z]{4})\/?$/);
  if (pathMatch && pathMatch[1]) return pathMatch[1].toUpperCase();
  return null;
}

/** Check if the scanned string is a valid Catan QR code (offline invite or room code/link). */
export function isAcceptableQrCode(raw: string): boolean {
  const text = raw.trim();
  return text.startsWith(PAIRING_CODE_PREFIX) || extractRoomCode(text) !== null;
}

/** Generate a clean room share URL preserving current base path (e.g. GitHub Pages or subpath). */
export function getRoomShareUrl(roomCode: string): string {
  const base = window.location.href.split('#')[0]?.split('?')[0]?.replace(/\/+$/, '') ?? window.location.origin;
  return `${base}/#/${roomCode}`;
}

export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'insecure' | 'error';

export interface CameraState {
  status: CameraStatus;
  stream: MediaStream | null;
}

/** True once the camera attempt finished (live or failed) — safe to create offers/answers. */
export function cameraSettled(status: CameraStatus): boolean {
  return status !== 'idle' && status !== 'starting';
}

function failureStatus(err: unknown): CameraStatus {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') return 'unavailable';
  return 'error';
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Opens the rear camera while `enabled`; stops every track when disabled or
 * unmounted. `retryKey` changes force a fresh attempt.
 */
export function useCamera(enabled: boolean, retryKey = 0): CameraState {
  // Result of the current attempt; null while it is still pending.
  const [result, setResult] = useState<CameraState | null>(null);
  const supported = typeof navigator.mediaDevices?.getUserMedia === 'function';
  const secure = window.isSecureContext;

  useEffect(() => {
    if (!enabled || !secure || !supported) return;
    let cancelled = false;
    let opened: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stopStream(stream);
          return;
        }
        opened = stream;
        setResult({ status: 'live', stream });
      })
      .catch((err: unknown) => {
        if (!cancelled) setResult({ status: failureStatus(err), stream: null });
      });
    return () => {
      cancelled = true;
      stopStream(opened);
      setResult(null);
    };
  }, [enabled, secure, supported, retryKey]);

  if (!enabled) return { status: 'idle', stream: null };
  if (!secure) return { status: 'insecure', stream: null };
  if (!supported) return { status: 'unavailable', stream: null };
  return result ?? { status: 'starting', stream: null };
}

export function cameraMessage(status: CameraStatus): string | null {
  switch (status) {
    case 'insecure':
      return 'The camera only works over a secure (https) connection. Use the text code below instead.';
    case 'denied':
      return 'Camera access was blocked. Allow the camera for this site in your browser settings, or use the text code below. Connecting without camera access may be less reliable.';
    case 'unavailable':
      return 'No camera available on this device. Use the text code below instead.';
    case 'error':
      return 'Could not start the camera. Use the text code below instead.';
    default:
      return null;
  }
}

/** Max side of the downscaled frame handed to jsQR — enough for dense codes, cheap on phones. */
const SCAN_SIZE = 640;
const SCAN_INTERVAL_MS = 120;

export function QrViewfinder({
  camera,
  onCode,
  paused = false,
  onRetry,
}: {
  camera: CameraState;
  /** Called once per newly decoded pairing code; scanning stops until `paused` toggles or a different code appears. */
  onCode: (code: string) => void;
  paused?: boolean;
  onRetry?: () => void;
}): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onCodeRef = useRef(onCode);
  const lastCodeRef = useRef<string | null>(null);
  const [foreign, setForeign] = useState(false);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const { stream, status } = camera;

  useEffect(() => {
    const video = videoRef.current;
    if (video === null || stream === null) return;
    video.srcObject = stream;
    // Some engines return undefined instead of a promise; aborts are harmless.
    void Promise.resolve()
      .then(() => video.play())
      .catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null || stream === null || paused) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx === null) return;

    let frame = 0;
    let lastScan = 0;
    let done = false;
    const tick = (now: number): void => {
      if (done) return;
      frame = requestAnimationFrame(tick);
      if (now - lastScan < SCAN_INTERVAL_MS) return;
      lastScan = now;
      if (video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) return;
      const scale = Math.min(1, SCAN_SIZE / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      const result = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
      if (result === null) return;
      const text = result.data.trim();
      if (!isAcceptableQrCode(text)) {
        setForeign(true);
        return;
      }
      setForeign(false);
      // A code that was already handed over (and rejected) is not re-sent.
      if (text === lastCodeRef.current) return;
      lastCodeRef.current = text;
      done = true;
      cancelAnimationFrame(frame);
      navigator.vibrate?.(60);
      onCodeRef.current(text);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      done = true;
      cancelAnimationFrame(frame);
    };
  }, [stream, paused]);

  const message = cameraMessage(status);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div
        className="relative aspect-square w-[min(80vw,320px)] overflow-hidden rounded-3xl border-2 border-line bg-ink shadow-[0_3px_0_rgba(0,0,0,0.15)]"
        data-testid="qr-viewfinder"
      >
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay aria-label="Camera viewfinder" />
        {status === 'live' ? (
          <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-4 border-white/80 shadow-[0_0_0_999px_rgba(31,42,55,0.35)]" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm font-bold text-white">
            <span className="text-3xl" aria-hidden="true">
              📷
            </span>
            <span>{status === 'starting' || status === 'idle' ? 'Starting camera…' : 'Camera unavailable'}</span>
          </div>
        )}
        {status === 'live' && paused ? (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/60 font-display text-lg font-bold text-white">
            Code read ✓
          </div>
        ) : null}
      </div>
      {foreign && !paused ? (
        <p className="text-center text-sm font-bold text-[#8a1424]">That QR code isn't a Catan room or pairing code.</p>
      ) : null}
      {message !== null ? (
        <div className="flex w-full flex-col gap-2 rounded-2xl border-2 border-[#e0b44c] bg-[#fff6dc] p-3 text-sm font-bold text-ink" role="alert" data-testid="camera-error">
          <p>{message}</p>
          {onRetry !== undefined && status !== 'insecure' ? (
            <button
              type="button"
              onClick={onRetry}
              className="h-12 rounded-xl bg-ocean-deep px-3 text-sm font-bold text-white shadow-[0_3px_0_#1f6f99] active:translate-y-px"
            >
              Try the camera again
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
