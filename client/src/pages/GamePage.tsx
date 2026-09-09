// Game page: 100% viewport-locked cockpit. Board lives in a pan/zoom canvas;
// HUD (top bar, right dock, bottom hand/build bar, zoom widget) is fixed floating.
// No page scroll anywhere.

import { useEffect, useMemo, useState } from 'react';
import type { GameAction } from '@catan/shared';
import { legalRobberHexes, RESOURCES } from '@catan/shared';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { Board3D } from '../board/Board3D';
import { BuildBar } from '../components/BuildBar';
import { DiceDisplay } from '../components/DiceDisplay';
import { DiscardModal, VictimPicker } from '../components/RobberFlow';
import { EventLog } from '../components/EventLog';
import { ReconnectBanner, ToastStack, TurnTimer } from '../components/Overlays';
import { ProductionFloaters } from '../components/ProductionFloaters';
import { TradeModal } from '../components/TradeModal';
import { VictoryOverlay } from '../components/VictoryOverlay';
import { useLegalMoves } from '../hooks/useLegalMoves';
import { useStore } from '../store';
import { PIECE_COLORS } from '../theme';
import type { GameEvent } from '../types';

const RESOURCE_EMOJI = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰',
} as const;

const RESOURCE_KEYS = RESOURCES;

/** Floating zoom controls bound to the TransformWrapper via context. */
function ZoomWidget(): React.JSX.Element {
  const { zoomIn, zoomOut, resetTransform, instance } = useControls();
  const [zoomPct, setZoomPct] = useState(100);
  useEffect(() => {
    const unsubscribe = instance.onTransform(({ scale }) => {
      setZoomPct(Math.round(scale * 100));
    });
    return unsubscribe;
  }, [instance]);
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-2 rounded-xl border border-sky-500/40 bg-[#04182a]/90 px-2 py-1.5 shadow-xl backdrop-blur-sm">
      <button
        type="button"
        className="h-9 w-9 rounded-lg bg-sky-900/80 text-lg font-bold text-white hover:bg-sky-700"
        onClick={() => zoomIn(0.3)}
        aria-label="Zoom in"
      >
        +
      </button>
      <span className="w-12 text-center font-mono text-xs font-bold text-sky-300">{zoomPct}%</span>
      <button
        type="button"
        className="h-9 w-9 rounded-lg bg-sky-900/80 text-lg font-bold text-white hover:bg-sky-700"
        onClick={() => zoomOut(0.3)}
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        className="h-9 rounded-lg bg-sky-900/80 px-3 text-xs font-bold text-amber-300 hover:bg-sky-700"
        onClick={() => resetTransform()}
      >
        ⛶ Fit
      </button>
    </div>
  );
}

