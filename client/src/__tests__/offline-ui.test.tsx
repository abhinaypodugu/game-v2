// Offline pairing UI: camera-before-code ordering, text fallback, guest
// reply/wait flow, and the host-lost re-scan entry point.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { GuestPairingSheet, HostPairingSheet, extractRoomCode } from '../components/OfflinePairing';
import { RoomQrModal } from '../components/RoomQrModal';
import { ReconnectBanner } from '../components/Overlays';
import type { Invite } from '../net/offline';
import { useStore } from '../store';

const INVITE = 'LC1.invite-code';
const REPLY = 'LC1.reply-code';

/** Fake rear camera; `order` records camera open/stop relative to code creation. */
function fakeCamera(opts: { deny?: boolean } = {}): { order: string[] } {
  const order: string[] = [];
  const stop = vi.fn(() => {
    order.push('stop');
  });
  const getUserMedia = vi.fn(async () => {
    order.push('camera');
    if (opts.deny === true) throw new DOMException('denied', 'NotAllowedError');
    return Object.assign(new MediaStream(), { getTracks: () => [{ stop }] });
  });
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  return { order };
}

async function pasteCode(user: UserEvent, code: string): Promise<void> {
  // Codes are only generated once the camera attempt has settled.
  await waitFor(() => expect(screen.queryByText(/starting camera/i)).not.toBeInTheDocument());
  await user.click(screen.getByText(/can't scan/i));
  await user.type(screen.getByTestId('paste-code'), code);
  await user.click(screen.getByTestId('paste-submit'));
}

beforeEach(() => {
  sessionStorage.clear();
  useStore.setState({ room: null, game: null, session: null, connected: true });
});

describe('HostPairingSheet', () => {
  it('opens the camera before creating the invite, accepts a pasted reply, then releases the camera', async () => {
    const cam = fakeCamera();
    const accept = vi.fn(async () => {});
    const createInvite = vi.fn(async (): Promise<Invite> => {
      cam.order.push('invite');
      return { code: INVITE, accept, cancel: vi.fn() };
    });
    useStore.setState({ createInvite });
    const user = userEvent.setup();
    render(<HostPairingSheet onClose={() => {}} />);

    await screen.findByAltText(/invite code/i);
    expect(cam.order).toEqual(['camera', 'invite']);

    await pasteCode(user, REPLY);
    expect(accept).toHaveBeenCalledWith(REPLY);
    await screen.findByTestId('pairing-success');
    expect(cam.order).toEqual(['camera', 'invite', 'stop']);
  });

  it('still creates an invite when the camera is denied, and keeps the invite usable after a bad reply', async () => {
    fakeCamera({ deny: true });
    const accept = vi.fn(async () => {
      throw new Error('That is an invite, not a reply code.');
    });
    const cancel = vi.fn();
    useStore.setState({ createInvite: vi.fn(async (): Promise<Invite> => ({ code: INVITE, accept, cancel })) });
    const user = userEvent.setup();
    const { unmount } = render(<HostPairingSheet onClose={() => {}} />);

    await screen.findByAltText(/invite code/i);
    expect(screen.getByTestId('camera-error')).toHaveTextContent(/blocked/i);

    await pasteCode(user, 'LC1.wrong');
    expect(await screen.findByTestId('pairing-error')).toHaveTextContent('That is an invite, not a reply code.');
    expect(screen.getByAltText(/invite code/i)).toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();

    unmount();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe('GuestPairingSheet', () => {
  it('shows the reply code while the camera is still held, waits, then reports connected', async () => {
    const cam = fakeCamera();
    let open!: () => void;
    const connected = new Promise<void>((resolve) => {
      open = resolve;
    });
    const joinOffline = vi.fn(async () => {
      cam.order.push('answer');
      return { replyCode: REPLY, connected };
    });
    const onConnected = vi.fn();
    useStore.setState({ joinOffline });
    const user = userEvent.setup();
    render(<GuestPairingSheet name="Bea" leaveOnCancel onClose={() => {}} onConnected={onConnected} />);

    await pasteCode(user, INVITE);
    expect(joinOffline).toHaveBeenCalledWith(INVITE, 'Bea');
    await screen.findByAltText(/reply code/i);
    expect(screen.getByTestId('waiting-host')).toBeInTheDocument();
    // Camera held while the answer was generated, released once the reply exists.
    expect(cam.order).toEqual(['camera', 'answer', 'stop']);
    expect(onConnected).not.toHaveBeenCalled();

    open();
    expect(await screen.findByText(/joining the game/i)).toBeInTheDocument();
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it('cancel tears down the offline transport only when asked to', async () => {
    fakeCamera();
    const leaveOffline = vi.fn();
    useStore.setState({ leaveOffline });
    const user = userEvent.setup();

    const home = render(<GuestPairingSheet name="Bea" leaveOnCancel onClose={() => {}} />);
    await user.click(screen.getByTestId('pairing-close'));
    expect(leaveOffline).toHaveBeenCalledTimes(1);
    home.unmount();

    render(<GuestPairingSheet name="Bea" leaveOnCancel={false} onClose={() => {}} />);
    await user.click(screen.getByTestId('pairing-close'));
    expect(leaveOffline).toHaveBeenCalledTimes(1);
  });

  it('connects directly in 1 scan when a 4-letter room code is scanned (zero return scans)', async () => {
    fakeCamera();
    let finishJoin!: () => void;
    const joinPromise = new Promise<void>((resolve) => {
      finishJoin = resolve;
    });
    const joinOfflineByCode = vi.fn(async () => joinPromise);
    const onConnected = vi.fn();
    useStore.setState({ joinOfflineByCode });
    const user = userEvent.setup();

    render(<GuestPairingSheet name="Bea" leaveOnCancel onClose={() => {}} onConnected={onConnected} />);

    await pasteCode(user, 'WXYZ');
    expect(joinOfflineByCode).toHaveBeenCalledWith('WXYZ', 'Bea');
    expect(screen.queryByAltText(/reply code/i)).not.toBeInTheDocument();

    finishJoin();
    expect(await screen.findByText(/joining the game/i)).toBeInTheDocument();
    expect(onConnected).toHaveBeenCalledTimes(1);
  });
});

describe('extractRoomCode', () => {
  it('extracts room code from plain 4 letters, room URLs, or broker prefixes', () => {
    expect(extractRoomCode('ABCD')).toBe('ABCD');
    expect(extractRoomCode('wxyz')).toBe('WXYZ');
    expect(extractRoomCode('https://domain.com/#/ABCD')).toBe('ABCD');
    expect(extractRoomCode('https://domain.com/#WXYZ')).toBe('WXYZ');
    expect(extractRoomCode('https://domain.com/?room=ABCD')).toBe('ABCD');
    expect(extractRoomCode('catan-v2-EFGH')).toBe('EFGH');
    expect(extractRoomCode('LC1.invite-code')).toBeNull();
    expect(extractRoomCode('invalid-string')).toBeNull();
  });
});

describe('RoomQrModal', () => {
  it('displays the room code, QR code, and triggers manual pairing callback', async () => {
    const onManual = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <RoomQrModal
        roomCode="TEST"
        isOffline
        onClose={onClose}
        onOpenManualPairing={onManual}
      />,
    );

    expect(screen.getByTestId('modal-room-code')).toHaveTextContent('TEST');
    await screen.findByAltText(/qr code for room test/i);

    const switchBtn = screen.getByTestId('switch-to-manual-pairing');
    await user.click(switchBtn);
    expect(onClose).toHaveBeenCalled();
    expect(onManual).toHaveBeenCalled();
  });
});

describe('ReconnectBanner (offline guest)', () => {
  it('explains a lost host and opens the guest scanner on Re-scan', async () => {
    fakeCamera();
    useStore.setState({
      connected: false,
      session: { roomCode: 'ABCD', seatIndex: 1, reconnectToken: 't' },
      offline: { role: 'guest', peers: [], hostLost: true },
    });
    const user = userEvent.setup();
    render(<ReconnectBanner />);

    expect(screen.getByTestId('host-lost-banner')).toHaveTextContent(/ask the host to tap add player and re-scan/i);
    expect(screen.queryByTestId('reconnect-banner')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('rescan-host'));
    expect(screen.getByTestId('guest-pairing')).toBeInTheDocument();
  });
});
