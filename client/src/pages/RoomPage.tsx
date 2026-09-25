// Room lobby: seats, colours, ready checks, host settings, board preview.
// Mobile-first single column; seats/settings beside the preview on ≥1024px.
// Offline games swap the invite link for QR pairing ("Add player").

import { useMemo, useState } from 'react';
import { DEFAULT_RULES, PLAYER_COLORS, boardConfigForPlayers, generateBoard } from '@catan/shared';
import type { PlayerColor, PlayerCount } from '@catan/shared';
import { BoardSvg } from '../board/BoardSvg';
import { useStore } from '../store';
import type { PersonalSnapshot, RoomSettings } from '../types';
import { Avatar, playerColor } from '../components/PlayerStrip';
import { HostPairingSheet } from '../components/OfflinePairing';
import { RoomQrModal } from '../components/RoomQrModal';
import { getRoomShareUrl } from '../components/QrScanner';
import { OfflineHostBanner, ReconnectBanner } from '../components/Overlays';

const TIMER_OPTIONS = [0, 60, 120, 180, 300];
const PLAYER_OPTIONS = [3, 4, 5, 6, 7, 8];
const VP_OPTIONS = Array.from({ length: 18 }, (_, i) => i + 3); // 3..20
const DISCARD_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 5); // 5..20

const MODE_LABEL = { base: 'Classic board', ext56: '5-6 expansion board', ext78: '7-8 expansion board' } as const;

