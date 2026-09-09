// Room lobby: seats, colors, ready checks, host settings, board preview.

import { useMemo } from 'react';
import { generateBoard, PLAYER_COLORS } from '@catan/shared';
import type { PlayerColor } from '@catan/shared';
import { BoardSvg } from '../board/BoardSvg';
import { useStore } from '../store';
import type { PersonalSnapshot } from '../types';
import { PIECE_COLORS } from '../theme';

const TIMER_OPTIONS = [0, 60, 120, 180, 300];

export function RoomPage(): React.JSX.Element {
  const room = useStore((s) => s.room);
  const session = useStore((s) => s.session);
  const setReady = useStore((s) => s.setReady);
  const pickColor = useStore((s) => s.pickColor);
  const updateSettings = useStore((s) => s.updateSettings);
  const regenerateBoard = useStore((s) => s.regenerateBoard);
  const startGame = useStore((s) => s.startGame);
  const leaveRoom = useStore((s) => s.leaveRoom);
  // Derived board preview — no effect needed (pure function of room).
  const preview: PersonalSnapshot | null = useMemo(() => {
    if (room === null || room.started) return null;
    const board = generateBoard(room.settings.maxPlayers >= 5 ? 5 : 4, room.seed);
    return {
      version: 0,
      config: room.settings.maxPlayers >= 5 ? 'ext56' : 'base',
      playerCount: room.settings.maxPlayers,
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
      winner: null,
      players: [],
      you: { seat: 0, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }, devHand: [], totalVp: 0 },
    };
  }, [room]);

  const isHost = session !== null && room !== null && room.host === session.seatIndex;
  const me = room?.players.find((p) => p.seatIndex === session?.seatIndex);

  if (room === null || session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#04182a] text-[#f6f8fa]">
        Loading room…
      </div>
    );
  }

  const takenColors = new Set(room.players.map((p) => p.color).filter((c): c is PlayerColor => c !== null));
  const allReady = room.players.every((p) => p.ready);
  const canStart =
    isHost &&
    allReady &&
    room.players.length >= 3 &&
    room.players.every((p) => p.color !== null);

  const inviteLink = `${window.location.origin}/#/${room.roomCode}`;

  return (
    <div className="min-h-screen bg-[#04182a] px-6 py-8 text-[#f6f8fa]">
      <div className="mx-auto flex max-w-6xl gap-8">
        {/* Left: seats + settings */}
        <div className="flex w-96 flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="font-[Bricolage_Grotesque,system-ui] text-3xl font-bold">Room {room.roomCode}</h1>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(inviteLink);
              }}
              className="rounded-lg bg-[#1e90ff] px-3 py-1.5 text-sm font-medium hover:brightness-110"
              data-testid="copy-invite"
            >
              Copy invite link
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {room.players.map((p) => (
              <div
                key={p.seatIndex}
                className={`flex items-center justify-between rounded-xl border border-amber-700/40 bg-gradient-to-b from-[#fffdf7] to-[#ede3cd] px-4 py-3 text-[#3b2a15] shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition hover:shadow-[0_6px_16px_rgba(0,0,0,0.5)] ${
                  p.connected ? '' : 'opacity-60 saturate-50'
                } ${me?.ready === true && p.seatIndex === session.seatIndex ? 'ring-2 ring-emerald-500/70' : ''}`}
                data-testid={`seat-${p.seatIndex}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-black/50"
                    style={{ background: p.color !== null ? PIECE_COLORS[p.color]?.main ?? '#666' : 'transparent' }}
                  />
                  <span className="text-lg font-medium">
                    {p.name}
                    {p.seatIndex === room.host ? ' 👑' : ''}
                    {p.connected ? '' : ' (disconnected)'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {p.color === null ? (
                    <div className="flex gap-2" data-testid={`color-picker-${p.seatIndex}`}>
                      {PLAYER_COLORS.filter((c) => !takenColors.has(c)).map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Pick ${c}`}
                          disabled={p.seatIndex !== session.seatIndex}
                          onClick={() => pickColor(c)}
                          className="h-6 w-6 rounded-full border-2 border-black/40 shadow-md transition hover:scale-125 disabled:opacity-40 disabled:hover:scale-100"
                          style={{ background: PIECE_COLORS[c]!.main }}
                        />
                      ))}
                    </div>
                  ) : null}
                  {p.seatIndex === session.seatIndex ? (
                    <button
                      type="button"
                      onClick={() => setReady(!(me?.ready ?? false))}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                        me?.ready === true ? 'bg-[#1fab1c]' : 'bg-[#f06800]'
                      }`}
                      data-testid="ready-toggle"
                    >
                      {me?.ready === true ? 'Ready ✓' : 'Ready?'}
                    </button>
                  ) : (
                    <span className={`text-sm font-semibold ${p.ready ? 'text-[#1fab1c]' : 'text-[#9fb8cc]'}`}>
                      {p.ready ? 'Ready' : 'Waiting…'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Host settings */}
          {isHost && !room.started ? (
            <div className="flex flex-col gap-3 rounded-lg bg-[#0a4986] p-4" data-testid="host-settings">
              <h2 className="font-semibold">Settings</h2>
              <label className="flex items-center justify-between gap-4 text-sm">
                <span>Max players</span>
                <select
                  value={room.settings.maxPlayers}
                  onChange={(e) => updateSettings({ maxPlayers: Number(e.target.value) })}
                  className="rounded bg-[#04182a] px-2 py-1.5"
                  data-testid="max-players-select"
                >
                  {[3, 4, 5, 6].map((n) => (
                    <option key={n} value={n} disabled={n < room.players.length}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-4 text-sm">
                <span>Turn timer</span>
                <select
                  value={room.settings.turnTimerSec}
                  onChange={(e) => updateSettings({ turnTimerSec: Number(e.target.value) })}
                  className="rounded bg-[#04182a] px-2 py-1.5"
                  data-testid="timer-select"
                >
                  {TIMER_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? 'Off' : `${n}s`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-4 text-sm">
                <span>Dice mode</span>
                <select
                  value={room.settings.diceMode}
                  onChange={(e) => updateSettings({ diceMode: e.target.value as 'random' | 'balanced' })}
                  className="rounded bg-[#04182a] px-2 py-1.5"
                  data-testid="dice-mode-select"
                >
                  <option value="random">Random</option>
                  <option value="balanced">Balanced</option>
                </select>
              </label>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span>Board seed: {room.seed}</span>
                <button
                  type="button"
                  onClick={regenerateBoard}
                  className="rounded-lg bg-[#1e90ff] px-3 py-1.5 font-medium hover:brightness-110"
                  data-testid="regenerate-board"
                >
                  🎲 Regenerate
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={!canStart}
            onClick={startGame}
            className="rounded-lg bg-[#f06800] px-4 py-3 text-lg font-bold text-white transition hover:bg-[#d05800] disabled:opacity-40"
            data-testid="start-game"
          >
            Start Game
          </button>

          <button
            type="button"
            onClick={leaveRoom}
            className="self-start text-sm text-[#9fb8cc] underline hover:text-white"
            data-testid="leave-room"
          >
            Leave room
          </button>
        </div>

        {/* Right: board preview */}
        <div className="flex-1 rounded-xl bg-[#0a2e52] p-4" data-testid="board-preview">
          {preview !== null ? <BoardSvg snap={preview} compact /> : <p>Loading preview…</p>}
        </div>
      </div>
    </div>
  );
}
