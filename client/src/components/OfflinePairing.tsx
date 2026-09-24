// Offline pairing sheets (no internet): the host shows an invite QR and scans
// the guest's reply QR; the guest scans the invite and shows its reply. Each
// side keeps its camera open while its WebRTC code is generated so browsers
// expose real LAN addresses instead of mDNS names. Text codes are the
// always-available fallback (copy / share / paste).

import { useEffect, useRef, useState } from 'react';
import type { Invite } from '../net/offline';
import { useStore } from '../store';
import { QrCode } from './QrCode';
import { PAIRING_CODE_PREFIX, QrViewfinder, cameraSettled, useCamera } from './QrScanner';

function errorText(err: unknown): string {
  return err instanceof Error && err.message.length > 0 ? err.message : 'Something went wrong — please try again.';
}

const primaryBtn =
  'h-12 rounded-2xl bg-go px-4 font-display text-base font-bold text-white shadow-[0_4px_0_#1d7a2c] active:translate-y-px disabled:opacity-50';
const secondaryBtn =
  'h-12 rounded-2xl bg-ocean-deep px-4 text-sm font-bold text-white shadow-[0_3px_0_#1f6f99] active:translate-y-px disabled:opacity-50';

function PairingSheet({
  title,
  onClose,
  closeLabel = 'Close',
  testId,
  children,
}: {
  title: string;
  onClose: () => void;
  closeLabel?: string;
  testId: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col overflow-y-auto overscroll-contain bg-cream text-ink"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid={testId}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b-2 border-line bg-cream px-4 pt-[max(0.75rem,var(--safe-top))] pb-3">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="h-12 rounded-xl bg-parchment px-4 text-sm font-bold text-ink active:translate-y-px"
          data-testid="pairing-close"
        >
          {closeLabel}
        </button>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 pt-4 pb-[max(1.5rem,var(--safe-bottom))]">
        {children}
      </div>
    </div>
  );
}

function StepHeading({ n, children }: { n: number; children: React.ReactNode }): React.JSX.Element {
  return (
    <h3 className="flex w-full items-center gap-2 text-lg font-bold">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-cta font-display text-base text-ink">
        {n}
      </span>
      {children}
    </h3>
  );
}

async function copyText(text: string, fallback: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API refused (insecure context / no permission): fall through.
  }
  if (fallback === null) return false;
  fallback.focus();
  fallback.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

