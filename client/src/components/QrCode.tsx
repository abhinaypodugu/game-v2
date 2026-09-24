// Large, crisp QR code for offline pairing codes. Rendered as an SVG data
// URL (no canvas needed, scales without blur) sized for a phone to scan.

import { useEffect, useState } from 'react';
import { toString as qrToSvg } from 'qrcode';

export function QrCode({ value, label }: { value: string; label: string }): React.JSX.Element {
  const [svg, setSvg] = useState<{ value: string; url: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Low error correction keeps long WebRTC codes at a scannable density.
    qrToSvg(value, { type: 'svg', errorCorrectionLevel: 'L', margin: 2, color: { dark: '#1f2a37', light: '#ffffff' } }).then(
      (markup) => {
        if (!cancelled) setSvg({ value, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}` });
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [value]);

  const ready = svg !== null && svg.value === value;
  return (
    <div
      className="flex aspect-square w-[min(80vw,360px)] items-center justify-center overflow-hidden rounded-3xl border-2 border-line bg-white p-2 shadow-[0_3px_0_rgba(0,0,0,0.15)]"
      data-testid="qr-code"
    >
      {ready ? (
        <img src={svg.url} alt={label} className="h-full w-full [image-rendering:pixelated]" draggable={false} />
      ) : (
        <span className="px-4 text-center text-sm font-bold text-ink-soft">
          {failed ? 'Could not draw the QR code — use the text code below.' : 'Drawing code…'}
        </span>
      )}
    </div>
  );
}
