// Pairing codes: `LC1.` + base64url(deflate-raw(JSON)). The JSON carries a
// WebRTC session description (plus the host's room code in offers). Codes
// travel as QR codes or copy/paste text, so decoding tolerates whitespace
// and reports foreign/corrupted input with a readable CodeError.

export const CODE_PREFIX = 'LC1.';

export type SignalType = 'offer' | 'answer';

export interface SignalPayload {
  v: 1;
  t: SignalType;
  sdp: string;
  /** Host room code; present in offers. */
  room?: string;
}

export type CodeErrorReason = 'prefix' | 'corrupt' | 'version' | 'type';

export class CodeError extends Error {
  readonly reason: CodeErrorReason;

  constructor(reason: CodeErrorReason, message: string) {
    super(message);
    this.name = 'CodeError';
    this.reason = reason;
  }
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const CORRUPT = 'The pairing code is damaged. Scan or paste it again.';
const OTHER_VERSION = 'This code comes from a different version of the game. Update both phones and try again.';

export async function encodeSignal(payload: SignalPayload): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const packed = await runStream(json, new CompressionStream('deflate-raw'));
  return CODE_PREFIX + toBase64Url(packed);
}

/**
 * Decode a pairing code. `expect` rejects a valid code of the other kind
 * (e.g. a guest's reply scanned where an invite was expected).
 */
export async function decodeSignal(code: string, expect?: SignalType): Promise<SignalPayload> {
  const compact = code.replace(/\s+/g, '');
  if (!compact.startsWith(CODE_PREFIX)) {
    if (/^LC\d+\./.test(compact)) throw new CodeError('version', OTHER_VERSION);
    throw new CodeError('prefix', 'That is not a game pairing code.');
  }
  const body = compact.slice(CODE_PREFIX.length);
  if (!BASE64URL.test(body)) throw new CodeError('corrupt', CORRUPT);

  let payload: unknown;
  try {
    const json = await runStream(fromBase64Url(body), new DecompressionStream('deflate-raw'));
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json));
  } catch {
    throw new CodeError('corrupt', CORRUPT);
  }

  if (typeof payload !== 'object' || payload === null) throw new CodeError('corrupt', CORRUPT);
  const { v, t, sdp, room } = payload as Record<string, unknown>;
  if (v !== 1) throw new CodeError('version', OTHER_VERSION);
  if ((t !== 'offer' && t !== 'answer') || typeof sdp !== 'string' || sdp.length === 0) {
    throw new CodeError('corrupt', CORRUPT);
  }
  if (room !== undefined && typeof room !== 'string') throw new CodeError('corrupt', CORRUPT);
  if (t === 'offer' && room === undefined) throw new CodeError('corrupt', CORRUPT);
  if (expect !== undefined && t !== expect) {
    throw new CodeError(
      'type',
      expect === 'offer'
        ? "That's a reply code. Scan the invite code shown on the host's phone."
        : "That's an invite code. Scan the reply code shown on the joining phone.",
    );
  }
  return room === undefined ? { v: 1, t, sdp } : { v: 1, t, sdp, room };
}

/** Push bytes through a (de)compression stream and collect the output. */
async function runStream(
  input: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const writer = transform.writable.getWriter();
  const written = writer.write(input).then(() => writer.close());
  // A corrupt input errors both sides; the reader below surfaces it.
  written.catch(() => undefined);

  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await written;

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  // Chunked to stay under argument-count limits of String.fromCharCode.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