/** Read-only text version of a code this device shows, with copy / share buttons. */
function CopyableCode({ code, what }: { code: string; what: string }): React.JSX.Element {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const canShare = typeof navigator.share === 'function';
  return (
    <div className="flex w-full flex-col gap-2">
      <textarea
        ref={areaRef}
        readOnly
        value={code}
        rows={3}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-none rounded-xl border-2 border-line bg-white p-2 font-mono text-xs break-all text-ink-soft"
        aria-label={`${what} as text`}
        data-testid="code-text"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            void copyText(code, areaRef.current).then((ok) => setCopied(ok ? 'yes' : 'no'));
          }}
          className={`${secondaryBtn} flex-1`}
          data-testid="copy-code"
        >
          {copied === 'yes' ? 'Copied ✓' : copied === 'no' ? 'Select & copy manually' : `Copy ${what}`}
        </button>
        {canShare ? (
          <button
            type="button"
            onClick={() => {
              void navigator.share({ text: code }).catch(() => {
                // Share sheet dismissed.
              });
            }}
            className={`${secondaryBtn} flex-1`}
          >
            Share
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Paste box for the other device's code. */
function PasteCode({
  what,
  disabled,
  busy,
  onSubmit,
}: {
  what: string;
  disabled: boolean;
  busy: boolean;
  onSubmit: (code: string) => void;
}): React.JSX.Element {
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const looksValid = trimmed.startsWith(PAIRING_CODE_PREFIX);
  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (looksValid && !disabled) onSubmit(trimmed);
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={`Paste the ${what} here (starts with ${PAIRING_CODE_PREFIX})`}
        className="w-full resize-none rounded-xl border-2 border-line bg-white p-2 font-mono text-xs break-all text-ink outline-none placeholder:font-sans placeholder:text-sm focus:border-cta"
        aria-label={`Paste ${what}`}
        data-testid="paste-code"
      />
      {trimmed.length > 0 && !looksValid ? (
        <p className="text-sm font-bold text-[#8a1424]">That doesn't look like a Catan pairing code.</p>
      ) : null}
      <button type="submit" disabled={!looksValid || disabled || busy} className={primaryBtn} data-testid="paste-submit">
        {busy ? 'Connecting…' : 'Connect'}
      </button>
    </form>
  );
}

function TextFallback({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <details className="w-full rounded-2xl border-2 border-line bg-white/70 p-3" data-testid="text-fallback">
      <summary className="flex min-h-12 cursor-pointer items-center text-sm font-bold text-ocean-deep">
        Can't scan? Use text codes instead
      </summary>
      <div className="flex flex-col gap-3 pt-2">{children}</div>
    </details>
  );
}

function ErrorNote({ message }: { message: string }): React.JSX.Element {
  return (
    <p
      className="w-full rounded-2xl border-2 border-[#a61b2d] bg-[#fdecee] px-3 py-2 text-sm font-bold text-[#8a1424]"
      role="alert"
      data-testid="pairing-error"
    >
      {message}
    </p>
  );
}

function Busy({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex aspect-square w-[min(80vw,360px)] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-line bg-white text-center font-bold text-ink-soft">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-cta" aria-hidden="true" />
      {children}
    </div>
  );
}

type HostStep =
  | { kind: 'preparing' }
  | { kind: 'invite'; invite: Invite; accepting: boolean; error: string | null }
  | { kind: 'connected' }
  | { kind: 'error'; message: string };

/** Host: "Add player" — show invite QR, then scan the guest's reply QR. */
export function HostPairingSheet({ onClose }: { onClose: () => void }): React.JSX.Element {
  const createInvite = useStore((s) => s.createInvite);
  // Free seats, or a dropped guest who can re-pair into their old seat.
  const canPairMore = useStore(
    (s) =>
      s.room === null ||
      s.room.players.length < s.room.settings.maxPlayers ||
      s.room.players.some((p) => !p.isBot && !p.connected),
  );
  const [step, setStep] = useState<HostStep>({ kind: 'preparing' });
  const [cameraRetry, setCameraRetry] = useState(0);
  const pendingRef = useRef<Invite | null>(null);

  // Camera first: it must be live (or have definitively failed) before the
  // offer is created so ICE gathering can use real LAN addresses.
  const camera = useCamera(step.kind === 'preparing' || step.kind === 'invite', cameraRetry);
  const settled = cameraSettled(camera.status);

  useEffect(() => {
    if (step.kind !== 'preparing' || !settled) return;
    let cancelled = false;
    createInvite().then(
      (invite) => {
        if (cancelled) {
          invite.cancel();
          return;
        }
        pendingRef.current = invite;
        setStep({ kind: 'invite', invite, accepting: false, error: null });
      },
      (err: unknown) => {
        if (!cancelled) setStep({ kind: 'error', message: errorText(err) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [step.kind, settled, createInvite]);

  // Closing the sheet abandons an unanswered invite.
  useEffect(
    () => () => {
      pendingRef.current?.cancel();
      pendingRef.current = null;
    },
    [],
  );

  const accept = (code: string): void => {
    if (step.kind !== 'invite' || step.accepting) return;
    const { invite } = step;
    setStep({ ...step, accepting: true, error: null });
    invite.accept(code).then(
      () => {
        if (pendingRef.current === invite) pendingRef.current = null;
        setStep({ kind: 'connected' });
      },
      (err: unknown) => {
        // The invite stays usable after a rejected reply: keep scanning.
        setStep((s) => (s.kind === 'invite' && s.invite === invite ? { ...s, accepting: false, error: errorText(err) } : s));
      },
    );
  };

  const again = (): void => {
    pendingRef.current?.cancel();
    pendingRef.current = null;
    setStep({ kind: 'preparing' });
  };

  if (step.kind === 'connected') {
    return (
      <PairingSheet title="Add player" onClose={onClose} closeLabel="Done" testId="host-pairing">
        <div className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-[#1f8a33] bg-[#eaf8ec] p-6 text-center" data-testid="pairing-success">
          <span className="text-5xl" aria-hidden="true">
            ✅
          </span>
          <p className="font-display text-2xl font-bold text-[#16692a]">Player connected!</p>
          <p className="text-sm font-bold text-ink-soft">They'll appear in the player list in a moment.</p>
        </div>
        {canPairMore ? (
          <button type="button" onClick={again} className={`${secondaryBtn} w-full`} data-testid="pair-another">
            📷 Add another player
          </button>
        ) : null}
        <button type="button" onClick={onClose} className={`${primaryBtn} w-full`}>
          Back to lobby
        </button>
      </PairingSheet>
    );
  }

  const invite = step.kind === 'invite' ? step : null;
  return (
    <PairingSheet title="Add player" onClose={onClose} closeLabel="Cancel" testId="host-pairing">
      <p className="w-full text-sm font-bold text-ink-soft">
        The guest joins your Wi-Fi or hotspot, opens the app and taps <b>Join a game</b>.
      </p>

      <StepHeading n={1}>Guest scans this</StepHeading>
      {step.kind === 'error' ? (
        <>
          <ErrorNote message={step.message} />
          <button type="button" onClick={again} className={`${primaryBtn} w-full`}>
            Try again
          </button>
        </>
      ) : invite !== null ? (
        <QrCode value={invite.invite.code} label="Invite code for the guest to scan" />
      ) : (
        <Busy>{settled ? 'Creating invite…' : 'Starting camera…'}</Busy>
      )}

      <StepHeading n={2}>Scan the guest's code</StepHeading>
      <QrViewfinder
        camera={camera}
        onCode={accept}
        paused={invite?.accepting === true}
        onRetry={() => setCameraRetry((n) => n + 1)}
      />
      {invite?.accepting === true ? <p className="font-bold text-ink-soft">Connecting…</p> : null}
      {invite !== null && invite.error !== null ? <ErrorNote message={invite.error} /> : null}

      {invite !== null ? (
        <TextFallback>
          <p className="text-sm font-bold">1. Send this invite code to the guest:</p>
          <CopyableCode code={invite.invite.code} what="invite code" />
          <p className="text-sm font-bold">2. Paste the reply code from the guest:</p>
          <PasteCode what="reply code" disabled={false} busy={invite.accepting} onSubmit={accept} />
        </TextFallback>
      ) : null}
    </PairingSheet>
  );
}

type GuestStep =
  | { kind: 'scan'; error: string | null }
  | { kind: 'answering' }
  | { kind: 'reply'; replyCode: string }
  | { kind: 'connected' };

/**
 * Guest: scan the host's invite, show the reply for the host to scan, then
 * wait for the channel. `joinOffline` reuses a saved seat token for the room.
 */
export function GuestPairingSheet({
  name,
  onClose,
  leaveOnCancel,
  onConnected,
}: {
  name: string;
  onClose: () => void;
  /** Tear down the offline transport when the guest backs out (true from Home, false when re-scanning). */
  leaveOnCancel: boolean;
  onConnected?: () => void;
}): React.JSX.Element {
  const joinOffline = useStore((s) => s.joinOffline);
  const leaveOffline = useStore((s) => s.leaveOffline);
  const [step, setStep] = useState<GuestStep>({ kind: 'scan', error: null });
  const [cameraRetry, setCameraRetry] = useState(0);
  const runRef = useRef(0);
  const onConnectedRef = useRef(onConnected);
  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  // The camera stays open until the reply code exists (see file header).
  const camera = useCamera(step.kind === 'scan' || step.kind === 'answering', cameraRetry);
  const settled = cameraSettled(camera.status);

  const submit = (code: string): void => {
    if (step.kind !== 'scan') return;
    const run = ++runRef.current;
    setStep({ kind: 'answering' });
    joinOffline(code, name).then(
      ({ replyCode, connected }) => {
        if (runRef.current !== run) return;
        setStep({ kind: 'reply', replyCode });
        connected.then(
          () => {
            if (runRef.current !== run) return;
            setStep({ kind: 'connected' });
            onConnectedRef.current?.();
          },
          (err: unknown) => {
            if (runRef.current === run) setStep({ kind: 'scan', error: `Couldn't connect: ${errorText(err)} Ask the host to tap Add player again.` });
          },
        );
      },
      (err: unknown) => {
        if (runRef.current === run) setStep({ kind: 'scan', error: errorText(err) });
      },
    );
  };

  const startOver = (): void => {
    runRef.current++;
    setStep({ kind: 'scan', error: null });
  };

  const cancel = (): void => {
    runRef.current++;
    if (leaveOnCancel && step.kind !== 'connected') leaveOffline();
    onClose();
  };

  if (step.kind === 'connected') {
    return (
      <PairingSheet title="Join offline game" onClose={onClose} closeLabel="Close" testId="guest-pairing">
        <Busy>
          <span className="font-display text-xl text-[#16692a]">Connected ✓</span>
          Joining the game…
        </Busy>
      </PairingSheet>
    );
  }

  if (step.kind === 'reply') {
    return (
      <PairingSheet title="Join offline game" onClose={cancel} closeLabel="Cancel" testId="guest-pairing">
        <StepHeading n={2}>Show this to the host</StepHeading>
        <p className="w-full text-sm font-bold text-ink-soft">The host scans it under “Scan the guest's code”.</p>
        <QrCode value={step.replyCode} label="Reply code for the host to scan" />
        <div className="flex items-center gap-2 font-bold text-ink-soft" data-testid="waiting-host">
          <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-line border-t-cta" aria-hidden="true" />
          Waiting for host…
        </div>
        <TextFallback>
          <p className="text-sm font-bold">Send this reply code to the host:</p>
          <CopyableCode code={step.replyCode} what="reply code" />
        </TextFallback>
        <button type="button" onClick={startOver} className="h-12 rounded-xl px-4 text-sm font-bold text-ocean-deep underline">
          Start over (scan a new invite)
        </button>
      </PairingSheet>
    );
  }

  const answering = step.kind === 'answering';
  return (
    <PairingSheet title="Join offline game" onClose={cancel} closeLabel="Cancel" testId="guest-pairing">
      <p className="w-full text-sm font-bold text-ink-soft">
        Join the host's Wi-Fi or hotspot first. The host taps <b>Add player</b> to show a code.
      </p>
      <StepHeading n={1}>Scan the host's code</StepHeading>
      <QrViewfinder camera={camera} onCode={submit} paused={answering} onRetry={() => setCameraRetry((n) => n + 1)} />
      {answering ? <p className="font-bold text-ink-soft">Creating your reply code…</p> : null}
      {step.kind === 'scan' && step.error !== null ? <ErrorNote message={step.error} /> : null}
      <TextFallback>
        <p className="text-sm font-bold">Paste the invite code from the host:</p>
        <PasteCode what="invite code" disabled={!settled} busy={answering} onSubmit={submit} />
      </TextFallback>
    </PairingSheet>
  );
}
