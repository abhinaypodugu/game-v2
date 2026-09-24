// Pairing codes: LC1 framing, compression round-trip and readable failures
// for foreign, damaged or wrong-kind codes.

import { describe, expect, it } from 'vitest';
import { CODE_PREFIX, CodeError, decodeSignal, encodeSignal, type SignalPayload } from '../net/codec';

const SDP = [
  'v=0',
  'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:1 1 udp 2113937151 192.168.43.17 54321 typ host generation 0',
  'a=ice-ufrag:abcd',
  'a=ice-pwd:0123456789abcdefghijklmn',
  'a=fingerprint:sha-256 12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

async function expectCodeError(promise: Promise<unknown>, reason: CodeError['reason']): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(CodeError);
  expect((err as CodeError).reason).toBe(reason);
  expect((err as CodeError).message.length).toBeGreaterThan(0);
}

describe('pairing code codec', () => {
  it('round-trips an offer with its room code', async () => {
    const offer: SignalPayload = { v: 1, t: 'offer', sdp: SDP, room: 'AB2C' };
    const code = await encodeSignal(offer);
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    expect(code.slice(CODE_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/);
    // Compression is what keeps a full SDP scannable as one QR code.
    expect(code.length).toBeLessThan(SDP.length);
    expect(await decodeSignal(code, 'offer')).toEqual(offer);
  });

  it('round-trips an answer without a room', async () => {
    const answer: SignalPayload = { v: 1, t: 'answer', sdp: SDP };
    expect(await decodeSignal(await encodeSignal(answer), 'answer')).toEqual(answer);
  });

  it('tolerates whitespace and line breaks from copy/paste', async () => {
    const code = await encodeSignal({ v: 1, t: 'answer', sdp: SDP });
    const mangled = `  ${code.slice(0, 20)}\n${code.slice(20, 40)} \r\n${code.slice(40)}\n`;
    expect((await decodeSignal(mangled)).sdp).toBe(SDP);
  });

  it('rejects text that is not a pairing code', async () => {
    await expectCodeError(decodeSignal('https://example.com/?room=AB2C'), 'prefix');
    await expectCodeError(decodeSignal(''), 'prefix');
  });

  it('reports codes from another format version', async () => {
    await expectCodeError(decodeSignal('LC2.q1YqU7JSMlSqBQA'), 'version');
    const future = await encodeSignal({ v: 2, t: 'offer', sdp: SDP, room: 'AB2C' } as unknown as SignalPayload);
    await expectCodeError(decodeSignal(future), 'version');
  });

  it('rejects damaged codes', async () => {
    const code = await encodeSignal({ v: 1, t: 'offer', sdp: SDP, room: 'AB2C' });
    const body = code.slice(CODE_PREFIX.length);
    // Truncated (half a QR scan / partial paste).
    await expectCodeError(decodeSignal(CODE_PREFIX + body.slice(0, Math.floor(body.length / 2))), 'corrupt');
    // Characters outside base64url.
    await expectCodeError(decodeSignal(`${CODE_PREFIX}${body.slice(0, 10)}!*${body.slice(12)}`), 'corrupt');
    // Valid base64url that is not deflate data.
    await expectCodeError(decodeSignal(`${CODE_PREFIX}bm90LWRlZmxhdGUtZGF0YQ`), 'corrupt');
  });

  it('rejects well-formed payloads with a broken shape', async () => {
    const noRoom = await encodeSignal({ v: 1, t: 'offer', sdp: SDP } as SignalPayload);
    await expectCodeError(decodeSignal(noRoom), 'corrupt');
    const noSdp = await encodeSignal({ v: 1, t: 'answer', sdp: '' });
    await expectCodeError(decodeSignal(noSdp), 'corrupt');
  });

  it('rejects the other kind of code when one kind is expected', async () => {
    const offer = await encodeSignal({ v: 1, t: 'offer', sdp: SDP, room: 'AB2C' });
    const answer = await encodeSignal({ v: 1, t: 'answer', sdp: SDP });
    await expectCodeError(decodeSignal(answer, 'offer'), 'type');
    await expectCodeError(decodeSignal(offer, 'answer'), 'type');
  });
});
