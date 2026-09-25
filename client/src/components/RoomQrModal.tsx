// Room QR Code / Share modal: allows players to join in a single camera scan
// or by typing the 4-letter room code, eliminating tedious 2-way return scans.

import { useState } from 'react';
import { QrCode } from './QrCode';

export function RoomQrModal({
  roomCode,
  onClose,
  onOpenManualPairing,
  isOffline,
}: {
  roomCode: string;
  onClose: () => void;
  onOpenManualPairing?: () => void;
  isOffline: boolean;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}${window.location.pathname}#/${roomCode}`;

  const copyLink = async (): Promise<void> => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-4 text-ink backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Room QR Code"
      data-testid="room-qr-modal"
    >
      <div className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-line bg-cream p-5 shadow-2xl">
        <header className="flex w-full items-center justify-between border-b-2 border-line pb-3">
          <div className="flex flex-col">
            <h2 className="font-display text-xl font-bold">Room QR Code</h2>
            <span className="text-xs font-bold text-ink-soft">1-Scan or Code Entry</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-parchment font-bold text-ink active:translate-y-px"
            data-testid="room-qr-close"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {/* Big scannable QR Code */}
        <div className="flex flex-col items-center gap-2">
          <QrCode value={shareUrl} label={`QR Code for room ${roomCode}`} />
        </div>

        {/* Room Code Display */}
        <div className="flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-line bg-white px-4 py-3 shadow-inner">
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">Room Code</span>
            <span className="font-display text-3xl font-bold tracking-widest text-ink" data-testid="modal-room-code">
              {roomCode}
            </span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="h-10 rounded-xl bg-ocean-deep px-3 text-xs font-bold text-white shadow-[0_2px_0_#1f6f99] active:translate-y-px"
            data-testid="modal-copy-link"
          >
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>

        {/* Instructions */}
        <div className="w-full rounded-2xl bg-parchment/60 p-3 text-left text-xs font-bold leading-relaxed text-ink-soft">
          <p className="font-display text-sm font-bold text-ink mb-1">⚡ Fast Join (No Return Scan):</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Guests open the app on their phone.</li>
            <li>
              Type <span className="font-mono text-ink font-extrabold">{roomCode}</span> on the home screen, or tap <b>Join a game</b> and scan this QR code once.
            </li>
            <li>Guests join immediately!</li>
          </ol>
        </div>

        {/* Fallback to 2-way manual pairing */}
        {isOffline && onOpenManualPairing ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenManualPairing();
            }}
            className="text-xs font-bold text-ocean-deep underline hover:text-ink active:translate-y-px"
            data-testid="switch-to-manual-pairing"
          >
            Zero internet / cellular signal? Use 2-way offline scan ➜
          </button>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="h-12 w-full rounded-2xl bg-go font-display text-base font-bold text-white shadow-[0_4px_0_#1d7a2c] active:translate-y-px"
        >
          Done
        </button>
      </div>
    </div>
  );
}