const selectClass =
  'h-11 min-w-24 rounded-xl border-2 border-line bg-white px-2 text-sm font-bold text-ink outline-none focus:border-cta';

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
      <span className="flex flex-col">
        <span className="font-bold text-ink">{label}</span>
        {hint !== undefined ? <span className="text-xs text-ink-soft">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function ReadOnlyValue({ children, testId }: { children: React.ReactNode; testId: string }): React.JSX.Element {
  return (
    <span className="rounded-xl bg-parchment px-3 py-2 text-sm font-bold text-ink" data-testid={testId}>
      {children}
    </span>
  );
}

export function RoomPage(): React.JSX.Element {
  const room = useStore((s) => s.room);
  const session = useStore((s) => s.session);
  const setReady = useStore((s) => s.setReady);
  const pickColor = useStore((s) => s.pickColor);
  const updateSettings = useStore((s) => s.updateSettings);
  const regenerateBoard = useStore((s) => s.regenerateBoard);
  const startGame = useStore((s) => s.startGame);
  const leaveRoom = useStore((s) => s.leaveRoom);
  const addBot = useStore((s) => s.addBot);
  const removeBot = useStore((s) => s.removeBot);
  const offline = useStore((s) => s.offline);
  const leaveOffline = useStore((s) => s.leaveOffline);
  const [pairing, setPairing] = useState(false);
  const [showRoomQr, setShowRoomQr] = useState(false);

  const maxPlayers = room?.settings.maxPlayers;
  const seed = room?.seed;
  const started = room?.started ?? true;
  const vpToWin = room?.settings.victoryPointsToWin ?? DEFAULT_RULES.victoryPointsToWin;
  const discardLimit = room?.settings.discardLimit ?? DEFAULT_RULES.discardLimit;

  // Derived board preview — a pure function of seat count + seed.
  const preview: PersonalSnapshot | null = useMemo(() => {
    if (maxPlayers === undefined || seed === undefined || started) return null;
    const board = generateBoard(maxPlayers as PlayerCount, seed);
    return {
      version: 0,
      config: boardConfigForPlayers(maxPlayers).key,
      playerCount: maxPlayers,
      rules: { victoryPointsToWin: vpToWin, discardLimit },
      phase: 'setupForward',
      activeSeat: 0,
      specialBuildSeat: null,
      turn: 0,
      dice: null,
      board,
      buildings: {},
      roads: {},
      robber: board.robberHex,
      bank: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      devDeckCount: 0,
      trades: [],
      pendingDiscards: [],
      longestRoad: { holder: null, length: 0 },
      largestArmy: { holder: null, knights: 0 },
      devCardPlayedThisTurn: false,
      winner: null,
      players: [],
      you: { seat: 0, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }, devHand: [], totalVp: 0 },
    };
  }, [maxPlayers, seed, started, vpToWin, discardLimit]);

  if (room === null || session === null) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-ocean font-display text-xl font-bold text-white">
        Loading room…
      </div>
    );
  }

  const isHost = room.host === session.seatIndex;
  const me = room.players.find((p) => p.seatIndex === session.seatIndex);
  const takenByOthers = new Set(
    room.players
      .filter((p) => p.seatIndex !== session.seatIndex)
      .map((p) => p.color)
      .filter((c): c is PlayerColor => c !== null),
  );
  const allReady = room.players.every((p) => p.ready);
  const allColored = room.players.every((p) => p.color !== null);
  const canStart = isHost && allReady && room.players.length >= 3 && allColored;
  const startHint =
    room.players.length < 3
      ? 'Need at least 3 players — add bots or invite friends.'
      : !allColored
        ? 'Everyone needs to pick a colour.'
        : !allReady
          ? 'Waiting for everyone to be ready.'
          : isHost
            ? 'Everyone is ready!'
            : 'Waiting for the host to start.';

  const inviteLink = getRoomShareUrl(room.roomCode);
  const settings: RoomSettings = room.settings;
  const boardMode = boardConfigForPlayers(settings.maxPlayers).key;
  const isOffline = offline.role !== null;
  const seatedNames = new Set(room.players.map((p) => p.name));
  // Guests still pairing, or connected but not yet seated.
  const pendingPeers = offline.peers.filter(
    (peer) => peer.state === 'pairing' || (peer.state === 'open' && (peer.name === null || !seatedNames.has(peer.name))),
  );
  // Free seats, or a dropped guest who needs to re-pair into their old seat.
  const canAddPlayer =
    isOffline &&
    isHost &&
    (room.players.length < settings.maxPlayers || room.players.some((p) => !p.isBot && !p.connected));

  const leave = (): void => {
    if (isOffline && isHost && !window.confirm('End this offline game for everyone?')) return;
    leaveRoom();
    if (isOffline) leaveOffline();
  };

  return (
    <div className="min-h-[100dvh] bg-ocean px-3 pt-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] text-ink sm:px-6">
      <ReconnectBanner />
      {pairing ? <HostPairingSheet onClose={() => setPairing(false)} /> : null}
      {showRoomQr ? (
        <RoomQrModal
          roomCode={room.roomCode}
          isOffline={isOffline}
          onClose={() => setShowRoomQr(false)}
          onOpenManualPairing={() => setPairing(true)}
        />
      ) : null}
      <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="flex w-full flex-col gap-3 lg:w-[420px] lg:flex-none">
          <OfflineHostBanner />
          {/* Header */}
          <div className="flex items-center justify-between gap-2 rounded-3xl border-2 border-line bg-cream px-4 py-3 shadow-[0_3px_0_rgba(0,0,0,0.15)]">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">Room code</span>
              <h1 className="font-display text-3xl font-bold tracking-widest" data-testid="room-code">
                {room.roomCode}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isOffline ? (
                <span
                  className="flex h-11 items-center gap-1.5 rounded-xl bg-[#eaf8ec] px-3 text-sm font-bold text-[#16692a]"
                  data-testid="offline-badge"
                >
                  📡 Offline
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setShowRoomQr(true)}
                className="flex h-11 items-center gap-1.5 rounded-xl bg-cta px-3 text-sm font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px"
                data-testid="show-qr-btn"
                title="Show Room QR Code for fast 1-scan joining"
              >
                <span>📷</span> QR
              </button>
              {!isOffline ? (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(inviteLink);
                  }}
                  className="h-11 rounded-xl bg-ocean-deep px-3 text-sm font-bold text-white shadow-[0_3px_0_#1f6f99] active:translate-y-px"
                  data-testid="copy-invite"
                >
                  Copy invite link
                </button>
              ) : null}
            </div>
          </div>

          {/* Seats */}
          <div className="flex flex-col gap-2 rounded-3xl border-2 border-line bg-cream p-3 shadow-[0_3px_0_rgba(0,0,0,0.15)]">
            <h2 className="flex items-baseline justify-between text-lg font-bold">
              Players
              <span className="text-sm font-bold text-ink-soft">
                {room.players.length}/{settings.maxPlayers}
              </span>
            </h2>
            {room.players.map((p) => {
              const isMe = p.seatIndex === session.seatIndex;
              return (
                <div
                  key={p.seatIndex}
                  className={`flex flex-col gap-2 rounded-2xl border-2 bg-white px-3 py-2 ${
                    isMe ? 'border-cta' : 'border-line'
                  } ${p.connected ? '' : 'opacity-60 grayscale'}`}
                  data-testid={`seat-${p.seatIndex}`}
                >
                  <div className="flex items-center gap-2">
                    {p.color !== null ? (
                      <Avatar name={p.name} color={p.color} />
                    ) : (
                      <span className="h-8 w-8 flex-none rounded-full border-2 border-dashed border-ink-soft" />
                    )}
                    {!p.isBot ? (
                      <span
                        className={`h-3 w-3 flex-none rounded-full ${p.connected ? 'bg-go' : 'animate-pulse bg-cta'}`}
                        role="img"
                        aria-label={p.connected ? 'Connected' : 'Reconnecting'}
                        data-testid={`seat-dot-${p.seatIndex}`}
                      />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-base font-bold">
                      {p.name}
                      {p.isBot ? ' 🤖' : ''}
                      {p.seatIndex === room.host ? ' 👑' : ''}
                      {p.connected ? '' : isOffline ? ' (reconnecting…)' : ' (offline)'}
                    </span>
                    {p.isBot && isHost ? (
                      <button
                        type="button"
                        onClick={() => removeBot(p.seatIndex)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fcd5d5] text-base font-bold text-[#8a1424]"
                        title="Remove bot"
                        aria-label={`Remove ${p.name}`}
                      >
                        ✕
                      </button>
                    ) : null}
                    {isMe ? (
                      <button
                        type="button"
                        onClick={() => setReady(!(me?.ready ?? false))}
                        className={`h-11 rounded-xl px-3 text-sm font-bold active:translate-y-px ${
                          me?.ready === true
                            ? 'bg-go text-white shadow-[0_3px_0_#1d7a2c]'
                            : 'bg-cta text-ink shadow-[0_3px_0_#a86d08]'
                        }`}
                        data-testid="ready-toggle"
                      >
                        {me?.ready === true ? 'Ready ✓' : 'Ready?'}
                      </button>
                    ) : (
                      <span className={`text-sm font-bold ${p.ready ? 'text-go' : 'text-ink-soft'}`}>
                        {p.ready ? 'Ready' : 'Waiting…'}
                      </span>
                    )}
                  </div>
                  {isMe ? (
                    <div className="flex flex-wrap gap-1.5" data-testid={`color-picker-${p.seatIndex}`}>
                      {PLAYER_COLORS.map((c) => {
                        const selected = p.color === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Pick ${c}`}
                            aria-pressed={selected}
                            disabled={takenByOthers.has(c)}
                            onClick={() => pickColor(c)}
                            className={`h-10 w-10 rounded-full border-2 border-ink transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 ${
                              selected ? 'ring-4 ring-cta ring-offset-2' : ''
                            }`}
                            style={{ background: playerColor(c).main }}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {pendingPeers.map((peer) => (
              <div
                key={peer.id}
                className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white/70 px-3 py-2 text-sm font-bold text-ink-soft"
                data-testid="pending-peer"
              >
                <span className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-line border-t-cta" aria-hidden="true" />
                {peer.state === 'pairing' ? 'Guest pairing…' : `${peer.name ?? 'Guest'} joining…`}
              </div>
            ))}

            {canAddPlayer ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowRoomQr(true)}
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-cta font-display text-base font-bold text-ink shadow-[0_4px_0_#a86d08] active:translate-y-px"
                  data-testid="btn-add-player-qr"
                >
                  ⚡ Add player (1-Scan or Code)
                </button>
                <button
                  type="button"
                  onClick={() => setPairing(true)}
                  className="flex h-10 items-center justify-center gap-1 rounded-xl border border-line bg-white/70 text-xs font-bold text-ink-soft active:translate-y-px"
                  data-testid="btn-add-player"
                >
                  📷 2-way camera scan (no internet fallback)
                </button>
              </div>
            ) : null}

            {isHost && room.players.length < settings.maxPlayers ? (
              <button
                type="button"
                onClick={addBot}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ocean-deep bg-white text-sm font-bold text-ocean-deep active:translate-y-px"
                data-testid="btn-add-bot"
              >
                🤖 Add AI bot
              </button>
            ) : null}
          </div>

          {/* Settings (editable by host, read-only for everyone else) */}
          <div
            className="flex flex-col gap-1 rounded-3xl border-2 border-line bg-cream p-3 shadow-[0_3px_0_rgba(0,0,0,0.15)]"
            data-testid={isHost ? 'host-settings' : 'room-settings'}
          >
            <h2 className="text-lg font-bold">Game settings</h2>
            <SettingRow label="Max players" hint={MODE_LABEL[boardMode]}>
              {isHost ? (
                <select
                  value={settings.maxPlayers}
                  onChange={(e) => updateSettings({ maxPlayers: Number(e.target.value) })}
                  className={selectClass}
                  data-testid="max-players-select"
                >
                  {PLAYER_OPTIONS.map((n) => (
                    <option key={n} value={n} disabled={n < room.players.length}>
                      {n}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadOnlyValue testId="max-players-value">{settings.maxPlayers}</ReadOnlyValue>
              )}
            </SettingRow>
            <SettingRow label="Victory points" hint="Points needed to win">
              {isHost ? (
                <select
                  value={vpToWin}
                  onChange={(e) => updateSettings({ victoryPointsToWin: Number(e.target.value) })}
                  className={selectClass}
                  data-testid="vp-select"
                >
                  {VP_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} VP
                    </option>
                  ))}
                </select>
              ) : (
                <ReadOnlyValue testId="vp-value">{vpToWin} VP</ReadOnlyValue>
              )}
            </SettingRow>
            <SettingRow label="Discard limit" hint="On a 7, discard if holding more">
              {isHost ? (
                <select
                  value={discardLimit}
                  onChange={(e) => updateSettings({ discardLimit: Number(e.target.value) })}
                  className={selectClass}
                  data-testid="discard-limit-select"
                >
                  {DISCARD_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} cards
                    </option>
                  ))}
                </select>
              ) : (
                <ReadOnlyValue testId="discard-limit-value">{discardLimit} cards</ReadOnlyValue>
              )}
            </SettingRow>
            <SettingRow label="Turn timer">
              {isHost ? (
                <select
                  value={settings.turnTimerSec}
                  onChange={(e) => updateSettings({ turnTimerSec: Number(e.target.value) })}
                  className={selectClass}
                  data-testid="timer-select"
                >
                  {TIMER_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? 'Off' : `${n}s`}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadOnlyValue testId="timer-value">
                  {settings.turnTimerSec === 0 ? 'Off' : `${settings.turnTimerSec}s`}
                </ReadOnlyValue>
              )}
            </SettingRow>
            <SettingRow label="Dice">
              {isHost ? (
                <select
                  value={settings.diceMode}
                  onChange={(e) => updateSettings({ diceMode: e.target.value as 'random' | 'balanced' })}
                  className={selectClass}
                  data-testid="dice-mode-select"
                >
                  <option value="random">Random</option>
                  <option value="balanced">Balanced</option>
                </select>
              ) : (
                <ReadOnlyValue testId="dice-mode-value">
                  {settings.diceMode === 'random' ? 'Random' : 'Balanced'}
                </ReadOnlyValue>
              )}
            </SettingRow>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!canStart}
              onClick={startGame}
              className="h-14 rounded-2xl bg-go px-4 font-display text-xl font-bold text-white shadow-[0_4px_0_#1d7a2c] active:translate-y-px disabled:opacity-40"
              data-testid="start-game"
            >
              Start game
            </button>
            <p className="text-center text-sm font-bold text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]">{startHint}</p>
            <button
              type="button"
              onClick={leave}
              className="h-11 self-center rounded-xl px-4 text-sm font-bold text-white underline"
              data-testid="leave-room"
            >
              {isOffline && isHost ? 'End offline game' : 'Leave room'}
            </button>
          </div>
        </div>

        {/* Board preview */}
        <div
          className="flex w-full flex-col gap-2 rounded-3xl border-2 border-line bg-cream p-3 shadow-[0_3px_0_rgba(0,0,0,0.15)] lg:sticky lg:top-4 lg:flex-1"
          data-testid="board-preview"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Board preview</h2>
            {isHost ? (
              <button
                type="button"
                onClick={regenerateBoard}
                className="h-11 rounded-xl bg-ocean-deep px-3 text-sm font-bold text-white shadow-[0_3px_0_#1f6f99] active:translate-y-px"
                data-testid="regenerate-board"
              >
                🎲 New board
              </button>
            ) : null}
          </div>
          <div className="pointer-events-none aspect-square w-full overflow-hidden rounded-2xl bg-ocean lg:aspect-[4/3]">
            {preview !== null ? <BoardSvg snap={preview} compact /> : <p className="p-4">Loading preview…</p>}
          </div>
          <p className="text-xs text-ink-soft">
            {MODE_LABEL[boardMode]} · seed {room.seed} · first to {vpToWin} VP
          </p>
        </div>
      </div>
    </div>
  );
}