export function GamePage(): React.JSX.Element {
  const snap = useStore((s) => s.game);
  const session = useStore((s) => s.session);
  const sendAction = useStore((s) => s.sendAction);
  const setPlacement = useStore((s) => s.setPlacement);
  const placement = useStore((s) => s.ui.placement);
  const showTradeModal = useStore((s) => s.ui.showTradeModal);
  const setTradeModal = useStore((s) => s.setTradeModal);
  const log = useStore((s) => s.log);
  const [rolling, setRolling] = useState(false);
  const [setupVertex, setSetupVertex] = useState<number | null>(null);

  const mySeat = session?.seatIndex ?? -1;
  const legal = useLegalMoves(snap, mySeat);

  // Dice roll animation: fires per new rolled event.
  const lastRollSeq = useMemo(
    () => log.filter((e: GameEvent) => e.type === 'rolled').length,
    [log],
  );
  useEffect(() => {
    if (lastRollSeq === 0) return;
    const start = setTimeout(() => setRolling(true), 0);
    const stop = setTimeout(() => setRolling(false), 800);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [lastRollSeq]);

  // Production pulse: hexes whose token matches the last roll (excluding robber).
  const pulseHexes = useMemo(() => {
    const rolledIdx = log.map((e: GameEvent) => e.type === 'rolled').lastIndexOf(true);
    if (rolledIdx === -1 || snap === null) return new Set<string>();
    const roll = log[rolledIdx] as Extract<GameEvent, { type: 'rolled' }> | undefined;
    if (roll === undefined) return new Set<string>();
    const sum = roll.die1 + roll.die2;
    const hexes = new Set<string>();
    for (const [hex, data] of Object.entries(snap.board.hexes)) {
      if (data.token === sum && hex !== snap.robber) hexes.add(hex);
    }
    return hexes;
  }, [log, snap]);

  if (snap === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#03111e] text-[#f6f8fa]">
        Loading game…
      </div>
    );
  }

  const myTurn = snap.activeSeat === mySeat;
  const sbpWindow = snap.specialBuildSeat === mySeat;
  const canAct = (myTurn && (snap.phase === 'turnMain' || snap.phase === 'turnPreroll')) || sbpWindow;
  const isSetupActor = (snap.phase === 'setupForward' || snap.phase === 'setupReverse') && myTurn;
  const robberPlacing = snap.phase === 'robberMove' && myTurn;

  const legalVertices =
    placement?.kind === 'settlement'
      ? legal.settlementVertices
      : placement?.kind === 'city'
        ? legal.cityVertices
        : isSetupActor
          ? legal.setupVertices
          : undefined;
  const legalEdges =
    placement?.kind === 'road'
      ? legal.roadEdges
      : isSetupActor && setupVertex !== null
        ? new Set(legal.setupRoadsForVertex(setupVertex))
        : undefined;
  const legalHexes = robberPlacing ? new Set(legalRobberHexes(snap as never)) : undefined;

  const onVertexClick = (vertex: number): void => {
    if (isSetupActor) {
      if (setupVertex === null) {
        setSetupVertex(vertex);
      }
      return;
    }
    if (placement?.kind === 'settlement' && legal.settlementVertices.has(vertex)) {
      const action: GameAction = { type: 'buildSettlement', vertex };
      sendAction(action);
      setPlacement(null);
    } else if (placement?.kind === 'city' && legal.cityVertices.has(vertex)) {
      const action: GameAction = { type: 'buildCity', vertex };
      sendAction(action);
      setPlacement(null);
    }
  };

  const onEdgeClick = (edge: string): void => {
    if (isSetupActor && setupVertex !== null) {
      const action: GameAction = {
        type: 'setupPlace',
        settlementVertex: setupVertex,
        roadEdge: edge,
      };
      sendAction(action);
      setSetupVertex(null);
      return;
    }
    if (placement?.kind === 'road' && legal.roadEdges.has(edge)) {
      const action: GameAction = { type: 'buildRoad', edge };
      sendAction(action);
      setPlacement(null);
    }
  };

  const onHexClick = (hex: string): void => {
    if (robberPlacing) {
      const action: GameAction = { type: 'moveRobber', hex };
      sendAction(action);
    }
  };

  const activePlayer = snap.players[snap.activeSeat]!;
  const me = snap.you;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#03111e] text-[#f6f8fa]">
      <ReconnectBanner />
      <ToastStack />

      {/* ============ TOP COCKPIT BAR (fixed) ============ */}
      <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-sky-800/60 bg-gradient-to-b from-[#0d3b66] to-[#08294a] px-4 shadow-lg">
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-4 w-4 rounded-full border border-black/50 shadow"
            style={{ background: PIECE_COLORS[activePlayer.color]?.main }}
          />
          <h1 className="font-[Bricolage_Grotesque,system-ui] text-lg font-bold leading-tight">
            {myTurn ? 'Your Turn' : `${activePlayer.name}'s Turn`}
          </h1>
          <span className="hidden rounded-md bg-black/30 px-2 py-0.5 text-xs text-sky-200 md:inline">
            {snap.phase === 'specialBuild'
              ? `SB: ${snap.specialBuildSeat !== null ? snap.players[snap.specialBuildSeat]!.name : 'passing'}`
              : snap.phase.replace(/([A-Z])/g, ' $1')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <DiceDisplay die1={snap.dice?.die1 ?? null} die2={snap.dice?.die2 ?? null} rolling={rolling} />
          <TurnTimer />
          {myTurn && snap.phase === 'turnPreroll' ? (
            <button
              type="button"
              onClick={() => {
                const action: GameAction = { type: 'rollDice' };
                sendAction(action);
              }}
              className="rounded-lg bg-[#f06800] px-4 py-2 text-sm font-bold shadow-md transition hover:bg-[#d05800]"
              data-testid="roll-button"
            >
              🎲 Roll
            </button>
          ) : null}
          {(myTurn && snap.phase === 'turnMain') || snap.trades.some((t) => t.status === 'open') ? (
            <button
              type="button"
              onClick={() => setTradeModal(true)}
              className="rounded-lg bg-[#1e90ff] px-3 py-2 text-sm font-bold shadow-md transition hover:brightness-110"
              data-testid="open-trade"
            >
              🔁 Trade
            </button>
          ) : null}
          {myTurn && snap.phase === 'turnMain' ? (
            <button
              type="button"
              onClick={() => {
                const action: GameAction = { type: 'endTurn' };
                sendAction(action);
              }}
              className="rounded-lg bg-[#1fab1c] px-4 py-2 text-sm font-bold shadow-md transition hover:brightness-110"
              data-testid="end-turn"
            >
              End Turn ➜
            </button>
          ) : null}
          {sbpWindow ? (
            <button
              type="button"
              onClick={() => {
                const action: GameAction = { type: 'specialBuildDone' };
                sendAction(action);
              }}
              className="rounded-lg bg-[#ef3f2a] px-3 py-2 text-sm font-bold shadow-md transition hover:brightness-110"
              data-testid="sbp-done"
            >
              Pass Window
            </button>
          ) : null}
        </div>
      </header>

      {/* ============ MAIN SPLIT: board canvas + right dock ============ */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* PAN & ZOOM CANVAS */}
        <div className="relative min-w-0 flex-1">
          <TransformWrapper
            initialScale={0.9}
            minScale={0.5}
            maxScale={2.6}
            centerOnInit
            limitToBounds={false}
            doubleClick={{ disabled: true }}
            wheel={{ step: 0.08 }}
            panning={{ velocityDisabled: false }}
          >
            <TransformComponent
              wrapperClass="!absolute inset-0 !w-full !h-full"
              contentClass="!w-full !h-full flex items-center justify-center"
            >
              <div className="h-full w-full">
                <Board3D
                  snap={snap}
                  legalVertices={legalVertices}
                  legalEdges={legalEdges}
                  legalHexes={legalHexes}
                  pulseHexes={pulseHexes}
                  onVertexClick={onVertexClick}
                  onEdgeClick={onEdgeClick}
                  onHexClick={onHexClick}
                />
              </div>
            </TransformComponent>
            <ZoomWidget />
          </TransformWrapper>

          {/* Contextual placement hints (fixed over canvas) */}
          {isSetupActor ? (
            <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-xl border border-amber-500/40 bg-[#04182a]/90 px-5 py-2 text-sm shadow-xl backdrop-blur-sm">
              {setupVertex === null
                ? 'Click a glowing spot to place your settlement'
                : 'Now click a glowing edge for your road'}
            </div>
          ) : null}
          {robberPlacing ? (
            <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-xl border border-red-500/50 bg-[#04182a]/90 px-5 py-2 text-sm shadow-xl backdrop-blur-sm">
              Move the robber — click a highlighted hex
            </div>
          ) : null}
        </div>

        {/* RIGHT DOCK: leaderboard + event feed (fixed) */}
        <aside
          className="z-20 flex w-80 shrink-0 flex-col gap-3 overflow-hidden border-l border-sky-800/60 bg-gradient-to-b from-[#0d3b66]/70 to-[#08294a]/70 p-3"
          data-testid="player-panel"
        >
          {/* Leaderboard */}
          <div className="rounded-xl border border-sky-700/50 bg-[#072644]/90 p-3 shadow-lg">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">Players</h2>
            <ul className="flex flex-col gap-1.5">
              {snap.players.map((p) => (
                <li
                  key={p.seat}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${
                    p.seat === snap.activeSeat ? 'bg-amber-500/15 ring-1 ring-amber-400/60' : 'bg-black/25'
                  } ${p.connected ? '' : 'opacity-50'}`}
                  data-testid={`panel-player-${p.seat}`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/50"
                      style={{ background: PIECE_COLORS[p.color]?.main }}
                    />
                    <span className="truncate font-medium">
                      {p.name}
                      {snap.longestRoad.holder === p.seat ? ' 🛣' : null}
                      {snap.largestArmy.holder === p.seat ? ' ⚔' : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-sky-200">
                    <span title="resource cards">🃏{p.resourceCount}</span>
                    <span title="dev cards">🎴{p.devCardCount}</span>
                    <b className="font-[Bricolage_Grotesque,system-ui] text-base text-amber-300">
                      {p.publicVp}
                    </b>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Own hand */}
          <div className="rounded-xl border border-sky-700/50 bg-[#072644]/90 p-3 shadow-lg" data-testid="own-hand">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              Your Hand — {me.totalVp} VP
            </h2>
            <div className="flex justify-between gap-1.5">
              {RESOURCE_KEYS.map((r) => (
                <span
                  key={r}
                  className="flex flex-col items-center rounded-lg bg-black/30 px-1.5 py-1 text-lg"
                  data-testid={`own-${r}`}
                >
                  {RESOURCE_EMOJI[r]}
                  <b className="text-sm">{me.resources[r]}</b>
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {me.devHand.length === 0 ? (
                <span className="text-xs text-slate-400">No development cards.</span>
              ) : null}
              {me.devHand.map((card) => {
                const icon =
                  card.type === 'knight'
                    ? '⚔'
                    : card.type === 'victoryPoint'
                      ? '🏆'
                      : card.type === 'roadBuilding'
                        ? '🛣'
                        : card.type === 'monopoly'
                          ? '👑'
                          : '🎁';
                const disabled =
                  !canAct || card.type === 'victoryPoint' || card.boughtOnTurn === snap.turn;
                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const action: GameAction = { type: 'playDevCard', cardId: card.id };
                      sendAction(action);
                    }}
                    className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                      disabled
                        ? 'bg-black/30 text-slate-500'
                        : 'bg-sky-800 text-sky-100 hover:bg-sky-600 hover:text-white'
                    }`}
                    data-testid={`dev-${card.id}`}
                    title={
                      card.boughtOnTurn === snap.turn && canAct
                        ? 'Purchased this turn — playable next turn'
                        : card.type
                    }
                  >
                    {icon} {card.type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Event log (flexible height) */}
          <EventLog />
        </aside>
      </div>

      {/* ============ BOTTOM COCKPIT DOCK (fixed) ============ */}
      <footer className="relative z-20 flex h-[104px] shrink-0 items-center justify-center border-t border-sky-800/60 bg-gradient-to-b from-[#0d3b66] to-[#08294a] shadow-[0_-6px_20px_rgba(0,0,0,0.45)]">
        <BuildBar
          mySeat={mySeat}
          canAct={canAct}
          legal={legal}
          onArm={(kind) => {
            setPlacement(placement?.kind === kind ? null : { kind });
          }}
        />
      </footer>

      {showTradeModal ? <TradeModal mySeat={mySeat} /> : null}
      <DiscardModal mySeat={mySeat} />
      <VictimPicker mySeat={mySeat} />
      <ProductionFloaters snap={snap} />
      <VictoryOverlay />
    </div>
  );
}
